// C2 persona store: the renderer's single source for the assistant display
// name, home greeting template and spark icon. Pure (node-testable); main.jsx
// syncs it from boot.config.persona and use-persona.js wraps it for React.
// Visible copy only: accessible names ("Message DeepSeek", ...) never read it.
import { normalizePersona, PERSONA_DEFAULT } from '../electron/prefs/persona.mjs';
import { greetingName, greetingText } from './home-model.mjs';
import { getAssistantName } from '../electron/i18n/index.mjs';

export const DEFAULT_ASSISTANT_NAME = 'DeepSeek';
let persona = PERSONA_DEFAULT;
const listeners = new Set();

export function setPersona(value) {
  const next = normalizePersona(value);
  if (Object.keys(next).every(key => next[key] === persona[key])) return persona;
  persona = Object.freeze(next);
  for (const listener of [...listeners]) listener();
  return persona;
}
export function getPersona() { return persona; }
export const getSnapshot = getPersona;
export function subscribe(listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
// Without a custom name: the running core's assistant ("DeepSeek", "Codex", … — i18n getAssistantName).
export function assistantName() { return persona.assistantName || getAssistantName() || DEFAULT_ASSISTANT_NAME; }

/** Escape a name for use inside a RegExp source. */
export function escapeRegExp(text) { return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** Fill a greeting template: {name} → first name, or drop it and tidy punctuation. */
export function fillGreeting(template, displayName) {
  const full = greetingName(displayName);
  const first = full ? full.split(/\s+/)[0] : '';
  if (first) return template.replaceAll('{name}', first).trim();
  return template
    .replaceAll('{name}', '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*,\s*([?!.])/g, '$1')
    .replace(/\s+([?!.,])/g, '$1')
    .replace(/,\s*$/, '')
    .replace(/^\s*[,]\s*/, '')
    .trim();
}

/** Home greeting: the built-in copy for an empty template, otherwise the filled template. */
export function greetingFor({ displayName, landingClear = true } = {}, value = persona) {
  const template = typeof value?.greeting === 'string' ? value.greeting.trim() : '';
  if (!template) return greetingText(greetingName(displayName), landingClear);
  return fillGreeting(template, displayName) || greetingText(greetingName(displayName), landingClear);
}
