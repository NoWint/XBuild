# dsh-plugin-service

管理、原生调用和通知复用既有每 Host plugin-management CLI。服务不持有 Context、
Session、Inbox、安装清单或原生 runtime；唯一事实所有者仍是 CLI controller / 域 worker。

不变量：

- `dispatch` / `onDynamicDshEvent` 使用 shared 严格 schema。原生 request、result、
  client graph、payload JSON 原样透传；Source identity mapping 仅修改外层 scope。
- 每条可信连接 facade 注入实际 clientMode，只保存该连接取得的 attachment lease；
  identity key 为 `workspaceIdentity?.trim() || workspacePath`，同时匹配 remoteSessionId。
  invoke / answer / cancel / events / detach 拒绝外连接 token、revision、generation。
- 原生等待不设固定业务期限，已有 protocol client 的 `timeoutMs: null` 只在 DSH 路径使用；
  显式 cancel、CLI 错误和连接关闭仍结算调用。普通协议路径保留默认超时。
- 关闭先拒绝 admission、移除事件监听，再 await 仅此 facade 的 detach；晚 attach 回执
  必须回收而非复活旧连接。控制器仍拥有调用、审批和 replay 状态。
- Host relay 沿用受信 V4 connection carrier 传递下游真实 clientMode；terminal facade
  覆盖任何客户端提供的 carrier，原生 RPC 前剥离此内部元数据。UI raw Agent DSH 方法
  同样经过该 facade，不能绕过租约校验。
- ConfigEditor write carrier 未批准；本模块不适配原生设置持久化。

```text
terminal connection → facade (trusted mode / own leases)
                    → existing service proxy / Host relay
                    → CLI controller (scope / generation / calls)
                    → native worker (Session / original policy)
close → stop facade admission → unsubscribe → detach own leases → owner cancels own calls
desktop: continuous events ── same CLI owner ── mobile: bounded replay + native baseline
```
