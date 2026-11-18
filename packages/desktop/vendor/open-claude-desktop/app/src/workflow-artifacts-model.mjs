// A workflow run's published deliverables (ZCode's artifact.*: run.artifacts from its journal, the content read through
// codeDesktop/workflow/artifact): the list the run card shows, primary first, and a board member's reported items as
// plain rows (a table, metric tiles, board columns, a chart's points), the way a beginner can read them without a
// chart library. Pure.
import { t } from "../electron/i18n/index.mjs";

const KINDS = { markdown: "Report", file: "File", chart: "Chart", table: "Table", metrics: "Metrics", board: "Board" };
/** The kind's label ("Report", "File", …), translated. */
export const artifactKindLabel = (kind) => t(KINDS[kind] ?? "File");

/** run.artifacts as the card lists them: valid entries, the primary deliverable first. */
export function workflowArtifacts(run) {
  const list = (Array.isArray(run?.artifacts) ? run.artifacts : []).filter((entry) => entry && typeof entry.id === "string" && entry.id && KINDS[entry.kind]);
  return [...list.filter((entry) => entry.primary === true), ...list.filter((entry) => entry.primary !== true)];
}

/** A dot path's value in a reported item ("timing.after"), or undefined. */
export function fieldValue(item, path) {
  if (typeof path !== "string" || !path) return undefined;
  let value = item;
  for (const part of path.split(".")) {
    if (!value || typeof value !== "object") return undefined;
    value = value[part];
  }
  return value;
}

/** A value as one short cell. */
export function cellText(value, unit = "") {
  if (value === undefined || value === null) return "";
  let text;
  if (typeof value === "string") text = value;
  else if (typeof value === "number" || typeof value === "boolean") text = String(value);
  else { try { text = JSON.stringify(value); } catch { text = String(value); } }
  text = text.length > 300 ? `${text.slice(0, 299)}…` : text;
  return unit && text ? `${text} ${unit}` : text;
}

const fields = (list) => (Array.isArray(list) ? list : [list]).filter((entry) => entry && typeof entry.field === "string" && entry.field);
const fieldLabel = (entry) => (typeof entry.label === "string" && entry.label ? entry.label : entry.field);
const MAX_ROWS = 500;

/** Rows keyed by a field: a later item with the same key replaces the earlier one (TableSpec.key / BoardSpec.key). */
function latestByKey(items, key) {
  if (typeof key !== "string" || !key) return items;
  const order = [], byKey = new Map();
  for (const item of items) {
    const id = cellText(fieldValue(item, key));
    if (!byKey.has(id)) order.push(id);
    byKey.set(id, item);
  }
  return order.map((id) => byKey.get(id));
}

/**
 * A board member's items as something plain to show:
 *   {type: 'table', columns: [label], rows: [[cell]]}   table, chart (x then each y series), or no usable spec
 *   {type: 'metrics', tiles: [{label, value}]}         each tile the newest value it has
 *   {type: 'board', columns: [{title, cards: [{title, details: [{label, value}]}]}]}
 */
export function artifactView(kind, spec, items) {
  const list = (Array.isArray(items) ? items : []).filter((item) => item !== undefined);
  const options = spec && typeof spec === "object" ? spec : {};
  if (kind === "metrics" && fields(options.metrics).length) {
    return { type: "metrics", tiles: fields(options.metrics).map((entry) => {
      const found = [...list].reverse().find((item) => fieldValue(item, entry.field) !== undefined);
      return { label: fieldLabel(entry), value: found === undefined ? "—" : cellText(fieldValue(found, entry.field), entry.unit) };
    }) };
  }
  if (kind === "board" && typeof options.status === "string" && options.status) {
    const named = Array.isArray(options.columns) ? options.columns.filter((column) => typeof column === "string") : [];
    const columns = new Map(named.map((column) => [column, []]));
    const other = [];
    for (const item of latestByKey(list, options.key)) {
      const status = cellText(fieldValue(item, options.status));
      const card = { title: cellText(fieldValue(item, options.cardTitle || options.key)) || t("Untitled"),
        details: fields(options.detail ?? []).map((entry) => ({ label: fieldLabel(entry), value: cellText(fieldValue(item, entry.field), entry.unit) })).filter((entry) => entry.value) };
      (columns.get(status) ?? other).push(card);
    }
    const out = [...columns.entries()].map(([title, cards]) => ({ title, cards }));
    if (other.length) out.push({ title: t("Other"), cards: other });
    return { type: "board", columns: out };
  }
  let columns = [];
  if (kind === "table" && fields(options.columns).length) columns = fields(options.columns);
  else if (kind === "chart" && options.x && fields(options.y ?? []).length) columns = [...fields(options.x), ...fields(options.y)];
  const rowsOf = kind === "table" ? latestByKey(list, options.key) : list;
  if (!columns.length) {
    // No usable spec: every top-level field of the first items, in order of appearance.
    const keys = [];
    for (const item of rowsOf.slice(0, 50)) if (item && typeof item === "object" && !Array.isArray(item)) for (const key of Object.keys(item)) if (!keys.includes(key)) keys.push(key);
    if (!keys.length) return { type: "table", columns: [t("Value")], rows: rowsOf.slice(-MAX_ROWS).map((item) => [cellText(item)]) };
    columns = keys.slice(0, 12).map((key) => ({ field: key }));
  }
  return { type: "table", columns: columns.map(fieldLabel), rows: rowsOf.slice(-MAX_ROWS).map((item) => columns.map((entry) => cellText(fieldValue(item, entry.field), entry.unit))) };
}
