export type DshPackageErrorCode =
  | "DSH_INVALID_SOURCE"
  | "DSH_MUTABLE_SOURCE"
  | "DSH_INTEGRITY_REQUIRED"
  | "DSH_INVALID_METADATA"
  | "DSH_SCOPE_MISMATCH"
  | "DSH_REVISION_UNKNOWN"
  | "DSH_AWAITING_TRUST"
  | "DSH_INTEGRITY_MISMATCH"
  | "DSH_LOCKED"
  | "DSH_INSTALL_FAILED"
  | "DSH_COMMAND_INVALID"
  | "DSH_COMMAND_CANCELLED"
  | "DSH_COMMAND_LIMIT"
  | "DSH_HTTP_FAILED"
  | "DSH_DOMAIN_ENABLED";

export class DshPackageError extends Error {
  constructor(
    readonly code: DshPackageErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "DshPackageError";
  }
}
