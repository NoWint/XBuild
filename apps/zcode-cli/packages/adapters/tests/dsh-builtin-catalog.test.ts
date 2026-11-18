import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildBuiltinCatalog, createDshCatalogStore } from "../src/dsh-plugins/index.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function store(builtin: boolean) {
  const root = await mkdtemp(join(tmpdir(), "dsh-catalog-"));
  roots.push(root);
  return createDshCatalogStore({
    root,
    ...(builtin ? { builtinCatalog: buildBuiltinCatalog } : {}),
  });
}

describe("built-in catalog store integration", () => {
  // 回归：catalog 目录在首次使用时不存在。早期实现直接在 readdir 的 ENOENT 上
  // return []，把内置源一并丢掉，用户第一次打开 DSH 插件页会看到空市场。
  it("surfaces the built-in catalog before any user source directory exists", async () => {
    const records = await (await store(true)).load();
    expect(records).toHaveLength(1);
    expect(records[0]!.catalog.id).toBe("dsh-builtin-curated");
    expect(records[0]!.catalog.entries.length).toBeGreaterThan(0);
  });

  it("keeps working when the built-in catalog is not enabled", async () => {
    expect(await (await store(false)).load()).toEqual([]);
  });

  it("refuses to refresh or remove the built-in catalog instead of faking success", async () => {
    const catalogStore = await store(true);
    const id = (await catalogStore.load())[0]!.catalog.id;
    await expect(catalogStore.refresh(id)).rejects.toMatchObject({ code: "DSH_INVALID_METADATA" });
    await expect(catalogStore.remove(id)).rejects.toMatchObject({ code: "DSH_INVALID_METADATA" });
  });
});
