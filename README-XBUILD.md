# Xbuild

ZCode（zai-org/ZCode）的深度定制 fork：**所有 z.ai / bigmodel 的 API 已全部改接到
Xiatian AI 中转站（nowint.qzz.io，new-api）**，并与本机已安装的 ZCode 完全数据隔离。

## 改动总览（相对 upstream main）

### 1. API 深度耦合 → nowint.qzz.io

| 类别 | 原 | 现 |
| --- | --- | --- |
| Anthropic 格式模型 API | `https://api.z.ai/api/anthropic`、`https://open.bigmodel.cn/api/anthropic` | `https://nowint.qzz.io`（new-api 的 `/v1/messages`） |
| OpenAI 格式模型 API | `https://api.z.ai/api/paas/v4`、`https://open.bigmodel.cn/api/paas/v4` | `https://nowint.qzz.io/v1`（`/v1/chat/completions`） |
| ZCode 云服务（OAuth token、zcode-plan 代理、remote、billing、event report） | `https://zcode.z.ai` | `https://nowint.qzz.io`（中转站无此服务，相关功能自然失效） |
| OAuth / 商业 API | `https://chat.z.ai`、`https://api.z.ai`、`https://bigmodel.cn` | `https://nowint.qzz.io` |

核心收口点：`packages/shared/src/zcodeEndpoint.ts`（5 个 origin 常量全部指向 nowint）。
共改写 132 个文件、约 380 处 URL。

**保持未动**（非 API，刻意保留）：

- `docs.z.ai` / `docs.bigmodel.cn` — 文档链接
- `cdn-zcode.z.ai` — 官方插件市场与图标 CDN（仍可用，与模型调用无关）
- 官方内置配置远程同步 `{origin}/api/v1/client/configs` 现指向 nowint → 必然失败 →
  本仓库内嵌的 `config/provider/zcode-builtin.json` 成为唯一事实源（缓存按 endpoint origin
  哈希隔离，不会串到官方 ZCode）

### 2. Provider 目录（`config/provider/zcode-builtin.json`，revision 43 → 44）

- 模板改名：`Xiatian AI`（Anthropic 格式，主通道）、`Xiatian AI（OpenAI 格式）`、
  以及两个备用通道模板 —— baseUrl 全部指向 nowint
- API Key 管理链接指向 `nowint.qzz.io/console/token`
- 10 个 OAuth 账号制 provider（coding plan / start plan / off-peak / highspeed）全部
  `visibility: hidden` —— 中转站没有账号体系，只走 API Key

### 3. 数据隔离：`~/.xbuild`

所有用户级数据目录从 `~/.zcode` 改为 `~/.xbuild`（v2 配置、`provider_config.json`、
cli 配置、会话库、日志、遥测、server agents），与已安装的官方 ZCode 互不污染。

**仍共享**（刻意保留）：

- 项目级 `<project>/.zcode/`（workflows、settings、agent-memory）
- 用户技能库 `~/.zcode/skills` 与 `~/.agents/skills`
- `~/.zcode/AGENTS.md` → fork 读 `~/.xbuild/AGENTS.md`（已隔离，需要的话自行复制）

## 使用

```bash
pnpm bootstrap          # 首次
pnpm build:zcode        # 构建 CLI
pnpm dev:desktop        # 桌面端开发
```

首次启动后在 provider 设置里选 **Xiatian AI**，粘贴中转站的 `sk-…` key
（在 nowint.qzz.io 控制台令牌页创建），模型选 GLM-5.3 / GLM-5.3-Flash 等
中转站实际供应的名称。

## 已知失效面（预期内，因为中转站不提供对应服务）

- Z.ai 账号登录（OAuth 全链路）、coding plan 订阅/升级/余额展示
- 用量配额查询（`/api/monitor/usage/quota/limit`）
- 内置 web_reader MCP（`open.bigmodel.cn/api/mcp/web_reader/mcp`）
- Web Remote / 手机远控中继（`wss://…/api/v1/remote/ws2`）
- 官方插件市场之外的内置配置热更新

## 维护脚本

- `xwork/scripts/xbuild-deep-couple-xiatian.sh` — URL 批量改写（有序映射表）
- `xwork/scripts/xbuild-edit-catalog.mjs` — provider 目录改名/隐藏/revision 自增

## Round 2（UI 彻底对接 + XBuild 品牌）

- **登录页**：OAuth 渠道列表（Z.ai/BigModel）整体移除，默认直接进 API Key 表单（provider 固定 Xiatian AI / Anthropic 主通道）
- **模型名对齐中转站**：4 个模板 builtinModelIds → `z-ai/glm-5.3-flash`（主）+ `z-ai/glm-5.3`（default 组实测可用），access 统一 `api-key`，revision 45
- **品牌**：locale 317 处 + TUI PRODUCT_NAME + desktop productName/Dev 包名 + 各窗口标题 → **XBuild**
- **图标**：全面换成 nowint.qzz.io 的圆角环 mark（CSS 几何：21px/r6 + conic 金属光泽 + 镂空）——
  登录/关于/启动/Windows 标题栏组件、provider 图标（svg+png）、Dock 图标（icns 全套尺寸）、web favicon
- **免配置启动**：已在中转站建专用令牌 `xbuild`（default 组），预写入 `~/.xbuild/v2/provider_config.json`
- **端到端已验证**：Mac → nowint.qzz.io/v1/messages → z-ai/glm-5.3-flash 真实推理响应

## Round 3（隔离修复：env 消毒 + 全量数据路径）

**根因**：在官方 ZCode 内启动 dev 实例时，shell 继承 `ZCODE_BASE_URL`、
`ZCODE_BUILTIN_PROVIDER_CONFIG_FILE`、`ZCODE_PERSONAL_PROVIDER_CONFIG_FILE` 等注入变量，
导致 Xbuild 读到官方 zcode.z.ai 的缓存目录/个人配置（"获取 API Key"打开 z.ai 的来源）。

- `scripts/dev-desktop-env.mjs`：启动前清空全部 `ZCODE_*` / `ZAI_*` 继承变量
- 补齐 15 处 home 级数据路径 `.zcode → .xbuild`：setting.json（settingService、chromium bootstrap、
  dataBaseDirBootstrap）、credentials.json、会话 db.sqlite、cli/config.json、AGENTS.md、
  telemetry-state、server root、exportLogs 等；skills/commands/plugins 用户资产按决策保持共享
- 修复后实测：setting.json 落 `~/.xbuild/v2/`，运行日志 z.ai 引用 0 条，
  provider `z-ai/glm-5.3-flash @ zai-api-2` 正常就绪

## Round 4（毛玻璃 UI + 身份提示词）

- **UI 全透明化**：四个主题（zai-dark/zai-light/dark/light）`--color-background` 全改 transparent，
  主表面（面板/聊天区/侧栏）直接透出窗口 vibrancy 毛玻璃；深色根容器加 22% 黑 tint 压深玻璃；
  浮层 `--color-popover` 半透明 + 全局 `.bg-popover` 挂 `backdrop-filter: blur(28px)`（真毛玻璃浮层）
- **侧栏品牌标题**：新建任务上方常驻 XBuild mark+标题（与按钮图标列对齐，text-ui-lg）
- **身份提示词**：`You are XBuild, an interactive agent developed by Xiatian AI
  (https://nowint.qzz.io) based on ZCode`（cli-prefix/identity/workflow-actor 及全部子代理、
  工具描述里的产品名统一改 XBuild；WebFetch UA 同步）
- **删除安全条款提示词**（SECURITY_NOTICE 及其全部引用），省 token——安全策略由中转站渠道层承担

## Round 5（自定义内核 P0：自定义中心）

设置页新增「自定义中心」（Agent 能力分组），底层是能力注册表 + overrides 覆盖文件：

**文件**（工作区级优先于全局）：
- `~/.xbuild/custom/overrides.json`
- `<workspace>/.zcode/custom/overrides.json`

**可定制项**：
- **提示词**：15 个内置段（身份/产品前缀/记忆/技能…）逐段启用或整段替换，实时 token 估算
- **追加段**：按锚点插入自定义文本（如自有规则、人设）
- **循环**：`beforeModel`/`turnEnd`/`compact` 三节点规则——`inject`（注入 system-reminder）
  或 `run`（任意命令，stdin 收 JSON 上下文，stdout 返回 `{"inject":"…"}` 生效，有超时）；
  另可设 `maxTurns` / `maxToolCallsPerTurn`
- **环境变量**：只补缺不覆盖，作用于 agent 子进程与工具
- **面板**：侧栏任务列表/自动化/插件市场 开关 + 排序
- **功能**：memory 等镜像现有设置键

**可靠性**：overrides 非法 → 忽略 + 自定义中心警告条；应用点全部回退内置默认；
「恢复默认」一键清空。schema 定义在 `packages/shared/src/customization/`，
装配在 `packages/core/src/customization/`（loader 于会话启动装配 EffectiveConfig），
提示词管线在 `context/builder.ts` 一处接入，loop 钩子在 `runtime/methods/turn.ts`
与 `compact-active.ts` 三处 emit。
