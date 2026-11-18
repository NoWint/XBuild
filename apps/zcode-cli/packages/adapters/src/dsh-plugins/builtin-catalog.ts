import { createHash } from "node:crypto";
import type { DshCatalog, DshCatalogEntry } from "./discovery-contract.js";

/**
 * XBuild 内置 DSH 插件市场源。
 *
 * 目的：用户首次打开 DSH 插件页时不必先去找市场 URL 才能开始浏览。内置源随应用分发，
 * 只包含**精选的、可核验来源**的社区插件，条目仍按与远程市场完全相同的规则解析
 * （见 parseDshCatalog），因此不会被特殊对待成"可信"或跳过校验。
 *
 * 约束：
 * - 内置源不联网、不执行安装脚本；它只是一个本地清单。
 * - 条目来源必须是可复现的（npm 精确版本或 GitHub 锁定 ref）；不接受浮动 tag。
 * - 用户仍然可以添加任意远程市场源，内置源不覆盖也不删除用户源。
 */
export interface DshBuiltinCatalog {
  /** 稳定的内置源 id（不是内容 hash，便于跨版本识别同一来源）。 */
  id: string;
  displayName: string;
  /** 用作 catalog.url 的虚拟标识；不参与网络请求。 */
  origin: string;
  entries: Array<{
    packageName: string;
    /** 精确版本；留空表示由市场解析最新稳定版。 */
    version?: string;
    name: string;
    description: string;
    author?: string;
    license?: string;
    repository?: string;
    category?: string;
    capabilities: string[];
  }>;
}

export const DSH_BUILTIN_CATALOG_ORIGIN = "xbuild://dsh-builtin";

/**
 * 精选条目。每一项都对应真实存在的公开包；ability 字段用于 UI 分类展示。
 * 只登记与 XBuild 固定运行库（Cordis 4.1.0 / DSH 0.2.2-rc.3）同代的插件，
 * 跨版本条目由远程市场承担，避免内置清单给出无法验证的承诺。
 */
export const DSH_BUILTIN_CATALOG: DshBuiltinCatalog = {
  id: "dsh-builtin-curated",
  displayName: "XBuild Curated",
  origin: DSH_BUILTIN_CATALOG_ORIGIN,
  entries: [
    {
      packageName: "dsh-prompt-inject",
      name: "Prompt Inject",
      description:
        "Inject a global system prompt into every model turn, including subagents and workflows, with a settings UI.",
      repository: "https://github.com/chiina66/dsh-prompt-inject",
      category: "prompt",
      capabilities: ["prompt", "settings-ui", "tool"],
    },
    {
      packageName: "dsh-client-ui-aqua-unofficial",
      version: "1.4.1",
      name: "Aqua Theme",
      description:
        "Glassmorphism theme for the Harness web UI: blur, frosted surfaces, wallpaper and motion.",
      repository: "https://github.com/afrel1024/dsh-client-ui-aqua-unofficial",
      license: "MIT",
      category: "ui",
      capabilities: ["ui-theme", "client"],
    },
  ],
};

/**
 * 把内置清单元数据转换成与远程市场一致的 DshCatalog 结构。
 * 转换后条目仍标为 unverified —— 内置只代表"来源可核验"，不代表功能已验证。
 */
export function buildBuiltinCatalog(catalog: DshBuiltinCatalog = DSH_BUILTIN_CATALOG): DshCatalog {
  const entries: DshCatalogEntry[] = catalog.entries.map((entry) => {
    const source = entry.version
      ? ({ kind: "npm", spec: `${entry.packageName}@${entry.version}`, packageName: entry.packageName } as const)
      : ({ kind: "npm", spec: entry.packageName, packageName: entry.packageName } as const);
    const identity = source.spec;
    return {
      id: `${catalog.id}:${createHash("sha256").update(identity).digest("hex").slice(0, 24)}`,
      name: entry.name,
      packageName: entry.packageName,
      source,
      description: entry.description,
      ...(entry.version ? { version: entry.version } : {}),
      ...(entry.author ? { author: entry.author } : {}),
      ...(entry.license ? { license: entry.license } : {}),
      ...(entry.repository ? { repository: entry.repository } : {}),
      ...(entry.category ? { category: entry.category } : {}),
      capabilities: entry.capabilities,
      compatibility: "unverified",
    };
  });
  return {
    id: catalog.id,
    name: catalog.displayName,
    url: catalog.origin,
    entries,
    diagnostics: [],
  };
}
