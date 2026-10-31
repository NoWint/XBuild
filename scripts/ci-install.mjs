#!/usr/bin/env node
// CI 依赖安装入口。
//
// 背景：node-linker=hoisted 下 pnpm 10.33.2 偶发在并发解包时撞上 rename 竞态
// （ERR_PNPM_ENOENT: rename '.../_tmp_xxx' -> '.../esbuild'），Linux 与 Windows runner
// 都会命中。这不是依赖本身有问题，第二次以串行解包（--child-concurrency=1）执行即可越过。
//
// 单独写成脚本而不是 workflow 里的 shell 片段：Windows runner 默认 shell 是 PowerShell，
// `||` / `{}` 的重试写法在不同 shell 下行为不一致。
import { spawn } from "node:child_process";
import process from "node:process";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function runPnpm(args) {
  return new Promise((resolve) => {
    const child = spawn(pnpmCommand, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", (error) => {
      console.error(`[ci-install] failed to spawn pnpm: ${error.message}`);
      resolve(1);
    });
  });
}

const baseArgs = ["install", "--frozen-lockfile", ...process.argv.slice(2)];

const firstAttempt = await runPnpm(baseArgs);
if (firstAttempt === 0) {
  process.exit(0);
}

console.log("::warning::pnpm install failed, retrying with serialized extraction");
const retryAttempt = await runPnpm([...baseArgs, "--child-concurrency=1"]);
if (retryAttempt !== 0) {
  console.error(`[ci-install] pnpm install failed twice (first=${firstAttempt}, retry=${retryAttempt})`);
}
process.exit(retryAttempt);
