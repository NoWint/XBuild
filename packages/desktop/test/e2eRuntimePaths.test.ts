import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findE2EBashOutputPath,
  E2E_RUNTIME_RELATIVE_ROOT,
  E2E_RUNTIME_ROOT_REPLAY_TOKEN,
  createE2EReplayFixtureVariables,
  resolveE2EHomeDir,
  resolveE2EStorageRoot,
  resolveE2ERuntimePath,
  resolveE2ERuntimeRoot,
  resolveE2EShellPath,
  resolveE2EToolPath,
} from "./e2e/helpers/e2e-runtime-paths.js";

describe("Desktop E2E runtime paths", () => {
  it("keeps runtime files below the isolated Agent execution workspace", () => {
    const e2eHomeDir = resolve("root", "isolated-e2e-home");

    expect(resolveE2ERuntimeRoot(e2eHomeDir)).toBe(join(e2eHomeDir, "ZCodeProject", ".zcode-e2e"));
    expect(resolveE2ERuntimePath("bg25", "release-child-bash")).toBe(
      join(resolveE2ERuntimeRoot(), "bg25", "release-child-bash"),
    );
  });

  it("uses portable absolute tool paths and workspace-relative shell paths", () => {
    expect(resolveE2EToolPath("bg25", "continued-work.txt")).toBe(
      resolveE2ERuntimePath("bg25", "continued-work.txt").replaceAll("\\", "/"),
    );
    expect(resolveE2EShellPath("bg25", "release-child-bash")).toBe(
      ".zcode-e2e/bg25/release-child-bash",
    );
    expect(E2E_RUNTIME_RELATIVE_ROOT).toBe(".zcode-e2e");
    expect(E2E_RUNTIME_ROOT_REPLAY_TOKEN).toBe("{{e2eRuntimeRoot}}");
    expect(createE2EReplayFixtureVariables(resolve("root", "fixture-home"))).toEqual({
      e2eRuntimeRoot: resolveE2ERuntimeRoot(resolve("root", "fixture-home")).replaceAll("\\", "/"),
    });
  });

  it("uses the existing E2E HOME precedence", () => {
    expect(
      resolveE2EHomeDir({
        cwd: resolve("root", "desktop"),
        env: { ZCODE_DATA_BASE_DIR: resolve("root", "data-base") },
      }),
    ).toBe(resolve("root", "data-base"));
    expect(
      resolveE2EHomeDir({
        cwd: resolve("root", "desktop"),
        env: {
          ZCODE_DATA_BASE_DIR: resolve("root", "data-base"),
          ZCODE_E2E_HOME_DIR: resolve("root", "explicit-home"),
        },
      }),
    ).toBe(resolve("root", "explicit-home"));
  });

  it("seeds the current .xbuild config below the isolated base rather than the legacy root", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "e2e-storage-root-"));
    const currentConfigPath = join(homeDir, ".xbuild", "v2", "setting.json");
    try {
      const configDir = join(resolveE2EStorageRoot(homeDir), "v2");
      await mkdir(configDir, { recursive: true });
      await writeFile(join(configDir, "setting.json"), "{}");

      expect(await readFile(currentConfigPath, "utf8")).toBe("{}");
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  it("keeps the production storage suffix when only the E2E data base is overridden", () => {
    const homeDir = resolve("root", "isolated-e2e-home");

    expect(resolveE2EStorageRoot(homeDir)).toBe(join(homeDir, ".xbuild"));
  });

  it.each([
    { env: {}, home: ".e2e-home" },
    { env: { ZCODE_DESKTOP_HOME_DIR: "desktop-home" }, home: "desktop-home" },
    {
      env: {
        ZCODE_DATA_BASE_DIR: " data-base ",
        ZCODE_DESKTOP_HOME_DIR: "desktop-home",
      },
      home: "data-base",
    },
    {
      env: {
        ZCODE_E2E_HOME_DIR: " explicit-home ",
        ZCODE_DATA_BASE_DIR: "data-base",
        ZCODE_DESKTOP_HOME_DIR: "desktop-home",
      },
      home: "explicit-home",
    },
  ])("resolves relative isolated bases from the launcher cwd: $home", ({ env, home }) => {
    const cwd = resolve("root", "desktop");
    const homeDir = resolveE2EHomeDir({ cwd, env });

    expect(homeDir).toBe(resolve(cwd, home));
    expect(resolveE2EStorageRoot(homeDir)).toBe(resolve(cwd, home, ".xbuild"));
  });
});

it("Bash 输出查找按 session/tool 隔离，区分清理完成与多个实际文件", async () => {
  const root = await mkdtemp(join(tmpdir(), "e2e-output-path-"));
  const storageRoot = join(root, "storage");
  const sessionId = "session_current";
  const toolCallId = "tool_current";
  const create = async (dir: string, session = sessionId) => {
    const path = join(root, dir, session, `${toolCallId}-stdout.log`);
    await mkdir(join(root, dir, session), { recursive: true });
    await writeFile(path, "output");
    return path;
  };
  try {
    await create("zcode-bash-other", "session_other");
    const options = { tempRoot: root, storageRoot };
    expect(await findE2EBashOutputPath(sessionId, toolCallId, options)).toBeNull();
    const path = await create("zcode-bash-current");
    expect(await findE2EBashOutputPath(sessionId, toolCallId, options)).toBe(path);
    await create("zcode-bash-duplicate");
    await expect(findE2EBashOutputPath(sessionId, toolCallId, options)).rejects.toThrow("没有唯一");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
