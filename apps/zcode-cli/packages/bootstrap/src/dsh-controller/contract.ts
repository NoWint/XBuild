import type { DshCatalogStore, DshPackageStore } from "@zcode/adapters/dsh-plugins";
import type { DshDomain, DshDomainRunner, DshDomainStartOptions } from "@zcode/dsh-runtime";
import type {
  DshDispatch, DshEvent, DshLocalDiscovery, DshResult, DshScope,
} from "@zcode/shared/dsh-compat";

export interface DshController {
  /** Management writes await persistence and native lifecycle; invoke returns the original receipt. */
  dispatch(input: DshDispatch, options?: { signal?: AbortSignal }): Promise<DshResult>;
  subscribe(listener: (event: DshEvent) => void): () => void;
  /** Closes admission, cancels leases and awaits every native domain exit. Idempotent. */
  shutdown(): Promise<void>;
}

export interface DshControllerOptions {
  packages: DshPackageStore;
  catalogs(scope: DshScope): DshCatalogStore;
  runtimeVersions: Readonly<Record<string, string>>;
  installationAnchor: string;
  startDomain(options: DshDomainStartOptions): Promise<DshDomain>;
  runner?: DshDomainRunner;
  /** Launcher-owned explicit values only, never inherited from the Host environment. */
  environment?: Readonly<Record<string, string>>;
  /**
   * 本机 DSH 安装探测。仅读本地磁盘，不联网；失败只影响 local 字段，不让 overview 整体失败。
   * 由 launcher 注入，便于测试隔离真实 home。
   */
  discoverLocal?(options: { signal?: AbortSignal }): Promise<DshLocalDiscovery>;
}

export type DshLauncherRunner =
  | { kind: "node"; executable: string }
  | { kind: "electron-node"; executable: string; packageManagerExecutable: string }
  | { kind: "sea"; executable: string };

/** Trusted CLI distribution inputs, never accepted from a plugin dispatch request. */
export type DshLauncherDistribution = {
  runner: DshLauncherRunner;
} & (
  | { kind: "development"; launcherAnchor: string }
  | { kind: "staged"; root: string }
);

export interface DshDefaultControllerOptions {
  cliStorageRoot: string;
  distribution?: DshLauncherDistribution;
}
