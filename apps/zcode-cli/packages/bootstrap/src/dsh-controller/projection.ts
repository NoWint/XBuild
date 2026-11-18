import type { DshPreparedRevision } from "@zcode/adapters/dsh-plugins";
import {
  dshJsonSchema, dshRevisionSummarySchema,
  type DshDiagnostic, type DshJson, type DshRevisionSummary, type DshScope,
} from "@zcode/shared/dsh-compat";

export class DshControllerError extends Error {
  constructor(readonly code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "DshControllerError";
  }
}

export function scopeKey(scope: DshScope): string {
  return `${scope.workspaceIdentity?.trim() || scope.workspacePath}\0${scope.remoteSessionId ?? ""}`;
}

export function sameScope(left: DshScope, right: DshScope): boolean {
  return scopeKey(left) === scopeKey(right) && left.workspacePath === right.workspacePath;
}

export function revisionSummary(revision: DshPreparedRevision): DshRevisionSummary {
  return dshRevisionSummarySchema.parse({
    domainId: revision.domainId, revision: revision.revision, digest: revision.digest,
    packageName: revision.packageName, manifest: revision.manifest, source: revision.source,
    dependencyInventory: revision.dependencyInventory, createdAt: revision.createdAt,
    state: revision.state, ...(revision.grant ? { grant: revision.grant } : {}),
  });
}

export function jsonResult(value: unknown): DshJson {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new DshControllerError("DSH_PROTOCOL_INVALID", "Native result is not JSON");
  return dshJsonSchema.parse(JSON.parse(encoded));
}

export function diagnostic(error: unknown): DshDiagnostic {
  const candidate = error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code : "DSH_OPERATION_FAILED";
  const code = /^DSH_[A-Z_]{1,100}$/.test(candidate) ? candidate : "DSH_OPERATION_FAILED";
  const reasons: Readonly<Record<string, string>> = {
    DSH_AWAITING_TRUST: "Native plugin revision requires authorization",
    DSH_CONFINEMENT_UNAVAILABLE: "Requested native-code confinement is unavailable",
    DSH_DISTRIBUTION_UNAVAILABLE: "Trusted native plugin distribution is unavailable",
    DSH_CONTROLLER_CLOSED: "Native plugin controller is closed",
    DSH_DOMAIN_STARTUP_FAILED: "Native plugin initialization failed",
    DSH_DOMAIN_SHUTDOWN_FAILED: "Native plugin cleanup failed",
    DSH_DOMAIN_REQUEST_FAILED: "Native plugin request failed",
    DSH_DOMAIN_RESOURCE_QUARANTINED: "Native resources remain quarantined",
  };
  // 正则脱敏无法穷尽上游凭据格式；管理诊断只映射稳定错误码，原始成功 payload 仍保持不变。
  return { code, message: reasons[code] ?? "Native plugin operation failed" };
}
