# DSH 完整兼容：实现前置审计与安全边界决策

日期：2026-11-14。

## 当前交付状态

**完整兼容适配器尚未实现。本文是前置审计和阻塞决策记录，不是架构方案获批记录、插件兼容声明或产品验收报告。**

本次没有修改 XBuild 产品源码、依赖、插件配置或权限设置，也没有安装社区插件到用户环境。只在独立临时目录检查上游源码、发布物和市场元数据，并执行锁定版 Cordis 的七项受控运行探针。仓库新增的文件仅用于保留审计证据。

## 已确认的产品边界（2026-11-14）

用户已明确选择“接受依赖域隔离”。该决定解除本次审计提出的实现阻塞：以显式授权的可信插件依赖域作为故障隔离边界，同域保留原始同步 ABI，同域插件可能互相影响。它不授予任何具体第三方包运行、安装脚本、凭据或跨域访问权限；这些仍需产品中的精确授权。后续实现规格见 [spec.md](./spec.md)。下文保留作出决定时的证据，不再要求重复确认相同取舍。

### 原始边界问题

原要求同时包含：

- 原样加载符合 DSH 公开接口的插件，保留同步服务、对象身份、Hook 时序以及原生 UI 行为。
- 一个插件的故障不能污染其他插件或 Session，并清理插件的所有副作用。

上游公开 ABI 是同进程、同 JavaScript realm 的扩展 ABI，不是逐插件安全沙箱协议。直接复用上游运行时不能证明第二项强隔离保证；把所有调用改成普通异步 IPC 又不能直接证明第一项全语义等效。

这里没有证明“任何隔离实现都不可能”。已确认的是：**不能将 Cordis 的服务命名域隔离、异常捕获或 React ErrorBoundary，直接标注为逐插件进程／DOM 隔离。**

### 推荐的可实施边界：显式信任的依赖域

仅在用户明确授权后，允许互相依赖的 DSH 插件在同一执行域共享上游同步 ABI。授权对象必须包含精确的依赖闭包、代码完整性、版本和执行权限，而不是市场的 `verified` 字段。原始工具审批继续保留，不能被此授权替代。

同域插件仍可能互相影响；故障恢复的硬边界是整个依赖域，而不是每个插件。跨域和跨 Session 必须另行设计并验证隔离；需要同域共享 Session 或跨 Session 服务的插件不能悄悄扩大授权范围。尚未实现或未验证的隔离能力不显示为可用。

```text
用户授权精确插件依赖域
        │
        ▼
XBuild 生命周期 owner ── 受约束的域间协议 ── DSH 可信执行域
        │                                  ├─ 原始 Cordis 服务／事件
        │                                  ├─ 原始 Agent／Session／模型
        │                                  └─ 原始 UI 模块／slots
        └─ 域失效时撤销路由与能力；不把同域副作用声称为逐插件隔离
```

**这会调整原要求中无条件逐插件故障隔离的含义，不能由实现者默认批准。**

### 若必须坚持逐插件强隔离

维持不放宽安全边界。对于依赖共享同步对象、同栈回调、跨插件 DOM 或未受控副作用的插件，在独立验证隔离后的 ABI 等效之前明确拒绝激活。这样可以继续建设安全的兼容体系，但不能同时承诺任意此类插件均可原样等效运行。

这不是建议使用 iframe、外部 DSH 页面或 MCP 降级替代原生 UI。

## 固定的上游事实

- 发布基线：`dsh-v0.2.2-rc.3`，commit `38a6a5c965aa99ab525161efb7cc5cf1fe62fced`。
- 调查时 master：`39163dd30f703a79079e2d2446545cff3c453738`。GitHub compare 返回比上述 tag 超前 608 个提交；不能用相同 package version 字符串认定源码相同。
- 实际执行的包：`@deepseek-ai/cordis@4.1.0`。
- Cordis 发布完整性：`sha512-CJrjNyBkKn1SfvBQUcgFYKFnLjS+uKrhdMsbHU60xabvi12d+xQ+IQSNlME5Z+B+4Zi6n4BDknKY94tEPeo47w==`。
- 本次 Cordis 依赖解析为 `@deepseek-ai/cosmokit@1.9.0`、`@standard-schema/spec@1.1.0`。安装使用 `--ignore-scripts`，未执行安装脚本。
- 上游 MIT 许可允许按条款内置分发。`@deepseek-ai/dsh-sdk-client` 解析自身同版本 DSH 依赖，使用 `process.execPath` 启动；这提供“不要求用户另装全局 DSH”的路径，但 Electron／SEA 打包仍需单独验证。
- 官方 `sdk-minimal` 的 sandbox 配置是 `danger-full-access`。**未运行该 Profile，也不能把它作为 XBuild 的默认安全策略直接引入。**

### 原生 UI 路径确实存在，但尚未接入

发布版客户端通过 `window.__ModuleLoader__.load({ id, factory })` 注册闭包，随后同步调用 `factory(require)`，共享 React、ReactDOM、Cordis 以及 store／slots 等实例。`ctx.uiRenderer.mount(HTMLElement)` 挂载根 slot，并返回卸载函数。

这使 XBuild 自己提供布局、挂载真正第三方 React slots 成为可研究的接入方向，不要求 iframe 整套 DSH。但需要实现原始 module table、生命周期、scope、store、Session 和远程服务合同。当前 XBuild 的 MCP Apps webview 不等于这套原生 ABI。

## 已执行的运行证据

原始结果：[2026-11-14-cordis-probe-results.json](./2026-11-14-cordis-probe-results.json)。

探针源文件：[cordis-contract-probe.mjs](./cordis-contract-probe.mjs)。它是上游合同探针，不是 XBuild 业务测试或插件运行适配器。

运行环境：macOS，Node `v24.14.0`；清空继承环境变量，Node Permission Model 只放行探针和依赖目录的读取及单个结果文件的写入。没有授予子进程执行能力，没有模型调用或用户凭据。Node 的这组限制不是完整的网络／CPU／浏览器安全沙箱证明。

| 探针            | 实际观察                                                                       |
| --------------- | ------------------------------------------------------------------------------ |
| serial 的返回值 | 返回 `0` 即阻断后续监听器，不是按 JavaScript truthiness 判断                   |
| waterfall       | 保留前后顺序及结果转换；不调用 `next()` 时真实执行不会发生                     |
| parallel        | 等待全部监听器结束后，聚合两个原始错误                                         |
| 普通 emit       | 同步异常原样向调用方抛出，后续监听器未运行                                     |
| 共享服务        | 同步回调修改真实共享对象；调用返回前可见，保留对象身份                         |
| 受管清理        | `fiber.dispose()` 后，通过 `ctx.on()` 注册的监听器不再被调用                   |
| 非受管副作用    | 独立 Context／服务 isolate 仍共享全局对象；插件 dispose 不会自动撤销该全局写入 |

七项探针均通过断言。这里的“通过”表示观察与上游真实合同一致，**不表示其安全保证达标，也不表示 XBuild 支持这七项能力**。探针仅使用受控内存对象，没有触发无限循环、崩溃或破坏性操作；对硬挂死及 DOM 越权的判断仍是基于源码的未验收边界。

首次启动探针因 macOS `/tmp` 符号链接触发 Node `ERR_ACCESS_DENIED`，尚未进入探针；改用 `/private/tmp` 实际目录后成功。没有通过取消 Permission Model 来绕过该错误。

复跑时，先在新的独立依赖目录安装上述精确 Cordis 版本并禁用 scripts，然后使用仓库固定 Node，传入依赖根目录及输出 JSON 路径：

```bash
node docs/plugins/dsh-compatibility/cordis-contract-probe.mjs /absolute/probe-dependencies /absolute/probe-results.json
```

该命令只复跑合同观察，不自动建立上面记录的 Permission Model；复现安全环境还需按本机实际路径显式配置读写白名单及空环境。

## XBuild 当前边界与工程基线

- 插件安装、配置和启停由 [CLI bootstrap](../../../apps/zcode-cli/packages/bootstrap/src/plugins.ts) 编排，[adapters](../../../apps/zcode-cli/packages/adapters/src/plugins/marketplace.ts) 执行存储；不能另造 Renderer 安装 owner。
- [PluginLoadOutcome](../../../apps/zcode-cli/packages/contracts/src/plugins/index.ts:276) 当前投影 Skill、Command、Hook 和 MCP，没有 Cordis 原生服务／模型／Session 贡献合同。
- [AgentRuntime 装配](../../../apps/zcode-cli/packages/bootstrap/src/app/create-app.ts:878) 有工具、权限、模型等宿主 seam，但尚未实现 DSH 运行内核。
- [现有 UI 桥](../../../packages/services/src/plugin-ui-bridge/contract.ts:107) 管理 MCP Apps，不是 DSH module loader／slots 宿主。
- [运行时边界](../../agents/runtime-boundaries.md) 继续要求唯一 owner、workspace identity、CommandInbox、桌面 continuous 与手机 replayable 分离；不能用另开一套不受这些边界约束的 DSH app 冒充集成。

已执行：

| 检查                                         | 结果                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| `node scripts/check-workspace-freshness.mjs` | main 与 origin/main 同步，ahead 0／behind 0；首次使用现有 Node v26.7.0 |
| 固定 Node                                    | mise 命令未安装；通过隔离 npm exec 获取并使用 `v24.14.0`               |
| `pnpm typecheck`                             | 固定 Node 下退出码 0                                                   |
| `pnpm lint`                                  | 固定 Node 下退出码 0，98 条已有 warning，0 error                       |
| `pnpm architecture:check --changed`          | 固定 Node 下 0 violation                                               |
| Cordis 合同探针                              | 7 项通过；不是 XBuild 兼容验收                                         |

尚未执行：社区插件在 XBuild 内安装／运行，DSH 模型与真实审批链，原生 UI 浏览器验收，桌面／手机远控，Windows／Linux，历史版本回归及用户要求的完整生命周期验收。因此最终产品验收的 15 项均不能在本次标注为完成。

## 市场调查的证据等级

读取了社区市场 `awesome-dsh-plugin.com/plugins.json`：2026-11-14 快照含 10,936 条目录记录。另读取 `ydhrdh/dsh-marketplace` 的 JSON Schema 和示例，以及 Pine Computer 的实际 DSH Bundle 清单。

目录中的分类、版本、权限描述和 `verified` 标签只是来源声明，不是 XBuild 运行、安全或真实性验证。没有执行目录里的 `install` 命令，没有将市场数量当作兼容覆盖率。Pine Computer 之类声明 Node、DSH、Cordis 和多个服务 peerDependencies 的真实包说明，仅做 manifest 转换不足以运行整个依赖闭包。

## 原始来源

- [锁定 release 源码](https://github.com/deepseek-ai/deepseek-harness/tree/38a6a5c965aa99ab525161efb7cc5cf1fe62fced)
- [Cordis Context／服务 isolate](https://github.com/deepseek-ai/deepseek-harness/blob/38a6a5c965aa99ab525161efb7cc5cf1fe62fced/vendor/cordis/src/context.ts#L109-L125)
- [Cordis 同步／异步事件合同](https://github.com/deepseek-ai/deepseek-harness/blob/38a6a5c965aa99ab525161efb7cc5cf1fe62fced/vendor/cordis/src/events.ts#L185-L260)
- [浏览器同 document 模块加载及同步工厂](https://github.com/deepseek-ai/deepseek-harness/blob/38a6a5c965aa99ab525161efb7cc5cf1fe62fced/packages/client/modules/src/client/system.ts#L15-L29)
- [原生 DOM renderer mount](https://github.com/deepseek-ai/deepseek-harness/blob/38a6a5c965aa99ab525161efb7cc5cf1fe62fced/packages/client/ui-renderer/src/client/index.ts#L89-L97)
- [原始审批的 fail-closed 实现](https://github.com/deepseek-ai/deepseek-harness/blob/38a6a5c965aa99ab525161efb7cc5cf1fe62fced/packages/interaction/user-approval/src/index.ts#L242-L333)
- [sdk-minimal 的默认 sandbox 配置](https://github.com/deepseek-ai/deepseek-harness/blob/38a6a5c965aa99ab525161efb7cc5cf1fe62fced/packages/bundle/sdk-minimal/cordis.patch.yml#L70-L74)
- [DSH 社区目录原始数据](https://awesome-dsh-plugin.com/plugins.json)
- [独立社区市场与清单 Schema](https://github.com/ydhrdh/dsh-marketplace)
- [Pine Computer DSH Bundle](https://github.com/PineComputer/pine-computer/tree/main/plugins/deepseek-harness)
