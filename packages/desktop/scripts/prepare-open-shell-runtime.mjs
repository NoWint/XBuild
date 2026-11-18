import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prepareOpenShellAssets } from "./prepare-open-shell-renderer.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = resolve(root, "vendor/open-claude-desktop/app");
await prepareOpenShellAssets();
console.log(`[open-shell] static shell assets ready in ${app}`);
