import { z } from "zod";

export type DshJson = null | boolean | number | string | DshJson[] | { [key: string]: DshJson };

export const DSH_LIMITS = {
  frameBytes: 8 * 1024 * 1024,
  jsonDepth: 64,
  jsonNodes: 100_000,
  replayBytes: 2 * 1024 * 1024,
  replayEvents: 256,
  identifiers: 256,
  diagnostics: 4096,
} as const;

function isBoundedJson(input: unknown): input is DshJson {
  const stack = [{ value: input, depth: 0 }];
  const visited = new Set<object>();
  let nodes = 0;
  try {
    while (stack.length) {
      const { value, depth } = stack.pop()!;
      if (++nodes > DSH_LIMITS.jsonNodes || depth > DSH_LIMITS.jsonDepth) return false;
      if (value === null || typeof value === "string" || typeof value === "boolean") continue;
      if (typeof value === "number") {
        if (!Number.isFinite(value)) return false;
        continue;
      }
      if (typeof value !== "object" || Object.getOwnPropertySymbols(value).length) return false;
      if (visited.has(value)) continue;
      visited.add(value);
      if (Array.isArray(value)) {
        if (Object.keys(value).length !== value.length) return false;
      } else {
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== null && prototype !== Object.prototype) return false;
      }
      for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
        if (Array.isArray(value) && key === "length") continue;
        if (!descriptor.enumerable || !("value" in descriptor)) return false;
        stack.push({ value: descriptor.value, depth: depth + 1 });
      }
    }
    const encoded = JSON.stringify(input);
    return encoded !== undefined && new TextEncoder().encode(encoded).byteLength <= DSH_LIMITS.frameBytes;
  } catch {
    return false;
  }
}

// 原生 payload 可含任意合法 JSON 字段；仅验证，不用 object schema 剥掉插件扩展字段。
export const dshJsonSchema = z.custom<DshJson>(isBoundedJson, "Expected a bounded JSON value");
export const dshJsonObjectSchema = dshJsonSchema.refine(
  (value): value is { [key: string]: DshJson } => value !== null && typeof value === "object" && !Array.isArray(value),
  "Expected a JSON object",
);
export const dshIdentifierSchema = z.string().min(1).max(DSH_LIMITS.identifiers).regex(/^[A-Za-z0-9][A-Za-z0-9_.:@/-]*$/);
export const dshTextSchema = z.string().min(1).max(32768);
export const dshPositiveSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const dshBase64Schema = z.string().max(DSH_LIMITS.frameBytes).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
export const dshScopeSchema = z.strictObject({
  workspacePath: dshTextSchema,
  workspaceIdentity: dshTextSchema.optional(),
  remoteSessionId: dshTextSchema.optional(),
});
export type DshScope = z.infer<typeof dshScopeSchema>;

export const dshSourceSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("npm"), spec: dshTextSchema, packageName: dshTextSchema }),
  z.strictObject({ kind: z.literal("github"), spec: dshTextSchema, repository: dshTextSchema, ref: dshTextSchema.optional() }),
  z.strictObject({ kind: z.literal("https"), spec: dshTextSchema, integrity: dshTextSchema.optional() }),
  z.strictObject({ kind: z.literal("directory"), spec: dshTextSchema, path: dshTextSchema }),
]);
export type DshPackageSource = z.infer<typeof dshSourceSchema>;

export const dshGrantSchema = z.strictObject({
  revision: dshIdentifierSchema,
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  nativeCode: z.literal(true),
  nativeUi: z.boolean(),
  executionMode: z.enum(["trusted-process", "sandboxed"]),
  filesystem: z.enum(["unrestricted", "workspace", "none"]),
  network: z.boolean(),
  subprocess: z.boolean(),
  installationScripts: z.array(dshTextSchema).max(128),
});
export type DshDomainGrant = z.infer<typeof dshGrantSchema>;

export const dshAttachmentSchema = z.strictObject({
  attachmentId: dshIdentifierSchema,
  token: z.string().min(16).max(256),
  domainId: dshIdentifierSchema,
  generation: dshPositiveSchema,
  revision: dshIdentifierSchema,
});
export type DshAttachment = z.infer<typeof dshAttachmentSchema>;
export const dshClientModeSchema = z.enum(["desktop-continuous", "web-remote-replayable"]);
export type DshClientMode = z.infer<typeof dshClientModeSchema>;

const relativePath = dshTextSchema.refine(
  (path) => path.startsWith("/") && !path.startsWith("//") && !/[\u0000-\u001f\\]/.test(path),
  "Expected a domain-relative path",
);
export const dshClientRequestSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("sdk"), method: dshTextSchema, params: dshJsonSchema }),
  z.strictObject({ kind: z.literal("plugins") }),
  z.strictObject({ kind: z.literal("client-graph") }),
  z.strictObject({ kind: z.literal("remote-stream"), endpoint: dshTextSchema, payload: dshJsonSchema }),
  z.strictObject({ kind: z.literal("stream-uplink"), streamId: dshIdentifierSchema, value: dshJsonSchema.optional(), end: z.boolean().optional() }),
  z.strictObject({
    kind: z.literal("fetch"), path: relativePath,
    method: z.enum(["GET", "HEAD", "POST"]).optional(),
    headers: z.record(z.string().min(1), z.string()).optional(),
    bodyBase64: dshBase64Schema.optional(),
  }),
]);
export type DshClientRequest = z.infer<typeof dshClientRequestSchema>;
