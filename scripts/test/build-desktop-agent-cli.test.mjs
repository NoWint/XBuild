import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

const exec = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, "../..");
const workspacePackages = [
  "shared-types",
  "contracts",
  "dynamic-workflow",
  "dynamic-workflow-runtime",
  "core",
  "adapters",
  "i18n",
  "telemetry",
  "dsh-runtime",
  "bootstrap",
];
const pluginArtifacts = {
  "android-emulator-plugin": "dist/mcp/server.js",
  "ios-simulator-plugin": "dist/mcp/server.js",
  "node-repl-host": "dist/mcp/server.js",
  "browser-use-plugin": "scripts/browser-client.mjs",
  "documents-plugin": "dist/server.mjs",
  "pdf-plugin": "dist/server.mjs",
  "presentations-plugin": "dist/server.mjs",
  "spreadsheets-plugin": "dist/server.mjs",
  "zcode-site-plugin": "dist/server.mjs",
};

const pnpmFixtureSource = `
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = process.env.HARNESS_ROOT;
const packageRoot = join(root, "apps/zcode-cli/packages");
const args = process.argv.slice(2);
const pluginArtifacts = JSON.parse(process.env.HARNESS_PLUGIN_ARTIFACTS);
async function build(packageName) {
  const directory = packageName.replace("@zcode/", "");
  const cwd = join(packageRoot, directory);
  if (directory === "cli") {
    const result = spawnSync(process.execPath, ["scripts/build.mjs", "--desktop-agent"], {
      cwd, stdio: "inherit", env: process.env,
    });
    process.exitCode = result.status ?? 1;
    return;
  }
  if (pluginArtifacts[directory]) {
    if (process.env.HARNESS_OMIT_RUNTIME !== directory) {
      const output = join(cwd, pluginArtifacts[directory]);
      await mkdir(resolve(output, ".."), { recursive: true });
      await writeFile(output, "export const fixtureRuntime = true;\\n");
    }
    return;
  }
  if (directory === "dynamic-workflow") {
    const prepared = spawnSync(process.execPath, ["scripts/generate-libs.mjs"], {
      cwd, stdio: "inherit", env: process.env,
    });
    if (prepared.status !== 0) process.exit(prepared.status ?? 1);
  }
  const compiled = spawnSync(process.execPath, ["../../node_modules/typescript/bin/tsc"], {
    cwd, stdio: "inherit", env: process.env,
  });
  if (compiled.status !== 0) process.exit(compiled.status ?? 1);
}
if (args[0] === "--filter") {
  await build(args[1]);
} else if (args[0] === "exec" && args[1] === "turbo") {
  if (args.join(" ") !== "exec turbo --skip-infer --cwd apps/zcode-cli run build:desktop-agent --filter=@zcode/cli") {
    throw new Error("Unexpected Turbo delegation");
  }
  const bootstrap = JSON.parse(await readFile(join(packageRoot, "bootstrap/package.json")));
  for (const dependency of ["@zcode/dsh-runtime", "@zcode/bootstrap"]) {
    if (dependency !== "@zcode/bootstrap" && !bootstrap.dependencies[dependency]) {
      throw new Error("Fixture dependency graph must include DSH");
    }
    await build(dependency);
  }
  await build("@zcode/cli");
} else {
  throw new Error("Unexpected build command: " + args.join(" "));
}
`;

async function createWorkspace(t) {
  const root = await mkdtemp(join(tmpdir(), "zcode-agent build-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  async function write(relative, contents) {
    const path = join(root, relative);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents);
  }
  for (const relative of [
    "scripts/build-desktop-agent-cli.mjs",
    "scripts/spawn-command.mjs",
    "scripts/builtin-provider-config.mjs",
    "scripts/stage-dev-cua-plugin-runtime.mjs",
    "packages/desktop/scripts/stage-agent-bundle.mjs",
    "packages/desktop/scripts/computer-use-producer.mjs",
    "packages/desktop/scripts/sharp-package-assets.mjs",
  ]) {
    await mkdir(dirname(join(root, relative)), { recursive: true });
    await copyFile(join(repoRoot, relative), join(root, relative));
  }
  await write("package.json", JSON.stringify({ private: true, type: "module" }));
  for (const relative of ["node_modules/tsx", "apps/zcode-cli/node_modules/typescript"]) {
    const target = join(repoRoot, "node_modules", relative.endsWith("tsx") ? "tsx" : "typescript");
    await mkdir(dirname(join(root, relative)), { recursive: true });
    await symlink(target, join(root, relative), process.platform === "win32" ? "junction" : "dir");
  }
  for (const directory of workspacePackages) {
    const relative = `apps/zcode-cli/packages/${directory}`;
    const manifest = ["dsh-runtime", "bootstrap"].includes(directory)
      ? JSON.parse(await readFile(join(repoRoot, relative, "package.json"), "utf8"))
      : { name: `@zcode/${directory}`, type: "module", scripts: { build: "tsc" } };
    await write(`${relative}/package.json`, JSON.stringify(manifest));
    await write(
      `${relative}/tsconfig.json`,
      JSON.stringify({
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          target: "ES2022",
          rootDir: "src",
          outDir: "dist",
          declaration: true,
          strict: true,
          types: [],
          noEmitOnError: true,
        },
        include: ["src/**/*.ts"],
      }),
    );
    await write(`${relative}/src/index.ts`, "export const fixture = true;\n");
  }
  await write(
    "apps/zcode-cli/packages/dsh-runtime/src/index.ts",
    "export interface DshDomain { id: string }\nexport const domainRuntimeReady = true;\n",
  );
  // 缺失 DSH 构建时，真实 tsc 必须在 Bootstrap 的公开类型依赖处失败，不能靠预存 dist 通过。
  await write(
    "apps/zcode-cli/packages/bootstrap/src/index.ts",
    'import type { DshDomain } from "@zcode/dsh-runtime";\nexport const domain: DshDomain = { id: "fixture" };\n',
  );
  await mkdir(join(root, "apps/zcode-cli/node_modules/@zcode"), { recursive: true });
  await symlink(
    join(root, "apps/zcode-cli/packages/dsh-runtime"),
    join(root, "apps/zcode-cli/node_modules/@zcode/dsh-runtime"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await write(
    "apps/zcode-cli/packages/dynamic-workflow/scripts/generate-libs.mjs",
    'import { writeFile } from "node:fs/promises";\nawait writeFile("src/libs.generated.ts", "export const generated = true;\\n");\n',
  );
  await write(
    "apps/zcode-cli/packages/dynamic-workflow/src/index.ts",
    'export { generated } from "./libs.generated.js";\n',
  );
  for (const directory of Object.keys(pluginArtifacts)) {
    await write(
      `apps/zcode-cli/packages/${directory}/package.json`,
      JSON.stringify({ name: `@zcode/${directory}`, type: "module" }),
    );
  }
  await write(
    "apps/zcode-cli/packages/cli/package.json",
    JSON.stringify({ name: "@zcode/cli", type: "module" }),
  );
  await write(
    "apps/zcode-cli/packages/cli/scripts/build.mjs",
    `import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { domainRuntimeReady } from "@zcode/dsh-runtime";
assert.equal(domainRuntimeReady, true);
assert.equal(process.env.ZCODE_ENV, "test");
assert.equal(process.env.PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN, "false");
assert.ok(process.env.NODE_OPTIONS.includes("--max-old-space-size=8192"));
await readFile("../bootstrap/dist/index.d.ts");
await mkdir("dist", { recursive: true });
await writeFile("dist/zcode.cjs", 'module.exports = { freshBuild: true };\\n');
`,
  );
  await write("apps/zcode-cli/packages/cli/dist/zcode.cjs", "stale bundle\n");
  await write("bin/pnpm-fixture.mjs", pnpmFixtureSource);
  if (process.platform === "win32") {
    await write("bin/pnpm.cmd", `@"${process.execPath}" "%~dp0pnpm-fixture.mjs" %*\r\n`);
  } else {
    await write("bin/pnpm", `#!/usr/bin/env node\nimport "./pnpm-fixture.mjs";\n`);
    await chmod(join(root, "bin/pnpm"), 0o755);
  }
  return {
    root,
    stagedBundle: join(
      root,
      "packages/desktop/bundled-agents",
      `${process.platform}-${process.arch}`,
      "glm/zcode.cjs",
    ),
    run: (env = {}) =>
      exec(process.execPath, ["scripts/build-desktop-agent-cli.mjs"], {
        cwd: root,
        timeout: 60_000,
        env: {
          ...process.env,
          PATH: [join(root, "bin"), dirname(process.execPath), process.env.PATH].join(
            process.platform === "win32" ? ";" : ":",
          ),
          ZCODE_ENV: "test",
          ZCODE_BOOTSTRAP_WITH_REMOTE: "",
          ZCODE_DESKTOP_AGENT_BUILD_MODE: "",
          HARNESS_ROOT: root,
          HARNESS_PLUGIN_ARTIFACTS: JSON.stringify(pluginArtifacts),
          ...env,
        },
      }),
  };
}

for (const [mode, env] of [
  ["normal", {}],
  ["bare-tsc", { ZCODE_BOOTSTRAP_WITH_REMOTE: "1" }],
  ["turbo", { ZCODE_DESKTOP_AGENT_BUILD_MODE: "turbo" }],
]) {
  test(`${mode} clean workspace builds Bootstrap's DSH entry before staging a fresh Agent`, async (t) => {
    const fixture = await createWorkspace(t);
    try {
      await fixture.run(env);
    } catch (error) {
      assert.fail(`Build must succeed from missing DSH dist:\n${error.stdout}\n${error.stderr}`);
    }
    assert.equal(
      await readFile(fixture.stagedBundle, "utf8"),
      "module.exports = { freshBuild: true };\n",
    );
    const declaration = await readFile(
      join(fixture.root, "apps/zcode-cli/packages/bootstrap/dist/index.d.ts"),
      "utf8",
    );
    assert.match(declaration, /import type \{ DshDomain \} from "@zcode\/dsh-runtime"/u);
  });
}

test("normal build rejects a missing required MCP artifact before staging", async (t) => {
  const fixture = await createWorkspace(t);
  await assert.rejects(
    fixture.run({ HARNESS_OMIT_RUNTIME: "android-emulator-plugin" }),
    (error) => {
      assert.match(error.stderr, /build succeeded without required MCP runtime/u);
      return true;
    },
  );
  await assert.rejects(readFile(fixture.stagedBundle), { code: "ENOENT" });
});
