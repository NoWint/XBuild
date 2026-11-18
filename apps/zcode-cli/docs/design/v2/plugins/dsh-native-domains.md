# DSH 原生依赖域：CLI 合同

产品规则与批准的信任边界见 [DSH 兼容规格](../../../../../../docs/plugins/dsh-compatibility/spec.md)。本目录为 CLI 的实际行为合同，不改变 ZCode 会话默认执行路径。

- 新包 `@zcode/dsh-runtime` 提供进程隔离的真实 Cordis／DSH 域。输入是已由插件 owner 准备并授权的 Profile、绝对目录和 generation；它不决定插件来源是否可信，不暗自安装包。
- supervisor 所有权包括子进程、在途请求、取消、generation、退出确认。worker 所有权包括原始 Context、fibers、Session/Agent inbox 与持久化。worker 的 stdout/stderr 不是 IPC 协议，原插件日志不能污染请求帧。
- IPC 消息是严格可校验的 JSON，包含 protocolVersion、domainId、generation、requestId／eventSeq。未知字段／类型、超大帧、晚到代际和未知 requestId 不推进状态。原生 JSON payload 必须保留，而不是反射任意 Node 对象。
- 原始 SDK request/notification 和 carrier-neutral Connection Fetch／stream 在边界透明传送。Profile 显式引用的官方 `@deepseek-ai/dsh-sdk-jsonrpc-server` 使用相同上游 HarnessSdkJsonRpcServer 的 IPC 载体包装，保留 config/inject、sdkSessionActivation 与原始请求语义；不改插件文件，不向 stdout 写协议，也不把 SDK shutdown 直接交给原入口 process.exit。这个明确的 launcher 载体适配必须独立回归验证。权限 request 必须由父 owner 绑定到当前域、请求和代际；缺答复时不执行工具。原生取消沿 AbortSignal／SDK cancel，退出使未完成请求失败。
- 2026-11-15：公开 invocation 的 result 与 settled，command query 的后续活动以原生 `session.query.completed` 及 Agent/子任务空闲结算，不能在 command 回执撤销审批归属。每次 invocation 有独立 host answerer。原生 UI stream 走真实 TypertGateway wireStream、attachment-owned Peer 和有界 uplink；普通 Fetch unary 不能替代 follow/control。细节与严格载荷见根接线合同。
- 默认 loader 使用 `@deepseek-ai/dsh-app-boot@0.2.2-rc.3` 的 Profile 和补丁组合，以及 `@deepseek-ai/cordis@4.1.0`。拒绝 skippedBundle、enabled fiber failed/pending 等不完整激活，不静默忽略必需插件。
- 每域专有 DSH_HOME、HOME、临时目录；环境必须显式构造，不继承父凭据。域接受的 workspace identity 不得只按路径匹配。启动参数中的目录均由管理 owner 推导，不能由前端任意读取机器路径。
- `stop()` 幂等：先拒绝新调用，取消原生输入／stream，await 原始清理，然后确认进程退出。清理超时仅用于终止失联进程，不作为成功同步。旧域未退出前不启动替换实例。
- 后代进程同样属于域资源。普通 worker PID 退出或单次 taskkill 调用不证明后代已退出；平台 adapter 必须确认其实际拥有的进程生命周期。对于无法证明已清理的异常退出，保留／隔离该 data ownership 并明确失败，不能立即重用。标准 POSIX 进程组不是任意 detached/native 代码的 OS containment；不支持的保护范围必须作为 environment-limited 拒绝或诊断，不以可信进程标签掩盖。
- 原生启动和删除域数据共用同一持久生命周期互斥，守卫位于可删除 data directory 之外。不能只在当前 controller 保存清理失败标志，也不能先读取标记再无锁删除。公开 `withDshDataMaintenance({domainId, workspace, dataDirectory}, action)` 仅在不存在运行／隔离／历史未验证所有权时取得维护租约，持有到全部文件操作结束；新启动同样必须取得该互斥。已有旧版目录内所有权记录继续阻止删除和复用，不因 PID 消失、进程重启或超时自动清除。普通关闭只有真实清理已验证后才释放守卫；维护租约不提供安全沙箱或强制恢复能力。
- 所有权记录读写共用 64 KiB 上限，校验身份、token 与结构；超大、损坏或未知记录 fail closed。插件可写数据目录不能使父 supervisor 无界读取元数据或转发原始凭据。
- 生效到 ZCode 工具链的桥不得绕过 ToolExecutor、原有 hooks 或权限；原生 DSH 会话则使用完整 DSH pipeline。不能把直接 `definition.execute()` 当成已通过 Tool Permission。

```text
管理 owner → 验证授权／workspace／revision → supervisor
                                              │ IPC generation
                                              ▼
                                         DSH worker
                          Profile → 原始 Loader → 原始 SDK／Connection
                          stop    → fiber.dispose → exit → 父确认结束
```

回归在本包 CLI tests，包含真正的子进程与原始运行库，不恢复 App 业务单测。跨端接线通过公共 shared schema；UI 不导入本包实现。
