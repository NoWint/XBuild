import type { DshData, DshPackageSource } from "./discovery-contract.js";
export type {
  DshData,
  DshPackageSource,
  DshCatalogEntry,
  DshCatalog,
} from "./discovery-contract.js";

export interface DshPackageManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  repository?: string;
  homepage?: string;
  entry?: string;
  clientEntry?: string;
  bundlePatches: string[];
  profileBundles: string[];
  dependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  engines: Record<string, string>;
  scripts: Record<string, string>;
  raw: Record<string, DshData>;
}

export interface DshWorkspaceScope {
  workspacePath: string;
  workspaceIdentity?: string;
  remoteSessionId?: string;
}

export interface DshDomainGrant {
  revision: string;
  digest: string;
  nativeCode: true;
  nativeUi: boolean;
  executionMode: "trusted-process" | "sandboxed";
  filesystem: "unrestricted" | "workspace" | "none";
  network: boolean;
  subprocess: boolean;
  installationScripts: string[];
}

export interface DshPreparedRevision {
  domainId: string;
  revision: string;
  digest: string;
  workspaceKey: string;
  scope: DshWorkspaceScope;
  profileDirectory: string;
  packageName: string;
  manifest: DshPackageManifest;
  source: DshPackageSource;
  provenance: DshRevisionProvenance;
  dependencyInventory: Array<{ name: string; version: string; integrity?: string }>;
  createdAt: string;
  state: "awaiting-trust" | "trusted";
  grant?: DshDomainGrant;
}

export interface DshDomainRecord {
  domainId: string;
  workspaceKey: string;
  scope: DshWorkspaceScope;
  activeRevision?: string;
  previousRevision?: string;
  preparedRevision?: string;
  enabled: boolean;
  revisions: string[];
  updatedAt: string;
  dataDirectory: string;
  diagnostic?: string;
}

export interface DshPackageCommand {
  run(
    args: readonly string[],
    options: { cwd: string; signal?: AbortSignal },
  ): Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

export interface DshPrepareInstallation {
  source: string | DshPackageSource;
  scope: DshWorkspaceScope;
  domainId?: string;
  baseBundles?: string[];
  configPatches?: DshData[];
  signal?: AbortSignal;
}

export interface DshRevisionProvenance {
  source: DshPackageSource;
  baseBundles: string[];
  configPatches: DshData[];
  configuredFrom?: string;
}

export interface DshPackageStore {
  list(scope: DshWorkspaceScope): Promise<DshDomainRecord[]>;
  prepare(input: DshPrepareInstallation): Promise<DshPreparedRevision>;
  configure(
    domainId: string,
    patches: DshData[],
    scope: DshWorkspaceScope,
  ): Promise<DshPreparedRevision>;
  update(
    domainId: string,
    scope: DshWorkspaceScope,
    options?: { signal?: AbortSignal },
  ): Promise<DshPreparedRevision>;
  readRevision(
    domainId: string,
    revision: string,
    scope: DshWorkspaceScope,
  ): Promise<DshPreparedRevision>;
  authorize(
    domainId: string,
    grant: DshDomainGrant,
    scope: DshWorkspaceScope,
  ): Promise<DshPreparedRevision>;
  verify(
    domainId: string,
    revision: string,
    scope: DshWorkspaceScope,
  ): Promise<DshPreparedRevision>;
  activate(domainId: string, revision: string, scope: DshWorkspaceScope): Promise<DshDomainRecord>;
  setEnabled(
    domainId: string,
    enabled: boolean,
    scope: DshWorkspaceScope,
  ): Promise<DshDomainRecord>;
  uninstall(
    domainId: string,
    scope: DshWorkspaceScope,
    options?: { deleteData?: boolean },
  ): Promise<void>;
}
export type { DshCatalogRecord, DshCatalogStore, DshHttpsRequest } from "./catalog-contract.js";
