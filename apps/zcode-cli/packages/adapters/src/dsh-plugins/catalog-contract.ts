import type { DshCatalog, DshData } from "./discovery-contract.js";

export interface DshHttpsRequest {
  request(
    url: string,
    options: { signal?: AbortSignal; maxBytes: number; timeoutMs: number },
  ): Promise<{ bytes: Uint8Array }>;
}

export interface DshCatalogRecord {
  catalog: DshCatalog;
  original: DshData;
  updatedAt: string;
}

export interface DshCatalogStore {
  load(): Promise<DshCatalogRecord[]>;
  add(url: string, options?: { signal?: AbortSignal }): Promise<DshCatalogRecord>;
  refresh(catalogId: string, options?: { signal?: AbortSignal }): Promise<DshCatalogRecord>;
  remove(catalogId: string): Promise<void>;
}
