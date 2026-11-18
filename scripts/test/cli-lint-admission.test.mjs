import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { readFile, writeFile, rm, mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { classifyLintDiagnostics, parseLintCommand } from "../cli-lint-admission.mjs";

test("只接纳原样上游的行数诊断，其他错误与修改过的文件仍阻断", () => {
  const diagnostics = [
    { filename: "src/original.ts", code: "eslint(max-lines)", severity: "error" },
    { filename: "src/edited.ts", code: "eslint(max-lines)", severity: "error" },
    { filename: "src/original.ts", code: "typescript(no-explicit-any)", severity: "error" },
    { filename: "src/original.ts", code: "eslint(no-unused-vars)", severity: "warning" },
  ];
  const result = classifyLintDiagnostics(diagnostics, {
    relativeDirectory: "apps/zcode-cli/packages/example",
    pristine: new Set(["apps/zcode-cli/packages/example/src/original.ts"]),
  });
  assert.deepEqual(result.accepted, [diagnostics[0]]);
  assert.deepEqual(result.errors, diagnostics.slice(1, 3));
  assert.deepEqual(result.warnings, [diagnostics[3]]);
});

test("runtime 清单的实际 lint 参数扫描源文件并阻断 801 行新源码", async () => {
  const root = await mkdtemp(join(tmpdir(), "zcode-runtime-lint-"));
  const cwd = join(root, "apps/zcode-cli/packages/dsh-runtime");
  const manifest = JSON.parse(await readFile(new URL("../../apps/zcode-cli/packages/dsh-runtime/package.json", import.meta.url), "utf8"));
  const fixture = join(cwd, "src/lint-admission-probe.ts");
  const args = [...parseLintCommand(manifest.scripts.lint), "--format", "json"];
  const exec = promisify(execFile);
  await mkdir(join(cwd, "src"), { recursive: true });
  await mkdir(join(cwd, "tests"));
  await writeFile(join(root, ".oxlintrc.json"), await readFile(new URL("../../.oxlintrc.json", import.meta.url)));
  await writeFile(fixture, `${Array.from({ length: 801 }, (_, index) => `export const line${index} = ${index};`).join("\n")}\n`);
  try {
    let result;
    try { result = await exec(fileURLToPath(new URL("../../node_modules/.bin/oxlint", import.meta.url)), args, { cwd }); }
    catch (error) { result = error; }
    assert.ok(!result.stdout.startsWith("No files found"), "runtime lint 必须扫描真实源码，不能被根 ignorePatterns 跳过");
    const report = JSON.parse(result.stdout);
    assert.ok(report.number_of_files > 0, "必须扫描真实源码，不能把零文件当作通过");
    assert.equal(result.code, 1);
    assert.ok(report.diagnostics.some(item => item.filename.endsWith("lint-admission-probe.ts") && item.code === "eslint(max-lines)" && item.severity === "error"));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("bootstrap cwd 的已批准 server 行数仅告警，其他文件和非行数错误仍阻断", async () => {
  const root = await mkdtemp(join(tmpdir(), "zcode-bootstrap-lint-"));
  const cwd = join(root, "apps/zcode-cli/packages/bootstrap");
  const manifest = JSON.parse(await readFile(new URL("../../apps/zcode-cli/packages/bootstrap/package.json", import.meta.url), "utf8"));
  const args = [...parseLintCommand(manifest.scripts.lint), "--config", "../../../../.oxlintrc.json", "--no-ignore", "--deny", "no-debugger", "--format", "json"];
  const exec = promisify(execFile);
  await mkdir(join(cwd, "src/zcode-protocol"), { recursive: true });
  await writeFile(join(root, ".oxlintrc.json"), await readFile(new URL("../../.oxlintrc.json", import.meta.url)));
  const declarations = `${Array.from({ length: 801 }, (_, index) => `export const line${index} = ${index};`).join("\n")}\n`;
  await writeFile(join(cwd, "src/zcode-protocol/server.ts"), `${declarations}debugger;\n`);
  await writeFile(join(cwd, "src/other.ts"), declarations);
  try {
    let result;
    try { result = await exec(fileURLToPath(new URL("../../node_modules/.bin/oxlint", import.meta.url)), args, { cwd }); }
    catch (error) { result = error; }
    const report = JSON.parse(result.stdout);
    assert.ok(report.number_of_files >= 2);
    assert.equal(result.code, 1);
    assert.ok(report.diagnostics.some(item => item.filename === "src/zcode-protocol/server.ts" && item.code === "eslint(max-lines)" && item.severity === "warning"), "已批准的存量 server 行数规则必须按真实 CLI cwd 生效");
    assert.ok(report.diagnostics.some(item => item.filename === "src/other.ts" && item.code === "eslint(max-lines)" && item.severity === "error"), "不能放宽其他文件行数");
    assert.ok(report.diagnostics.some(item => item.filename === "src/zcode-protocol/server.ts" && item.code === "eslint(no-debugger)" && item.severity === "error"), "同一 server 的非行数错误仍须阻断");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("保留包原有参数；不默默绕过未知或复合命令", () => {
  assert.deepEqual(parseLintCommand("oxlint src tests --no-ignore"), [
    "src",
    "tests",
    "--no-ignore",
  ]);
  for (const command of [
    "tsc --noEmit",
    "oxlint src && echo done",
    "oxlint 'src path'",
    "oxlint --format text src",
  ])
    assert.throws(() => parseLintCommand(command), /不支持/);
});
