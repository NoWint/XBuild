# XBuild 自定义内核（Customization Kernel）P0 设计

日期：2026-10-31  
状态：已与用户确认方向（架构先行 / 钩子级 loop / 复用现有机制 / 尽可能简单可靠）

## 1. 目标与非目标

**目标**：让用户对 XBuild 有充分自主权——系统提示词可查看/禁用/替换/追加，agent loop 关键节点可编程，运行环境可定制，UI 面板可开关排序，全部通过一个统一的「能力注册表」暴露，并在设置里提供可视化「自定义中心」。

**非目标（P1+，本期不做）**：插件包格式统一（收编 MCP 插件/skills）、热重载、loop 本体替换、常驻 worker 运行时、依赖注入框架、跨设备同步。

**可靠性与简单性铁律**：

- 不新造插件运行时；复用现有 settings hooks 执行器与 MCP-UI 面板机制。
- 覆盖文件非法 → 忽略该文件 + 状态栏警告，绝不阻塞启动。
- 每个覆盖应用点 try/catch，失败回退内置行为。
- 一切可一键恢复默认。

## 2. 架构总览

```
内置代码 ──注册──▶ Capability Registry（清单+合并器）
                          ▲
~/.xbuild/custom/overrides.json ──┐
.zcode/custom/overrides.json ─────┴─ zod 校验 ──▶ EffectiveConfig
                                                    │
        ┌───────────────┬──────────────┬───────────┼──────────┐
        ▼               ▼              ▼           ▼          ▼
  提示词管线        loop 钩子节点     面板槽位     功能开关    环境变量
 (builder.ts 一处)  (扩展 settings   (侧栏注册制) (现有 settings (spawn env
                     hooks 执行器)                  键的镜像)    追加)
```

自定义中心（设置新页）= 注册表 + EffectiveConfig 的可视化编辑器，写回 overrides.json。

## 3. 能力注册表

位置：`packages/core/src/customization/registry.ts`（类型放 `packages/shared/src/customization/types.ts`，桌面端与 CLI 共用）。

```ts
type CapabilityType = "prompt-section" | "loop-node" | "panel" | "feature";

interface Capability {
  id: string;            // "prompt.identity" / "loop.beforeModel" / "panel.automations" / "feature.memory"
  type: CapabilityType;
  title: string;         // 自定义中心显示名
  description?: string;
  defaultEnabled: boolean;
}
```

- 注册表本身无状态、无副作用：各组装点调用 `register(caps)` 上报清单；EffectiveConfig 由合并器从默认值 + 两级覆盖文件算出。
- 合并规则（逐能力）：
  - `enabled` = workspace ?? user ?? builtin
  - 内容替换/追加：workspace > user > 内置；追加列表按 user → workspace 顺序拼接
- 不做服务发现、不做依赖注入、不做热重载。

## 4. 用户覆盖文件

- 全局：`~/.xbuild/custom/overrides.json`；工作区：`<workspace>/.zcode/custom/overrides.json`（优先级更高）。
- zod schema（`packages/shared/src/customization/schema.ts`），`version` 字段做前向兼容；`safeParse` 失败 → 忽略该文件、记录日志、自定义中心顶部显示警告条。

```jsonc
{
  "version": 1,
  // 提示词段：按内置 section 的 source id 寻址
  "promptSections": {
    "identity": { "enabled": true, "replace": "可选：整段替换文本" },
    "harness": { "enabled": false }
  },
  // 追加自定义段
  "promptAppend": [
    { "id": "my-rules", "title": "My Rules", "after": "identity", "text": "…" } // after 省略则追加到末尾
  ],
  // 追加到 agent 子进程 env 的变量（先应用，已存在的环境变量优先，避免破坏运行时内部变量）
  "env": { "MY_KEY": "value" },
  // loop 数值参数（在 loop 现有对应点做 clamp；核心只暴露这两个）
  "loop": { "maxTurns": 64, "maxToolCallsPerTurn": 100 },
  // 新增 loop 钩子节点（见 §6）
  "hooks": {
    "beforeModel": [ { "inject": "…" }, { "run": "my-script.sh", "timeoutMs": 10000 } ],
    "turnEnd": [],
    "compact": [ { "inject": "压缩时务必保留：…" } ]
  },
  // 侧栏面板
  "panels": { "order": ["tasks", "automations", "pluginStore"], "disabled": ["pluginStore"] }
}
```

注：功能开关（memory 等）**不进 overrides.json**——它们直接镜像既有 settings 键（见 §8），避免同一状态两个存储。

```

## 5. 提示词管线

改动点只有一个：`apps/zcode-cli/packages/core/src/context/builder.ts` 在 sections 组装完成后调用 `applyPromptOverrides(sections, effective)`（`packages/core/src/customization/apply-prompt-overrides.ts`）：

1. 过滤 `enabled === false` 的段；
2. 应用 `replace`（整段替换文本）；
3. 按 `after` 锚点插入 `promptAppend` 段；锚点不存在（段被禁用或 id 未找到）时退化为追加到末尾；
4. 重新计算 chars/tokens（复用 `estimateTokens`），自定义中心逐段显示 token 占用。

段 id 沿用现有 section `source` 值（`cli_prefix`、`identity` 等），新增段不得与内置 id 冲突（冲突 → 忽略该追加段 + 警告）。

## 6. loop 钩子节点

复用 settings hooks 的执行器（命令在独立进程执行、有超时、失败不影响主流程），新增三个事件：

| 节点 | 触发时机 | 可用动作 |
| --- | --- | --- |
| `beforeModel` | 每次发起模型请求前 | `inject`（文本以 system-reminder 附加）、`run`（脚本，stdout 为合法 JSON 且含 `inject` 字符串字段时才生效，非 JSON 输出一律忽略，防止日志误注入） |
| `turnEnd` | 单个 turn 的最终响应完成后 | 同上 |
| `compact` | 自动压缩触发前 | 同上（用于「压缩时务必保留…」类指令） |

- 声明式 `inject` 在进程内直接解释，零开销；`run` 走现有 hooks 执行器（天然进程隔离 + 超时）。
- 事件上下文通过 stdin JSON 传给脚本：`{ event, workspacePath, turnIndex, modelId, tokenUsage }`。
- PreToolUse/PostToolUse 等工具期钩子**已存在**，本期不动。

## 7. 面板注册制

- 侧栏面板位注册进注册表（`panel` 类型）：内置面板（任务列表 / 自动化 / 插件市场）启动时注册；MCP-UI 插件的 `ui.surfaces` 页面（Excalidraw 机制，现成）注册为面板。
- overrides 的 `panels.order/disabled` 决定侧栏渲染顺序与可见性；被禁用面板的入口隐藏，能力本身不下线。
- UI 改动集中在 `packages/ui/src/project-sidebar/`（渲染时读 EffectiveConfig）。

## 8. 自定义中心（设置页）

`packages/ui/src/settings/` 现有 SettingsPage 内新增「自定义中心」顶级分组（与其它设置分组同级，保持现有导航结构）：

- **提示词**：逐段开关 + 编辑框（`replace` 文本）+ 追加段的增删改 + 每段实时 token 数
- **循环**：beforeModel/turnEnd/compact 规则列表（inject 文本 / run 命令）+ loop 两个数值参数
- **环境**：key-value 编辑器
- **面板**：开关 + 上/下移排序
- **功能**：镜像现有 settings 开关（memory 等）
- 每组即时保存到对应 overrides 文件（全局 or 工作区，页内可切换作用域）；「恢复默认」= 删除对应键
- 读写走新的 `customizationService`（`packages/services`）：load（校验+合并）/ save；桌面 host 暴露 RPC，CLI 侧直接读文件

## 9. 错误处理

| 故障 | 行为 |
| --- | --- |
| overrides.json 非法 / 版本未知 | 忽略该文件，日志 + 自定义中心警告条，内置默认生效 |
| 覆盖应用点异常 | try/catch 回退内置行为，不中断请求/回合 |
| 钩子脚本超时/失败 | 沿用现有 hooks 超时；失败仅记日志，本轮继续 |
| 追加段 id 与内置冲突 | 忽略该追加段 + 警告 |
| 设置页保存失败 | 行内错误提示，文件内容不被部分写入（原子写） |

## 10. 测试

- 合并器单测：优先级（workspace > user > builtin）、非法文件忽略、部分覆盖合并
- 提示词管线单测：禁用/替换/追加/锚点/冲突 id/token 重算（快照）
- 钩子节点单测：inject 解释、run 超时、stdout JSON 解析
- 设置页组件测试：渲染分组、开关写回、恢复默认
- 手动验收：改 identity 段 → 新会话模型自报 XBuild 身份；禁用插件市场面板 → 侧栏消失；非法 JSON → 警告且 app 正常

## 11. 涉及文件清单（实现面）

- `packages/shared/src/customization/types.ts`、`schema.ts`（新）
- `packages/core/src/customization/registry.ts`、`apply-prompt-overrides.ts`、`loop-hook-nodes.ts`（新）
- `apps/zcode-cli/packages/core/src/context/builder.ts`（一处接入）
- `apps/zcode-cli/packages/core/src/runtime/`（3 个事件发射点 + loop 参数 clamp）
- `packages/services/src/customization/`（overrides 读写服务，新）
- 桌面 host RPC + `packages/ui/src/settings/`（自定义中心 UI）
- `packages/ui/src/project-sidebar/`（面板槽位渲染）
- `README-XBUILD.md` 补充说明
```
