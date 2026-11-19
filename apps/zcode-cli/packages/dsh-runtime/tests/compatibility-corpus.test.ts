import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import corpus from "./fixtures/compatibility-corpus.json";

type CorpusCase = (typeof corpus.cases)[number];
const requireFromRuntime = createRequire(import.meta.url);

function packageManifest(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(requireFromRuntime.resolve(`${name}/package.json`), "utf8")) as Record<string, unknown>;
}

function resolveClientEntry(name: string): string {
  const manifestPath = requireFromRuntime.resolve(`${name}/package.json`);
  const manifest = packageManifest(name);
  const exportsField = manifest.exports as Record<string, unknown>;
  const client = exportsField["./client"] as Record<string, string> | string;
  const relativeTarget = typeof client === "string" ? client : client.default;
  return join(dirname(manifestPath), relativeTarget.replace(/^\.\//, ""));
}

describe("pinned DSH compatibility corpus", () => {
  it("uses the pinned DSH/Cordis line for every real corpus package", () => {
    for (const item of corpus.cases as CorpusCase[]) {
      const manifest = packageManifest(item.package);
      expect(manifest.version, item.package).toBe(corpus.runtime.dsh);
      const peer = manifest.peerDependencies as Record<string, string> | undefined;
      if (peer?.["@deepseek-ai/cordis"]) {
        expect(peer["@deepseek-ai/cordis"], item.package).toMatch(/^~4\.1\.0$/);
      }
    }
  });

  it("has a real Node entry for runtime cases and a browser entry for UI cases", () => {
    for (const item of corpus.cases as CorpusCase[]) {
      const manifest = packageManifest(item.package);
      if (item.clientEntry) {
        const exportsField = manifest.exports as Record<string, unknown> | undefined;
        expect(exportsField, item.package).toBeDefined();
        expect(exportsField?.["./client"], item.package).toBeDefined();
        expect(existsSync(resolveClientEntry(item.package)), item.package).toBe(true);
      } else {
        const entry = requireFromRuntime.resolve(item.package);
        expect(existsSync(entry), item.package).toBe(true);
      }
    }
  });

  it("does not silently treat the local incompatible corpus as supported", () => {
    const incompatible = [
      { package: "dsh-prompt-inject", requiredCordis: "~4.0.5", actualCordis: "4.1.0" },
      { package: "dsh-client-ui-aqua-unofficial", requiredDsh: "0.1.0-rc.8", actualDsh: corpus.runtime.dsh },
    ];
    for (const item of incompatible) {
      if ("requiredCordis" in item) {
        expect(item.requiredCordis).not.toBe(item.actualCordis);
      } else {
        expect(item.requiredDsh).not.toBe(item.actualDsh);
      }
    }
  });
});
