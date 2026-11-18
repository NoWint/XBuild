import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareOpenShellAssets } from "./prepare-open-shell-renderer.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "vendor/open-claude-desktop/app");
const destination = resolve(root, "out/open-shell/app");

await prepareOpenShellAssets();
await mkdir(destination, { recursive: true });
await Promise.all(
  ["electron", "dist", "public", "extensions", "native", "src", "third-party"].map((entry) =>
    cp(resolve(source, entry), resolve(destination, entry), {
      recursive: true,
      force: true,
      // 构建依赖允许缓存在源码目录外；复制实体，不把符号链接再次指回产物。
      dereference: true,
    }),
  ),
);
await Promise.all(
  ["package.json", "package-lock.json", "index.html", "vite.config.js"].map((entry) =>
    cp(resolve(source, entry), resolve(destination, entry), { force: true }),
  ),
);
await mkdir(resolve(destination, "node_modules"), { recursive: true });
await cp(resolve(root, "../../node_modules/node-pty"), resolve(destination, "node_modules/node-pty"), {
  recursive: true,
  force: true,
  dereference: true,
});
await rm(resolve(destination, "electron/core-registry.mjs.map"), { force: true });
console.log(`[open-shell] staged desktop application in ${destination}`);
