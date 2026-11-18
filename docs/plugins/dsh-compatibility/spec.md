# DSH 原生依赖域兼容规格

## 决定、目标与完成标准

2026-11-14，用户明确接受依赖域隔离。故障隔离单位为经过精确授权的插件依赖闭包；同域保留真实 Cordis 同步对象、服务及事件语义，同域插件可能互相影响。此决定不自动信任任何插件、脚本、凭据或外部资源。

目标仍是原生 DSH 插件、Bundle、Profile、工具、Agent/Subagent、Hook、LLM、Context/Memory、Workflow、持久化和原生 UI 在 XBuild 中运行；不使用 Markdown/MCP 降级或嵌入整套 DSH 页面替代。现有 ZCode 插件链保持不变。声明兼容必须有精确版本、原始包身份、完整性、能力与实际运行证据。

## 版本与分发

初始固定运行库为 `@deepseek-ai/dsh@0.2.2-rc.3`，同族包固定相同版本；Cordis 固定 `4.1.0`。依据为 release `38a6a5c965aa99ab525161efb7cc5cf1fe62fced`，不混用 master 或 npm latest。其他历史 ABI 在独立运行库和测试记录具备前显示版本限制，不能静默强装。

运行库随 XBuild 的依赖及运行资产管理，不要求用户手动安装 DSH。插件支持 npm spec、带完整性的 HTTPS tarball、锁定 Git commit 的公开仓库和本地开发目录。分发元数据只用于展示／解析，不执行市场提供的 shell install 字符串。原包内容不改写；配置覆盖只写域的 Profile 或 Host-owned overlay。

包管理安装、构建脚本与运行激活是不同授权。默认禁用安装脚本。缺少发布产物或被禁用的构建脚本必须明确报告，不能以包已下载宣称可用。npm 依赖闭包使用真实包管理器锁定，版本冲突、缺失 peer、循环加载、平台限制与失败均保留诊断。只有原始模块实际完成加载且必需服务就绪才进入 running。

## 所有者与进程

- CLI 插件管理能力面拥有安装记录、域配置、信任、版本及生命周期；服务层经已存在的 Agent stdio／RPC 路由，不直接引用具体 Runtime。
- `@zcode/dsh-runtime` 是新的受控 adapter 模块。父 supervisor 拥有子进程、generation 和在途调用；子进程拥有真实 Cordis Context、原始插件 fibers、DSH Agent/Session 及其日志。不会在父进程重建第二个 DSH 对象图。
- 原生插件代码只在域子进程执行，不导入 Electron Main 或 Local Host。不同域使用不同进程、独立 HOME／DSH_HOME／临时目录和安装目录。父环境不自动传入模型密钥、应用 token、调试注入或其他域的数据路径。
- 标准 Node 与桌面／SEA 使用显式 runner 描述，不将 Electron/SEA 可执行文件误当 `node script.js`。runner 复用 CLI 的受控隐藏子进程入口；停止时必须确认旧进程退出后才能启动下一代。
- `workspaceIdentity?.trim() || workspacePath` 是隔离键。路径只用于真实文件操作。所有远端调用同时携带 identity、remoteSessionId 和 generation；相同路径不能跨身份复用域。
- 一个域可按明确配置持有多个 DSH Session；跨 Session 插件共享是域授权的一部分。跨域没有同步对象共享，只有可校验的异步消息。用户停止／禁用后，新调用立即被拒绝；旧在途调用必须取消、结算或因域退出明确失败。

```text
插件管理 UI → service → CLI 插件 inventory owner
                                │ 授权 + immutable revision
                                ▼
                       DSH 域 supervisor
                                │ generation-bound IPC
                                ▼
                    原始 Cordis / Profile / Agent
                       ├─ 原始 Tool/Hook/LLM
                       ├─ Session log / native inbox
                       └─ 原始 Connection / UI graph
```

## 原生行为与事件

加载使用原始 `@deepseek-ai/dsh-app-boot`、Cordis Loader、Include、Profile composition 与原始服务。不能自建一个形似 Context 的 shim。函数、class、apply、Config、inject、provide、scope、fiber 与 effect 由上游实现。

保留 emit/parallel/serial/bail/waterfall、prepend、scope/filter、同步异常、异步返回、零值 bail、next 一次性约束与调用者归属。工具 schema、output.render、条件注册、执行前拦截、审批、guard、执行后变换、超时、进度和清理走原始 pipeline。原始 LLM adapter、prepared call generation、块流、usage、路由、prompt/context/compaction 以及 Agent 生命周期均由真实内核执行。

原生 Session 日志是事实源，XBuild 只持关联与展示投影；不把 DSH 事件伪装成 ZCode 事件后丢掉原 payload。原生 Inbox 承担 DSH 会话的 CLI/runtime 串行 admission；Host 只路由，不持第二份已接受队列。ZCode 会话仍使用现有 CommandInbox。原始 sessionId 与 XBuild 关联不能仅以路径推断。

```text
桌面 desktop-continuous ─ generation-bound live notifications ─┐
                                                             ├─ 同一域／Session owner
手机 web-remote-replayable ─ snapshot + cursor + gap repair ────┘

输入 → 原生 inbox admission → 原生 turn/log commit → 事件投影
权限问询 → 原始 approval/asked → 用户答复 → approval/decided
```

审批只有上游 `allowed-once` 授权；`never` 表示拒绝 ask，不是自动允许。缺失 answerer、取消、过期代际或未知返回 fail closed。用户对域代码的信任不替代原生工具审批、Plan Mode 或 sandbox policy。不得默认引入 sdk-minimal 的 danger-full-access 设置。

## 依赖域授权与安全

每次激活绑定 domainId、workspaceKey、revision、完整依赖闭包、运行权限及 UI 权限。更新、依赖变化、配置中可执行表达式变化或权限扩大使旧授权失效；撤销立即阻止新消息。公开市场 verified／author 字段不能授予权限。

原生 JS 与工具层权限不同：前者在平台提供的域执行边界内运行，后者继续经过 DSH 原始审批。只有明确授权的环境变量和凭据被传入域。没有平台级保障时必须如实标注 trusted-process 限制，不将 Node Permission Model 或 Cordis isolate 宣称为完整 OS sandbox。跨域内存、取消和故障必须进程隔离；共享 workspace 文件是显式授予的资源，而不是私有域数据。

记录 lifecycle、版本、错误码及 traceId，不记录凭据或原始会话内容。日志高频内容为 debug，生产生命周期为 info。卸载清理代码、注册、副作用进程；长期数据默认保留，删除数据须显式选择。

## 生命周期与事务

状态：absent → resolving → staged → awaiting-trust → starting → running；停止经 stopping → stopped；错误为 failed 并携带诊断。配置成功、安装完成、已信任和运行成功不能混成一个 boolean。

同域 mutation 串行。staging 失败不替换 active revision；新版本必须通过完整性／依赖／真实加载检查后激活。回滚引用仍保留的旧 revision 和配置，不能凭版本字符串重新下载另一份包冒充回滚。重试不自动扩大权限或忽略错误；全局卸载不能误删其他域或 ZCode 插件文件。

加载、配置、禁用和卸载都 await 原始 fiber 生命周期。域退出撤销全部对外注册并拒绝该 generation 的晚到响应。后台任务由域生命周期负责，不能遗留孤儿进程；业务长任务不以固定请求超时冒充完成。

## 原生 UI

保持原始 `__ModuleLoader__.load({id,factory})`、同步 require、共享 React/ReactDOM/Cordis 与原始 modules/slots/store 生命周期。不同域各自拥有模块表；相同包名不串域。XBuild 提供自己的 layout/root slots，在设置、侧栏、会话、工具结果位置挂载真实组件；不加载原版完整 App 页面，不使用 iframe 作为兼容替代。

使用上游 carrier-neutral Connection 与 `ClientTransportHooks` 接到 XBuild 的 scoped service；不新增面向公网的未鉴权端口。client RPC、stream、fetch、asset 与 HMR 绑定域、revision、generation；关闭释放订阅、React root、fibers、脚本和资源 URL。配置 schema 使用原始 Config 生成器；敏感字段不回显明文。

原生 UI 是显式授权能力，必须呈现其可信代码／DOM 权限边界，不把 ErrorBoundary 当安全沙箱。实现仅能在已支持的平台宣告可用，未支持的表面明确显示限制，不用空卡片冒充原始组件。遵守 DESIGN 的字体、主题、现有组件、国际化及移动布局；UI 通过 hooks 调 service。

## 统一插件管理

DSH 来源作为个人来源出现在现有插件商店，保留原名、npm scope、作者、版本、许可证、仓库、依赖、平台和权限。安装、信任、启停、配置、更新、回滚、卸载和诊断复用插件管理入口；不污染原有 ZCode manifest 解析。

兼容等级只依据证据：native-equivalent、verified-mapping、native-runtime-required、environment-limited、unverified／incompatible。下载成功或静态分析不能提升为 equivalent。复杂 Bundle/Profile 原有加载顺序、整段 config 覆盖、禁用和依赖服务保留。

## 验证

CLI 包中先写回归测试，再实现；App 不恢复业务单测。交互先加桌面 E2E／浏览器验收。最低测试包括真实包 apply/dispose、同步 Hook veto／修改结果、隔离和异常退出、错误 peer/version、Profile patch 顺序、数据重启、审批拒绝／取消、原始 SDK turn、client RPC／slots 配置和卸载。

真实社区 corpus 覆盖 Skill/Command、Subagent、MCP、Tool、Hook、模型、Agent 生命周期、Memory/Context、Workflow、UI/Settings、权限和 Bundle/Profile。每条记录固定版本、来源、完整性、执行平台、通过／失败／未执行及原因；未执行不得显示通过。需要付费模型、外部系统或其他 OS 的场景应作为明确未验收条件，不隐藏为成功。

必须执行根 typecheck、lint、architecture --changed；CLI 改动加 CLI typecheck/lint 与受影响测试。最终验收仍以用户列出的 15 项逐项检查；仅运行宿主或注册工具不等于整个项目完成。
