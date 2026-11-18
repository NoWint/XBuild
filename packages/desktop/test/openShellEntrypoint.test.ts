import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "../src/open-shell/index.ts");
const content = await readFile(source, "utf8");
if (!content.includes('require(join(appRoot, "electron", "main.cjs"))')) {
  throw new Error("Open shell must retain its complete Electron application entrypoint");
}
if (content.includes("lusion")) throw new Error("Unapproved motion source is not part of this shell");
console.log("open-shell entrypoint contract: ok");
