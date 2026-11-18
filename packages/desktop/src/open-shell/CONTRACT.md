# desktop-open-shell

XBuild 桌面主窗口使用 `vendor/open-claude-desktop` 的 new-2.42304.0 完整应用。
本目录只负责注入随包 XBuild Agent 路径、产品身份和完整 Electron 入口，不重写上游组件。

不变量：
- 内核只选择 `zcode`，Agent 必须来自当前 XBuild 包，不能回退到 DeepSeek。
- 主入口只有 `require(electron/main.cjs)`，不能再同时挂载旧 Root。
- 壳的结构、交互和样式保持选定版本；不混入 Lusion 或另一套视觉系统。
- 第三方快照不是本适配器的内部依赖图；上游许可与来源必须随代码保留。
