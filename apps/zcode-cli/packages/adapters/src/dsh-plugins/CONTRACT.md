# cli-dsh-packages

负责原始 DSH 包及市场元数据、隔离 staging、不可变 revision、完整性、域信任记录与持久化安装状态。不运行插件；启动成功由原生 runtime owner 另行确认。

- 原始身份、Manifest、Bundle/Profile 顺序、版本和来源必须保留。市场 install 字符串不是 shell 命令入口，verified 标记不是信任。
- 信任绑定 workspace identity、domain、revision 与完整闭包摘要。下载、信任和运行是不同状态；配置／依赖／代码改变使旧授权失效。
- 存储目录只由验证过的标识派生，写入使用同目录原子替换。mutation 互斥，失败 staging 不替换 active；不删除其他域或 ZCode 数据。
- 安装器接受 argv，不接受 shell；禁用 scripts 是默认值。单独授权的安装脚本必须关联精确 revision。
- 不把敏感环境变量写进元数据。源路径、版本或校验失败必须向调用层冒泡，不以空列表伪装成功。
- 原生运行时通过公开契约消费已验证的 Profile；本模块没有第二份 Agent/Session 状态。

## 生命周期接口

- `prepare({ source, scope, domainId?, baseBundles?, configPatches? })` 接受字符串或严格 typed source。Git 仅允许完整 commit；HTTPS archive 必须附带 SHA-256/384/512 SRI，下载后先验字节再提交脚本禁用的 pnpm 安装。原始声明和配置保存为 `revision.provenance`，npm 锁定安装后的精确 identity。
- `configure(domainId, patches, scope)` 从当前 prepared 或 active revision 离线 reflink 复制，失败平台退回独立文件复制，不共享可变 inode。原始 `cordis.patch.yml` 字节不变，额外配置只追加到 `.xbuild-host-overlay.json`；原生 runtime 在原 Profile patches 之后应用该层。新摘要一律重新 awaiting-trust，旧 active revision 不变。
- `update(domainId, scope, { signal? })` 重用保存的原始来源、baseBundles 与累计 patches，不重新从版本号伪造回滚。被选 revision 在 admission 前变化时拒绝 stale 更新。回滚使用 `readRevision` / `verify` / `activate` 已保存 revision，停止、真实加载和恢复由 controller 负责。
- `authorize` 必须有显式 `executionMode` 和 filesystem intent。旧缺失 mode 的 grant 不迁移成 unrestricted；本模块只保存 intent，controller 对 unsupported confinement 拒绝启动。`trusted-process` 不是 sandbox。
- `createDshCatalogStore` 的 load/add/refresh/remove 原子保存原始 JSON、来源 URL 与解析目录。移除目录只删来源记录。controller 负责以 workspace key + remoteSessionId 选择独立 root。
- `createDshPackageCommand` 只接受 controller 选定的绝对 pinned executable 与 argv prefix，隔离 HOME/tmp、清空 npm 用户配置，只保留显式白名单环境，不继承 PATH、token、NODE_OPTIONS 或包管理器认证。stdout/stderr 和执行时间有界，取消等到子进程退出。
- 所有持久 domain/revision/grant 使用公开 runtime schema；scope 的 identity 与 remoteSessionId 双向一致，所有代码摘要覆盖任意扩展名、嵌套依赖和 Host overlay。错误通过 `DshPackageError.code` 交付，不让 controller 解析文本。

```text
controller scoped admission → package store domain lock → immutable candidate
                                                        ├─ original package bytes + Host overlay
                                                        ├─ validated metadata + exact digest
                                                        └─ atomic preparedRevision projection
controller verified native load → activate stored revision
```

## 包审查回归边界

- 最终序列化 JSON 与读取使用相同 4MiB 上限；超限必须在原子替换前拒绝，刷新失败保留可读旧目录。revision 与 domain 完整 schema 同样在写入与发布指针前验证。
- 描述、作者等原始展示字段保留自由文本，不把换行误判为路径或标识符中的控制字符。超宽 JSON 数组先检查节点预算，再逐个入队，schema 返回 invalid 而非抛出 RangeError。
- peer 从每个实际安装包的目录按 Node resolution 查找，不能从无关嵌套副本拼全局版本表。明确提供的 `runtimeDependencyRoot` 才允许解析已声明的真实 bundled runtime fallback；仅有版本字符串不代表依赖可用。本地目录安装保留原始 optionalDependencies，由固定包管理器决定平台及 optional 行为。
- HTTPS 使用公开 `@zcode/adapters/http` 端口，public egress 在 DNS 预检与建连时重新校验地址；禁止重定向，继承超时、取消与响应字节上限。默认网络环境不继承凭据或代理。
