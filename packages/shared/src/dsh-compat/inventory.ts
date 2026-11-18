import { z } from "zod";
import {
  dshGrantSchema, dshIdentifierSchema, dshJsonObjectSchema,
  dshScopeSchema, dshSourceSchema, dshTextSchema, DSH_LIMITS,
} from "./values.js";

const strings = z.array(dshTextSchema).max(50_000);
const stringMap = z.record(z.string().min(1), z.string());
export const dshManifestSchema = z.strictObject({
  name: dshTextSchema, version: dshTextSchema,
  description: z.string().optional(), author: z.string().optional(),
  license: z.string().optional(), repository: z.string().optional(),
  homepage: z.string().optional(), entry: z.string().optional(),
  clientEntry: z.string().optional(),
  bundlePatches: strings, profileBundles: strings,
  dependencies: stringMap, peerDependencies: stringMap,
  engines: stringMap, scripts: stringMap,
  raw: dshJsonObjectSchema,
});
export type DshPackageManifest = z.infer<typeof dshManifestSchema>;

export const dshCatalogEntrySchema = z.strictObject({
  id: dshIdentifierSchema, name: dshTextSchema,
  packageName: dshTextSchema.optional(), source: dshSourceSchema,
  description: z.string().optional(), descriptionI18n: stringMap.optional(),
  version: z.string().optional(), author: z.string().optional(),
  license: z.string().optional(), repository: z.string().optional(),
  icon: z.string().optional(), category: z.string().optional(),
  capabilities: strings, compatibility: z.literal("unverified"),
});
export const dshCatalogSchema = z.strictObject({
  id: dshIdentifierSchema, name: dshTextSchema, url: dshTextSchema,
  entries: z.array(dshCatalogEntrySchema).max(50_000),
  diagnostics: z.array(z.strictObject({
    index: z.number().int().nonnegative(), message: z.string().max(DSH_LIMITS.diagnostics),
  })).max(50_000),
});
export type DshCatalog = z.infer<typeof dshCatalogSchema>;
export type DshCatalogEntry = z.infer<typeof dshCatalogEntrySchema>;

export const dshRevisionSummarySchema = z.strictObject({
  domainId: dshIdentifierSchema, revision: dshIdentifierSchema,
  digest: z.string().regex(/^[a-f0-9]{64}$/), packageName: dshTextSchema,
  manifest: dshManifestSchema, source: dshSourceSchema,
  dependencyInventory: z.array(z.strictObject({
    name: dshTextSchema, version: dshTextSchema, integrity: z.string().optional(),
  })).max(20_000),
  createdAt: dshTextSchema, state: z.enum(["awaiting-trust", "trusted"]),
  grant: dshGrantSchema.optional(),
});
export type DshRevisionSummary = z.infer<typeof dshRevisionSummarySchema>;

export const dshDiagnosticSchema = z.strictObject({
  code: dshIdentifierSchema, message: z.string().max(DSH_LIMITS.diagnostics),
});
export type DshDiagnostic = z.infer<typeof dshDiagnosticSchema>;
export const dshInstalledDomainSchema = z.strictObject({
  domainId: dshIdentifierSchema, scope: dshScopeSchema,
  enabled: z.boolean(), activeRevision: dshIdentifierSchema.optional(),
  previousRevision: dshIdentifierSchema.optional(),
  preparedRevision: dshIdentifierSchema.optional(),
  revisions: strings, revision: dshRevisionSummarySchema.optional(),
  state: z.enum(["awaiting-trust", "starting", "running", "stopping", "stopped", "failed", "environment-limited"]),
  generation: z.number().int().nonnegative(),
  runtimeVersion: z.string().optional(),
  compatibility: z.enum(["native-equivalent", "verified-mapping", "native-runtime-required", "environment-limited", "unverified", "incompatible"]),
  diagnostics: z.array(dshDiagnosticSchema).max(128),
});
export type DshInstalledDomain = z.infer<typeof dshInstalledDomainSchema>;

/**
 * 本机已安装 DSH 插件的只读探测结果。
 * 目的是让用户不必重新下载已有插件：XBuild 直接发现本机 DSH profile 里的第三方包，
 * 以本地目录作为来源导入。发现不等于授权，导入仍需经过准备/授权流程。
 */
export const dshLocalPluginSchema = z.strictObject({
  packageName: dshTextSchema,
  version: dshTextSchema,
  profile: dshTextSchema,
  /** 包目录绝对路径；来源由后端据此构造，前端不参与路径推导。 */
  directory: dshTextSchema,
  description: z.string().optional(),
  author: z.string().optional(),
  license: z.string().optional(),
  /** 已声明的能力面，供 UI 分类展示（bundle / client / profile）。 */
  capabilities: strings,
  thirdParty: z.boolean(),
  /** 是否已在当前 scope 安装（按包名匹配），避免重复导入。 */
  alreadyInstalled: z.boolean(),
});
export type DshLocalPlugin = z.infer<typeof dshLocalPluginSchema>;
export const dshLocalDiscoverySchema = z.strictObject({
  home: dshTextSchema,
  profiles: z.array(z.strictObject({
    name: dshTextSchema,
    bundles: strings,
  })).max(512),
  plugins: z.array(dshLocalPluginSchema).max(4096),
  diagnostics: z.array(z.strictObject({
    subject: dshTextSchema,
    message: z.string().max(DSH_LIMITS.diagnostics),
  })).max(512),
});
export type DshLocalDiscovery = z.infer<typeof dshLocalDiscoverySchema>;

export const dshOverviewSchema = z.strictObject({
  catalogs: z.array(dshCatalogSchema).max(1024),
  domains: z.array(dshInstalledDomainSchema).max(4096),
  runtimeVersions: stringMap,
  /** 本机 DSH 探测结果；无 DSH 安装时为空列表而不是错误。 */
  local: dshLocalDiscoverySchema.optional(),
});
export type DshOverview = z.infer<typeof dshOverviewSchema>;
