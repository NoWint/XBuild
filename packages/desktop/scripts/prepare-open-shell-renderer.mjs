import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const app = resolve(root, "vendor/open-claude-desktop/app");
const permittedFontExtensions = new Set([".css", ".png", ".svg", ".webp"]);
const permittedFonts = new Set([
  "c28cfec68-DYV7mfZR.woff2", "c59d6eb1d-lZojiKrH.woff2", "c73cc6b20-DV_iHO0x.woff2",
  "c7a30a803-MwLqaKOs.woff2", "c82997890-14J8GVxA.woff2", "c8e28c223-DuikJnEq.woff2",
  "c99400209-BuyVa9gS.woff2", "cad2ddc9f-CgTlxqEg.woff2", "ce4f31d76-ChjKfT4W.woff2",
  "ce598b86c-CctVJsaN.css", "ce6cfa480-T9ivnrk-.woff2", "cf31ed6d8-BBLU1dOL.woff2",
  "cf44730eb-BbzhsdCM.woff2", "cf5d8819d-D7oQwCA_.woff2",
]);

export async function prepareOpenShellAssets() {
  const assets = resolve(app, "public/assets/v1");
  await mkdir(assets, { recursive: true });
  const entries = await readdir(assets, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (permittedFontExtensions.has(extname(name)) || permittedFonts.has(name)) continue;
    throw new Error(`[open-shell] unreviewed visual resource: ${name}; verify its redistribution license before inclusion`);
  }
  for (const entry of entries) {
    if (!entry.isFile() || extname(entry.name) !== ".css") continue;
    const filename = resolve(entry.parentPath, entry.name);
    const source = await readFile(filename, "utf8");
    const filtered = source.replace(/@font-face\{font-family:(?:anthropic-(?:sans|serif|mono)|Anthropicons-Variable);[^}]*\}/g, "");
    if (filtered !== source) await writeFile(filename, filtered);
    if (/font-family:Anthropicons-Variable;src:url/.test(filtered)) {
      throw new Error(`[open-shell] proprietary icon font reference remains in ${entry.name}`);
    }
  }
  console.log("[open-shell] redistribution-safe shell assets ready");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await prepareOpenShellAssets();
