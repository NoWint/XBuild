// Quitting while an agent works (index.chunk-ChZ67Jhw.js installQuitSessionGuard jjt / Mjt / Bjt / QS): when any
// session has a running turn, a running workflow or live background commands, the first quit shows a warning box
// "DeepSeek is still working" (the running core's assistant) with Quit anyway, Wait for DeepSeek (the default: the
// app quits by itself once that work ends) and Cancel. Quit anyway, or the wait finishing, quits without asking again.
// Does not import Electron so the decision flow is unit-testable; main.cjs feeds it the core's events.

const parentOf = (thread) => thread?.parentThreadId || thread?.source?.subAgent?.thread_spawn?.parent_thread_id || null;

/**
 * The sessions with live work, from the events main.cjs receives: turn/started … turn/completed per thread (a sub-agent
 * thread counts for the session that spawned it) and workflow runs while their status is running. Every core speaks
 * these notifications, so this needs no capability.
 */
function createLiveWork({ getConfig }) {
  const active = new Map(), parents = new Map(), workflows = new Map(), touched = new Set(), listeners = new Set();
  const changed = () => { for (const listener of [...listeners]) { try { listener(); } catch {} } };
  const threadIds = () => new Set(Array.isArray(getConfig()?.threadIds) ? getConfig().threadIds : []);
  // The sidebar session a thread belongs to: itself, or the nearest ancestor that is one (sub-agents nest).
  const ownerOf = (id, sessions) => {
    for (let current = id, depth = 0; current && depth < 8; current = parents.get(current), depth++) if (sessions.has(current)) return current;
    return null;
  };
  function observe(event) {
    if (!event || typeof event !== "object") return;
    if (event.kind === "workflow") {
      const run = event.run;
      if (!run || typeof run.id !== "string") return;
      if (run.status === "running") workflows.set(run.id, typeof run.threadId === "string" && run.threadId ? run.threadId : null);
      else if (!workflows.delete(run.id)) return;
      changed();
      return;
    }
    if (event.kind === "connection" && !event.connected) {
      if (!active.size) return;
      active.clear(); changed();
      return;
    }
    const p = event.params || {};
    if (event.method === "thread/started" && typeof p.thread?.id === "string") {
      const parent = parentOf(p.thread);
      if (typeof parent === "string" && parent) parents.set(p.thread.id, parent);
      return;
    }
    if (typeof p.threadId !== "string") return;
    if (event.method === "turn/started") { active.set(p.threadId, p.turn?.id ?? true); touched.add(p.threadId); changed(); }
    // Any completion ends the thread's turn: an inline review completes under its outer ID, and a turn held open by a
    // mismatched ID would keep "Wait" from ever quitting.
    else if (event.method === "turn/completed" && active.delete(p.threadId)) changed();
  }
  /** The session ids with a running turn (or a running sub-agent) or a running workflow. */
  function sessions() {
    const known = threadIds(), result = new Set();
    for (const id of active.keys()) { const owner = ownerOf(id, known); if (owner) result.add(owner); }
    for (const [runId, threadId] of workflows) result.add(threadId || `workflow:${runId}`);
    return result;
  }
  /** Sessions that ran a turn since launch: the only ones that can have background commands left running. */
  function touchedSessions() {
    const known = threadIds(), result = new Set();
    for (const id of touched) { const owner = ownerOf(id, known); if (owner) result.add(owner); }
    return [...result];
  }
  function onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  /** The id of the thread's running turn (turn/started), else null: the app's own approval cards carry it. */
  function turnOf(threadId) { const id = active.get(threadId); return typeof id === "string" && id ? id : null; }
  return { observe, sessions, touchedSessions, onChange, turnOf };
}

/**
 * Sessions whose background commands still run (thread/backgroundTerminals/list), asked only of a connected core and
 * only for sessions that ran a turn since launch. A core without the method, a timeout or an error counts as none:
 * a failed query never holds the quit.
 */
async function backgroundSessions({ client, ids, timeoutMs = 1500 }) {
  if (!client?.connection || !client.serverInfo || !ids.length) return [];
  const results = await Promise.all(ids.slice(0, 50).map(async (threadId) => {
    try {
      const page = await client.request("thread/backgroundTerminals/list", { threadId, limit: 1 }, timeoutMs);
      return Array.isArray(page?.data) && page.data.length > 0 ? threadId : null;
    } catch { return null; }
  }));
  return results.filter(Boolean);
}

/**
 * handle(event) runs first in before-quit and returns true when it held the quit (it then called event.preventDefault());
 * false lets the quit go on. countNow() is the number of sessions with live work known at once (turns, workflows);
 * count() resolves it with background commands too, which takes a core query, so it runs only when mayFindMore() says a
 * session could have some. skip(): quit without asking (automation).
 */
// terminalsNow(): the built-in terminal tabs whose foreground program is still running (terminal-service.cjs); they join
// the same confirmation (a terminal-only quit asks Quit anyway / Cancel).
function createQuitGuard({ app, dialog, getWindow = () => null, t, count, countNow, mayFindMore = () => false, onChange, skip = () => false, pollMs = 5000, onError = () => {}, terminalsNow = () => 0 }) {
  let allowed = false, prompting = false, checking = false, stopWaiting = null;
  const quit = () => { cancelWait(); allowed = true; app.quit(); };
  function cancelWait() { if (stopWaiting) { const stop = stopWaiting; stopWaiting = null; stop(); } }
  // Wait for DeepSeek: quit by itself once no session has live work (rechecked on every change, and on a timer for
  // background commands, which report no end event). Commands still running in the built-in terminal then get the
  // terminal-only question (Quit anyway / Cancel) instead of being hung up without asking.
  function wait() {
    cancelWait();
    let busy = false, done = false;
    const check = async () => {
      if (busy || done) return;
      busy = true;
      try {
        if ((await count()) === 0 && !done) {
          done = true;
          let terminals = 0;
          try { terminals = Number(terminalsNow()) || 0; } catch (error) { onError(error); }
          if (terminals > 0) { cancelWait(); void prompt(0, terminals); } else quit();
        }
      }
      catch (error) { onError(error); }
      finally { busy = false; }
    };
    const off = onChange(() => { if (countNow() === 0) void check(); });
    const timer = setInterval(() => void check(), pollMs);
    timer.unref?.();
    stopWaiting = () => { done = true; off(); clearInterval(timer); };
    void check();
  }
  const plural = (count, one, other) => t(count === 1 ? one : other, { count });
  async function prompt(sessions, terminals = 0) {
    prompting = true;
    // t() names the running core's assistant in place of DeepSeek (i18n setAssistantName).
    const terminalNote = terminals > 0 ? plural(terminals, "A command is also running in {count} terminal.", "Commands are also running in {count} terminals.") : "";
    const options = sessions === 0 ? {
      type: "warning",
      message: t("A command is still running in a terminal"),
      detail: plural(terminals, "Quitting now will stop the command running in {count} terminal.", "Quitting now will stop the commands running in {count} terminals."),
      buttons: [t("Quit anyway"), t("Cancel")],
      defaultId: 0, cancelId: 1, noLink: true,
    } : {
      type: "warning",
      message: t("DeepSeek is still working"),
      detail: [t(sessions === 1 ? "DeepSeek is working in {count} session. Quitting now will interrupt that work." : "DeepSeek is working in {count} sessions. Quitting now will interrupt that work.", { count: sessions }), terminalNote].filter(Boolean).join(" "),
      buttons: [t("Quit anyway"), t("Wait for DeepSeek"), t("Cancel")],
      defaultId: 1, cancelId: 2, noLink: true,
    };
    const window = getWindow();
    const parent = window && !window.isDestroyed?.() && window.isVisible?.() ? window : undefined;
    let response;
    try { ({ response } = parent ? await dialog.showMessageBox(parent, options) : await dialog.showMessageBox(options)); }
    catch (error) {
      // A prompt that cannot be shown never traps the user in a running app.
      onError(error); prompting = false; quit(); return;
    }
    prompting = false;
    if (response === 0) quit();
    else if (sessions === 0) cancelWait();
    else if (response === 1) wait();
    else cancelWait();
  }
  function handle(event) {
    if (allowed) return false;
    try { if (skip()) return false; } catch {}
    const now = countNow();
    let terminals = 0;
    try { terminals = Number(terminalsNow()) || 0; } catch (error) { onError(error); }
    // Nothing running and no session that could hold background commands: quit at once.
    if (now === 0 && terminals === 0 && !mayFindMore()) return false;
    event.preventDefault();
    if (prompting || checking) return true;
    if (now > 0 || !mayFindMore()) { void prompt(now, terminals); return true; }
    checking = true;
    Promise.resolve().then(count).then(
      (sessions) => { checking = false; if (sessions > 0 || terminals > 0) void prompt(sessions, terminals); else quit(); },
      (error) => { checking = false; onError(error); quit(); },
    );
    return true;
  }
  return { handle, get waiting() { return stopWaiting !== null; }, get prompting() { return prompting; } };
}

module.exports = { createLiveWork, backgroundSessions, createQuitGuard };
