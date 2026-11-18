import { appToolCall } from './agent-tool-titles.mjs';

/**
 * The files a finished SendUserFile call (XBuild's agent tools, agent-tools/files.mjs) sent: its result's
 * structuredContent.deliverables, or — for a core that drops structured content from its tool items (the bridges) —
 * the call's own `files`, each with the caption (the cards open them relative to the session folder). null otherwise.
 */
function sentFiles(item) {
  if (appToolCall(item)?.tool !== "SendUserFile" || item.status !== "completed" || item.result?.isError === true || item.error) return null;
  const structured = item.result?.structuredContent?.deliverables;
  if (Array.isArray(structured)) return structured;
  const files = Array.isArray(item.arguments?.files) ? item.arguments.files : typeof item.arguments?.files === "string" ? [item.arguments.files] : [];
  const caption = typeof item.arguments?.caption === "string" ? item.arguments.caption.trim() : "";
  return [...new Set(files.filter((file) => typeof file === "string" && file.trim()).map((file) => file.trim()))].map((file) => ({ path: file, ...(caption ? { description: caption } : {}) }));
}

/** The deliverables of a `present` call item (codeDesktop.deliverables) or a SendUserFile call, or null. */
export function itemDeliverables(item) {
  const files = (item?.type === "dynamicToolCall" ? item.codeDesktop?.deliverables : null) ?? (item?.type === "mcpToolCall" || item?.type === "dynamicToolCall" ? sentFiles(item) : null);
  return Array.isArray(files) && files.some((file) => typeof file?.path === "string" && file.path) ? files.filter((file) => typeof file?.path === "string" && file.path) : null;
}

