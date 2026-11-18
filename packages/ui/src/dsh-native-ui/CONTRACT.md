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
