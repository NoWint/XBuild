import { createRequire } from "node:module";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const sessionImport = require("../vendor/open-claude-desktop/app/electron/session-import.cjs");
const { SOURCES, createManager, discoverSource, importedId, sourceId } = sessionImport;

let home: string;
let ledgerFile: string;

const jsonl = (rows: unknown[]) => rows.map((row) => JSON.stringify(row)).join("\n") + "\n";

async function claudeFixture() {
  const dir = join(home, ".claude", "projects", "-Users-someone-work--demo");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "11111111-1111-4111-8111-111111111111.jsonl"), jsonl([
    { type: "user", cwd: "/tmp", timestamp: "2026-01-01T10:00:00.000Z", message: { role: "user", content: "Fix the login bug" } },
    { type: "assistant", timestamp: "2026-01-01T10:00:05.000Z", message: { role: "assistant", content: [{ type: "text", text: "I found it in auth.ts." }, { type: "tool_use", name: "Bash", input: { command: "rm -rf /" } }] } },
    { type: "user", timestamp: "2026-01-01T10:00:06.000Z", message: { role: "user", content: [{ type: "tool_result", content: "output" }] } },
  ]));
  // A sidechain is a sub-agent transcript, never a session of its own.
  await writeFile(join(dir, "22222222-2222-4222-8222-222222222222.jsonl"), jsonl([
    { type: "user", isSidechain: true, timestamp: "2026-01-01T10:00:00.000Z", message: { role: "user", content: "sub-agent work" } },
  ]));
}

async function codexFixture({ running = false } = {}) {
  const dir = join(home, ".codex", "sessions", "2026", "01", "02");
  await mkdir(dir, { recursive: true });
  const id = "0199aaaa-bbbb-7ccc-8ddd-eeeeeeeeeeee";
  const rows: unknown[] = [
    { timestamp: "2026-01-02T09:00:00.000Z", type: "session_meta", payload: { session_id: id, id, cwd: "/tmp", timestamp: "2026-01-02T09:00:00.000Z" } },
    { timestamp: "2026-01-02T09:00:01.000Z", type: "response_item", payload: { type: "message", role: "developer", content: [{ type: "input_text", text: "You are Codex." }] } },
    { timestamp: "2026-01-02T09:00:02.000Z", type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "<environment_context>\n  <cwd>/tmp</cwd>\n</environment_context>" }] } },
    { timestamp: "2026-01-02T09:00:03.000Z", type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "Add a cache layer" }] } },
    { timestamp: "2026-01-02T09:00:09.000Z", type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "Done: cache.ts." }] } },
    { timestamp: "2026-01-02T09:00:10.000Z", type: "event_msg", payload: { type: "item_completed", item: { type: "CommandExecution", command: ["rm", "-rf", "/"], stdout: "x" } } },
  ];
  if (!running) rows.push({ timestamp: "2026-01-02T09:01:00.000Z", type: "event_msg", payload: { type: "task_complete" } });
  // A turn Codex opened and never closed: the rollout an install leaves behind while the session is still running.
  else rows.push({ timestamp: "2026-01-02T09:00:11.000Z", type: "event_msg", payload: { type: "task_started" } });
  await writeFile(join(dir, `rollout-2026-01-02T09-00-00-${id}.jsonl`), jsonl(rows));
  return id;
}

async function deepseekFixture({ finished = true } = {}) {
  const dir = join(home, ".dsh", "sessions", "--tmp--", "session-dsh-1");
  await mkdir(dir, { recursive: true });
  // The Harness log is independent zstd frames (header frame, then one per append batch): both must be read.
  const zlib = await import("node:zlib");
  const frames = [
    JSON.stringify({ type: "session", version: 4, id: "session-dsh-1", createdAt: 1_767_000_000_000, cwd: "/tmp" }),
    JSON.stringify({ type: "turn/start", seq: 0, time: 1_767_000_000_001 }),
    JSON.stringify({ type: "user/message", seq: 1, time: 1_767_000_000_002, data: { role: "user", content: [{ type: "text", text: "The approval policy changed (changed by the user)." }], source: { kind: "user-approval" } } }),
    JSON.stringify({ type: "user/message", seq: 2, time: 1_767_000_000_003, data: { role: "user", content: [{ type: "text", text: "Summarize the release notes" }], source: { kind: "user" } } }),
    JSON.stringify({ type: "tool/call", seq: 3, time: 1_767_000_000_004, data: { name: "shell", arguments: { command: "rm -rf /" } } }),
    JSON.stringify({ type: "assistant/message", seq: 4, time: 1_767_000_000_005, data: { content: [{ type: "text", text: "Here is the summary." }] } }),
    ...(finished ? [JSON.stringify({ type: "turn/end", seq: 5, time: 1_767_000_000_006 })] : []),
  ];
  const bytes = Buffer.concat(frames.map((frame) => zlib.zstdCompressSync(Buffer.from(`${frame}\n`))));
  await writeFile(join(dir, "session.v4.jsonl.zstd"), bytes);
}

async function zcodeFixture() {
  const dir = join(home, ".zcode", "cli", "db");
  await mkdir(dir, { recursive: true });
  const db = new DatabaseSync(join(dir, "db.sqlite"));
  db.exec(`
    create table session (id text primary key, title text, directory text, time_created integer, time_updated integer, time_deleted integer);
    create table message (id text primary key, session_id text, data text, sequence integer, time_created integer);
    create table part (id text primary key, message_id text, data text, sequence integer, time_created integer);
  `);
  db.prepare("insert into session values (?,?,?,?,?,null)").run("sess_zcode_1", "Refactor the parser", "/tmp", 1_767_000_000_000, 1_767_000_000_900);
  db.prepare("insert into message values (?,?,?,?,?)").run("m1", "sess_zcode_1", JSON.stringify({ role: "user", time: { created: 1_767_000_000_100 } }), 1, 1_767_000_000_100);
  db.prepare("insert into part values (?,?,?,?,?)").run("p1", "m1", JSON.stringify({ type: "text", text: "Refactor the parser" }), 1, 1_767_000_000_100);
  db.prepare("insert into message values (?,?,?,?,?)").run("m2", "sess_zcode_1", JSON.stringify({ role: "assistant", time: { created: 1_767_000_000_200 } }), 2, 1_767_000_000_200);
  db.prepare("insert into part values (?,?,?,?,?)").run("p2", "m2", JSON.stringify({ type: "text", text: "Extracted the reader." }), 1, 1_767_000_000_200);
  db.prepare("insert into part values (?,?,?,?,?)").run("p3", "m2", JSON.stringify({ type: "tool", tool: "bash", state: { status: "completed", input: { command: "rm -rf /" } } }), 2, 1_767_000_000_200);
  db.close();
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "xbuild-session-import-"));
  ledgerFile = join(home, "data", "session-imports.json");
});
afterEach(async () => {
  await rm(home, { recursive: true, force: true });
});

describe("session import readers", () => {
  it("reads Claude Code JSONL as visible text, without sidechains or tool results", async () => {
    await claudeFixture();
    const rows = await discoverSource("claude", { env: { HOME: home } });
    expect(rows.map((row) => row.sourceSessionId)).toEqual(["11111111-1111-4111-8111-111111111111"]);
    expect(rows[0].messages).toEqual([
      expect.objectContaining({ role: "user", content: "Fix the login bug" }),
      expect.objectContaining({ role: "assistant", content: "I found it in auth.ts." }),
    ]);
    expect(rows[0].title).toBe("Fix the login bug");
  });

  it("reads Codex rollout JSONL, dropping its developer and environment context", async () => {
    const id = await codexFixture();
    const rows = await discoverSource("codex", { env: { HOME: home } });
    expect(rows).toHaveLength(1);
    expect(rows[0].sourceSessionId).toBe(id);
    expect(rows[0].messages.map((message) => message.content)).toEqual(["Add a cache layer", "Done: cache.ts."]);
    expect(rows[0].status).toBe("completed");
  });

  it("offers a Codex turn that never finished as running", async () => {
    await codexFixture({ running: true });
    const rows = await discoverSource("codex", { env: { HOME: home } });
    expect(rows[0].status).toBe("running");
  });

  it("reads ZCode's SQLite history (text parts only)", async () => {
    await zcodeFixture();
    const rows = await discoverSource("zcode", { env: { HOME: home } });
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Refactor the parser");
    expect(rows[0].messages.map((message) => message.content)).toEqual(["Refactor the parser", "Extracted the reader."]);
  });

  it("decodes every zstd frame of a DeepSeek Harness log, keeping only the user's own messages", async () => {
    await deepseekFixture();
    const rows = await discoverSource("deepseek", { env: { HOME: home } });
    expect(rows).toHaveLength(1);
    expect(rows[0].messages.map((message) => message.content)).toEqual(["Summarize the release notes", "Here is the summary."]);
    expect(rows[0].status).toBe("completed");
  });

  it("marks a DeepSeek log without turn/end as running", async () => {
    await deepseekFixture({ finished: false });
    const rows = await discoverSource("deepseek", { env: { HOME: home } });
    expect(rows[0].status).toBe("running");
  });

  it("reports an empty source instead of failing when nothing is installed", async () => {
    const rows = await discoverSource("claude", { env: { HOME: home } });
    expect(rows).toEqual([]);
  });

  it("namespaces the target session by source, so equal ids stay distinct", () => {
    expect(importedId("codex", "same")).not.toBe(importedId("zcode", "same"));
    expect(importedId("codex", "same")).toBe(importedId("codex", "same"));
    expect(sourceId("claude", "x")).toBe("claude:x");
  });
});

describe("session import ledger", () => {
  const writer = (calls: any[][]) => async (sessions: any[]) => {
    calls.push(sessions);
    return { imported: sessions.length, skipped: 0, failed: 0, sessions: sessions.map((session) => ({ sourceSessionId: session.sourceSessionId, targetThreadId: session.targetThreadId, status: "imported" })) };
  };

  it("hands only user/assistant text to the core and records the import once", async () => {
    await claudeFixture();
    const calls: any[][] = [];
    const manager = createManager({ file: ledgerFile, env: { HOME: home } });
    const first = await manager.import(["claude"], writer(calls));
    expect(first.claude.imported).toBe(1);
    expect(calls).toHaveLength(1);
    // Nothing executable crosses the boundary: each payload is text messages and metadata, nothing else.
    expect(Object.keys(calls[0][0])).toEqual(expect.arrayContaining(["source", "sourceSessionId", "targetThreadId", "title", "messages"]));
    expect(calls[0][0].messages.every((message: any) => Object.keys(message).every((key) => ["role", "content", "timestamp"].includes(key)))).toBe(true);
    expect(JSON.stringify(calls[0])).not.toContain("rm -rf");

    const second = await manager.import(["claude"], writer(calls));
    expect(second.claude.skipped).toBe(1);
    expect(second.claude.imported).toBe(0);
    // A repeat import never reaches the core again and answers the same target session.
    expect(calls).toHaveLength(1);
    expect(second.claude.sessions[0]).toMatchObject({ status: "skipped", reason: "already-imported", targetThreadId: first.claude.sessions[0].targetThreadId });
  });

  it("does not record anything when no core is available", async () => {
    await claudeFixture();
    const manager = createManager({ file: ledgerFile, env: { HOME: home } });
    const result = await manager.import(["claude"], null);
    expect(result.claude).toMatchObject({ imported: 0, failed: 1 });
    const ledger = JSON.parse(await readFile(ledgerFile, "utf8"));
    expect(ledger.sessions).toEqual({});
  });

  it("skips a running source session rather than importing it as finished", async () => {
    await codexFixture({ running: true });
    const calls: any[][] = [];
    const manager = createManager({ file: ledgerFile, env: { HOME: home } });
    const result = await manager.import(["codex"], writer(calls));
    expect(result.codex).toMatchObject({ imported: 0, skipped: 1 });
    expect(result.codex.sessions[0]).toMatchObject({ status: "skipped", reason: "running" });
    expect(calls).toHaveLength(0);
  });

  it("imports several sources in one pass and keeps their histories apart", async () => {
    await claudeFixture();
    await zcodeFixture();
    const calls: any[][] = [];
    const manager = createManager({ file: ledgerFile, env: { HOME: home } });
    const result = await manager.import(SOURCES, writer(calls));
    expect(result.claude.imported).toBe(1);
    expect(result.zcode.imported).toBe(1);
    expect(result.codex.imported).toBe(0);
    expect(calls).toHaveLength(2);
  });

  it("leaves the source files untouched", async () => {
    await claudeFixture();
    const file = join(home, ".claude", "projects", "-Users-someone-work--demo", "11111111-1111-4111-8111-111111111111.jsonl");
    const before = await readFile(file, "utf8");
    const manager = createManager({ file: ledgerFile, env: { HOME: home } });
    await manager.import(["claude"], writer([]));
    expect(await readFile(file, "utf8")).toBe(before);
  });
});
