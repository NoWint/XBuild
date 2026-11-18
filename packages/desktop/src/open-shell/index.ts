import { app } from "electron";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// 新壳也必须复用旧桌面开发验收的 CDP 入口；E2E 仍由 Chromedriver 接管端口。
if (!app.isPackaged && process.env.ZCODE_DISABLE_FIXED_REMOTE_DEBUGGING_PORT !== "1") {
  app.commandLine.appendSwitch("remote-debugging-port", "9229");
}
const desktopRoot = resolve(app.getAppPath());
const appRoot = app.isPackaged
  ? join(desktopRoot, "out", "open-shell", "app")
  : join(desktopRoot, "vendor", "open-claude-desktop", "app");
const platformKey = `${process.platform}-${process.arch}`;
const agentCandidates = [
  process.resourcesPath ? join(process.resourcesPath, "glm", "zcode.cjs") : "",
  join(desktopRoot, "bundled-agents", platformKey, "glm", "zcode.cjs"),
].filter(Boolean);
const agent = agentCandidates.find((candidate) => existsSync(candidate));
if (!agent) throw new Error(`XBuild Agent is missing. Checked: ${agentCandidates.join(", ")}`);

if (process.env.ZCODE_E2E_HOME_DIR) {
  app.setPath("home", process.env.ZCODE_E2E_HOME_DIR);
  app.setPath("sessionData", process.env.ZCODE_E2E_HOME_DIR);
  process.env.CODE_DESKTOP_DATA = join(process.env.ZCODE_E2E_HOME_DIR, "open-shell");
  process.env.CODE_DESKTOP_DETECTED_PROJECTS_HOME = process.env.ZCODE_E2E_HOME_DIR;
}
process.env.CODE_DESKTOP_CORE = "zcode";
process.env.CODE_DESKTOP_AGENT_BINARY = agent;
process.env.CODE_DESKTOP_AGENT_RUNNER = "node";
process.env.CODE_DESKTOP_NODE_BINARY = process.execPath;
process.env.CODE_DESKTOP_AGENT_VERSION = app.getVersion();
process.env.CODE_DESKTOP_DATA_DIR = app.getPath("userData");
process.env.CODE_DESKTOP_BRIDGE_STATE = join(app.getPath("userData"), "open-shell", "bridge");
if (process.env.ELECTRON_RENDERER_URL) {
  process.env.CODE_DESKTOP_DEV_URL = process.env.ELECTRON_RENDERER_URL;
}

require(join(appRoot, "electron", "main.cjs"));
