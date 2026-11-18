import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import tsupConfig, {
  resolveBuildPackagedAgentTelemetryEnv,
  resolveBuildRemoteCdnReleaseRoots,
  resolveDesktopTsupBundleSecurityOptions,
} from "../tsup.config";

const execFileAsync = promisify(execFile);
const desktopDir = fileURLToPath(new URL("..", import.meta.url));
const sandboxPreloadProbe = `
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { build } from "tsup";
import configs from "./tsup.config.ts";

const preload = configs.find((config) => config.name === "preload");
const outDir = process.argv[1];
await build({
  ...preload,
  config: false,
  outDir,
  onSuccess: undefined,
  watch: false,
  silent: true,
});

const exposed = {};
const handlers = new Map();
const forwarded = [];
const closed = [];
const validPort = { close() { closed.push("valid"); } };
const electron = {
  contextBridge: {
    exposeInMainWorld(name, value) { exposed[name] = value; },
    executeInMainWorld() { return false; },
  },
  ipcRenderer: {
    send() {},
    invoke: async () => undefined,
    on(channel, handler) { handlers.set(channel, handler); },
    removeListener() {},
  },
  webFrame: { getZoomFactor() { return 1; } },
  webUtils: { getPathForFile() { return ""; } },
};
const nodeRequire = createRequire(import.meta.url);
// Electron sandbox 只提供这些内置入口，不允许从 node_modules 加载 Zod。
function preloadRequire(id) {
  if (id === "electron") return electron;
  if (["events", "timers", "url", "node:events", "node:timers", "node:url"].includes(id)) {
    return nodeRequire(id);
  }
  throw new Error("module not found: " + id);
}
const window = {
  addEventListener() {},
  postMessage(message, target, ports) {
    forwarded.push({ message, target, transferredOriginalPort: ports[0] === validPort });
  },
};
let startupError = null;
try {
  runInNewContext(await readFile(join(outDir, "preload/index.cjs"), "utf8"), {
    require: preloadRequire,
    exports: {},
    module: { exports: {} },
    process: { argv: [], env: {}, platform: "darwin" },
    window,
    document: { title: "Sandbox regression" },
    URL,
    URLSearchParams,
    ArmsEventBridge: { send() {} },
  });
} catch (error) {
  startupError = String(error);
}
if (startupError === null) {
  const servicePort = handlers.get("zcode:service-port");
  servicePort({ ports: [validPort] }, { databaseStartupId: "startup-1" });
  for (const [name, payload] of [
    ["empty", { databaseStartupId: "" }],
    ["number", { databaseStartupId: 1 }],
    ["extra", { databaseStartupId: "startup-1", unexpected: true }],
  ]) {
    servicePort({ ports: [{ close() { closed.push(name); } }] }, payload);
  }
}
console.log(JSON.stringify({
  startupError,
  hasPrintPageToPdf: typeof exposed.zcode?.printPageToPdf === "function",
  forwarded,
  closed,
  artifacts: await readdir(join(outDir, "preload")),
}));
`;

type EsbuildLikeOptions = {
  chunkNames?: string;
  legalComments?: string;
};

function getChunkNames(configName: string): string | undefined {
  const configs = Array.isArray(tsupConfig) ? tsupConfig : [tsupConfig];
  const target = configs.find((config) => config.name === configName);
  expect(target).toBeDefined();

  const esbuildOptions: EsbuildLikeOptions = {};
  target?.esbuildOptions?.(esbuildOptions);
  return esbuildOptions.chunkNames;
}

function getExternal(configName: string): string[] {
  const configs = Array.isArray(tsupConfig) ? tsupConfig : [tsupConfig];
  const target = configs.find((config) => config.name === configName);
  expect(target).toBeDefined();
  expect(Array.isArray(target?.external)).toBe(true);
  return target?.external as string[];
}

function getNoExternal(configName: string): string[] {
  const configs = Array.isArray(tsupConfig) ? tsupConfig : [tsupConfig];
  const target = configs.find((config) => config.name === configName);
  expect(target).toBeDefined();
  expect(Array.isArray(target?.noExternal)).toBe(true);
  return target?.noExternal as string[];
}

function getDefines(configName: string): Record<string, string> {
  const configs = Array.isArray(tsupConfig) ? tsupConfig : [tsupConfig];
  const target = configs.find((config) => config.name === configName);
  expect(target).toBeDefined();
  return target?.define ?? {};
}

describe("desktop tsup chunk isolation", () => {
  it.each(["development", "production"])(
    "%s preload 在 sandbox require 边界内建立 bridge，并保留真实 schema 校验",
    async (mode) => {
      const outDir = await mkdtemp(join(tmpdir(), "zcode-sandbox-preload-"));
      try {
        const { stdout } = await execFileAsync(
          process.execPath,
          ["--import", "tsx", "--input-type=module", "-e", sandboxPreloadProbe, outDir],
          {
            cwd: desktopDir,
            env: { ...process.env, NODE_ENV: mode, ZCODE_E2E_COVERAGE: "0" },
            timeout: 30_000,
            maxBuffer: 1_048_576,
          },
        );
        const result = JSON.parse(stdout.trim().split("\n").at(-1) ?? "");
        expect(result.startupError).toBeNull();
        expect(result.hasPrintPageToPdf).toBe(true);
        expect(result.forwarded).toEqual([
          {
            message: { type: "zcode:service-port", databaseStartupId: "startup-1" },
            target: "*",
            transferredOriginalPort: true,
          },
        ]);
        expect(result.closed).toEqual(["empty", "number", "extra"]);
        if (mode === "production") {
          expect(result.artifacts.some((name: string) => name.endsWith(".map"))).toBe(false);
        }
      } finally {
        await rm(outDir, { recursive: true, force: true });
      }
    },
  );

  it("ZIP 解包器应外置，避免 Electron ESM 启动时动态 require fs 崩溃", () => {
    for (const name of ["main", "host", "scheduler"]) expect(getExternal(name)).toContain("yauzl");
  });
  it("main 构建应将 chunk 输出到 main 子目录，避免覆盖 host 构建产物", () => {
    expect(getChunkNames("main")).toBe("main/chunk-[hash]");
  });

  it("host 构建应将 chunk 输出到 host 子目录，避免覆盖 main 构建产物", () => {
    expect(getChunkNames("host")).toBe("host/chunk-[hash]");
  });

  it("main/host 构建应外置飞书 SDK，避免 Electron ESM 动态 require 崩溃", () => {
    expect(getExternal("main")).toContain("@larksuiteoapi/node-sdk");
    expect(getExternal("host")).toContain("@larksuiteoapi/node-sdk");
  });

  it("main/host 构建应外置 yaml，避免 Electron ESM 动态 require 崩溃", () => {
    expect(getExternal("main")).toContain("yaml");
    expect(getExternal("host")).toContain("yaml");
  });

  it("main/host/scheduler 应内联 CUA producer，安装包不能依赖被排除的 @zcode node_modules", () => {
    for (const configName of ["main", "host", "scheduler"]) {
      expect(getNoExternal(configName)).toContain("@zcode/zcode-cua");
    }
  });

  it("main/host/scheduler 应内联 Provider workspace 包，Electron 不能直接加载 TypeScript 源码", () => {
    for (const configName of ["main", "host", "scheduler"]) {
      expect(getNoExternal(configName)).toContain("@zcode/provider");
      expect(getNoExternal(configName)).toContain("@zcode/provider-node");
    }
  });

  it("生产构建应压缩 main/host/preload 且不生成 sourcemap", () => {
    expect(resolveDesktopTsupBundleSecurityOptions({ NODE_ENV: "production" })).toEqual({
      keepNames: true,
      minify: true,
      sourcemap: false,
    });
  });

  it("开发构建应保留 sourcemap 方便本地调试", () => {
    expect(resolveDesktopTsupBundleSecurityOptions({ NODE_ENV: "development" })).toEqual({
      keepNames: false,
      minify: false,
      sourcemap: true,
    });
  });

  it("E2E coverage 构建应关闭压缩并保留 sourcemap", () => {
    expect(
      resolveDesktopTsupBundleSecurityOptions({
        NODE_ENV: "production",
        ZCODE_E2E_COVERAGE: "1",
      }),
    ).toEqual({
      keepNames: false,
      minify: false,
      sourcemap: true,
    });
  });

  it("remote runtime CDN 根应可由 CI 的 CDN_DOMAIN/OSS_PATH_PREFIX 多值注入", () => {
    expect(
      resolveBuildRemoteCdnReleaseRoots({
        CDN_DOMAIN: "cdn-zcode.z.ai,cdn.zcode-ai.com",
        OSS_PATH_PREFIX: "zcode/electron/releases",
      }),
    ).toEqual([
      "https://cdn-zcode.z.ai/zcode/electron/releases",
      "https://cdn.zcode-ai.com/zcode/electron/releases",
    ]);
  });

  it("remote runtime CDN 根的路径前缀数量不匹配时应失败", () => {
    expect(() =>
      resolveBuildRemoteCdnReleaseRoots({
        CDN_DOMAIN: "cdn-zcode.z.ai,cdn.zcode-ai.com",
        OSS_PATH_PREFIX: "new-prefix,old-prefix,extra-prefix",
      }),
    ).toThrow("OSS_PATH_PREFIX must contain one value or match CDN_DOMAIN count");
  });

  it("正式安装包 Agent OTLP 配置应映射为 Main 使用的标准环境字段", () => {
    expect(
      resolveBuildPackagedAgentTelemetryEnv({
        ZCODE_ENV: "production",
        ZCODE_PACKAGED_AGENT_OTEL_ENDPOINT: "https://arms.example.com/otlp",
        ZCODE_PACKAGED_AGENT_OTEL_HEADERS: "x-arms-license-key=write-only",
        ZCODE_PACKAGED_AGENT_OTEL_SERVICE_NAME: "zcode-cli-agent",
      }),
    ).toEqual({
      OTEL_EXPORTER_OTLP_ENDPOINT: "https://arms.example.com/otlp",
      OTEL_EXPORTER_OTLP_HEADERS: "x-arms-license-key=write-only",
      OTEL_SERVICE_NAME: "zcode-cli-agent",
      ZCODE_TELEMETRY_RUNTIME_DISTRIBUTION: "packaged",
    });
  });

  it("正式安装包 Agent OTLP 配置不完整或生产环境使用 HTTP 时应阻止构建", () => {
    expect(() =>
      resolveBuildPackagedAgentTelemetryEnv({
        ZCODE_ENV: "production",
        ZCODE_PACKAGED_AGENT_OTEL_ENDPOINT: "https://arms.example.com/otlp",
      }),
    ).toThrow("must be configured together");
    expect(() =>
      resolveBuildPackagedAgentTelemetryEnv({
        ZCODE_ENV: "production",
        ZCODE_PACKAGED_AGENT_OTEL_ENDPOINT: "http://arms.example.com/otlp",
        ZCODE_PACKAGED_AGENT_OTEL_HEADERS: "x-arms-license-key=write-only",
      }),
    ).toThrow("must use HTTPS in production");
  });

  it("release/current 与 Tag 构建缺少 Agent OTLP 配置时应失败，普通开发构建保持 Noop", () => {
    expect(resolveBuildPackagedAgentTelemetryEnv({})).toEqual({});
    expect(() =>
      resolveBuildPackagedAgentTelemetryEnv({
        CI: "true",
        CI_COMMIT_BRANCH: "release/current",
      }),
    ).toThrow("required for release builds");
    expect(() =>
      resolveBuildPackagedAgentTelemetryEnv({
        CI: "true",
        CI_COMMIT_TAG: "v3.6.0",
      }),
    ).toThrow("required for release builds");
  });

  it("安装包身份与后端环境作为两个编译期常量注入每个 bundle", () => {
    // 打包后的应用不能依赖机器环境变量：ZCODE_PREVIEW_IDENTITY 在构建时折叠成 __ZCODE_PRODUCT_FLAVOR__。
    for (const entry of ["main", "host", "preload"] as const) {
      const defines = getDefines(entry);
      expect(defines).toHaveProperty("__ZCODE_ENV__");
      expect(defines).toHaveProperty("__ZCODE_PRODUCT_FLAVOR__");
      expect(['"production"', '"preview"']).toContain(defines.__ZCODE_PRODUCT_FLAVOR__);
    }
  });

  it("Agent OTLP 部署默认值只应编译进 Main bundle", () => {
    expect(getDefines("main")).toHaveProperty("__ZCODE_PACKAGED_AGENT_TELEMETRY_ENV__");
    expect(getDefines("host")).not.toHaveProperty("__ZCODE_PACKAGED_AGENT_TELEMETRY_ENV__");
    expect(getDefines("preload")).not.toHaveProperty("__ZCODE_PACKAGED_AGENT_TELEMETRY_ENV__");
  });

  it("所有 tsup 子构建都应关闭 esbuild legal comments 输出", () => {
    for (const configName of ["main", "host", "preload"]) {
      const configs = Array.isArray(tsupConfig) ? tsupConfig : [tsupConfig];
      const target = configs.find((config) => config.name === configName);
      expect(target).toBeDefined();

      const esbuildOptions: EsbuildLikeOptions = {};
      target?.esbuildOptions?.(esbuildOptions);
      expect(esbuildOptions.legalComments).toBe("none");
    }
  });
});
