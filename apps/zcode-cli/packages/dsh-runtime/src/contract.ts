export type DshJson = null | boolean | number | string | DshJson[] | { [key: string]: DshJson };

export interface DshWorkspace {
  workspacePath: string;
  workspaceIdentity?: string;
  remoteSessionId?: string;
}

export interface DshDataMaintenanceOptions {
  domainId: string;
  workspace: DshWorkspace;
  dataDirectory: string;
}

export interface DshDomainRunner {
  executable: string;
  /** Prefix selects the CLI's embedded worker for SEA; absent uses the built Node worker. */
  argsPrefix?: string[];
}

export interface DshDomainStartOptions {
  domainId: string;
  revision: string;
  generation: number;
  workspace: DshWorkspace;
  profileDirectory: string;
  installationAnchor: string;
  dataDirectory: string;
  /** An explicit environment, never implicitly merged with process.env. */
  environment: Record<string, string>;
  runner?: DshDomainRunner;
  /** Only liveness bounds; a native model turn has no fixed request deadline. */
  startupTimeoutMs?: number;
  shutdownTimeoutMs?: number;
  onHostRequest?: (
    method: string,
    params: DshJson,
    context: { signal: AbortSignal },
  ) => Promise<DshJson>;
}

export type DshDomainRequest =
  | { kind: "sdk"; method: string; params: DshJson }
  | { kind: "plugins" }
  | { kind: "client-graph" }
  | { kind: "peer-open"; peerId: string; interactions: "answer" | "none" }
  | { kind: "peer-close"; peerId: string }
  | { kind: "remote-stream"; peerId: string; streamId: string; endpoint: string; payload: DshJson }
  | { kind: "stream-uplink"; peerId: string; streamId: string; value?: DshJson; end?: boolean }
  | {
      kind: "fetch";
      peerId?: string;
      path: string;
      method?: "GET" | "HEAD" | "POST";
      headers?: Record<string, string>;
      bodyBase64?: string;
    };

export interface DshSdkNotification {
  jsonrpc: "2.0";
  method: string;
  params?: DshJson;
}

export type DshFetchResult = {
  status: number;
  statusText: string;
  headers: Record<string, string>;
} & ({ bodyBase64: string; streamId?: never } | { streamId: string; bodyBase64?: never });

export type DshStreamPayload =
  | { streamId: string; event: "chunk"; chunkBase64: string }
  | { streamId: string; event: "end" }
  | { streamId: string; event: "error"; error: string };

export type DshRemoteStreamPayload =
  | { peerId: string; streamId: string; event: "data"; value?: DshJson }
  | { peerId: string; streamId: string; event: "end" }
  | { peerId: string; streamId: string; event: "error"; error: { code: string; message: string; details: DshJson } };

export interface DshInvocationOptions {
  signal?: AbortSignal;
  onHostRequest?: DshDomainStartOptions["onHostRequest"];
}

export interface DshInvocation {
  result: Promise<DshJson>;
  /** Native work has actually unwound; a receipt does not settle this promise. */
  settled: Promise<void>;
  cancel(): void;
}

export type DshDomainErrorCode =
  | "DSH_DOMAIN_INVALID_OPTIONS"
  | "DSH_DOMAIN_CONFLICT"
  | "DSH_DOMAIN_PLATFORM_UNSUPPORTED"
  | "DSH_DOMAIN_RESOURCE_QUARANTINED"
  | "DSH_DOMAIN_STARTUP_FAILED"
  | "DSH_DOMAIN_STARTUP_TIMEOUT"
  | "DSH_DOMAIN_REQUEST_FAILED"
  | "DSH_DOMAIN_CANCELLED"
  | "DSH_DOMAIN_STOPPED"
  | "DSH_DOMAIN_EXITED"
  | "DSH_DOMAIN_SHUTDOWN_FAILED"
  | "DSH_DOMAIN_SHUTDOWN_TIMEOUT"
  | "DSH_DOMAIN_PROTOCOL_ERROR";

export interface DshDomainInfo {
  domainId: string;
  revision: string;
  generation: number;
  workspace: DshWorkspace;
  state: "starting" | "running" | "stopping" | "stopped" | "failed";
  pid?: number;
  runtimeVersion: string;
}

export interface DshDomainEvent {
  domainId: string;
  generation: number;
  /** Transport ordering only; original Session sequence remains in payload. */
  sequence: number;
  kind: "notification" | "log" | "exit" | "stream";
  payload: DshJson;
}

export interface DshDomain {
  readonly info: DshDomainInfo;
  invoke(request: DshDomainRequest, options?: DshInvocationOptions): DshInvocation;
  request(request: DshDomainRequest, options?: DshInvocationOptions): Promise<DshJson>;
  subscribe(listener: (event: DshDomainEvent) => void): () => void;
  /** Confirms native and observed process cleanup; unverifiable release quarantines data. Idempotent. */
  stop(): Promise<void>;
}
