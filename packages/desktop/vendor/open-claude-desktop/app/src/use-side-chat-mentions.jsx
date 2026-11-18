import { useCallback, useEffect, useRef, useState } from 'react';
import { mentionToken, mentionOptions, nextHighlight, MENTION_SEARCH_DELAY } from './mention-model.mjs';

// Current ca80fca8d RI enables the DA file provider by default, including in
// kT's side composer. Reuse the shared file chip/dropdown with a request-owned
// lookup, so a result cannot outlive its draft, session or visible composer.
export function useSideChatMentions({ inputRef, searchFiles, scope, enabled, onPick }) {
  const [menu, setMenu] = useState(null), latest = useRef(null), pending = useRef(0), timer = useRef(null), dismissed = useRef(null);
  latest.current = { searchFiles, enabled, onPick, menu };
  const cancel = useCallback(() => { pending.current++; clearTimeout(timer.current); }, []);
  const close = useCallback(() => {
    const node = inputRef.current, token = node && mentionToken(node.value, node.selectionStart);
    dismissed.current = token ? `${token.start}:${token.query}` : null;
    cancel(); setMenu(null);
  }, [cancel, inputRef]);
  const update = useCallback((edited = false) => {
    cancel();
    if (edited) dismissed.current = null;
    const node = inputRef.current;
    const token = node && node.selectionStart === node.selectionEnd ? mentionToken(node.value, node.selectionStart) : null;
    if (!latest.current.enabled || !latest.current.searchFiles || !token || dismissed.current === `${token.start}:${token.query}`) { setMenu(null); return; }
    const caret = node.getCaretViewportRect(token.start), request = pending.current;
    setMenu({ token, caret, options: [], highlighted: 0 });
    timer.current = setTimeout(async () => {
      let matches;
      try { matches = await latest.current.searchFiles(token.query); } catch { matches = []; }
      if (request !== pending.current || !latest.current.enabled) return;
      setMenu({ token, caret, options: mentionOptions(Array.isArray(matches) ? matches : []), highlighted: 0 });
    }, MENTION_SEARCH_DELAY);
  }, [cancel, inputRef]);
  useEffect(() => { cancel(); dismissed.current = null; setMenu(null); return cancel; }, [scope, enabled, cancel]);
  const select = option => {
    const node = inputRef.current, current = latest.current.menu;
    if (!node || !current || !option || !latest.current.enabled) return;
    const token = mentionToken(node.value, node.selectionStart);
    if (!token || token.start !== current.token.start || token.query !== current.token.query) { close(); return; }
    cancel(); setMenu(null); latest.current.onPick?.(option);
    node.insertMention(token, option);
  };
  const keyDown = event => {
    const current = latest.current.menu;
    if (!current?.options.length) return false;
    if (event.isComposing || event.keyCode === 229) return false;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return true; }
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return false;
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      setMenu(value => value && ({ ...value, highlighted: nextHighlight(value.highlighted, value.options.length, event.key) })); return true;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault(); event.stopPropagation(); select(current.options[current.highlighted]); return true;
    }
    return false;
  };
  return { menu, open: !!menu?.options.length, update, select, close, keyDown };
}
