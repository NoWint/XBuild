import { isAbsolute } from "node:path";
import semver from "semver";
import { z } from "zod";
import type { DshData, DshDomainGrant, DshDomainRecord, DshPreparedRevision } from "./contract.js";
import { DshPackageError } from "./errors.js";
import { parseDshManifest } from "./manifest.js";
import { DSH_PACKAGE_NAME, hasDshControlCharacters, normalizeDshSource } from "./source.js";

const text = z
  .string()
  .min(1)
  .max(4096)
  .refine((value) => !hasDshControlCharacters(value));
const identifier = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,127}$/i);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const absolute = text.refine(isAbsolute);
const date = z.iso.datetime();
const originalText = z.string().refine((value) => Boolean(value.trim()));
function boundedJson(value: unknown): value is DshData {
  const pending: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const item = pending.pop()!;
    if (++count > 100000 || item.depth > 64) return false;
    const child = item.value;
    if (child === null || typeof child === "string" || typeof child === "boolean") continue;
    if (typeof child === "number") {
      if (!Number.isFinite(child)) return false;
      continue;
    }
    if (Array.isArray(child)) {
      // 展开超宽数组会先触发 JS 参数数量上限；预算检查必须先于逐项入队。
      if (count + pending.length + child.length > 100000) return false;
      for (const value of child) pending.push({ value, depth: item.depth + 1 });
      continue;
    }
    if (
      !child ||
      typeof child !== "object" ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(child))
    )
      return false;
    for (const [key, value] of Object.entries(child)) {
      if (["__proto__", "constructor", "prototype"].includes(key)) return false;
      if (count + pending.length >= 100000) return false;
      pending.push({ value, depth: item.depth + 1 });
    }
  }
  return true;
}
// 递归 schema 会在恶意深层配置上耗尽调用栈；先用有界迭代校验，再接受 JSON 形状。
export const dshDataSchema: z.ZodType<DshData> = z.custom<DshData>(boundedJson);
export const dshWorkspaceScopeSchema = z.strictObject({
  workspacePath: absolute,
  workspaceIdentity: text.optional(),
  remoteSessionId: text.optional(),
});
export const dshPackageSourceSchema = z
  .union([
    z.strictObject({ kind: z.literal("npm"), spec: text, packageName: text }),
    z.strictObject({
      kind: z.literal("github"),
      spec: text,
      repository: text,
      ref: text.optional(),
    }),
    z.strictObject({ kind: z.literal("https"), spec: text, integrity: text.optional() }),
    z.strictObject({ kind: z.literal("directory"), spec: text, path: absolute }),
  ])
  .transform((value, ctx) => {
    try {
      return normalizeDshSource(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid stored source" });
      return z.NEVER;
    }
  });
export const dshDomainGrantSchema: z.ZodType<DshDomainGrant> = z.strictObject({
  revision: identifier,
  digest,
  nativeCode: z.literal(true),
  nativeUi: z.boolean(),
  executionMode: z.enum(["trusted-process", "sandboxed"]),
  filesystem: z.enum(["unrestricted", "workspace", "none"]),
  network: z.boolean(),
  subprocess: z.boolean(),
  installationScripts: z.array(text).max(0),
});
export const dshRevisionProvenanceSchema = z.strictObject({
  source: dshPackageSourceSchema,
  baseBundles: z.array(text.regex(DSH_PACKAGE_NAME)).max(1000),
  configPatches: z.array(dshDataSchema).max(10000),
  configuredFrom: identifier.optional(),
});
const manifestSchema = z
  .strictObject({
    name: text,
    version: text.refine((value) => Boolean(semver.valid(value))),
    // 原始展示字段允许换行；路径与身份字段的单行规则不能破坏已被 Manifest 接受的自由文本。
    description: originalText.optional(),
    author: originalText.optional(),
    license: originalText.optional(),
    repository: originalText.optional(),
    homepage: originalText.optional(),
    entry: text.optional(),
    clientEntry: text.optional(),
    bundlePatches: z.array(text),
    profileBundles: z.array(text),
    dependencies: z.record(text, z.string()),
    peerDependencies: z.record(text, z.string()),
    engines: z.record(text, z.string()),
    scripts: z.record(text, z.string()),
    raw: z.record(z.string(), dshDataSchema),
  })
  .superRefine((value, ctx) => {
    try {
      const parsed = parseDshManifest(value.raw);
      for (const key of Object.keys(parsed) as Array<keyof typeof parsed>) {
        if (JSON.stringify(value[key]) !== JSON.stringify(parsed[key])) {
          ctx.addIssue({
            code: "custom",
            message: "Stored manifest differs from original metadata",
          });
          break;
        }
      }
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid original package manifest" });
    }
  });
export const dshPreparedRevisionSchema: z.ZodType<DshPreparedRevision> = z.strictObject({
  domainId: identifier,
  revision: identifier,
  digest,
  workspaceKey: text,
  scope: dshWorkspaceScopeSchema,
  profileDirectory: absolute,
  packageName: text,
  manifest: manifestSchema,
  source: dshPackageSourceSchema,
  provenance: dshRevisionProvenanceSchema,
  dependencyInventory: z
    .array(
      z.strictObject({
        name: text,
        version: text.refine((value) => Boolean(semver.valid(value))),
        integrity: text.optional(),
      }),
    )
    .max(20000),
  createdAt: date,
  state: z.enum(["awaiting-trust", "trusted"]),
  grant: dshDomainGrantSchema.optional(),
});
export const dshDomainRecordSchema: z.ZodType<DshDomainRecord> = z
  .strictObject({
    domainId: identifier,
    workspaceKey: text,
    scope: dshWorkspaceScopeSchema,
    activeRevision: identifier.optional(),
    previousRevision: identifier.optional(),
    preparedRevision: identifier.optional(),
    enabled: z.boolean(),
    revisions: z.array(identifier).max(10000),
    updatedAt: date,
    dataDirectory: absolute,
    diagnostic: text.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      new Set(value.revisions).size !== value.revisions.length ||
      [value.activeRevision, value.previousRevision, value.preparedRevision].some(
        (item) => item && !value.revisions.includes(item),
      )
    ) {
      ctx.addIssue({ code: "custom", message: "Invalid revision references" });
    }
  });
export function parseDshStored<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new DshPackageError("DSH_INVALID_METADATA", `Invalid ${label}`);
  return structuredClone(parsed.data);
}
