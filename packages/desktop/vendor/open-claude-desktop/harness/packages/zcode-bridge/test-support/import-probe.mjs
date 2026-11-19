// End-to-end check of Settings › Code › Import sessions against the real bridge and the real ZCode agent:
// start the ZCode app-server bridge with an isolated data folder, detect nothing (no sources in the temp HOME),
// then import one normalized conversation through codeDesktop/history/import, read it back, and import it again to
// prove the second attempt is the same session. Not shipped: a local acceptance probe.
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
void require;
void root;
const data = await mkdtemp(join(tmpdir(), "xbuild-import-e2e-"));
const home = join(data, "home");
const child = spawn(process.execPath, [join(root, "bin/app-server.mjs"), "app-server", "--stdio"], {
  cwd: root,
  // The bridge and the ZCode agent share the user s real ZCode install (a temp HOME has no ~/.zcode, which the agent
  // needs to start), but every write lands in the temp ZCODE_DATA_BASE_DIR and bridge state folder.
  env: { ...process.env, ZCODE_DATA_BASE_DIR: join(data, "zcode"), CODE_DESKTOP_BRIDGE_STATE: join(data, "state"), CODE_DESKTOP_DATA_DIR: join(data, "app") },
  stdio: ["pipe", "pipe", "pipe"],
});
child.stderr.on("data", (chunk) => process.stderr.write(`[bridge] ${chunk}`));
const lines = readline.createInterface({ input: child.stdout });
const pending = new Map();
let id = 0;
lines.on("line", (line) => {
  let message; try { message = JSON.parse(line); } catch { return; }
  if (message.id !== undefined) { const entry = pending.get(message.id); pending.delete(message.id); if (message.error) entry.reject(new Error(`${message.error.code}: ${message.error.message}`)); else entry.resolve(message.result); }
});
const request = (method, params = {}, timeout = 120000) => new Promise((resolve, reject) => {
  const requestId = ++id;
  pending.set(requestId, { resolve, reject });
  child.stdin.write(`${JSON.stringify({ id: requestId, method, params })}\n`);
  setTimeout(() => { if (pending.delete(requestId)) reject(new Error(`${method} timed out`)); }, timeout).unref();
});

const fail = (message) => { console.error(`FAIL ${message}`); child.kill(); process.exitCode = 1; };
try {
  await request("initialize", { clientInfo: { name: "import-probe", version: "0" } });
  child.stdin.write(`${JSON.stringify({ method: "initialized", params: {} })}\n`);
  // A fresh id per run: the probe leaves a session in whatever ZCode store it points at (ZCODE_DATA_BASE_DIR).
  const stamp = randomUUID().slice(0, 8), sourceId = `probe-${stamp}`, target = `imported-claude-${stamp}`;
  const source = {
    source: "claude", sourceSessionId: sourceId, targetThreadId: target,
    title: "Cache layer", cwd: data, createdAt: Date.now() - 60_000, updatedAt: Date.now(),
    messages: [{ role: "user", content: "Add a cache layer", timestamp: Date.now() - 60_000 }, { role: "assistant", content: "Added cache.ts", timestamp: Date.now() - 59_000 }],
  };
  const write = (sessions) => request("codeDesktop/history/import", { sessions });
  const first = await write([source]);
  console.log("first import:", JSON.stringify(first));
  if (first?.imported !== 1) throw new Error("first import did not import the session");
  const threadId = first.sessions[0].targetThreadId;

  const read = await request("thread/read", { threadId, includeTurns: true });
  const items = (read?.thread?.turns ?? []).flatMap((turn) => turn.items ?? []);
  console.log("thread:", read?.thread?.id, "historyMode:", read?.thread?.historyMode, "importedFrom:", read?.thread?.codeDesktop?.importedFrom);
  console.log("items:", items.map((item) => `${item.type}:${(item.text ?? item.content?.map((part) => part.text).join("") ?? "").slice(0, 40)}`).join(" | "));
  if (read?.thread?.codeDesktop?.importedFrom !== "Claude Code") throw new Error("provenance missing");
  if (!items.some((item) => item.type === "userMessage") || !items.some((item) => item.type === "agentMessage")) throw new Error("imported transcript incomplete");

  const second = await write([source]);
  console.log("second import:", JSON.stringify(second));
  if (second?.skipped !== 1 || second.sessions[0].targetThreadId !== threadId) throw new Error("second import was not skipped");

  const listed = await request("thread/list", { limit: 10 });
  const rows = (listed?.data ?? []).filter((thread) => thread.id === threadId);
  console.log("thread/list sees the import:", rows.length, rows[0]?.codeDesktop ?? null);
  if (rows.length !== 1) throw new Error("imported session not listed");
  console.log("PASS import → continue-ready session, provenance, idempotent re-import");
} catch (error) {
  fail(error?.message ?? String(error));
} finally {
  child.kill();
  await rm(data, { recursive: true, force: true });
}
