import { sideChatContextQuestion } from './generated/code-editor/side-chat-context.mjs';
import { sideChatStore } from './side-chat-store.mjs';
import { isSideChatReset } from './side-chat-command.mjs';
import { t } from '../electron/i18n/index.mjs';

const METHOD_NOT_FOUND = -32601, INVALID_REQUEST = -32600;

/**
 * Whether a codeDesktop/sideQuestion failure means the core has no side questions: JSON-RPC method not found, or
 * the invalid request a native Codex app-server answers for a method it doesn't know ("unknown variant
 * `codeDesktop/sideQuestion`, expected one of …", a list of every method it serves).
 */
export function sideQuestionUnsupported(error) {
  if (error?.code === METHOD_NOT_FOUND) return true;
  return error?.code === INVALID_REQUEST && /unknown (?:variant|method)|method not found|not supported/i.test(String(error?.message ?? ''));
}

export function clearSideChat({ rpc, threadId, keepDraft = false }) {
  const requestId = sideChatStore.get(threadId).requestId;
  if (requestId) void rpc('codeDesktop/sideQuestion/cancel', { requestId }).catch(() => {});
  // Original kT clearMessages/restart leaves staged context intact.
  sideChatStore.clear(threadId, { keepDraft, keepContext: true, keepStarted: true });
}

export async function stopSideQuestion({ rpc, threadId }) {
  const requestId = sideChatStore.get(threadId).requestId;
  if (!requestId || !sideChatStore.interrupt(threadId, requestId)) return;
  try {
    await rpc('codeDesktop/sideQuestion/cancel', { requestId });
    sideChatStore.finish(threadId, requestId, { retryable: false });
  } catch (error) {
    sideChatStore.interruptFailed(threadId, requestId, error?.message || t('Something went wrong'));
  }
}

/** Ask one side question for `threadId`; resolves when the answer settles. */
export async function askSideQuestion({ rpc, threadId, question, useStagedContext = false, subscribe = handler => globalThis.desktop?.onEvent?.(handler) }) {
  const text = String(question ?? '').trim();
  if (!text || !threadId) return;
  if (isSideChatReset(text)) { clearSideChat({ rpc, threadId }); return; }
  const previous = sideChatStore.get(threadId);
  if (previous.requestId) void rpc('codeDesktop/sideQuestion/cancel', { requestId: previous.requestId }).catch(() => {});
  const wireText = useStagedContext && previous.stagedContext !== null ? sideChatContextQuestion(text, previous.stagedContext) : text;
  if (useStagedContext) sideChatStore.clearStagedContext(threadId);
  const history = sideChatStore.history(threadId);
  const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  sideChatStore.ask(threadId, wireText, requestId);
  let unsubscribe;
  try {
    // The request owns its stream, independently of mounted panels/split views.
    unsubscribe = subscribe(event => {
      const params = event?.params;
      if (params?.threadId !== threadId || params.requestId !== requestId) return;
      if (event?.method === 'codeDesktop/sideQuestion/delta') sideChatStore.delta(threadId, requestId, params.text);
      else if (event?.method === 'codeDesktop/sideQuestion/progress') sideChatStore.progress(threadId, requestId, params);
    });
    const result = await rpc('codeDesktop/sideQuestion', { threadId, question: wireText, history, requestId });
    sideChatStore.finish(threadId, requestId, { text: result?.text, closed: result?.closed === true });
  } catch (error) {
    // The question stays on screen with the error; Retry is offered unless the core has no side questions at all.
    const unsupported = sideQuestionUnsupported(error);
    const message = unsupported ? t('This core doesn’t support side questions.') : error?.message || t('Something went wrong');
    sideChatStore.finish(threadId, requestId, { error: message, retryable: !unsupported });
  } finally {
    try { unsubscribe?.(); } catch {}
  }
}

