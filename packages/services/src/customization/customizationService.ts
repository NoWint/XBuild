// 自定义内核 overrides 文件读写：load（zod 校验 + 失败回退空默认）与 save（原子写）。
// 失败安全约定见 spec §9：文件缺失/非法 → 忽略 + warning，内置默认生效，绝不抛错中断主流程。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseOverridesFile, type OverridesFileParsed } from "@zcode/shared";
import { atomicWritePrivateTextFile } from "@zcode/shared/node";

// 全局（user）与工作区（workspace）两级覆盖文件的固定落点。
const USER_OVERRIDES_RELATIVE_PATH = join(".xbuild", "custom", "overrides.json");
const WORKSPACE_OVERRIDES_RELATIVE_PATH = join(".zcode", "custom", "overrides.json");

export interface OverridesLoadResult {
  file: OverridesFileParsed;
  /** 文件非法/不可读时的警告（含路径，供自定义中心顶部警告条展示）；正常加载为 undefined。 */
  warning?: string;
}

/** 空覆盖文档：除 version 外全部走内置默认。 */
export function defaultOverrides(): OverridesFileParsed {
  return { version: 1 };
}

function loadOverridesAtPath(filePath: string): OverridesLoadResult {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (error) {
    // 缺失是常态（用户还没写过覆盖），静默回退；其它读取失败（权限、目录占位）给出警告。
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return { file: defaultOverrides() };
    }
    return { file: defaultOverrides(), warning: `overrides.json 不可读，已忽略：${filePath}` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { file: defaultOverrides(), warning: `overrides.json 不是合法 JSON，已忽略：${filePath}` };
  }
  const result = parseOverridesFile(parsed);
  if (!result.ok) {
    return {
      file: defaultOverrides(),
      warning: `overrides.json 未通过校验（版本未知或字段非法），已忽略：${filePath}`,
    };
  }
  return { file: result.value };
}

/** 读全局覆盖：<home>/.xbuild/custom/overrides.json。缺失/非法 → 空默认（非法时附带 warning）。 */
export function loadUserOverrides(homeDir: string): OverridesLoadResult {
  return loadOverridesAtPath(join(homeDir, USER_OVERRIDES_RELATIVE_PATH));
}

/** 读工作区覆盖：<workspace>/.zcode/custom/overrides.json。缺失/非法 → 空默认（非法时附带 warning）。 */
export function loadWorkspaceOverrides(workspacePath: string): OverridesLoadResult {
  return loadOverridesAtPath(join(workspacePath, WORKSPACE_OVERRIDES_RELATIVE_PATH));
}

function resolveOverridesTargetPath(
  scope: "user" | "workspace",
  opts: { homeDir: string; workspacePath?: string },
): string {
  if (scope === "user") return join(opts.homeDir, USER_OVERRIDES_RELATIVE_PATH);
  if (!opts.workspacePath) {
    throw new Error("saveOverrides: workspace 作用域需要提供 workspacePath");
  }
  return join(opts.workspacePath, WORKSPACE_OVERRIDES_RELATIVE_PATH);
}

/** 保存覆盖文件：临时文件 + rename 原子写（0600），目录不存在自动创建；文件内容不被部分写入。 */
export async function saveOverrides(
  scope: "user" | "workspace",
  opts: { homeDir: string; workspacePath?: string },
  file: OverridesFileParsed,
): Promise<void> {
  // zod 一律 safeParse：写前兜底再校验一次，拒绝未经校验的文档，避免把坏数据落盘。
  const validated = parseOverridesFile(file);
  if (!validated.ok) {
    throw new Error("saveOverrides: overrides document failed schema validation");
  }
  const targetPath = resolveOverridesTargetPath(scope, opts);
  await atomicWritePrivateTextFile(targetPath, `${JSON.stringify(validated.value, null, 2)}\n`);
}
