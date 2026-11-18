// B39 Allowed sites dialog logic (2.31226.0 c25b1be4a-C8MgNjI5 p, c36734a81-B0yxtrZx g/_): pure, for the
// renderer (source-preview-allowed-sites.jsx) and its tests.

// c25b1be4a p: the add field's message for each shared-0 yg result ("ok" and "declined" show none).
const ERRORS = {
  invalid: "Enter a valid web address.",
  loopback: "Localhost is always allowed.",
  exists: "That site is already allowed.",
  blocked: "This site can’t be added due to safety restrictions.",
  "org-blocked": "This site is blocked by your organization’s policy.",
  unavailable: "Couldn’t verify this site. Try again.",
};
export function allowedSiteError(result, translate = (text) => text) {
  const text = ERRORS[result];
  return text ? translate(text) : null;
}

// c36734a81 g: a row shows the origin's host (a wildcard's %2A. as *.); a label the entry carries wins.
export function allowedSiteLabel(entry) {
  if (entry?.label) return entry.label;
  try { return new URL(entry.origin).host.replace(/^%2A\./i, "*."); } catch { return entry?.origin ?? ""; }
}

// c36734a81 D: saved sites first, then built-in ones, each in list order.
export const orderedAllowedSites = (entries = []) => [...entries.filter((entry) => !entry.builtin), ...entries.filter((entry) => entry.builtin)];

// c36734a81 _ T-ref effect: after a removed row is gone, the first remaining saved row after it, else before it.
export function removeFocusTarget(removing, entries = []) {
  const remaining = new Set(entries.filter((entry) => !entry.builtin).map((entry) => entry.origin));
  return removing.successors.find((origin) => remaining.has(origin)) ?? removing.predecessors.find((origin) => remaining.has(origin)) ?? null;
}
