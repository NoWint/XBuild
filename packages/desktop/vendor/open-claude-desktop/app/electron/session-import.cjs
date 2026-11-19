const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = fs.promises;
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");

const SOURCES = Object.freeze(["claude", "codex", "zcode", "deepseek"]);
const SOURCE_LABELS = Object.freeze({ claude: "Claude Code", codex: "Codex", zcode: "ZCode", deepseek: "DeepSeek Harness" });
const MAX_SESSIONS = 200;
// ZCode's SQLite is read newest first in batches of this many sessions (with their message and part ids), so a store
// with hundreds of thousands of parts answers the first list without reading all of them.
const ZCODE_BATCH = 20;
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
  // A tool's own output is not the user's words: tool_result holds what a command printed, so it never enters the
  // imported conversation (neither does a tool_use block's input, which can name a command).
  return value.map((part) => part?.type === "tool_result" || part?.type === "tool_use" ? "" : typeof part === "string" ? part : text(part?.text ?? (part?.type === "text" ? part?.content : null) ?? part?.input_text)).filter(Boolean).join("\n");
};
// What the user actually said: the tools' own protocol wrappers (Claude's IDE/command records, Codex's environment and
// instructions context, the AGENTS.md block Codex sends as a user message) never show as the user's words. Some records
// are nothing but a wrapper, and become empty, so the message is dropped rather than shown as an assertion of context.
const WRAPPERS = [/<ide_opened_file>[^]*?<\/ide_opened_file>/g, /<local-command[^>]*>[^]*?<\/local-command[^>]*>/g,
  /<environment_context>[^]*?<\/environment_context>/g, /<user_instructions>[^]*?<\/user_instructions>/g,
  /# AGENTS\.md instructions for [^\n]*\n[^]*?<\/INSTRUCTIONS>/g, /<INSTRUCTIONS>[^]*?<\/INSTRUCTIONS>/g];
const visibleText = (value) => WRAPPERS.reduce((text, pattern) => text.replace(pattern, ""), contentText(value)).trim();
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
    // An import never presents a live conversation as a finished one: a log that opens a turn without closing it, or
    // one whose rollout is written elsewhere, is offered as running and skipped. A finished turn leaves it completed.
    const starts = [];
    rows.forEach((row, index) => { if (row.type === "event_msg" && ["task_started", "turn_started"].includes(row.payload?.type)) starts.push(index); });
    const closedAfter = (index) => rows.slice(index + 1).some((row) => row.type === "event_msg" && ["task_complete", "task_completed", "turn_completed", "turn_aborted", "turn_failed"].includes(row.payload?.type));
    const running = starts.length > 0 && !closedAfter(starts[starts.length - 1]);
    // response_item rows hold the transcript: role "user"/"assistant" messages only (Codex's "developer" messages are its
    // own instructions), and event_msg items from a newer Codex that carries the same messages.
    const messages = normalizeMessages(rows.map((row) => {
      const payload = row.type === "response_item" ? row.payload : row.type === "event_msg" ? row.payload?.item : null;
      const role = payload?.type === "message" && payload?.role === "user" ? "user" : payload?.type === "message" && payload?.role === "assistant" ? "assistant"
        : payload?.type === "UserMessage" ? "user" : payload?.type === "AgentMessage" ? "assistant" : null;
      return { role, content: payload?.content ?? payload?.text, timestamp: eventTime(row) };
    }).filter((row) => row.role), "codex");
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
    // Newest first, and only as many sessions as the list needs: a store of hundreds of thousands of parts is read
    // from its newest sessions down, not whole (SQLite's session index supplies the order).
    const rows = db.prepare("select * from session where time_deleted is null order by time_updated desc").all();
    if (!rows.length) return [];
    const out = [];
    for (let start = 0; start < rows.length && out.length < limit; start += ZCODE_BATCH) {
      const batch = rows.slice(start, start + ZCODE_BATCH);
      const marked = batch.map(() => "?").join(",");
      // Two statements for the batch, never one per session: the messages (message.session_id), then the text parts of
      // exactly those messages (part.message_id). A join would walk part once per message.
      const transcripts = new Map();
      const messageById = new Map();
      for (const entry of db.prepare(`select id, session_id, data from message where session_id in (${marked})
        order by session_id, sequence, time_created, id`).iterate(...batch.map((row) => row.id))) {
        const meta = safeJson(entry.data) || {};
        const message = { role: meta.role, content: "", timestamp: finiteTime(meta.time?.created || meta.createdAt) };
        messageById.set(entry.id, message);
        const list = transcripts.get(entry.session_id) ?? [];
        list.push(message);
        transcripts.set(entry.session_id, list);
      }
      const messageIds = [...messageById.keys()];
      for (let offset = 0; offset < messageIds.length; offset += ZCODE_BATCH) {
        const chunk = messageIds.slice(offset, offset + ZCODE_BATCH);
        for (const entry of db.prepare(`select message_id, data from part where message_id in (${chunk.map(() => "?").join(",")})
          order by message_id, sequence, time_created, id`).iterate(...chunk)) {
          const part = safeJson(entry.data);
          if (!part || (part.type !== undefined && part.type !== "text")) continue;
          const value = part.text ?? part.content;
          const message = messageById.get(entry.message_id);
          if (message && typeof value === "string" && value) message.content = `${message.content}\n${value}`;
        }
      }
      for (const row of batch) {
        if (out.length >= limit) break;
        const data = safeJson(row.data) || {};
        const normalized = normalizeMessages(transcripts.get(row.id) ?? [], "zcode");
        if (!normalized.length) continue;
        out.push(candidate({ source: "zcode", id: row.id, file: dbPath, cwd: row.directory || row.path, title: row.title || data.title,
          createdAt: finiteTime(row.time_created), updatedAt: finiteTime(row.time_updated), messages: normalized }));
      }
    }
    return out;
  } catch { return []; } finally { try { db?.close(); } catch {} }
}

// A DeepSeek Harness log is a concatenation of independent Zstandard frames (a header frame, then one per append batch;
// the README's "Physical encoding"). zstdDecompressSync stops after the first frame, so the frames are walked by their
// own frame headers and each one decoded: an undecodable frame is skipped, a torn last frame simply contributes nothing.
const ZSTD_MAGIC = 0xfd2fb528;
function decodeZstdFrames(buffer) {
  const chunks = [];
  let offset = 0;
  while (offset + 4 <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) { offset += 1; continue; }
    let end = offset + 4;
    try {
      // Frame header: a 1-byte descriptor sets whether a 1/2/4-byte content size and a dictionary id follow.
      const descriptor = buffer[offset + 4];
      const singleSegment = (descriptor >> 5) & 1, checksum = (descriptor >> 2) & 1, dictFlag = descriptor & 3;
      const sizeFlag = descriptor >> 6;
      let header = 5;
      if (!singleSegment) header += 1;
      header += [0, 1, 2, 4][dictFlag];
      header += [singleSegment ? 1 : 0, 2, 4, 8][sizeFlag];
      end = offset + header;
      // Blocks until the last one; each block header is 3 bytes little-endian (last bit, type, size).
      for (;;) {
        if (end + 3 > buffer.length) throw new Error("truncated");
        const block = buffer[end] | (buffer[end + 1] << 8) | (buffer[end + 2] << 16);
        end += 3 + (block >>> 3);
        if (end > buffer.length) throw new Error("truncated");
        if (block & 1) break;
      }
      if (checksum) end += 4;
      if (end > buffer.length) throw new Error("truncated");
      chunks.push(zlib.zstdDecompressSync(buffer.subarray(offset, end)).toString("utf8"));
      offset = end;
    } catch { break; }
  }
  return chunks.join("");
}
const decodeDsh = (buffer, file) => {
  if (!file.endsWith(".zstd")) return buffer.toString("utf8");
  const frames = decodeZstdFrames(buffer);
  if (frames) return frames;
  try { return zlib.zstdDecompressSync(buffer).toString("utf8"); } catch { return ""; }
};
// A Harness event row is {type, seq, time, data} (dsh-session types): user/message and assistant/message carry the text,
// turn/end or session/end-seed close the log. A log whose last turn/start has no turn/end is still running.
function deepseekEventText(data) {
  const value = data?.message ?? data ?? {};
  return value.content ?? value.text ?? value.parts ?? (typeof value === "string" ? value : "");
}
async function deepseekCandidates(home, limit) {
  const files = await listFiles(path.join(home, ".dsh", "sessions"), (file) => /session(?:\.v\d+)?\.jsonl(?:\.zstd)?$/.test(file), limit);
  const out = [];
  for (const file of files) {
    let buffer; try { buffer = await fsp.readFile(file); } catch { continue; }
    const rows = decodeDsh(buffer, file).split(/\r?\n/).map(safeJson).filter(Boolean);
    const header = rows.find((row) => row.type === "session") || {};
    const id = text(header.id); if (!id) continue;
    const starts = rows.filter((row) => row.type === "turn/start").length;
    const ends = rows.filter((row) => row.type === "turn/end").length;
    const ended = rows.some((row) => row.type === "session/end-seed" || row.type === "session/end");
    // Only what the person typed (source.kind "user"; "user-approval" and the runtime-context snapshots Harness injects
    // as user messages are protocol, not their words) and the assistant's replies; tool calls and results stay behind.
    const messages = normalizeMessages(rows.map((row) => {
      const kind = row.data?.source?.kind ?? row.data?.message?.source?.kind;
      const role = row.type === "user/message" ? (kind && kind !== "user" ? null : "user") : row.type === "assistant/message" ? "assistant" : null;
      return { role, content: deepseekEventText(row.data), timestamp: finiteTime(row.time) };
    }).filter((row) => row.role), "deepseek");
    if (!messages.length) continue;
    out.push(candidate({ source: "deepseek", id, file, cwd: header.cwd, title: text(header.title), createdAt: finiteTime(header.createdAt),
      updatedAt: finiteTime(rows.at(-1)?.time), status: ended || ends >= starts ? "completed" : "running", messages }));
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
// What the running core is handed for one source session: the inert, ordered user/assistant text only. A source's
// tool calls, command output and attachments are never sent, so the core has nothing to replay and no source file is
// written by the import (the adapters above only ever read).
function importPayload(item) {
  return { source: item.source, sourceSessionId: item.sourceSessionId, targetThreadId: item.targetThreadId, title: item.title,
    cwd: item.cwd, createdAt: item.createdAt, updatedAt: item.updatedAt,
    messages: item.messages.map((message) => ({ role: message.role, content: message.content, ...(Number.isFinite(message.timestamp) ? { timestamp: message.timestamp } : {}) })) };
}

/**
 * The import's outcome per source. `write` sends the not-yet-imported sessions to the running core
 * (codeDesktop/history/import) and answers per session; sessions the core reports imported are recorded in the ledger,
 * so a second import skips them and answers the same target id. A source session whose status is running is skipped
 * and never handed over: an import must not claim a live source session is finished.
 */
async function importStats(sessions, ledger, write) {
  const stats = { scanned: sessions.length, imported: 0, skipped: 0, failed: 0, sessions: [] };
  const pending = [];
  for (const item of sessions) {
    const existing = ledger.sessions[item.sourceKey];
    if (item.status === "running") { stats.skipped++; stats.sessions.push({ sourceSessionId: item.sourceSessionId, status: "skipped", reason: "running" }); continue; }
    if (existing) { stats.skipped++; stats.sessions.push({ sourceSessionId: item.sourceSessionId, targetThreadId: existing.targetThreadId, status: "skipped", reason: "already-imported" }); continue; }
    pending.push(item);
  }
  if (!pending.length || !write) { stats.failed += pending.length; for (const item of pending) stats.sessions.push({ sourceSessionId: item.sourceSessionId, status: "failed", reason: "no-core" }); return stats; }
  const answer = await write(pending.map(importPayload));
  const byId = new Map((Array.isArray(answer?.sessions) ? answer.sessions : []).map((entry) => [String(entry?.sourceSessionId ?? ""), entry]));
  for (const item of pending) {
    const entry = byId.get(item.sourceSessionId);
    if (entry?.status === "imported") {
      stats.imported++;
      stats.sessions.push({ sourceSessionId: item.sourceSessionId, targetThreadId: entry.targetThreadId || item.targetThreadId, status: "imported" });
      ledger.sessions[item.sourceKey] = { source: item.source, sourceSessionId: item.sourceSessionId, targetThreadId: entry.targetThreadId || item.targetThreadId, importedAt: Date.now(), record: item };
    } else if (entry?.status === "skipped") {
      stats.skipped++;
      stats.sessions.push({ sourceSessionId: item.sourceSessionId, targetThreadId: entry.targetThreadId ?? null, status: "skipped", reason: entry.reason || "already-imported" });
    } else {
      stats.failed++;
      stats.sessions.push({ sourceSessionId: item.sourceSessionId, status: "failed", reason: entry?.reason || "not-imported" });
    }
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
    // write: (payloads) => the core's codeDesktop/history/import answer. Without it nothing is imported (and nothing is
    // recorded), so a failed core never leaves a ledger entry claiming a session exists.
    async import(requested = SOURCES, write = null) {
      const detected = await this.detect(requested);
      const ledger = state();
      const result = {};
      for (const source of Object.keys(detected)) {
        const stats = await importStats(detected[source].sessions, ledger, write);
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

module.exports = { SOURCES, SOURCE_LABELS, createManager, discoverSource, importedId, sourceId, sanitizeCandidate, normalizeMessages, sourceLabel, importPayload };
