# Third-party shell snapshot

完整保留用户选定的 OpenClaude Desktop `new-2.42304.0` 壳与 MIT 许可，来源见 `NOTICE.md`。

- 内部组件不属于 XBuild 的新模块依赖图；本目录没有可执行 `module.ts`。
- XBuild 适配只负责启动入口、随包 Agent 路径、产品品牌和资源。
- 壳结构、交互和视觉保持选定版本，不加入 Lusion 或其他动效。
- 内核固定 `zcode`，不能回退到 DeepSeek Harness。
- 本地构建依赖可由包管理器重新安装，不属于源码或产品运行资源。
