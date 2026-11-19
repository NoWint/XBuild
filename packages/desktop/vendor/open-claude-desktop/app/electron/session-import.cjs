const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = fs.promises;
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");

const SOURCES = Object.freeze(["claude", "codex", "zcode", "deepseek"]);
const SOURCE_LABELS = Object.freeze({ claude: "Claude Code", codex: "Codex", zcode: "ZCode", deepseek: "DeepSeek Harness" });
const MAX_SESSIONS = 200;
const MAX_MESSAGES = 2000;
const MAX_LINE_BYTES = 2 * 1024 * 1024;
const LEDGER_VERSION = 1;

const text = (value) => typeof value === "string" ? value : "";
const finiteTime = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value > 10_000_000_000 ? value : value * 1000;
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return finiteTime(numeric);
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};
const hash = (value, length = 24) => crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, length);
const sourceLabel = (source) => SOURCE_LABELS[source] || source;
const sourceId = (source, id) => `${source}:${String(id)}`;
const importedId = (source, id) => `imported-${source}-${hash(sourceId(source, id), 32)}`;
const normalizePath = (value) => {
  if (typeof value !== "string" || !value || value.includes("\0") || !path.isAbsolute(value)) return null;
  try { return fs.realpathSync(value); } catch { return null; }
};
const inside = (target, root) => {
  const relative = path.relative(root, target);
  return relative === "" || (relative && !relative.startsWith("..") && !path.isAbsolute(relative));
};
const homeDirs = (env = process.env) => [...new Set([env.HOME, os.homedir()].filter((value) => typeof value === "string" && value))];
const safeJson = (value) => { try { return JSON.parse(value); } catch { return null; } };
const safeRead = async (file) => { try { return await fsp.readFile(file, "utf8"); } catch { return null; } };
const listFiles = async (root, predicate, limit = MAX_SESSIONS) => {
  const found = [];
  const walk = async (dir) => {
    if (found.length >= limit) return;
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (found.length >= limit) return;
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile() && predicate(full)) found.push(full);
    }
  };
  await walk(root);
  return found;
};
const readJsonLines = async (file, maxLines = 10000) => {
  const raw = await safeRead(file);
  if (raw === null || Buffer.byteLength(raw) > 32 * 1024 * 1024) return [];
  return raw.split(/\r?\n/).slice(0, maxLines).map((line) => {
    if (!line || Buffer.byteLength(line) > MAX_LINE_BYTES) return null;
    return safeJson(line);
  }).filter(Boolean);
};
const contentText = (value) => {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map((part) => typeof part === "string" ? part : text(part?.text ?? part?.content ?? part?.input_text)).filter(Boolean).join("\n");
};
const visibleText = (value) => contentText(value).replace(/<ide_opened_file>[^]*?<\/ide_opened_file>/g, "").replace(/<local-command[^>]*>[^]*?<\/local-command[^>]*>/g, "").trim();
const eventTime = (row) => finiteTime(row?.timestamp ?? row?.createdAt ?? row?.created_at ?? row?.time?.created ?? row?.message?.timestamp ?? row?.payload?.timestamp);
const finalTitle = (messages, fallback) => {
  const first = messages.find((message) => message.role === "user" && message.content.trim());
  const value = first?.content.trim().replace(/\s+/g, " ");
  return (value ? value.slice(0, 96) : fallback) || "Imported session";
};
const normalizeMessage = (role, content, timestamp) => ({ role, content: content.trim().slice(0, 100_000), timestamp: timestamp || Date.now() });
const normalizeMessages = (rows, source) => {
  const messages = [];
  for (const row of rows) {
    const role = row?.role === "user" || row?.role === "assistant" ? row.role : null;
    if (!role) continue;
    const content = visibleText(row.content);
    if (!content) continue;
    const previous = messages.at(-1);
    if (previous?.role === role && role === "assistant") previous.content = `${previous.content}\n\n${content}`.slice(0, 100_000);
    else messages.push(normalizeMessage(role, content, finiteTime(row.timestamp)));
  }
  return messages.slice(0, MAX_MESSAGES);
};
const candidate = ({ source, id, file, cwd, title, createdAt, updatedAt, status = "completed", messages = [], skipped = 0 }) => ({
  source, sourceSessionId: String(id), sourceKey: sourceId(source, id), targetThreadId: importedId(source, id), file,
  cwd: normalizePath(cwd) || null, title: finalTitle(messages, title || `${sourceLabel(source)} session`), createdAt: createdAt || updatedAt || Date.now(),
  updatedAt: updatedAt || createdAt || Date.now(), status, messages, skipped,
});

async function claudeCandidates(home, limit) {
  const root = path.join(home, ".claude", "projects");
  const files = await listFiles(root, (file) => file.endsWith(".jsonl") && !file.includes(`${path.sep}subagents${path.sep}`) && !file.includes(`${path.sep}worktrees${path.sep}`), limit);
  const out = [];
  for (const file of files) {
    const rows = await readJsonLines(file, 80);
    const meta = rows.find((row) => row.type === "session_meta" || row.type === "session") || {};
    const id = text(meta.session_id || meta.sessionId || path.basename(file, ".jsonl"));
    if (!id || rows.some((row) => row.isSidechain || row.is_sidechain || row.message?.isSidechain)) continue;
    const cwd = rows.map((row) => row.cwd || row.message?.cwd || row.request?.cwd).find(Boolean);
    const messages = normalizeMessages(rows.map((row) => {
      const role = row.type === "user" || row.message?.role === "user" ? "user" : row.type === "assistant" || row.message?.role === "assistant" ? "assistant" : null;
      return { role, content: row.message?.content ?? row.request?.prompt ?? row.content, timestamp: eventTime(row) };
    }), "claude");
    if (!messages.length) continue;
    const stat = await fsp.stat(file).catch(() => null);
    out.push(candidate({ source: "claude", id, file, cwd, title: text(meta.title), createdAt: eventTime(rows[0]), updatedAt: eventTime(rows.at(-1)) || stat?.mtimeMs, messages }));
  }
  return out;
}

async function codexCandidates(home, limit) {
  const root = path.join(home, ".codex", "sessions");
  const files = await listFiles(root, (file) => /rollout-.*\.jsonl$/.test(file), limit);
  const out = [];
  for (const file of files) {
    const rows = await readJsonLines(file, 10000);
    const meta = rows.find((row) => row.type === "session_meta")?.payload || {};
    const id = text(meta.session_id || meta.id || path.basename(file, ".jsonl").replace(/^rollout-/, ""));
    if (!id) continue;
    const running = rows.some((row) => row.type === "event_msg" && ["task_started", "turn_started"].includes(row.payload?.type)) && !rows.some((row) => row.type === "event_msg" && ["task_complete", "task_completed", "turn_completed", "turn_aborted"].includes(row.payload?.type));
    const messages = normalizeMessages(rows.map((row) => {
      const payload = row.type === "response_item" ? row.payload : row.payload?.item || row.payload;
      const role = payload?.role === "user" ? "user" : payload?.role === "assistant" ? "assistant" : payload?.type === "message" && payload?.role === "user" ? "user" : payload?.type === "message" && payload?.role === "assistant" ? "assistant" : null;
      return { role, content: payload?.content || payload?.text, timestamp: eventTime(row) };
    }), "codex");
    if (!messages.length) continue;
    out.push(candidate({ source: "codex", id, file, cwd: meta.cwd, title: text(meta.title), createdAt: finiteTime(meta.timestamp), updatedAt: eventTime(rows.at(-1)), status: running ? "running" : "completed", messages }));
  }
  return out;
}

async function zcodeCandidates(home, limit) {
  const candidates = [path.join(home, ".zcode", "cli", "db", "db.sqlite"), path.join(home, ".xbuild", "cli", "db", "db.sqlite")];
  const dbPath = candidates.find((file) => fs.existsSync(file));
  if (!dbPath) return [];
  let sqlite;
  try { sqlite = await import("node:sqlite"); } catch { return []; }
  let db;
  try {
    db = new sqlite.DatabaseSync(dbPath, { readOnly: true });
    db.exec("PRAGMA busy_timeout = 2000");
    const sessionColumns = new Set(db.prepare("PRAGMA table_info(session)").all().map((row) => row.name));
    if (!sessionColumns.has("id")) return [];
    const rows = db.prepare("select * from session where time_deleted is null order by time_updated desc limit ?").all(limit);
    const messages = db.prepare("select id, data from message where session_id = ? order by sequence, time_created, id");
    const parts = db.prepare("select data from part where message_id = ? order by sequence, time_created, id");
    return rows.map((row) => {
      const data = safeJson(row.data) || {};
      const rowsForSession = messages.all(row.id).map((message) => {
        const info = safeJson(message.data) || {};
        const content = parts.all(message.id).map((part) => safeJson(part.data)).map((part) => part?.text || part?.content).filter(Boolean).join("\n");
        return { role: info.role, content, timestamp: finiteTime(info.time?.created || info.createdAt) };
      });
      const normalized = normalizeMessages(rowsForSession, "zcode");
      return normalized.length ? candidate({ source: "zcode", id: row.id, file: dbPath, cwd: row.directory || row.path, title: row.title || data.title, createdAt: finiteTime(row.time_created), updatedAt: finiteTime(row.time_updated), messages: normalized }) : null;
    }).filter(Boolean);
  } catch { return []; } finally { try { db?.close(); } catch {} }
}

const decodeDsh = (buffer, file) => {
  if (file.endsWith(".zstd")) { try { return zlib.zstdDecompressSync(buffer).toString("utf8"); } catch { return ""; } }
  return buffer.toString("utf8");
};
async function deepseekCandidates(home, limit) {
  const roots = [path.join(home, ".dsh", "sessions"), path.join(home, ".dsh")];
  const files = [];
  for (const root of roots) files.push(...await listFiles(root, (file) => /session(?:\.v\d+)?\.jsonl(?:\.zstd)?$/.test(file), limit - files.length));
  const out = [];
  for (const file of [...new Set(files)].slice(0, limit)) {
    let buffer; try { buffer = await fsp.readFile(file); } catch { continue; }
    const rows = decodeDsh(buffer, file).split(/\r?\n/).map(safeJson).filter(Boolean);
    const header = rows.find((row) => row.type === "session") || {};
    const id = text(header.id); if (!id) continue;
    const ended = rows.some((row) => row.type === "session/end-seed" || row.type === "session/end");
    const messages = normalizeMessages(rows.map((row) => ({ role: row.type === "user/message" ? "user" : row.type === "assistant/message" ? "assistant" : null, content: row.text || row.content || row.message?.content, timestamp: eventTime(row) })), "deepseek");
    if (!messages.length) continue;
    out.push(candidate({ source: "deepseek", id, file, cwd: header.cwd, title: text(header.title), createdAt: finiteTime(header.createdAt), updatedAt: eventTime(rows.at(-1)), status: ended ? "completed" : "running", messages }));
  }
  return out;
}

async function discoverSource(source, { env = process.env, limit = MAX_SESSIONS } = {}) {
  const home = homeDirs(env)[0] || os.homedir();
  if (source === "claude") return claudeCandidates(home, limit);
  if (source === "codex") return codexCandidates(home, limit);
  if (source === "zcode") return zcodeCandidates(home, limit);
  if (source === "deepseek") return deepseekCandidates(home, limit);
  throw new Error(`Unsupported session import source: ${source}`);
}

function readLedger(file) {
  try { const value = JSON.parse(fs.readFileSync(file, "utf8")); return value?.version === LEDGER_VERSION ? value : { version: LEDGER_VERSION, sessions: {} }; } catch { return { version: LEDGER_VERSION, sessions: {} }; }
}
function writeLedger(file, ledger) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(ledger, null, 2), { mode: 0o600 });
  fs.renameSync(temp, file);
}
function sanitizeCandidate(item) {
  return { source: item.source, sourceSessionId: item.sourceSessionId, sourceKey: item.sourceKey, targetThreadId: item.targetThreadId, title: item.title, cwd: item.cwd, createdAt: item.createdAt, updatedAt: item.updatedAt, status: item.status, messages: item.messages, skipped: item.skipped || 0 };
}
function importStats(sessions, ledger) {
  const stats = { scanned: sessions.length, imported: 0, skipped: 0, failed: 0, sessions: [] };
  for (const item of sessions) {
    const existing = ledger.sessions[item.sourceKey];
    if (item.status === "running") { stats.skipped++; stats.sessions.push({ sourceSessionId: item.sourceSessionId, status: "skipped", reason: "running" }); continue; }
    if (existing) { stats.skipped++; stats.sessions.push({ sourceSessionId: item.sourceSessionId, targetThreadId: existing.targetThreadId, status: "skipped", reason: "already-imported" }); continue; }
    stats.imported++; stats.sessions.push({ sourceSessionId: item.sourceSessionId, targetThreadId: item.targetThreadId, status: "imported" });
  }
  return stats;
}

function createManager({ file, env = process.env } = {}) {
  const ledgerFile = file;
  const state = () => readLedger(ledgerFile);
  return {
    sources: SOURCES,
    labels: SOURCE_LABELS,
    async detect(requested = SOURCES) {
      const sources = [...new Set((Array.isArray(requested) ? requested : SOURCES).map((source) => String(source).trim().toLowerCase()).filter((source) => SOURCES.includes(source)))];
      const result = {};
      for (const source of sources) {
        const sessions = await discoverSource(source, { env });
        result[source] = { source, label: sourceLabel(source), scanned: sessions.length, sessions: sessions.map(sanitizeCandidate), error: null };
      }
      return result;
    },
    async import(requested = SOURCES) {
      const detected = await this.detect(requested);
      const ledger = state();
      const result = {};
      for (const source of Object.keys(detected)) {
        const sessions = detected[source].sessions;
        const stats = importStats(sessions, ledger);
        for (const item of sessions) {
          if (item.status === "running" || ledger.sessions[item.sourceKey]) continue;
          ledger.sessions[item.sourceKey] = { source: item.source, sourceSessionId: item.sourceSessionId, targetThreadId: item.targetThreadId, importedAt: Date.now(), record: item };
        }
        result[source] = { ...stats, label: detected[source].label };
      }
      writeLedger(ledgerFile, ledger);
      return result;
    },
    get(id) { return state().sessions[id] || null; },
    all() { return Object.values(state().sessions); },
    file: ledgerFile,
  };
}

module.exports = { SOURCES, SOURCE_LABELS, createManager, discoverSource, importedId, sourceId, sanitizeCandidate, normalizeMessages, sourceLabel };
