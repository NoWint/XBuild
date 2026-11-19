# dsh-native-ui

一页以内。只写类型与测试表达不了的三样：模块存在的意图、不变量、与其它模块的交集在哪个 hook 点处理。

意图：把 CLI owner 的 DSH 插件管理投影接到 XBuild 设置页，让用户能在原生 UI 里完成来源、安装、授权、启停、更新、回滚、卸载与诊断，而不必知道插件来自 DSH 还是 ZCode。

不变量：

- **事实源唯一**：生命周期与版本状态只来自 `plugins/dsh/dispatch` 的 `overview` 返回。UI 不本地推导终态、不做乐观合并；动作失败保留用户原本看到的投影。
- **scope 隔离**：隔离键是 `workspaceIdentity?.trim() || workspacePath` 加 remoteSessionId。切换工作区必须 `reset()`，不得把上一个域的 DSH 状态显示成当前工作区。
- **授权不是默认放行**：`nativeCode=true`、`trusted-process`、`filesystem=unrestricted`、`network`、`subprocess` 必须来自用户在确认界面的显式选择，且 grant 绑定 `revision + digest`（`trustChoiceFor`）。UI 不构造兜底 grant。
- **兼容等级只展示证据**：`compatibility` 原样呈现，UI 不会把 `unverified` 提升成等效。
- **不支持即报错**：服务端 `dsh.unsupported` 或任何失败都以 `error/errorCode` 暴露，不静默吞掉、不显示伪造成功。
- **依赖方向**：本模块只依赖 `dsh-compat-protocol` 与 `ui` 基元。服务经 `DshDispatchPort`（仅 `dispatch`）注入，不直接依赖 `@zcode/services`。

与其它模块的交集：

- 经 `useWorkspaceServices(...).dshPluginService` 适配成 `DshDispatchPort`；远端/本地差异由既有 workspace service 解析处理。
- 设置页挂载点是 `SettingsPage` 的 `dshPlugins` 分支，导航项在 `settingsPageConfig`，section id 在 `settingsNavigation`。
- 状态在 `store.ts`（Zustand）；不要在组件里复制一份生命周期事实。

验证：CLI 侧 `@zcode/dsh-runtime` 回归覆盖原生行为；服务路由由 `scripts/acceptance/dsh-service-routing.mjs` 覆盖；本模块的 UI 渲染目前只做了类型/静态校验，真实桌面交互尚未纳入验收。

## 原生客户端生命周期

`native-client.ts` 是上游 `@deepseek-ai/dsh-client-modules`、`dsh-client-connection` 与 Cordis entry 的适配器，不是另一套模块加载器。每次 mount 使用独立 `ClientModuleSystem`、Cordis `Context` 和 attachment lease；React/ReactDOM/Cordis 等宿主单例经 `staticModules` 注入，插件工厂使用原始同步 `require`。

```text
attach(scope, desktop-continuous) → attachment(token, generation, clientGraph)
       → fetch 原始 bundle 字节 → 原始 __ModuleLoader__.load({id,factory})
       → bootstrap factory 物化 client-modules → entries.start(BrowserLoader, manifest)
       → 上游 connection 插件从 __DSH_TRANSPORT__ 取同一 attachment 的 HTTP 载体
       → surface 的真实组件 → dispose fiber/subscriptions → detach(同一 lease)
```

- `BrowserLoader` 只实现上游 `ClientEntries` 实际调用的 `create/resolve/remove/entries/await`，不复用 Node 版 `cordis-plugin-loader`：其入口静态 import `node:fs/node:path`，打进 renderer 会把 Node builtin 外部化。
- 这不等同于上游完整 Loader 语义：`loader.patch-context`、`loader/partial` 事件与热替换路径没有实现，client graph 只能按 `entries.start` 初始装载；需要这些能力的 UI 插件当前不应显示为等价。
- `mobile/web`：attachment(clientMode=web-remote-replayable)，相同域、不同 lease，不另建 Host

- 只允许 dispatch 返回的 attachment 驱动本代模块；旧 generation 的晚到字节、事件与 RPC 不得推进状态。
- `loadBundle` 不是通用网络 fetch：必须经由 attachment 的 `/plugins/` fetch 授权与原始响应字节执行；资源路径沿用上游 URL 语义，不能用字符串前缀绕过。
- RPC 复用 `plugins/dsh/dispatch` 的 `invoke/cancel`，事件仅来自该 lease 的 `onDynamicDshEvent`；不把插件自定义事件丢掉或改写为 ZCode 事件。
- `dispose` 先停止新输入，再 await Cordis fiber 与 attachment 清理；拒绝晚到应答，释放脚本、样式、React root 与事件订阅。
- 原生 DOM 权限来自 `grant.nativeUi`，不是 ErrorBoundary 或 CSS 隔离；缺服务、加载失败或未授权均显示真实诊断，不用空卡片冒充成功。
