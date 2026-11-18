# DSH 管理、会话与原生 UI 接线合同

2026-11-14。沿用已批准的依赖域隔离及 spec.md。本文定义各实施模块共享的消息面，避免原生运行时、包 owner 和 UI 各建一份事实状态。

## 稳定协议面

在 `@zcode/shared/dsh-compat` 定义以下严格 schema 和类型；不要让浏览器导入 CLI 实现。

```ts
type DshJson = null | boolean | number | string | DshJson[] | { [key: string]: DshJson };
interface DshScope {
  workspacePath: string;
  workspaceIdentity?: string;
  remoteSessionId?: string;
}
interface DshAttachment {
  attachmentId: string;
  token: string;
  domainId: string;
  generation: number;
  revision: string;
}
type DshClientMode = 'desktop-continuous' | 'web-remote-replayable';
```

唯一管理 RPC 为 `plugins/dsh/dispatch`；唯一通知为 `plugins/dsh/event`。既有 `plugins/*` 和 ZCode 插件默认行为不改。请求包含 `scope`、`command` 及可选 traceId；命令以 `kind` 判别。所有方法必须有对应公共运行时 schema，不能只用 TypeScript cast。

- `overview`：读取来源、安装域、未验证／错误／运行状态与支持的运行库版本。
- `add-catalog` / `refresh-catalog` / `remove-catalog`：scope + 公开 HTTPS 目录来源。移除来源不卸载已安装域。
- `prepare`：原始 source，或 catalogId + entryId；可选 domainId（更新）、baseBundles 和原始配置 patches。目录 install 文本不作为命令执行。
- `grant`：domainId + 完整 DshDomainGrant（当前包合同字段），只授权已准备 revision/digest。不存在或已变化的 revision 拒绝。
- `set-enabled`：domainId + enabled。启用先验证授权、真正加载成功后发布 running；停用 await 原始清理。持久开关不代表运行成功。
- `configure`：domainId + 原始 patches，生成新的配置版本；不修改原包。只改变非可执行配置且不扩大权限时可保留原精确代码授权；引入新代码、表达式或外部权限时回到 awaiting-trust。
- `update` / `rollback`：domainId + 可选目标 revision。失败不替换原 active revision；回滚引用现存校验过的 revision。
- `uninstall`：domainId + deleteData（默认 false）。先 await 停止，拒绝外域路径。
- `deleteData: true` 必须取得原生资源 owner 的持久维护租约并持有至删除完成；缺少这个能力的 launcher 明确拒绝删除。运行、隔离或历史未验证所有权不能被删除操作清除，即使换了 controller 或 CLI 进程。目录外的生命周期守卫同时阻止新启动，避免“检查标记后再删除”的竞态；不建立第二份清理事实状态。
- `attach`：domainId + attachmentId + clientMode；返回 DshAttachment 和真实 native client graph（如已声明）、native session baseline。每窗口／scope 有独立 attachment；手机复用相同域，不新建 Agent/Host。
- `detach`：DshAttachment。只释放这一 attachment 的 calls/streams，不停止别人的会话。
- `invoke`：DshAttachment + callId + 原始 runtime request（sdk / plugins / client-graph / fetch）。必须绑定域／revision／generation/token。原 SDK 返回值和 JSON shape 原样保留。
- `cancel`：DshAttachment + callId；取消仅作用于这一调用及它已提交的原生 Agent 输入，不取消另一 Session 的审批。
- `answer`：DshAttachment + hostRequestId + 原始答复。只有发出问题的当前 owner attachment 能响应；撤销、取消、旧代际和晚答 fail closed。
- `events`：DshAttachment + afterSequence，返回有界保留的原始域通知与 nextSequence/gap。gap 或进程更换时通过原始 Session／Connection 拉 baseline，不把截断的 ring 说成完整恢复日志。

`events` 同时返回该 attachment 仍在等待的 `questions`（hostRequestId、callId、method、params）。这是在途载体应答的恢复面，不是第二份审批事实；原生 signal 或调用结算会撤销它。即使问询已从 ring 淘汰，也不能让用户永远看不到仍等待的原生审批。

通知携带 scope/domainId/generation、attachmentId、递增 transport sequence、kind 和 payload。kind 包括原始 notification、stream、host-request、host-request-cancelled、lifecycle；原始 Session 序号保留在 payload，transport sequence 不取代业务日志。

返回为严格 `{ value: DshJson }`；overview、attach 和 events 另外提供具体 schema。失败有稳定 DSH 错误码、可读原因和相关 domain/revision，不泄露凭据或堆栈原始用户数据。

### 2026-11-15 载体核实与实现约束

上游 SDK 的 `session.event` 只通知已提交日志，不包含 live assistant chunks 或可恢复基线。原生会话与自定义 UI 必须继续使用上游 `SessionController.follow/control` 和 Gateway-owned Remote event stream。`Connection` 的普通 Fetch RPC 是 unary，不能用它调用声明为 stream 的方法。

运行库公开 `invoke(request, options)`，返回 `{ result, settled, cancel }`；`result` 可以先返回 prompt/command 回执，`settled` 只在原始 Agent/子任务或 `session.query.completed` 对应活动真正结束后结算。每次 invoke 可提供独立 `onHostRequest`，不得按通知中的 Session 名称猜测审批发起人。原有 `request()` 仍为返回 `result` 的兼容入口。

域请求增加以下受控载体操作；外层 controller 将 attachmentId 映射为 worker 内部 peerId，不允许 UI 任意选择其他 Peer。

```ts
type NativeCarrierRequest =
  | { kind: 'peer-open'; peerId: string; interactions: 'answer' | 'none' }
  | { kind: 'peer-close'; peerId: string }
  | { kind: 'remote-stream'; peerId: string; streamId: string; endpoint: string; payload: DshJson }
  | { kind: 'stream-uplink'; peerId: string; streamId: string; value?: DshJson; end?: boolean };
```

`fetch` 可携带内部 peerId；原始 `ClientTransportHooks.fetch/openStream` 使用同一 Peer。Remote stream 由真实 `ctx.typertGateway.wireStream.open(endpoint, payload, uplink, peer, signal)` 打开，数据事件为 `{ peerId, streamId, event: 'data', value? }`，终态为 `end` 或携带原始 `{code,message,details}` 的 `error`。缺少 value 表达上游 `undefined` item，不改成 null。uplink 有界、支持半关闭，溢出真实取消并报告错误。订阅、首次 item、取消与结算顺序必须有真实双向 stream 回归。

禁用或卸载先关闭 controller admission，撤销 attachment 的调用与应答权，再 await 原生整域清理和退出，最后释放载体记录。整域 stop 本身负责原始 Peer 清理；不能同时再发送独立 peer-close 请求，让 stop 取消自己需要等待的关闭操作。独立 detach 仍 await 对应 Peer 清理，不停止别的 attachment。更新候选失败时不写 activeRevision；旧代码、配置和原始数据仍在，恢复旧版本使用新 generation。传输 ring 只修复有界投递间隙；丢失时重新打开原生 follow 获得 baseline，绝不从 ring 伪造 Session 历史。

所有分发操作固定 pnpm 10.33.2，安装环境不继承 `NODE_OPTIONS`、包管理认证或其他域凭据。Git 来源在准备时固定完整 commit，HTTPS tarball 必须提供完整性。配置变更从已有 immutable revision 复制并附加 Host-owned overlay，不用重新下载原插件来冒充配置更新或回滚。

执行边界必须可验证。初始跨平台可用级别为用户明确选择的 `trusted-process`，并明确授权原生代码的 unrestricted filesystem、network 与 subprocess；它不是 OS sandbox。请求 `sandboxed` 或 narrower native-code 权限而平台没有对应实现时拒绝激活，不能展示限制后仍无约束运行。工具审批和 Plan Mode 始终继续使用原生 DSH policy，不随原生代码信任自动放行。原生 UI 的 DOM 信任单独授权。

### 安装与持久化回归边界

- 目录与 revision/domain 元数据的最终序列化大小须满足相同的 4 MiB 读写上限；超限在原子替换前拒绝，保留旧记录。
- 发布 preparedRevision 指针前验证完整 revision/domain schema。原始描述等展示字段保留合法多行文本，不能写入后再被自己的读取规则拒绝。
- peer 按插件所在目录的真实 Node 查找顺序解析。缺失项只可从显式 runtimeDependencyRoot 与已核实安装版本补齐；runtimeVersions 字符串不是实际依赖存在的证据。该 root 与原生 installAnchor 对应，不建立逃出 immutable revision 的 symlink。
- 本地包的 optionalDependencies 同样进入原始安装声明，由固定包管理器保持平台选择和可选语义。
- 超大／超宽 JSON 在入队和写入前有界校验；不能让 safeParse 抛出 RangeError 或把不完整元数据发布为成功。
- 公开 HTTPS 来源经现有公共 HTTP adapter 的 public egress、DNS／连接时检查、manual redirect、大小和超时边界执行；不能仅按 URL 字符串判断公网。

## owner 与授权

CLI bootstrap 的 DSH controller 拥有 management operations、domain supervisor、attachment lease、in-flight call correlation 和可恢复诊断。adapters 的 package store 只拥有原始包、revision/信任/安装记录。真实 Agent、Session 与 Inbox 仍由域 worker 唯一管理。services 只路由和通知，不引用运行时具体实现。

所有包管理器网络／子进程通过 adapter，argv 传参，使用 XBuild 内置 pnpm 10.33.2，默认 `--ignore-scripts`。不依赖用户 PATH 或 DSH 安装。域子进程先构造明确环境与 confinement；network/subprocess/filesystem grant 不是只展示的字段。无法实现所请求的平台保护时拒绝启动并给出原因，或仅在用户显式选择并知晓的 trusted-process 等级运行；不能静默放行。

可执行配置、第三方本机代码和原生 UI 分别有明确的信任边界。用户接受依赖域隔离不等于授予某个具体包凭据、目录或脚本。代码完整性必须覆盖嵌套依赖和任何扩展名，不按 .tmp 等名字跳过文件。不可变 revision 与当前原生持久化数据分开。

```text
Settings / Session UI
  → hooks → IDshPluginService
  → scoped Agent protocol client
  → DSH controller (lease / generation)
  → verified revision → confined native domain
                    ├─ original inbox / log / tool / model
                    └─ original Connection RPC / client graph
```

## 原生客户端

### CLI 协议装配与关闭

生产 stdio 入口按已解析的 `storage.dir` 和 `getCliStorageRoot` 派生独立 `dsh` 存储根，向协议服务器注入惰性的 controller 工厂。首个合法 DSH 请求创建一个 controller；并发首次请求共享同一个创建结果。已有 ZCode 请求不创建 DSH 域、不安装 DSH 包、不创建用于代理 DSH 的 ZCode Session。管理与载体结果均经 shared schema 校验，通知保留原生载荷与 scope/generation；错误只发送稳定诊断，不透传上游堆栈或凭据。

运行库安装锚点、真实依赖解析根、worker runner 与固定 pnpm 路径由受信 launcher 装配，不接受前端传入路径。依赖解析根必须与安装锚点所在目录一致，并读取实际包元数据确认固定 DSH/Cordis 版本。pnpm 必须来自内置的 `10.33.2` 分发物，不能使用用户 PATH、全局 DSH 或任意同版本名的外部包替代。开发检出与已打包分发使用各自明确的资源位置；分发资源缺失时返回 `DSH_DISTRIBUTION_UNAVAILABLE`，不能将未运行的插件显示为成功。

controller 是全部 management operations 的唯一关闭所有者，包括未完成的 prepare、catalog 网络请求与 update。每项操作使用 owner-owned AbortController，与调用方取消信号组合；关闭先同步停止 admission 并撤销所有在途操作，再等待操作清理与已有 mutation 结算，并等待所有原生域退出。native attach/detach 请求与清理同样传递 owner signal；在途 Peer 清理／调用的真正结算可能依赖原生 stop，不能先等待这些操作再启动 stop。关闭使用幂等的单域停止任务，与在途原生操作 drain 协作，最后统一等待；已关闭时才完成的启动由其创建路径负责 stop，不能重新登记。不能物理取消的有界文件 IO 必须等待收尾，不谎报已取消；取消后不能再接纳后续发布或原生启动。prepare、catalog add/refresh 均在最终元数据提交前重新检查 signal，已在关闭前进入原子提交的写入允许完成并由关闭流程等待，不用反向恢复覆盖并发 owner。异步工厂若在关闭后才完成，也必须先关闭其结果，不能重新挂载通知或接收调用。协议断连取消在途操作并撤销当前进程载体；持续运行与重连不得通过另建 ZCode 会话恢复。

```text
stdio request → strict schema → lazy single controller → package / native domain
protocol close → stop admission → abort / revoke → management IO drain ──┐
                                               → native stop + drain ──┴→ await all → detach sink
```

CLI 回归必须经过真实 `ZCodeProtocolAgentServer.handleMessage` 与真实 controller，验证原生插件返回字节、通知、scope/lease 拒绝及关闭后的停止行为；不能只用 stubbed dispatch 证明接线。另用可控制的安装进程复现 shutdown 与 prepare 竞态，验证关闭不先于清理、取消后不新接纳候选发布，也不接纳迟到的原生启动。

UI 新模块 `dsh-native-ui` 使用真正上游 `ClientModuleSystem`、Cordis Loader、renderer/slots/store 与共享 React。

```ts
interface DshNativeTransport {
  request(request: unknown, options?: { signal?: AbortSignal }): Promise<unknown>;
  subscribe(listener: (event: unknown) => void): () => void;
}
interface DshNativeClient {
  mount(container: HTMLElement, surface: 'settings' | 'sidebar' | 'session' | 'tool'): Promise<void>;
  dispose(): Promise<void>;
}
```

这些只是 UI adapter 端口；最终定义必须使用上面严格 shared 类型与原始 SDK/Connection 类型，不保留 unknown 绕开校验。跨层调用通过 hook/service。加载器提供受作用域限制的 RPC/stream、真实资源字节和取消，不直接 fetch 任意 host 地址，不直接 `window.zcode`。

每个后端域的 module table、原生服务和 RPC capability 独立。来自同一窗口的显式可信 native UI 共用宿主 DOM 的渲染信任边界；明确显示 DOM 权限风险，不把 CSS shadow root 或 ErrorBoundary 当作安全隔离。经典脚本登记必须从当前受信脚本的域元数据路由到对应 module table，不通过相同 npm 名称猜测域。动态 require、chunk、asset 和 dispose 同样绑定域代际。

原生资源授权使用与 worker Fetch 相同的标准 URL `pathname` 规范化语义，但不改写原始请求载荷。`/api/../plugins/...`、百分号编码点段等规范化为 `/plugins/` 的路径同样需要 native UI 授权，不能用原始字符串前缀检查放行。

XBuild 提供自己的 surface/root 插件：渲染真正第三方设置、sidebar、Session/Tool presenters，不启动原版完整页面，也不使用 iframe 占位。已有 ZCode MCP Apps 路径保持独立。真实 provider/context/command/settings/remote 服务由原始 client 插件注入；缺失服务使界面明确报错而不是空白成功。

## 验证

先维护 CLI/schema 回归、原生 UI 浏览器/E2E 场景，再接代码。需验证持久化重启、两域同包名、错误依赖、拒绝/晚答/取消、停用/更新/回滚、UI真实交互、桌面continuous与手机replayable。未执行或平台受限的条目不能标通过。
