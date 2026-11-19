import { describe, expect, it } from "vitest";
import { resolveArchiveExtractCommand } from "../../../scripts/prebuilt-binary-extract.mjs";

// v3.18.6 Windows CI 实测：Expand-Archive 在 windows-2025 runner 上因 PSModulePath
// 装载到 PowerShell 7 版 Archive 模块，调用了已被移除的 ExtractToDirectory 三参重载，
// 一个文件都不会落盘。zip 解压必须改用系统自带 bsdtar，命令选择成为契约。
describe("prebuilt archive extract command selection", () => {
  it("uses bsdtar for zip archives on Windows", () => {
    const plan = resolveArchiveExtractCommand({
      archivePath: "D:/repo/node_modules/.cache/zcode-dsh-node/node-v24.15.0-win-x64.zip",
      archiveExt: "zip",
      extractDir: "D:/repo/node_modules/.cache/zcode-dsh-node/node-v24.15.0-win-x64",
      cwd: "D:/repo/node_modules/.cache/zcode-dsh-node",
      platform: "win32",
    });

    expect(plan.command).toBe("tar");
    expect(plan.args[0]).toBe("-xf");
    expect(plan.args).not.toContain("-xzf");
    expect(plan.args[2]).toBe("-C");
    expect(plan.args[3]).not.toContain("\\");
    expect(plan.options.cwd).toBe("D:/repo/node_modules/.cache/zcode-dsh-node");
  });

  it("keeps unzip for zip archives on darwin and linux", () => {
    for (const platform of ["darwin", "linux"]) {
      const plan = resolveArchiveExtractCommand({
        archivePath: "/repo/cache/node-v24.15.0-darwin-x64.zip",
        archiveExt: "zip",
        extractDir: "/repo/cache/node-v24.15.0-darwin-x64",
        cwd: "/repo/cache",
        platform,
      });
      expect(plan.command).toBe("unzip");
      expect(plan.args[0]).toBe("-q");
      expect(plan.args[2]).toBe("-d");
    }
  });

  it("keeps tar -xzf for tar.xz archives on every platform", () => {
    for (const platform of ["darwin", "linux", "win32"]) {
      const plan = resolveArchiveExtractCommand({
        archivePath: "/repo/cache/node-v24.15.0-linux-x64.tar.xz",
        archiveExt: "tar.xz",
        extractDir: "/repo/cache/node-v24.15.0-linux-x64",
        cwd: "/repo/cache",
        platform,
      });
      expect(plan.command).toBe("tar");
      expect(plan.args[0]).toBe("-xzf");
    }
  });

  it("normalizes Windows archive paths to posix form for tar", () => {
    const plan = resolveArchiveExtractCommand({
      archivePath: "D:\\repo\\cache\\node-v24.15.0-win-x64.zip",
      archiveExt: "zip",
      extractDir: "D:\\repo\\cache\\out",
      cwd: "D:\\repo\\cache",
      platform: "win32",
    });
    // 归档路径绝不带反斜杠：真实 Windows 上转成相对 cwd 的形式避开盘符冒号；
    // 在非 Windows 测试主机上 relative 语义不同，退回正斜杠绝对路径（bsdtar 可用）。
    expect(plan.args[1]).not.toContain("\\");
    expect(plan.args[3]).toBe("D:/repo/cache/out");
  });
});
