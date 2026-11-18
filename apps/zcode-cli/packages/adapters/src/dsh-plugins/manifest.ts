import { posix, win32 } from "node:path";
import semver from "semver";
import type { DshData, DshPackageManifest } from "./contract.js";
import { DSH_PACKAGE_NAME, hasDshControlCharacters } from "./source.js";

export function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

export function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function strings(value: unknown, label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} must be a string array`);
  }
  return value as string[];
}

function stringRecord(value: unknown, label: string): Record<string, string> {
  if (value === undefined) return {};
  const record = objectValue(value, label);
  if (Object.values(record).some((item) => typeof item !== "string"))
    throw new Error(`${label} values must be strings`);
  return record as Record<string, string>;
}

function packagePath(value: string, label: string): string {
  const normalized = value.replaceAll("\\", "/");
  if (
    !normalized ||
    posix.isAbsolute(normalized) ||
    win32.isAbsolute(value) ||
    normalized.split("/").includes("..") ||
    hasDshControlCharacters(value) ||
    /^[a-z][a-z\d+.-]*:/i.test(value)
  ) {
    throw new Error(`${label} escapes its package`);
  }
  return value;
}

function exportTarget(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  return exportTarget(record.import) ?? exportTarget(record.node) ?? exportTarget(record.default);
}

function validateJson(value: unknown, depth = 0): asserts value is DshData {
  if (depth > 64) throw new Error("DSH metadata nesting exceeds the supported limit");
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    for (const child of value) validateJson(child, depth + 1);
    return;
  }
  const record = objectValue(value, "DSH metadata");
  for (const [key, child] of Object.entries(record)) {
    if (["__proto__", "constructor", "prototype"].includes(key))
      throw new Error("Unsafe metadata key");
    validateJson(child, depth + 1);
  }
}

export function parseDshManifest(value: unknown): DshPackageManifest {
  const raw = objectValue(value, "DSH package.json");
  validateJson(raw);
  const name = stringValue(raw.name);
  const version = stringValue(raw.version);
  if (!name || !DSH_PACKAGE_NAME.test(name) || name.length > 214)
    throw new Error("Invalid DSH package name");
  if (!version || !semver.valid(version))
    throw new Error("DSH packages require an exact semantic version");
  const dsh = raw.dsh === undefined ? {} : objectValue(raw.dsh, "dsh");
  const bundle = dsh.bundle === undefined ? undefined : objectValue(dsh.bundle, "dsh.bundle");
  const profile = dsh.profile === undefined ? undefined : objectValue(dsh.profile, "dsh.profile");
  if (dsh.client !== undefined) {
    const client = objectValue(dsh.client, "dsh.client");
    strings(client.inject, "dsh.client.inject");
    strings(client.external, "dsh.client.external");
    if (
      client.platform !== undefined &&
      !["web", "desktop", "node"].includes(String(client.platform))
    ) {
      throw new Error("Unsupported dsh.client.platform");
    }
  }
  const declaredPatches = typeof bundle?.patch === "string" ? [bundle.patch] : bundle?.patch;
  if (bundle && declaredPatches === undefined) throw new Error("dsh.bundle.patch is required");
  const bundlePatches = strings(declaredPatches, "dsh.bundle.patch").map((path) =>
    packagePath(path, "bundle patch"),
  );
  const profileBundles = strings(profile?.bundles, "dsh.profile.bundles");
  if (profileBundles.some((item) => !DSH_PACKAGE_NAME.test(item)))
    throw new Error("Invalid profile bundle name");
  const exports =
    raw.exports && typeof raw.exports === "object" && !Array.isArray(raw.exports)
      ? (raw.exports as Record<string, unknown>)
      : undefined;
  const entry = exportTarget(exports?.["."] ?? raw.exports) ?? stringValue(raw.main);
  const clientEntry = exportTarget(exports?.["./client"]);
  if (entry) packagePath(entry, "plugin entry");
  if (clientEntry) packagePath(clientEntry, "client entry");
  if (!entry && !clientEntry && !bundle && !profile)
    throw new Error("Package declares no native entry, client, Bundle or Profile");
  const author =
    stringValue(raw.author) ??
    (raw.author && typeof raw.author === "object"
      ? stringValue((raw.author as Record<string, unknown>).name)
      : undefined);
  const repository =
    stringValue(raw.repository) ??
    (raw.repository && typeof raw.repository === "object"
      ? stringValue((raw.repository as Record<string, unknown>).url)
      : undefined);
  return {
    name,
    version,
    ...(stringValue(raw.description) ? { description: stringValue(raw.description) } : {}),
    ...(author ? { author } : {}),
    ...(stringValue(raw.license) ? { license: stringValue(raw.license) } : {}),
    ...(repository ? { repository } : {}),
    ...(stringValue(raw.homepage) ? { homepage: stringValue(raw.homepage) } : {}),
    ...(entry ? { entry } : {}),
    ...(clientEntry ? { clientEntry } : {}),
    bundlePatches,
    profileBundles,
    dependencies: stringRecord(raw.dependencies, "dependencies"),
    peerDependencies: stringRecord(raw.peerDependencies, "peerDependencies"),
    engines: stringRecord(raw.engines, "engines"),
    scripts: stringRecord(raw.scripts, "scripts"),
    raw: structuredClone(raw) as Record<string, DshData>,
  };
}
