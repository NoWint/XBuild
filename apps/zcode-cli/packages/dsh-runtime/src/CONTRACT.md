# cli-dsh-runtime

本模块是已授权 DSH 依赖域的进程 adapter，不负责授予信任或改写插件。原始 Cordis/DSH Context、Agent、Session、Hook、Tool 和 LLM 对象图只在域子进程内存在；父进程只持生命周期和可序列化传输。

`@zcode/dsh-runtime/package.json` 是公开只读 metadata 入口；可信 launcher 使用 `createRequire(...).resolve()` 找到外部 distribution，不导入 native graph。普通 Node 与 SEA hidden CLI 均由 parent 明确提供 runner/argsPrefix；worker-entry 只在子进程中执行一次。

- domainId + revision + generation + workspace identity 绑定一次启动。不得按路径复用远程身份、接受旧代际返回或在旧进程尚未退出时报告新一代就绪。
- 安装及 Profile 由调用方准备；缺包、skipped Bundle、必需服务不就绪、enabled 插件失败必须拒绝启动。包内原始文件不改写。
- 子环境显式构造；HOME/DSH_HOME/TMP 指向域目录。不默认继承父 credentials、NODE_OPTIONS 或模块注入。stdout/stderr 与 IPC 分离。
- 初始 Config 是父 owner 已准备并授权的真实 Profile；只加载该 Profile 的 Bundle／patch，不隐式引入 base、sdk-minimal 或 danger-full-access。根 `dataDirectory/cordis.runtime.yml` 由 worker 异步重置为空列表（授权 Profile 不写回），使用上游 Profile resolution、PluginPackages 和 boot 装配。通过公开 Loader hook 保持原 Profile 的资源／解析 baseUrl，原始 Include.filename 与写回在域 data；包含退休 Bundle 的 Profile 必须在授权前迁移，本包只拒绝、不代迁移。显式嵌套 Include 仍拥有其配置文件写回路径，父 owner 必须独立授权这些路径。精确 `@deepseek-ai/dsh-sdk-jsonrpc-server` row 通过启动层 carrier patch 映射为同一上游 HarnessSdkJsonRpcServer 的 IPC wrapper，保留原始 Config／inject／name 和 sdkSessionActivation，不修改源 Profile／包文件；这不是原生 stdio 部署等效。
- SDK 返回上游 result；notification.payload 保留 `{jsonrpc:'2.0',method,params?}`。`invoke()` 返回独立 `result`、`settled`、`cancel`，`request()` 是 `result` 包装。每次 invocation 可提供独立 host answerer；prompt/query 回执不结束 invocation：command 先等待原始 commandId 对应的 `session.query.completed`，再 await 原始 `session/wait`（Agent 与子任务）；只有独立 `settled` 控制帧释放父方 admission。取消仍 await 原始 Agent/子任务清理。`turn/end` 不能替代原生空闲边界。上游没有 session/cancel，取消指定 session 的在途调用使用真实 Agent.cancel；已接受的 inbox 仍归 Agent 所有。
- Fetch 返回 `{status,statusText,headers,bodyBase64}`（无 body）或 `{status,statusText,headers,streamId}`；stream.payload 为 `{streamId,event:'chunk'|'end'|'error',chunkBase64?/error?}`，原始字节透传，不重组 SSE。调用者 AbortSignal 绑定 stream 直至 end/error，传输 sequence 不取代原生 Session 日志 sequence。
- `peer-open` 创建真实 Connection Peer，`peer-close` 先撤销该内部 peerId admission，再 await 原始 Peer.dispose 和所属 native iterators。`fetch.peerId` 与 `remote-stream.peerId` 使用同一 Peer；省略 fetch Peer 时仅兼容原来的 non-interactive domain Peer。streamId 仅在 Peer 内唯一。Remote stream 通过真实 `TypertGateway.wireStream.open` 打开，首次读取前发送注册回执；`data.value` 缺失表示原始 undefined，失败保留原始 code/message/details。`stream-uplink` 使用 262144-byte 有界队列，支持 undefined item 和 half-close；溢出用原始 gateway/uplink-overflow 取消原生 stream。Gateway 值校验和取消语义不改写。
- `.xbuild-host-overlay.json` 是受批准 digest 覆盖的 Host-owned 最后 patch 层。worker 异步读取并在 boot 前验证有界 JSON patch object array；缺少文件不增加配置，错误文件拒绝启动。它在 Profile patches 之后、launcher 的明确 SDK carrier mapping 之前应用，不写回 `cordis.patch.yml`。
- `dataDirectory/loader-state.json` 是域自有、跨重启保留的运行时配置层，承接插件通过公开 `ctx.loader.update()` 产生的 patch-owned 变更。上游 Include 把这类变更路由进内存 patch 而非配置文件的 insert 行（`cordis.patch.yml` 因此保持字节不变），若不落盘，重启即丢失；这不是原生 Profile 写回，也不修改已授权 revision。
  - 读取：boot 前校验有界 patch object array（`{id, config?, disabled?}`），缺失不增加配置，损坏/超限拒绝启动，与 host overlay 同一 fail-closed 策略。层序为 Profile layers → Profile patches → loader-state（用户运行时偏好）→ host overlay（Host-owned，按 launch overlay 语义更优先）。
  - 写入：仅在授权基线条目上记录与基线不同的 `config`/`disabled` 增量，不持久化 launcher 注入的 SDK carrier row，也不伪造缺失的 insert 行；基线是本次 boot 实际组合出的 entries，因此重启后读取的层不会产生自反馈 diff。
  - 原子写（临时文件 + rename）并由域 owner 串行化；`close()` 在 dispose 前 await 未完成的持久化。超限只报告域诊断，不静默写成部分状态。
- 父进程只接受严格 JSON IPC schema、当前 domainId/generation、已登记 requestId 与递增 eventSeq；未知／超限帧不推进状态。异常退出拒绝所有在途调用及 host 审批，stop 在 cleanup 后等待进程退出；cleanup 失败及强制 kill 不报告成功。
- host request 由 worker 在当前 SDK invocation 中关联 requestId，父 owner 使用 signal 生命周期返回原生答复。没有 host handler 时明确拒绝，不默认授权工具。stdout/stderr 仅作有界 log event，绝不解析成协议。
- stop 先封闭调用入口，再 await 原始清理和进程退出。不得以过了若干毫秒等同清理成功；终止失联进程后仍需确认退出。
- 2026-11-15 review fix：POSIX adapter 为 worker 建独立进程组，异步观察实际组／后代身份，退出后终止并确认已观察资源不存在。正常 native cleanup acknowledgment 与观察到的组／树清理是可用边界，不是 arbitrary native OS containment。原生清理后仍存活的 detached escape、观测失败、未知异常退出或强制超时均 fail closed：保留 `.xbuild-domain-owner.json` 和内存 ownership，拒绝目录复用。已由原生清理 reaped 的 detached 后代不误报；held startup failure 在原生清理成功且已观察资源确认释放时可解除所有权，保留原始失败码。旧 supervisor 消失不自动解除记录；该 metadata lease 仅防意外重用，不是安全凭据。Windows／其他未实现平台在 spawn 前明确拒绝，不能以 taskkill 替代 Job Object。当前 Linux/macOS 不声称 sandboxed 或限制 unrestricted native-code grant。
- worker 的 stopped/failed 帧先于 root 退出；stopped 需父方完成资源观察后发送内部 exit 帧，失败需父方观察后终止。这样 startup failure 不会先让 detached 子进程失去可追踪的父身份。真正 abrupt exit 无法证明未知 escape 已清理，始终隔离目录。
- 快照在 ready、stop 前、stopped 屏障、强制终止前和退出验证时被实际 await；任一观测失败永久使本次释放不可验证。worker 退出时立即关闭 admission，资源验证未结束前不发布 stopped。POSIX creation identity 使用已验证的 pid/ppid/pgid/lstart；macOS lstart 只有秒级精度，不是 PID handle 或安全证明。残留组内身份未知时不冒险宣称释放，保留隔离记录。
- 同 Peer 重复 streamId 在 native admission 时只拒绝新 request（error/settled）；不得发布成功 metadata 或同 id 的 stream 终态。已登记的 incumbent 保持取消、uplink 与事件关联；不同 Peer 可使用同一 id。
- `withDshDataMaintenance({domainId, workspace, dataDirectory}, action)` 与 native start 共用原子持久守卫，位置是 canonical data 的目录外同级 `.xbuild-dsh-lifetime-<digest>.json`。先取得守卫，再检查旧目录内 marker，最后才允许创建 data 或执行维护 IO；守卫一直持有至 native 资源验证或完整 awaited action 结束。维护只释放自己的 token，不恢复／删除隔离记录；失败 action 也先等待 IO 收尾，再验证并释放自身守卫。
- 所有权记录读写共用 64 KiB 上限；异步读取只分配上限内 buffer，验证普通文件、大小、严格 schema、domain/workspace/canonical data 身份及 token。超限／损坏／未知／改变 token 的记录 byte-preserved，使用通用稳定诊断，不转发记录内容。旧 `.xbuild-domain-owner.json` 存在时 fail closed，不因外部守卫缺失、PID 消失、重启或 TTL 自动解除。正常 native release 先验证两个自身记录才删除；无法验证时只更新确属自己的守卫，不覆盖未知 marker。
- `start()` await 退出及资源 owner 的最终结算后抛出 finalized failure，保留原启动失败码并携带实际 quarantine 诊断，不提前返回旧 ready rejection。
- 本模块的 IPC 不是逐插件安全沙箱。可信依赖域内共享同步语义的产品边界见 docs/plugins/dsh-compatibility/spec.md。

```text
已授权 Profile → supervisor → generation-bound IPC → native Context
stop          → 禁止新调用 → native dispose → stopped → 平台资源观察 → exit
              → 清理并确认已观察组／树 → clean release 或持久 quarantine → 请求结算

attachment → peer-open → 原始 Peer → fetch / Gateway stream
                              └─ peer-close → signal abort → iterator.return → settled
invoke → 原始 SDK → result 回执 → correlated command completion → Agent/子任务 wait → settled

canonical data + domain/workspace → atomic external guard
                                ├─ native lifetime → verified cleanup → release / quarantine
                                └─ maintenance → await all filesystem IO → own-token release
```
