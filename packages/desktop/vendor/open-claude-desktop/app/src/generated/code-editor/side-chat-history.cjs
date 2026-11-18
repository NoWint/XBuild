// Original desktop side-chat history, limits, escaping and replay prompt.
function qUr(e) {
  return e.replaceAll("@", "\uff20");
}
const t = { pv: qUr };
const KU = 20;
const qU = 8e3;
const JU = 8e4;
function YU(e) {
  return e.replace(/<\/side_chat_history/gi, "<\u200b/side_chat_history");
}
const XU = class e {
  constructor() {
    ((this.entries = []),
      (this.turn = 0),
      (this.userCount = 0),
      (this.totalChars = 0));
  }
  recordUser(e) {
    this.record("user", e);
  }
  recordAssistant(e) {
    this.record("assistant", e);
  }
  endTurn() {
    this.turn += 1;
  }
  hasUserMessage() {
    return this.userCount > 0;
  }
  cloneForRespawn() {
    let t = new e();
    return (
      (t.entries = this.entries.map((e) => ({ ...e }))),
      (t.turn = this.turn),
      (t.userCount = this.userCount),
      (t.totalChars = this.totalChars),
      t
    );
  }
  buildReplayPrompt() {
    let e = [...this.entries];
    for (; e.at(-1)?.role === "assistant" && e.at(-1)?.turn === this.turn; )
      e.pop();
    let n = [];
    for (let t of e) {
      let e = n.at(-1);
      e?.role === "assistant" && t.role === "assistant" && e.turn === t.turn
        ? (e.text += `\n\n${t.text}`)
        : n.push({ ...t });
    }
    return `<side_chat_history>\n${n.map((e) => (e.role === "user" ? `User: ${YU(e.text)}` : `Assistant: ${YU(t.pv(e.text))}`)).join(`\n\n`)}\n</side_chat_history>\n\nThis side chat was restarted after an error; the exchanges above are its most recent conversation (the panel still shows them). Continue from them: answer the most recent user question that hasn't been answered yet. Don't repeat answers already shown above and don't mention the restart.`;
  }
  record(e, t) {
    let n = t;
    if (t.length > qU) {
      let e = qU,
        r = t.charCodeAt(e - 1);
      (r >= 55296 && r <= 56319 && --e, (n = `${t.slice(0, e)}\u2026`));
    }
    (this.entries.push({ role: e, text: n, turn: this.turn }),
      e === "user" && (this.userCount += 1),
      (this.totalChars += n.length),
      this.evict());
  }
  evict() {
    for (; this.userCount > KU || this.totalChars > JU; ) {
      let e = +(this.entries[0]?.role === "user" && this.userCount === 1),
        t = this.entries[e];
      if (t === void 0) break;
      (this.entries.splice(e, 1),
        t.role === "user" && --this.userCount,
        (this.totalChars -= t.text.length));
    }
    if (this.userCount > 0)
      for (; this.entries[0]?.role === "assistant"; )
        ((this.totalChars -= this.entries[0].text.length),
          this.entries.shift());
  }
};
module.exports = {
  SideChatHistory: XU,
  escapeSideHistory: YU,
  escapeAssistantMentions: qUr,
};
