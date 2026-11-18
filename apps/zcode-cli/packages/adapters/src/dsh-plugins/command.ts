import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { delimiter, dirname, isAbsolute, join } from "node:path";
import type { DshPackageCommand } from "./contract.js";
import { DshPackageError } from "./errors.js";

export interface DshPackageCommandOptions {
  executable: string;
  prefixArgs: readonly string[];
  environment?: Readonly<Record<string, string>>;
  maxOutputBytes?: number;
  timeoutMs?: number;
}
const ENVIRONMENT_KEYS = new Set([
  "PATH",
  "SystemRoot",
  "WINDIR",
  "LANG",
  "LC_ALL",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
]);

export function createDshPackageCommand(options: DshPackageCommandOptions): DshPackageCommand {
  if (
    !isAbsolute(options.executable) ||
    !Array.isArray(options.prefixArgs) ||
    options.prefixArgs.some((item) => typeof item !== "string" || item.includes("\0"))
  ) {
    throw new DshPackageError(
      "DSH_COMMAND_INVALID",
      "Package manager requires an explicit pinned executable and argv prefix",
    );
  }
  const environment: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(options.environment ?? {})) {
    if (
      !ENVIRONMENT_KEYS.has(key) ||
      value.includes("\0") ||
      (key === "PATH" && value.split(delimiter).some((path) => !isAbsolute(path))) ||
      (["SystemRoot", "WINDIR", "SSL_CERT_FILE", "SSL_CERT_DIR"].includes(key) &&
        !isAbsolute(value))
    ) {
      throw new DshPackageError("DSH_COMMAND_INVALID", "Invalid package manager environment");
    }
    environment[key] = value;
  }
  const maxOutputBytes = options.maxOutputBytes ?? 1024 * 1024;
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
  if (
    !Number.isSafeInteger(maxOutputBytes) ||
    maxOutputBytes < 1 ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1
  ) {
    throw new DshPackageError("DSH_COMMAND_INVALID", "Invalid package manager limits");
  }
  return {
    async run(args, input) {
      if (
        !isAbsolute(input.cwd) ||
        args.some((arg) => typeof arg !== "string" || arg.includes("\0"))
      ) {
        throw new DshPackageError(
          "DSH_COMMAND_INVALID",
          "Package manager requires an absolute cwd and string argv",
        );
      }
      if (input.signal?.aborted)
        throw new DshPackageError("DSH_COMMAND_CANCELLED", "Package manager invocation cancelled");
      const home = join(dirname(input.cwd), ".package-manager-home");
      await mkdir(home, { recursive: true });
      const config = join(home, "empty.npmrc");
      await writeFile(config, "", { mode: 0o600 });
      // 父进程可能含模型密钥、NODE_OPTIONS 与 npm token；只显式构造环境，不继承进程凭据。
      const env = {
        ...environment,
        HOME: home,
        USERPROFILE: home,
        TMPDIR: home,
        TMP: home,
        TEMP: home,
        npm_config_userconfig: config,
        npm_config_globalconfig: config,
        npm_config_ignore_scripts: "true",
        npm_config_manage_package_manager_versions: "false",
        CI: "true",
      };
      return await new Promise((resolve, reject) => {
        const child = spawn(options.executable, [...options.prefixArgs, ...args], {
          cwd: input.cwd,
          env,
          shell: false,
          detached: process.platform !== "win32",
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        });
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        let bytes = 0;
        let failure: DshPackageError | undefined;
        let termination: Promise<void> | undefined;
        const stop = (code: "DSH_COMMAND_CANCELLED" | "DSH_COMMAND_LIMIT", message: string) => {
          if (failure) return;
          failure = new DshPackageError(code, message);
          // 包管理器可派生 Git/解压进程；POSIX 取消整个受控进程组，不能只停最外层留下后台子进程。
          if (process.platform !== "win32" && child.pid) {
            try {
              process.kill(-child.pid, "SIGKILL");
            } catch {
              child.kill("SIGKILL");
            }
          } else if (child.pid) {
            const taskkill = join(
              environment.SystemRoot ?? environment.WINDIR ?? "C:\\Windows",
              "System32",
              "taskkill.exe",
            );
            termination = new Promise((resolve) => {
              const killer = spawn(taskkill, ["/PID", String(child.pid), "/T", "/F"], {
                env,
                windowsHide: true,
                shell: false,
                stdio: "ignore",
              });
              const limit = setTimeout(() => {
                killer.kill();
                child.kill("SIGKILL");
              }, 10000);
              limit.unref();
              killer.on("error", () => {
                child.kill("SIGKILL");
                clearTimeout(limit);
                resolve();
              });
              killer.on("close", (code) => {
                if (code) child.kill("SIGKILL");
                clearTimeout(limit);
                resolve();
              });
            });
          } else child.kill("SIGKILL");
        };
        const abort = () => stop("DSH_COMMAND_CANCELLED", "Package manager invocation cancelled");
        input.signal?.addEventListener("abort", abort, { once: true });
        if (input.signal?.aborted) abort();
        const timer = setTimeout(
          () => stop("DSH_COMMAND_LIMIT", "Package manager exceeded its time limit"),
          timeoutMs,
        );
        timer.unref();
        const collect = (chunks: Buffer[], chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > maxOutputBytes)
            stop("DSH_COMMAND_LIMIT", "Package manager exceeded its output limit");
          else chunks.push(chunk);
        };
        child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk));
        child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));
        child.on("error", (error) => {
          failure ??= new DshPackageError(
            "DSH_COMMAND_INVALID",
            "Unable to start pinned package manager",
            { cause: error },
          );
        });
        child.on("close", async (code) => {
          clearTimeout(timer);
          input.signal?.removeEventListener("abort", abort);
          await termination;
          if (failure) reject(failure);
          else
            resolve({
              exitCode: code ?? 1,
              stdout: Buffer.concat(stdout).toString("utf8"),
              stderr: Buffer.concat(stderr).toString("utf8"),
            });
        });
      });
    },
  };
}
