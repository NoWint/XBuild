# XBuild 自定义内核 P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地自定义内核 P0——能力注册表 + overrides 覆盖文件 + 提示词管线过滤 + 3 个 loop 钩子节点 + 侧栏面板注册制 + 自定义中心设置页。

**Architecture:** 一个无副作用的 Capability Registry（清单 + 三层合并器），用户覆盖存 `~/.xbuild/custom/overrides.json`（workspace `.zcode/custom/overrides.json` 可叠加，zod 校验，非法即忽略）。提示词在 `builder.ts` 组装后过一层 `applyPromptOverrides`。loop 钩子复用现有 settings hooks 执行器（`packages/services/src/hooks/hooksService.ts`），新增 beforeModel/turnEnd/compact 三个事件。面板槽位由注册表顺序/开关驱动侧栏渲染。

**Tech Stack:** TypeScript, zod（shared 校验）, vitest, pnpm monorepo, React（packages/ui）。

**Spec:** `docs/superpowers/specs/2026-10-31-customization-kernel-design.md`

## Global Constraints

- 仓库根：`/Users/xiatian/Desktop/projects/Xbuild`（下称 `$R`）。所有命令在 `$R` 下执行（除非注明 `cd apps/zcode-cli`）。
- 类型检查：`pnpm typecheck`（根）。单测：`npx vitest run <file>`（根目录，或 `cd apps/zcode-cli && npx vitest run <file>`）。构建验证：`pnpm build`。
- 提交：每个 Task 一次 commit，命令用 `git -c core.hooksPath=/dev/null commit`（跳过 husky）。
- 禁止：引入新运行时/worker/DI 框架；修改 node_modules；把 features 开关写进 overrides.json（走现有 settings 键）。
- 覆盖文件应用点必须 try/catch 回退内置；zod 一律 `safeParse`。
- 代码注释用中文、与周边文件风格一致（现有 core 代码即此风格）。
- 新文件全部遵循 repo 现有 ESM `.js` 后缀 import 习惯（如 `./x.js`）。

## Phase 1（Task 1-3，可三路并行）

---

### Task 1: shared 类型 + zod schema

**Files:**
- Create: `packages/shared/src/customization/types.ts`
- Create: `packages/shared/src/customization/schema.ts`
- Test: `packages/shared/src/customization/schema.test.ts`
- Modify: `packages/shared/src/index.ts`（追加 re-export，一行）

**Interfaces:**
- Produces: `OverridesFile`、`PromptSectionOverride`、`PromptAppendEntry`、`HookRule`、`LoopParams`、`PanelsOverride`、`overridesFileSchema`（zod）、`parseOverridesFile(input: unknown): { ok: true; value: OverridesFile } | { ok: false }`
- 后续所有 Task 只从这里 import 这批名字。

- [ ] **Step 1: 写 types.ts**

```ts
// 自定义内核共享类型：overrides 文档结构与能力清单。
export type CapabilityType = "prompt-section" | "loop-node" | "panel" | "feature";

export interface Capability {
  id: string; // "prompt.identity" / "panel.automations" / "loop.beforeModel" / "feature.memory"
  type: CapabilityType;
  title: string;
  description?: string;
  defaultEnabled: boolean;
}

export interface PromptSectionOverride {
  enabled?: boolean;
  replace?: string; // 整段替换文本；与 enabled 并用
}

export interface PromptAppendEntry {
  id: string; // 自定义段 id，不得与内置 section source 冲突
  title: string;
  after?: string; // 锚点：内置 section source；缺省/未找到 → 末尾追加
  text: string;
}

export type HookAction = { inject?: string } & { run?: string; timeoutMs?: number };

export interface HookRule extends HookAction {}

export interface LoopParams {
  maxTurns?: number;
  maxToolCallsPerTurn?: number;
}

export interface PanelsOverride {
  order?: string[]; // 面板 id 全序（未列出的排其后，按注册顺序）
  disabled?: string[];
}

export interface OverridesFile {
  version: 1;
  promptSections?: Record<string, PromptSectionOverride>;
  promptAppend?: PromptAppendEntry[];
  env?: Record<string, string>;
  loop?: LoopParams;
  hooks?: { beforeModel?: HookRule[]; turnEnd?: HookRule[]; compact?: HookRule[] };
  panels?: PanelsOverride;
}
```

- [ ] **Step 2: 写 schema.ts（zod）**

```ts
import { z } from "zod";

const promptSectionOverrideSchema = z
  .object({
    enabled: z.boolean().optional(),
    replace: z.string().optional(),
  })
  .strict();

const promptAppendEntrySchema = z
  .object({
    id: z.string().min(1).regex(/^[a-z0-9.-]+$/, "id 仅允许小写字母数字点连字符"),
    title: z.string().min(1),
    after: z.string().min(1).optional(),
    text: z.string(),
  })
  .strict();

const hookActionSchema = z
  .object({
    inject: z.string().optional(),
    run: z.string().min(1).optional(),
    timeoutMs: z.number().int().positive().max(120_000).optional(),
  })
  .strict()
  .refine((v) => v.inject !== undefined || v.run !== undefined, "inject 与 run 至少其一");

const hookRuleSchema = hookActionSchema;

const loopParamsSchema = z
  .object({
    maxTurns: z.number().int().positive().max(10_000).optional(),
    maxToolCallsPerTurn: z.number().int().positive().max(100_000).optional(),
  })
  .strict();

const panelsOverrideSchema = z
  .object({
    order: z.array(z.string().min(1)).optional(),
    disabled: z.array(z.string().min(1)).optional(),
  })
  .strict();

export const overridesFileSchema = z
  .object({
    version: z.literal(1),
    promptSections: z.record(z.string(), promptSectionOverrideSchema).optional(),
    promptAppend: z.array(promptAppendEntrySchema).optional(),
    env: z.record(z.string(), z.string().min(1)).optional(),
    loop: loopParamsSchema.optional(),
    hooks: z
      .object({
        beforeModel: z.array(hookRuleSchema).optional(),
        turnEnd: z.array(hookRuleSchema).optional(),
        compact: z.array(hookRuleSchema).optional(),
      })
      .strict()
      .optional(),
    panels: panelsOverrideSchema.optional(),
  })
  .strict();

export type OverridesFileParsed = z.infer<typeof overridesFileSchema>;

export function parseOverridesFile(input: unknown):
  | { ok: true; value: OverridesFileParsed }
  | { ok: false } {
  const result = overridesFileSchema.safeParse(input);
  return result.success ? { ok: true, value: result.data } : { ok: false };
}
```

- [ ] **Step 3: index.ts 追加 re-export**

在 `packages/shared/src/index.ts` 追加：
```ts
export * from "./customization/types.js";
export * from "./customization/schema.js";
```
（若该文件用命名导出清单而非 `export *`，按文件现有风格逐个追加导出。）

- [ ] **Step 4: 写失败测试 schema.test.ts**

```ts
import { describe, expect, it } from "vitest";
import { parseOverridesFile } from "./schema.js";

describe("parseOverridesFile", () => {
  it("接受合法最小文档", () => {
    const r = parseOverridesFile({ version: 1 });
    expect(r.ok).toBe(true);
  });

  it("接受完整文档", () => {
    const r = parseOverridesFile({
      version: 1,
      promptSections: { identity: { enabled: true, replace: "hi" } },
      promptAppend: [{ id: "my-rules", title: "My Rules", after: "identity", text: "x" }],
      env: { A: "b" },
      loop: { maxTurns: 64 },
      hooks: { beforeModel: [{ inject: "x" }, { run: "a.sh", timeoutMs: 5000 }] },
      panels: { order: ["tasks"], disabled: ["automations"] },
    });
    expect(r.ok).toBe(true);
  });

  it("拒绝未知 version", () => {
    expect(parseOverridesFile({ version: 2 }).ok).toBe(false);
  });

  it("拒绝未知字段（strict）", () => {
    expect(parseOverridesFile({ version: 1, hacker: true }).ok).toBe(false);
  });

  it("拒绝既无 inject 也无 run 的钩子规则", () => {
    expect(parseOverridesFile({ version: 1, hooks: { beforeModel: [{}] } }).ok).toBe(false);
  });

  it("拒绝非法追加段 id", () => {
    expect(
      parseOverridesFile({ version: 1, promptAppend: [{ id: "Bad Id", title: "t", text: "x" }] }).ok,
    ).toBe(false);
  });
});
```

- [ ] **Step 5: 运行验证**

Run: `npx vitest run packages/shared/src/customization/schema.test.ts`
Expected: PASS（6 tests）。若 vitest 未扫到该路径，检查根 `vitest.config.ts` include 模式并按现有 shared 测试文件位置惯例调整测试文件位置（保持 schema.test.ts 与 schema.ts 同目录为首选）。

- [ ] **Step 6: 提交**

```bash
git add packages/shared/src/customization packages/shared/src/index.ts
git -c core.hooksPath=/dev/null commit -m "feat(customization): shared overrides types + zod schema"
```

---

### Task 2: core 注册表 + 三层合并器

**Files:**
- Create: `packages/core/src/customization/registry.ts`
- Test: `packages/core/src/customization/registry.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `Capability`、`OverridesFileParsed`
- Produces:
  - `registerCapabilities(caps: Capability[]): void`（内置代码在各组装点上报；重复 id 幂等）
  - `getRegisteredCapabilities(): Capability[]`
  - `resetCapabilitiesForTest(): void`
  - `resolveEffective(caps: Capability[], user?: OverridesFileParsed, workspace?: OverridesFileParsed): EffectiveConfig`
  - `interface EffectiveConfig { enabled: ReadonlyMap<string, boolean>; promptSections: ReadonlyMap<string, { enabled: boolean; replace?: string }>; promptAppend: readonly PromptAppendEntry[]; env: Readonly<Record<string, string>>; loop: Required<Pick<LoopParams, never>> & LoopParams; hooks: { beforeModel: HookRule[]; turnEnd: HookRule[]; compact: HookRule[] }; panels: { order: string[]; disabled: string[] } }`

- [ ] **Step 1: 写失败测试 registry.test.ts**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { registerCapabilities, resolveEffective, resetCapabilitiesForTest } from "./registry.js";
import type { Capability } from "@zcode/shared";

const cap = (id: string, type: Capability["type"], defaultEnabled = true): Capability => ({
  id,
  type,
  title: id,
  defaultEnabled,
});

describe("resolveEffective", () => {
  beforeEach(() => resetCapabilitiesForTest());

  it("无覆盖时用内置默认", () => {
    const caps = [cap("prompt.identity", "prompt-section"), cap("panel.tasks", "panel", false)];
    const eff = resolveEffective(caps);
    expect(eff.enabled.get("prompt.identity")).toBe(true);
    expect(eff.enabled.get("panel.tasks")).toBe(false);
  });

  it("workspace > user > builtin", () => {
    const caps = [cap("panel.tasks", "panel", true)];
    const user = { version: 1 as const, panels: { disabled: ["panel.tasks"] } };
    const ws = { version: 1 as const, panels: { disabled: [] } };
    expect(resolveEffective(caps, user).enabled.get("panel.tasks")).toBe(false);
    expect(resolveEffective(caps, user, ws).enabled.get("panel.tasks")).toBe(true);
  });

  it("promptAppend 按 user → workspace 顺序拼接", () => {
    const user = {
      version: 1 as const,
      promptAppend: [{ id: "a", title: "A", text: "1" }],
    };
    const ws = {
      version: 1 as const,
      promptAppend: [{ id: "b", title: "B", text: "2" }],
    };
    const eff = resolveEffective([], user, ws);
    expect(eff.promptAppend.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("env 合并且 workspace 覆盖 user", () => {
    const user = { version: 1 as const, env: { A: "1", B: "1" } };
    const ws = { version: 1 as const, env: { B: "2" } };
    const eff = resolveEffective([], user, ws);
    expect(eff.env).toEqual({ A: "1", B: "2" });
  });

  it("promptSections 开关与 replace 透传", () => {
    const user = {
      version: 1 as const,
      promptSections: { identity: { enabled: false }, harness: { replace: "# H" } },
    };
    const eff = resolveEffective([cap("prompt.identity", "prompt-section")], user);
    expect(eff.promptSections.get("identity")?.enabled).toBe(false);
    expect(eff.promptSections.get("harness")?.replace).toBe("# H");
  });

  it("panels.order 未列出的面板按注册顺序排其后", () => {
    const caps = [cap("panel.a", "panel"), cap("panel.b", "panel"), cap("panel.c", "panel")];
    const user = { version: 1 as const, panels: { order: ["panel.c"] } };
    const eff = resolveEffective(caps, user);
    expect(eff.panels.order).toEqual(["panel.c", "panel.a", "panel.b"]);
  });

  it("hooks 数组合并（user 与 workspace 拼接）", () => {
    const user = { version: 1 as const, hooks: { beforeModel: [{ inject: "u" }] } };
    const ws = { version: 1 as const, hooks: { beforeModel: [{ inject: "w" }] } };
    const eff = resolveEffective([], user, ws);
    expect(eff.hooks.beforeModel.map((h) => h.inject)).toEqual(["u", "w"]);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run packages/core/src/customization/registry.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 registry.ts**

```ts
// 自定义内核：能力清单 + 三层合并（builtin ← user ← workspace）。
// 刻意保持无状态、无副作用：不做 DI、不做热重载（见 spec §3）。
import type {
  Capability,
  HookRule,
  LoopParams,
  OverridesFileParsed,
  PromptAppendEntry,
} from "@zcode/shared";

const registered: Capability[] = [];
const seen = new Set<string>();

export function registerCapabilities(caps: readonly Capability[]): void {
  for (const c of caps) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    registered.push(c);
  }
}

export function getRegisteredCapabilities(): readonly Capability[] {
  return registered;
}

export function resetCapabilitiesForTest(): void {
  registered.length = 0;
  seen.clear();
}

export interface EffectiveConfig {
  enabled: ReadonlyMap<string, boolean>;
  promptSections: ReadonlyMap<string, { enabled: boolean; replace?: string }>;
  promptAppend: readonly PromptAppendEntry[];
  env: Readonly<Record<string, string>>;
  loop: LoopParams;
  hooks: { beforeModel: HookRule[]; turnEnd: HookRule[]; compact: HookRule[] };
  panels: { order: string[]; disabled: string[] };
}

function mergePanels(
  caps: readonly Capability[],
  user: OverridesFileParsed | undefined,
  workspace: OverridesFileParsed | undefined,
): { order: string[]; disabled: string[] } {
  const panelIds = caps.filter((c) => c.type === "panel").map((c) => c.id);
  const order = [...(workspace?.panels?.order ?? user?.panels?.order ?? [])];
  for (const id of panelIds) if (!order.includes(id)) order.push(id);
  const disabled = new Set([...(user?.panels?.disabled ?? []), ...(workspace?.panels?.disabled ?? [])]);
  return { order, disabled: [...disabled] };
}

export function resolveEffective(
  caps: readonly Capability[],
  user?: OverridesFileParsed,
  workspace?: OverridesFileParsed,
): EffectiveConfig {
  const enabled = new Map<string, boolean>();
  for (const c of caps) {
    const ws = workspace?.panels?.disabled?.includes(c.id);
    // 逐能力 enabled：panel 走 panels.disabled；其余走专用键（当前无，默认 builtin）
    enabled.set(c.id, ws ? false : c.defaultEnabled);
  }
  // prompt 开关：显式 promptSections 键优先于 defaultEnabled
  const promptSections = new Map<string, { enabled: boolean; replace?: string }>();
  for (const c of caps.filter((x) => x.type === "prompt-section")) {
    const key = c.id.replace(/^prompt\./, "");
    const o = user?.promptSections?.[key];
    const w = workspace?.promptSections?.[key];
    const merged = { enabled: w?.enabled ?? o?.enabled ?? c.defaultEnabled, replace: w?.replace ?? o?.replace };
    promptSections.set(key, merged);
    enabled.set(c.id, merged.enabled);
  }
  const promptAppend = [...(user?.promptAppend ?? []), ...(workspace?.promptAppend ?? [])];
  const env = { ...(user?.env ?? {}), ...(workspace?.env ?? {}) };
  const hooks = {
    beforeModel: [...(user?.hooks?.beforeModel ?? []), ...(workspace?.hooks?.beforeModel ?? [])],
    turnEnd: [...(user?.hooks?.turnEnd ?? []), ...(workspace?.hooks?.turnEnd ?? [])],
    compact: [...(user?.hooks?.compact ?? []), ...(workspace?.hooks?.compact ?? [])],
  };
  return {
    enabled,
    promptSections,
    promptAppend,
    env,
    loop: { ...(user?.loop ?? {}), ...(workspace?.loop ?? {}) },
    hooks,
    panels: mergePanels(caps, user, workspace),
  };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run packages/core/src/customization/registry.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/core/src/customization
git -c core.hooksPath=/dev/null commit -m "feat(customization): capability registry + three-layer merger"
```

---

### Task 3: overrides 文件读写服务

**Files:**
- Create: `packages/services/src/customization/customizationService.ts`
- Test: `packages/services/src/customization/customizationService.test.ts`
- Modify: `packages/services/src/index.ts`（按现有导出风格追加）

**Interfaces:**
- Consumes: Task 1 `parseOverridesFile`
- Produces:
  - `loadUserOverrides(homeDir: string): { file: OverridesFileParsed; warning?: string }`（读 `~/.xbuild/custom/overrides.json`；缺失 → 空 `{version:1}`；非法 → 空 + warning）
  - `loadWorkspaceOverrides(workspacePath: string): 同上`（读 `<ws>/.zcode/custom/overrides.json`）
  - `saveOverrides(scope: "user" | "workspace", opts: { homeDir: string; workspacePath?: string }, file: OverridesFileParsed): Promise<void>`（原子写：临时文件 + rename；目录不存在自动创建）
  - `defaultOverrides(): OverridesFileParsed`（`{ version: 1 }`）

- [ ] **Step 1: 写失败测试**（覆盖：缺失返回空、非法返回 warning、save 后 load 往返、save 原子性——目录自动创建）

```ts
import { mkdtempSync } from "node:fs";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  defaultOverrides,
  loadUserOverrides,
  loadWorkspaceOverrides,
  saveOverrides,
} from "./customizationService.js";

const tmp = () => mkdtempSync(join(tmpdir(), "xbuild-cust-"));
let dir: string;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("customizationService", () => {
  it("缺失文件 → 空默认，无 warning", () => {
    dir = tmp();
    const r = loadUserOverrides(dir);
    expect(r.file).toEqual({ version: 1 });
    expect(r.warning).toBeUndefined();
  });

  it("非法 JSON → 空默认 + warning", () => {
    dir = tmp();
    const p = join(dir, ".xbuild", "custom");
    require("node:fs").mkdirSync(p, { recursive: true });
    require("node:fs").writeFileSync(join(p, "overrides.json"), "{oops");
    const r = loadUserOverrides(dir);
    expect(r.file).toEqual({ version: 1 });
    expect(r.warning).toMatch(/overrides\.json/);
  });

  it("schema 非法 → 空默认 + warning", () => {
    dir = tmp();
    const p = join(dir, ".xbuild", "custom");
    require("node:fs").mkdirSync(p, { recursive: true });
    require("node:fs").writeFileSync(join(p, "overrides.json"), JSON.stringify({ version: 9 }));
    expect(loadUserOverrides(dir).warning).toBeDefined();
  });

  it("save → load 往返（user 作用域）", async () => {
    dir = tmp();
    const file = { version: 1 as const, env: { A: "1" } };
    await saveOverrides("user", { homeDir: dir }, file);
    expect(loadUserOverrides(dir).file).toEqual(file);
  });

  it("save workspace 作用域落到 <ws>/.zcode/custom/", async () => {
    dir = tmp();
    const ws = join(dir, "proj");
    const file = { version: 1 as const, panels: { disabled: ["panel.pluginStore"] } };
    await saveOverrides("workspace", { homeDir: dir, workspacePath: ws }, file);
    expect(loadWorkspaceOverrides(ws).file).toEqual(file);
  });

  it("defaultOverrides 为空文档", () => {
    expect(defaultOverrides()).toEqual({ version: 1 });
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run packages/services/src/customization/customizationService.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

要点：读文件 `readFileSync` try/catch；`parseOverridesFile` 校验；写用 `writeFileSync(tmp) + renameSync`（复用 `@zcode/shared/node` 的 `atomicWritePrivateTextFile` 若签名匹配，否则本地实现 0600 临时文件）；workspace 路径拼 `.zcode/custom/overrides.json`。

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run packages/services/src/customization/customizationService.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add packages/services/src/customization packages/services/src/index.ts
git -c core.hooksPath=/dev/null commit -m "feat(customization): overrides load/save service with atomic writes"
```

---

## Phase 2（Task 4-6，依赖 Phase 1，可三路并行）

---

### Task 4: 提示词管线接入 builder.ts

**Files:**
- Create: `packages/core/src/customization/apply-prompt-overrides.ts`
- Test: `packages/core/src/customization/apply-prompt-overrides.test.ts`
- Modify: `apps/zcode-cli/packages/core/src/context/builder.ts`（约 83 行起的组装函数：sections 组装完成后、返回前接入）

**Interfaces:**
- Consumes: Task 1 `PromptAppendEntry`；Task 2 `EffectiveConfig`
- Produces: `applyPromptOverrides(sections: ContextSection[], eff: EffectiveConfig): ContextSection[]`（纯函数，不改入参）

- [ ] **Step 1: 写失败测试**

用例（构造最小 ContextSection：`{name,source,injectionTarget:"system",cacheHint:"stable",chars,tokens,content,preview}`）：
1. `enabled=false` 的段被过滤（`promptSections.identity.enabled=false` → source 为 `identity` 的段消失）
2. `replace` 整段替换 content 且 chars/tokens 重算（用 `estimateTokens` 的真实值断言）
3. `promptAppend` 按锚点插入（after=identity → 紧随其后）
4. 锚点不存在 → 追加到末尾
5. 追加段 id 与内置 source 冲突 → 该段被丢弃（测试传 `eff.promptAppend` 前自行构造）
6. 无任何覆盖时返回与输入等价的数组（浅拷贝）

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现 apply-prompt-overrides.ts**

```ts
// 提示词覆盖：在 builder 组装完成后过滤/替换/追加。纯函数，失败安全由调用方保证（spec §9）。
import type { ContextSection } from "../context/types.js";
import type { EffectiveConfig } from "./registry.js";
import { estimateTokens } from "../utils.js";

export function applyPromptOverrides(
  sections: readonly ContextSection[],
  eff: EffectiveConfig,
): ContextSection[] {
  let out = sections.filter((s) => eff.promptSections.get(s.source)?.enabled ?? true);
  out = out.map((s) => {
    const replace = eff.promptSections.get(s.source)?.replace;
    if (replace === undefined) return s;
    const patched = { ...s, content: replace, chars: replace.length, tokens: estimateTokens(replace), preview: replace.slice(0, 100) };
    return patched;
  });
  const appends = eff.promptAppend.filter((a) => !out.some((s) => s.source === a.id));
  if (appends.length === 0) return [...out];
  const withAppends = [...out];
  for (const a of [...appends].reverse()) {
    const section: ContextSection = {
      name: a.title,
      source: a.id,
      injectionTarget: "system",
      cacheHint: "stable",
      chars: a.text.length,
      tokens: estimateTokens(a.text),
      content: a.text,
      preview: a.text.slice(0, 100),
    };
    const anchorIdx = a.after ? withAppends.findIndex((s) => s.source === a.after) : -1;
    if (anchorIdx >= 0) withAppends.splice(anchorIdx + 1, 0, section);
    else withAppends.push(section);
  }
  return withAppends;
}
```

注意：`ContextSection` 字段以 `apps/zcode-cli/packages/core/src/context/types.ts` 实际定义为准（`injectionTarget`/`cacheHint` 取值若为联合类型需按现有值填写）；实现时先读该类型再落笔。

- [ ] **Step 4: builder.ts 接入**

在 builder.ts 中持有 sections 的组装函数返回前插入：
```ts
const finalSections = this.config.customization
  ? applyPromptOverrides(sections, this.config.customization)
  : sections;
```
`ContextBuilderConfig`（builder 的配置类型）追加可选字段 `customization?: EffectiveConfig`；runtime 创建 builder 时从 Task 5 的 loader 传入（本任务先留可选，UI/CLI 侧 Task 7 接线；无字段时行为与现状完全一致）。

- [ ] **Step 5: 运行确认通过 + core 类型检查**

Run: `npx vitest run packages/core/src/customization/apply-prompt-overrides.test.ts && cd apps/zcode-cli && npx tsc -p packages/core/tsconfig.json --noEmit`

- [ ] **Step 6: 提交**

```bash
git add packages/core/src/customization apps/zcode-cli/packages/core/src/context/builder.ts
git -c core.hooksPath=/dev/null commit -m "feat(customization): prompt pipeline override layer wired into builder"
```

---

### Task 5: loop 钩子三节点（beforeModel/turnEnd/compact）

**Files:**
- Modify: `apps/zcode-cli/packages/contracts/src/hooks/index.ts`（HookEventName 增加 `BeforeModel: "BeforeModel"`、`TurnEnd: "TurnEnd"`、`Compact: "Compact"`；各事件 Input 接口：`BeforeModelHookInput { hookEventName; workspacePath; turnIndex; modelId; tokenUsage }`、`TurnEndHookInput`、`CompactHookInput` 同构）
- Modify: `packages/services/src/hooks/hooksService.ts`（三个新事件走现有命令执行路径；配置键 `settings.hooks.BeforeModel[]` 等，与现有 PreToolUse 完全同构）
- Create: `packages/core/src/customization/loop-hook-nodes.ts`（把 EffectiveConfig.hooks 规则桥接到 hooksService：声明式 `inject` 进程内生效；`run` 调 hooksService 执行器）
- Modify: `apps/zcode-cli/packages/core/src/runtime/methods/turn.ts`（模型请求发起前 emit `beforeModel`，收集 inject 文本并入本次请求的 system-reminder；turn 最终响应后 emit `turnEnd`）
- Modify: `apps/zcode-cli/packages/core/src/runtime/methods/compact-active.ts`（压缩前 emit `compact`）
- Test: `packages/core/src/customization/loop-hook-nodes.test.ts`

**Interfaces:**
- Consumes: Task 2 `EffectiveConfig["hooks"]`
- Produces:
  - `collectInjects(rules: HookRule[], ctx: { event: "beforeModel" | "turnEnd" | "compact"; workspacePath: string; turnIndex: number; modelId?: string }): Promise<string[]>`（inject 立即收集；run 规则经 hooksService 执行，stdout 为合法 JSON 且含 `inject` 字符串才采纳，非 JSON 忽略；超时/失败忽略）
  - runtime 侧：turn/compact 处调用 `collectInjects` 后把文本包成 `<system-reminder>…</system-reminder>` 追加到本次请求（注入方式参照现有 mid-conversation system turn 的拼装 helper；找不到现成 helper 就在最贴近请求体的 messages 组装点 append 一条 user-visible=false 的 system 文本，注释注明 Xbuild 钩子注入）

- [ ] **Step 1: 写失败测试 loop-hook-nodes.test.ts**

用例：1) 纯 inject 规则按序返回文本；2) run 规则 stdout 合法 JSON 含 inject → 采纳（mock hooksService 执行函数）；3) run 规则 stdout 非 JSON → 忽略；4) run 抛错/超时 → 忽略不抛；5) 空规则数组 → 空数组。

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现 loop-hook-nodes.ts + contracts/services 扩展 + 两处 emit 接入**

contracts/services 的扩展逐字照抄现有 PreToolUse 的接口与配置读取模式（保持同构，方便审查）。runtime 两处接入点：在 `turn.ts` 内检索"发起模型请求"的函数调用（现实现里请求前有 system/messages 组装），在其前调 `collectInjects(eff.hooks.beforeModel, …)`；`turnEnd` 在该 turn 方法最终 return 前发（结果仅用于脚本副作用与日志）；`compact-active.ts` 在压缩入口发。若 turn loop 里无法直接拿到 EffectiveConfig，从 Task 7 的 loader 挂到 runtime config（与 Task 4 的 `customization` 字段同源）。

- [ ] **Step 4: 运行确认通过 + tsc**

Run: `npx vitest run packages/core/src/customization/loop-hook-nodes.test.ts && cd apps/zcode-cli && npx tsc -p packages/core/tsconfig.json --noEmit && npx tsc -p packages/contracts/tsconfig.json --noEmit`

- [ ] **Step 5: 提交**

```bash
git add apps/zcode-cli/packages/contracts/src/hooks apps/zcode-cli/packages/core packages/services/src/hooks
git -c core.hooksPath=/dev/null commit -m "feat(customization): beforeModel/turnEnd/compact loop hook nodes"
```

---

### Task 6: 面板槽位 + env 应用

**Files:**
- Create: `packages/core/src/customization/panel-registry.ts`（内置面板 id 常量 + `builtinPanels: Capability[]`：`panel.tasks`、`panel.automations`、`panel.pluginStore`，defaultEnabled 全 true）
- Modify: `packages/ui/src/project-sidebar/`（渲染处读取面板配置 prop：`panelsUi: { order: string[]; disabled: string[] }`；缺省 = 全启用 + 注册顺序；ProjectSidebarNavigation 上方调用方负责把内置三面板与 MCP-UI surfaces 按 order/disabled 重排与隐藏）
- Modify: 桌面侧把 EffectiveConfig.panels 传给 renderer：沿用 desktop main → renderer 现有 config 下发通道（参考 `desktopContextPrompt config refreshed` 的下发模式）；无通道可用时在 renderer 默认值兜底
- Modify: `apps/zcode-cli/packages/cli/src/provider-runtime-env.ts`（或 agent 子进程 env 组装处）：用户 env 只补缺不覆盖——`for (const [k, v] of Object.entries(eff.env)) if (process.env[k] === undefined) env[k] = v;`（spec：已存在的环境变量优先，避免破坏运行时内部变量）
- Test: `packages/core/src/customization/panel-registry.test.ts`（order/disabled 排序纯函数 `applyPanelOrder(registered, panels)` 的单测）

**Interfaces:**
- Consumes: Task 2 `EffectiveConfig.panels`、`builtinPanels`
- Produces: `applyPanelOrder(registeredIds: string[], panels: { order?: string[]; disabled?: string[] }): string[]`

- [ ] **Step 1: 写失败测试**（order 重排、disabled 剔除、未列出者按注册序排尾、空配置原序）
- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现 panel-registry.ts + sidebar 接入 + env assign**
- [ ] **Step 4: 运行确认通过 + `pnpm typecheck`**
- [ ] **Step 5: 提交**

```bash
git add packages/core/src/customization packages/ui/src/project-sidebar apps/zcode-cli/packages/cli/src/provider-runtime-env.ts
git -c core.hooksPath=/dev/null commit -m "feat(customization): panel slots in sidebar + user env injection"
```

---

## Phase 3（Task 7-8，依赖 Phase 2）

---

### Task 7: EffectiveConfig loader（CLI/desktop 共用装配）

**Files:**
- Create: `packages/core/src/customization/loader.ts`
- Test: `packages/core/src/customization/loader.test.ts`

**Interfaces:**
- Consumes: Task 2 resolver、Task 3 loaders
- Produces:
  - `loadEffectiveConfig(opts: { homeDir: string; workspacePath?: string }): { eff: EffectiveConfig; warnings: string[] }`（load 两级文件 → `resolveEffective(getRegisteredCapabilities(), user, ws)` → 汇总 warnings）
  - `registerBuiltinCapabilities(): void`（集中调用点：prompt 段清单硬编码内置 source 列表——`cli_prefix`、`identity`、`env`、`desktop`、`harness` 等，以 builder.ts 实际组装的 section 集合为准逐个列；`loop.beforeModel/turnEnd/compact`、`panel.tasks/automations/pluginStore`）

- [ ] **Step 1: 写失败测试**（warnings 汇总、内置清单注册幂等、两级文件合并结果正确）
- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现 loader.ts**（内置 prompt-section 清单需先读 `builder.ts:83-170` 实际 push 的 section source 集合再列全）
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: 提交**

```bash
git add packages/core/src/customization
git -c core.hooksPath=/dev/null commit -m "feat(customization): effective-config loader + builtin capability registration"
```

---

### Task 8: 自定义中心设置页

**Files:**
- Create: `packages/ui/src/settings/CustomizationSection.tsx`（主组件：五个分组 Tab/折叠区）
- Create: `packages/ui/src/settings/customization/`（子组件：`PromptSectionEditor.tsx`、`HooksEditor.tsx`、`EnvEditor.tsx`、`PanelsEditor.tsx`）
- Modify: `packages/ui/src/SettingsPage.tsx`（注册「自定义中心」顶级分组，图标用 `lucide-react` 的 `SlidersHorizontal`）
- Modify: 桌面 host：新增 RPC `customization.load` / `customization.save`（照现有 settings RPC 的注册模式；CLI 侧文件直读）
- Test: `packages/ui/src/settings/customization/PromptSectionEditor.test.tsx`（渲染分组、开关回调、token 显示）

**Interfaces:**
- Consumes: Task 3 service（经 host RPC）、Task 7 `registerBuiltinCapabilities` 清单（用于展示内置段列表）
- Produces: 编辑器组件 props：
  - `PromptSectionEditor({ sections: {id,title,enabled,replace?,tokens}[], onChange(id, patch) })`
  - `HooksEditor({ rules: {beforeModel,turnEnd,compact}, onChange(next) })`（每条规则：inject textarea 或 run 命令行 + timeoutMs）
  - `EnvEditor({ env, onChange })`（key-value 行编辑）
  - `PanelsEditor({ order, disabled, onChange })`（上下移 + 开关）

- [ ] **Step 1: 写失败测试**（渲染 + onChange 断言；不测 host RPC——该层由手测覆盖）
- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现四个编辑器 + 主组件 + SettingsPage 注册 + host RPC**

要点：
- 状态管理沿用 SettingsPage 现有 store/service hooks 模式（`useServices` / `useZCodeIntl`）；加载时调 `customization.load`，编辑后防抖 500ms 调 `customization.save`
- 每个提示词段的 token 数在编辑时用与 CLI 相同的估算（`content.length / 4` 取整即可，注明"估算"）
- 警告条：`customization.load` 返回 warnings 时顶部黄条展示
- 「恢复默认」按钮 = 用 `defaultOverrides()` 覆盖保存
- **功能分组**：镜像现有 settings 键（如 `memoryEnabled`），直接用 `settingService` 读写，不经 overrides.json（spec §8）
- 作用域切换（全局/工作区）用页面顶部两个 pill
- 样式沿用现有 settings 分组的类（`bg-popover` 等已是毛玻璃 token）

- [ ] **Step 4: 运行确认通过 + `pnpm typecheck`**
- [ ] **Step 5: 提交**

```bash
git add packages/ui/src/settings packages/ui/src/SettingsPage.tsx packages/desktop/src
git -c core.hooksPath=/dev/null commit -m "feat(customization): customization center settings UI + host RPC"
```

---

## Phase 4（Task 9，串行收尾）

---

### Task 9: 全量验证 + 文档

- [ ] **Step 1: 全量检查**

```bash
pnpm typecheck
pnpm build
cd apps/zcode-cli && npx vitest run packages/bootstrap/tests/zcode-builtin-model-runtime-integration.test.ts
```
Expected: 全部 exit 0。bootstrap 集成测试确认内置目录机制未被波及。

- [ ] **Step 2: 手动验收清单**（重启 `pnpm dev:desktop` 后逐项）

1. 设置 → 自定义中心出现，五个分组可编辑
2. 禁用 `identity` 段 → 新会话询问模型"你是谁"不再自称 XBuild 开发方（改回后恢复）
3. `promptAppend` 加一段 → token 计数增加
4. beforeModel inject 一条 → 新对话首个请求带 system-reminder（开发者工具网络面板或日志确认）
5. 禁用 `panel.pluginStore` → 侧栏插件市场入口消失；恢复默认后回来
6. 写入非法 overrides.json → 重启后 app 正常、自定义中心顶部警告条
7. 恢复默认 → overrides.json 回 `{ "version": 1 }`

- [ ] **Step 3: README-XBUILD.md 追加 Round 5 说明**（自定义中心用法 + overrides 文件位置 + 三钩子事件表）

- [ ] **Step 4: 提交**

```bash
git add -A
git -c core.hooksPath=/dev/null commit -m "feat(customization): docs + full verification for customization kernel P0"
```

## 并行调度说明（供执行者）

- Phase 1 三个任务零文件交集，可同时派发 3 个 subagent。
- Phase 2 三个任务共享 `packages/core/src/customization/` 目录但文件不同（apply-prompt-overrides / loop-hook-nodes / panel-registry），可并行；builder.ts 仅 Task 4 改。
- Phase 3 的 Task 7/8 都要动 loader/清单，串行执行（7 → 8）。
- 每个 subagent 只给本任务全文 + Global Constraints + spec 路径；Interfaces 块是它们之间的唯一契约，不得偏离。
