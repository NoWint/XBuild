import type { DshCatalogStore, DshPackageStore, DshWorkspaceScope } from "./contract.js";
import { createDshPackageStore, type DshPackageStoreOptions } from "./store.js";

export function createDshStoreWithRuntimeAnchor(
  options: Omit<DshPackageStoreOptions, "runtimeDependencyRoot">,
  runtimeDependencyRoot: string,
) {
  return createDshPackageStore({
    ...options,
    // controller 使用与原生 app-boot installationAnchor 相同目录，不用版本表伪造可用运行库。
    runtimeDependencyRoot,
  });
}

export async function listDshDomains(store: DshPackageStore, scope: DshWorkspaceScope) {
  return await store.list(scope);
}

export async function configureDshDomain(
  store: DshPackageStore,
  domainId: string,
  scope: DshWorkspaceScope,
) {
  const candidate = await store.configure(
    domainId,
    [{ id: "native-plugin", config: { enabled: true } }],
    scope,
  );
  return {
    revision: candidate.revision,
    digest: candidate.digest,
    requiresTrust: candidate.state === "awaiting-trust",
  };
}

export async function refreshDshCatalog(store: DshCatalogStore, catalogId: string) {
  const record = await store.refresh(catalogId);
  return record.catalog.entries;
}
