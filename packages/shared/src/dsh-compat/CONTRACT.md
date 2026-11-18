# dsh-compat-protocol

DSH 原生依赖域的公共 JSON 载体；浏览器、Host 与 CLI 使用同一份严格信封，不导入 CLI 实现。

- 原始 SDK/Connection payload 只验证合法 JSON、深度及大小，不剥掉第三方扩展字段。
- scope、attachment token、revision、generation 由 controller 验证归属；类型校验不授予权限。
- nativeCode 与 nativeUi 独立授权；trusted-process 不是 OS sandbox，较窄权限必须由真实平台执行或明确拒绝。
- 回执不是结算。call-settled、流终态及原生 baseline 保留各自语义；transport sequence 不是 Session 日志序号。
- desktop-continuous 与 web-remote-replayable 使用同一 owner，gap 明确报告，不能将有界 ring 宣称完整历史。
- 既有 ZCode 插件、工具和 V4 会话协议保持独立。
