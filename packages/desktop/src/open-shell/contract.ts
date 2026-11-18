/** XBuild 桌面壳的唯一启动配置；具体 Agent 路径在运行时由包布局解析。 */
export interface DesktopOpenShellContract {
  readonly productName: "XBuild";
  readonly coreId: "zcode";
  readonly shellVersion: "2.42304.0";
}
