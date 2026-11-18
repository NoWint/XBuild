import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createLiveWork, backgroundSessions, createQuitGuard } = require("../electron/quit-guard.cjs");
const { installShutdownHandler } = require("../electron/shutdown.cjs");
const { t, tn, setLocale, setAssistantName } = await import("../electron/i18n/index.mjs");

class App extends EventEmitter {
  exits = 0;
  quit() {
    const event = { prevented: false, preventDefault() { this.prevented = true; } };
    this.emit("before-quit", event);
    if (!event.prevented) this.exits++;
  }
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

function setup({ responses = [], config = { threadIds: ["s1", "s2"] }, background = [], skip = () => false } = {}) {
  const app = new App(), work = createLiveWork({ getConfig: () => config }), prompts = [];
  const dialog = { showMessageBox: async (...args) => { const options = args.at(-1); prompts.push(options); const response = responses.shift(); if (response instanceof Error) throw response; return { response }; } };
  const guard = createQuitGuard({ app, dialog, t, countNow: () => work.sessions().size, mayFindMore: () => background.length > 0,
    count: async () => new Set([...work.sessions(), ...background]).size, onChange: (fn) => work.onChange(fn), skip, pollMs: 20 });
  let stopped = 0;
  const shutdown = installShutdownHandler(app, { guard: (event) => guard.handle(event), stop: () => { stopped++; } });
  return { app, work, guard, prompts, shutdown, stopped: () => stopped, background };
}

test("live work: a turn counts for its session, a sub-agent for the session that spawned it, a workflow while running", () => {
  const config = { threadIds: ["s1", "s2"] }, work = createLiveWork({ getConfig: () => config });
  work.observe({ method: "turn/started", params: { threadId: "s1", turn: { id: "t1" } } });
  work.observe({ method: "thread/started", params: { thread: { id: "child", source: { subAgent: { thread_spawn: { parent_thread_id: "s2" } } } } } });
  work.observe({ method: "turn/started", params: { threadId: "child", turn: { id: "c1" } } });
  work.observe({ method: "turn/started", params: { threadId: "unknown", turn: { id: "u1" } } });
  assert.deepEqual([...work.sessions()].sort(), ["s1", "s2"]);
  work.observe({ method: "turn/completed", params: { threadId: "child", turn: { id: "other-id" } } });
  assert.deepEqual([...work.sessions()], ["s1"], "any completion ends the thread's turn");
  work.observe({ kind: "workflow", run: { id: "w1", threadId: "s2", status: "running" } });
  assert.equal(work.sessions().size, 2);
  work.observe({ kind: "workflow", run: { id: "w1", threadId: "s2", status: "completed" } });
  work.observe({ kind: "connection", connected: false });
  assert.equal(work.sessions().size, 0);
  assert.deepEqual(work.touchedSessions().sort(), ["s1", "s2"]);
});

test("nothing running: quit goes straight to shutdown without a prompt", async () => {
  const { app, prompts, shutdown } = setup();
  app.quit();
  assert.equal(shutdown.state, "waiting");
  await shutdown.completion;
  assert.equal(prompts.length, 0);
  assert.equal(app.exits, 1);
});

test("a running turn asks first; Cancel keeps the app and its work running", async () => {
  setLocale("en-US"); setAssistantName("Codex");
  const { app, work, prompts, shutdown, stopped } = setup({ responses: [2] });
  work.observe({ method: "turn/started", params: { threadId: "s1", turn: { id: "t1" } } });
  app.quit(); app.quit();
  await tick();
  assert.equal(prompts.length, 1, "a second quit while the box is open does not open another");
  assert.equal(prompts[0].message, "Codex is still working");
  assert.equal(prompts[0].detail, "Codex is working in 1 session. Quitting now will interrupt that work.");
  assert.deepEqual(prompts[0].buttons, ["Quit anyway", "Wait for Codex", "Cancel"]);
  assert.equal(prompts[0].defaultId, 1); assert.equal(prompts[0].cancelId, 2);
  assert.equal(shutdown.state, "idle"); assert.equal(stopped(), 0); assert.equal(app.exits, 0);
  setAssistantName("DeepSeek");
});

test("Quit anyway quits at once and does not ask again", async () => {
  const { app, work, prompts, shutdown } = setup({ responses: [0] });
  work.observe({ method: "turn/started", params: { threadId: "s1", turn: { id: "t1" } } });
  work.observe({ method: "turn/started", params: { threadId: "s2", turn: { id: "t2" } } });
  app.quit();
  await tick();
  assert.match(prompts[0].detail, /working in 2 sessions/);
  await shutdown.completion;
  assert.equal(prompts.length, 1);
  assert.equal(app.exits, 1);
});

test("Wait quits by itself once every turn ends", async () => {
  const { app, work, guard, shutdown } = setup({ responses: [1] });
  work.observe({ method: "turn/started", params: { threadId: "s1", turn: { id: "t1" } } });
  app.quit();
  await tick();
  assert.equal(guard.waiting, true);
  assert.equal(shutdown.state, "idle");
  work.observe({ method: "turn/completed", params: { threadId: "s1", turn: { id: "t1", status: "completed" } } });
  await tick(); await tick();
  await shutdown.completion;
  assert.equal(app.exits, 1);
});

test("background commands alone are found by the async check, and a wait polls until they end", async () => {
  const { app, prompts, shutdown, background } = setup({ responses: [1], background: ["s2"] });
  app.quit();
  await tick();
  assert.equal(prompts.length, 1);
  assert.match(prompts[0].detail, /1 session/);
  background.length = 0;
  await new Promise((resolve) => setTimeout(resolve, 60));
  await shutdown.completion;
  assert.equal(app.exits, 1);
});

test("a prompt that cannot open and automated launches never block the quit", async () => {
  const failing = setup({ responses: [new Error("Native action forbidden")] });
  failing.work.observe({ method: "turn/started", params: { threadId: "s1", turn: { id: "t1" } } });
  failing.app.quit();
  await tick();
  await failing.shutdown.completion;
  assert.equal(failing.app.exits, 1);
  const automated = setup({ skip: () => true });
  automated.work.observe({ method: "turn/started", params: { threadId: "s1", turn: { id: "t1" } } });
  automated.app.quit();
  await automated.shutdown.completion;
  assert.equal(automated.prompts.length, 0);
});

test("backgroundSessions asks only a connected core and treats failures as none", async () => {
  assert.deepEqual(await backgroundSessions({ client: null, ids: ["s1"] }), []);
  const client = { connection: {}, serverInfo: {}, request: async (method, params) => {
    assert.equal(method, "thread/backgroundTerminals/list");
    if (params.threadId === "bad") throw new Error("unsupported");
    return { data: params.threadId === "s1" ? [{ processId: "p" }] : [] };
  } };
  assert.deepEqual(await backgroundSessions({ client, ids: ["s1", "s2", "bad"] }), ["s1"]);
});

test("quit warning copy has zh-CN entries", () => {
  setLocale("zh-CN");
  for (const key of ["DeepSeek is still working", "Quit anyway", "Wait for DeepSeek",
    "DeepSeek is working in {count} session. Quitting now will interrupt that work.", "DeepSeek is working in {count} sessions. Quitting now will interrupt that work."])
    assert.notEqual(t(key), key, key);
  assert.match(tn(3, "DeepSeek is working in {count} session. Quitting now will interrupt that work.", "DeepSeek is working in {count} sessions. Quitting now will interrupt that work."), /3/);
  setLocale("en-US");
});
