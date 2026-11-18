import { join, isAbsolute } from "node:path";
import { readdir, rm } from "node:fs/promises";
import { z } from "zod";
import type { DshCatalogRecord, DshCatalogStore, DshHttpsRequest } from "./contract.js";
import type { DshCatalog } from "./discovery-contract.js";
import { parseDshCatalog } from "./catalog.js";
import { DshPackageError } from "./errors.js";
import { readJson, safeIdentifier, withDirectoryLock, writeJson } from "./files.js";
import { createDshHttpsRequest, dshPublicHttpsUrl } from "./https.js";
import { dshDataSchema, parseDshStored } from "./schemas.js";

export interface DshCatalogStoreOptions {
  root: string;
  httpsRequest?: DshHttpsRequest;
  /**
   * 内置市场源提供者。返回 undefined 表示本次不启用内置源（例如测试隔离场景）。
   * 以函数形式传入是为了让目录内容可随版本升级而更新，而无需重建 store。
   */
  builtinCatalog?: () => DshCatalog | undefined;
}
const catalogRecordSchema = z.strictObject({
  original: dshDataSchema,
  updatedAt: z.iso.datetime(),
  sourceUrl: z.string().url(),
  catalogId: z.string().regex(/^dsh-[a-f0-9]{20}$/),
});

export function createDshCatalogStore(options: DshCatalogStoreOptions): DshCatalogStore {
  if (!isAbsolute(options.root))
    throw new DshPackageError("DSH_INVALID_METADATA", "Catalog inventory root must be absolute");
  const directory = join(options.root, "catalogs");
  const http = options.httpsRequest ?? createDshHttpsRequest();
  const path = (id: string) => join(directory, `${safeIdentifier(id, "catalog id")}.json`);
  async function read(id: string): Promise<DshCatalogRecord> {
    const stored = parseDshStored(
      catalogRecordSchema,
      await readJson(path(id)),
      "catalog metadata",
    );
    const catalog = parseDshCatalog(stored.original, dshPublicHttpsUrl(stored.sourceUrl));
    if (catalog.id !== id || stored.catalogId !== id)
      throw new DshPackageError("DSH_INVALID_METADATA", "Catalog identity mismatch");
    return { catalog, original: stored.original, updatedAt: stored.updatedAt };
  }
  async function fetchAndWrite(url: string, signal?: AbortSignal): Promise<DshCatalogRecord> {
    const sourceUrl = dshPublicHttpsUrl(url);
    const response = await http.request(sourceUrl, {
      signal,
      maxBytes: 4 * 1024 * 1024,
      timeoutMs: 30000,
    });
    if (response.bytes.byteLength > 4 * 1024 * 1024)
      throw new DshPackageError("DSH_HTTP_FAILED", "Catalog exceeds byte limit");
    let value: unknown;
    try {
      value = JSON.parse(Buffer.from(response.bytes).toString("utf8"));
    } catch (error) {
      throw new DshPackageError("DSH_INVALID_METADATA", "Catalog is not valid JSON", {
        cause: error,
      });
    }
    const original = parseDshStored(dshDataSchema, value, "catalog content");
    const catalog = parseDshCatalog(original, sourceUrl);
    const updatedAt = new Date().toISOString();
    await writeJson(path(catalog.id), { original, updatedAt, sourceUrl, catalogId: catalog.id });
    return { catalog, original, updatedAt };
  }
  return {
    async load() {
      let entries: string[];
      try {
        entries = await readdir(directory);
      } catch (error) {
        // 目录尚未创建是首次使用时的正常状态；不能因此丢掉内置源，
        // 否则用户第一次打开 DSH 插件页会看到空市场。
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        entries = [];
      }
      const records: DshCatalogRecord[] = [];
      // 内置源始终可用：用户首次打开即可浏览，无需先自己找市场 URL。
      // 它不写入目录、不能被 remove/refresh，因此不会与用户源的生命周期混淆。
      const builtin = options.builtinCatalog?.();
      if (builtin) {
        records.push({
          catalog: builtin,
          // 内置源不来自远程字节；original 只保留可序列化的展示元数据。
          original: {
            builtin: true,
            name: builtin.name,
            entryCount: builtin.entries.length,
          },
          updatedAt: new Date(0).toISOString(),
        });
      }
      for (const entry of entries.sort()) {
        if (/^dsh-[a-f0-9]{20}\.json$/.test(entry)) records.push(await read(entry.slice(0, -5)));
      }
      return records;
    },
    async add(url, input = {}) {
      return await withDirectoryLock(directory, () => fetchAndWrite(url, input.signal));
    },
    async refresh(id, input = {}) {
      // 内置源没有远程地址可刷新，明确拒绝而不是返回一份看似成功的旧数据。
      if (options.builtinCatalog?.()?.id === id)
        throw new DshPackageError("DSH_INVALID_METADATA", "Built-in catalog cannot be refreshed");
      return await withDirectoryLock(directory, async () =>
        fetchAndWrite((await read(id)).catalog.url, input.signal),
      );
    },
    async remove(id) {
      if (options.builtinCatalog?.()?.id === id)
        throw new DshPackageError("DSH_INVALID_METADATA", "Built-in catalog cannot be removed");
      await withDirectoryLock(directory, () => rm(path(id)));
    },
  };
}
