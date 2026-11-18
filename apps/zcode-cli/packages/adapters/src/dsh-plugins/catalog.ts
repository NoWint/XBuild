import { createHash } from "node:crypto";
import semver from "semver";
import type { DshCatalog, DshCatalogEntry, DshPackageSource } from "./contract.js";
import { objectValue, stringValue } from "./manifest.js";
import { normalizeDshSource, parseDshSource } from "./source.js";

const MAX_CATALOG_ENTRIES = 50_000;

function sourceOf(row: Record<string, unknown>): DshPackageSource {
  const npm = stringValue(row.npm) ?? stringValue(row.packageName);
  if (npm) {
    const parsed = parseDshSource(npm);
    const version = stringValue(row.version);
    return parsed.kind === "npm" && version && semver.valid(version)
      ? parseDshSource(`${parsed.packageName}@${version}`)
      : parsed;
  }
  if (row.install && typeof row.install === "object") {
    const install = objectValue(row.install, "install");
    const spec = stringValue(install.spec);
    if (spec) {
      const source = parseDshSource(spec);
      return source.kind === "https" && stringValue(install.integrity)
        ? normalizeDshSource({ ...source, integrity: stringValue(install.integrity) })
        : source;
    }
  }
  if (typeof row.install === "string") {
    const match =
      /^dsh\s+plugin\s+(?:--profile\s+[\w-]+\s+)?add\s+(?:"([^"\r\n]+)"|'([^'\r\n]+)'|([^\s]+))\s*$/.exec(
        row.install,
      );
    const spec = match?.[1] ?? match?.[2] ?? match?.[3];
    if (spec) return parseDshSource(spec);
    throw new Error("Catalog install text is not a supported package declaration");
  }
  const repository = stringValue(row.repository) ?? stringValue(row.url);
  if (repository) {
    const source = parseDshSource(repository);
    return source.kind === "https" && stringValue(row.integrity)
      ? normalizeDshSource({ ...source, integrity: stringValue(row.integrity) })
      : source;
  }
  throw new Error("Catalog entry has no supported distribution source");
}

export function parseDshCatalog(value: unknown, sourceUrl: string): DshCatalog {
  const url = new URL(sourceUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.hash)
    throw new Error("Catalog requires a credential-free HTTPS URL");
  const root = Array.isArray(value) ? { plugins: value } : objectValue(value, "DSH catalog");
  if (!Array.isArray(root.plugins) || root.plugins.length > MAX_CATALOG_ENTRIES)
    throw new Error("Invalid or oversized DSH catalog");
  const id = `dsh-${createHash("sha256").update(url.href).digest("hex").slice(0, 20)}`;
  const entries: DshCatalogEntry[] = [];
  const diagnostics: DshCatalog["diagnostics"] = [];
  const seen = new Set<string>();
  for (const [index, value] of root.plugins.entries()) {
    try {
      const row = objectValue(value, "catalog entry");
      const source = sourceOf(row);
      const identity = source.kind === "npm" ? source.packageName : source.spec;
      if (seen.has(identity)) throw new Error("Duplicate package source identity");
      const name =
        stringValue(row.name) ?? (source.kind === "npm" ? source.packageName : stringValue(row.id));
      if (!name) throw new Error("Catalog entry name is missing");
      const localized =
        row.description && typeof row.description === "object" && !Array.isArray(row.description)
          ? (Object.fromEntries(
              Object.entries(row.description).filter(([, value]) => typeof value === "string"),
            ) as Record<string, string>)
          : undefined;
      const description =
        stringValue(row.description) ?? localized?.en ?? localized?.zh ?? localized?.["zh-CN"];
      const author =
        stringValue(row.author) ??
        stringValue(row.owner) ??
        (row.author && typeof row.author === "object"
          ? stringValue((row.author as Record<string, unknown>).name)
          : undefined);
      const repository = stringValue(row.repository) ?? stringValue(row.url);
      const capabilities = Array.isArray(row.capabilities)
        ? row.capabilities.filter(
            (capability): capability is string => typeof capability === "string",
          )
        : [];
      entries.push({
        id: `${id}:${createHash("sha256").update(identity).digest("hex").slice(0, 24)}`,
        name,
        source,
        ...(source.kind === "npm" ? { packageName: source.packageName } : {}),
        ...(description ? { description } : {}),
        ...(localized ? { descriptionI18n: localized } : {}),
        ...(stringValue(row.version) ? { version: stringValue(row.version) } : {}),
        ...(author ? { author } : {}),
        ...(stringValue(row.license) ? { license: stringValue(row.license) } : {}),
        ...(repository ? { repository } : {}),
        ...(stringValue(row.icon) ? { icon: stringValue(row.icon) } : {}),
        ...(stringValue(row.category) ? { category: stringValue(row.category) } : {}),
        capabilities,
        compatibility: "unverified",
      });
      seen.add(identity);
    } catch (error) {
      diagnostics.push({ index, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { id, name: stringValue(root.name) ?? url.hostname, url: url.href, entries, diagnostics };
}
