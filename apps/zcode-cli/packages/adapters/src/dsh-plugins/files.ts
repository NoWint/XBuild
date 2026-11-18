import { createHash, randomUUID } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  readlink,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { DshPackageError } from "./errors.js";

const MAX_PACKAGE_FILES = 100_000;
const MAX_PACKAGE_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 4 * 1024 * 1024;
const LOCK_FILENAME = ".operation-lock";

export function safeIdentifier(value: string, label: string): string {
  if (!/^[a-z0-9][a-z0-9_-]{0,127}$/i.test(value))
    throw new DshPackageError("DSH_INVALID_METADATA", `Invalid ${label}`);
  return value;
}

export function inside(root: string, child: string): string {
  const path = resolve(root, child);
  const difference = relative(resolve(root), path);
  if (difference === ".." || difference.startsWith(`..${sep}`) || isAbsolute(difference))
    throw new DshPackageError("DSH_INVALID_METADATA", "Package path escapes its root");
  return path;
}

export async function readJson(path: string): Promise<unknown> {
  const info = await stat(path);
  if (!info.isFile() || info.size > MAX_MANIFEST_BYTES)
    throw new DshPackageError("DSH_INVALID_METADATA", "Invalid or oversized package metadata");
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new DshPackageError("DSH_INVALID_METADATA", "Invalid package metadata JSON", {
      cause: error,
    });
  }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  const serialized = JSON.stringify(value, null, 2) + "\n";
  // 输入紧凑 JSON 合法不代表缩进后的持久化字节仍可读；必须在替换旧记录前使用同一上限。
  if (Buffer.byteLength(serialized, "utf8") > MAX_MANIFEST_BYTES)
    throw new DshPackageError("DSH_INVALID_METADATA", "Oversized serialized package metadata");
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, serialized, { flag: "wx", mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function withDirectoryLock<T>(root: string, body: () => Promise<T>): Promise<T> {
  await mkdir(root, { recursive: true });
  const path = join(root, LOCK_FILENAME);
  const handle = await open(path, "wx", 0o600).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "EEXIST")
      throw new DshPackageError(
        "DSH_LOCKED",
        "Another DSH package operation holds this domain lock",
        { cause: error },
      );
    throw error;
  });
  try {
    await handle.writeFile(
      JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }),
    );
    return await body();
  } finally {
    await handle.close();
    await rm(path, { force: true });
  }
}

export async function copyPackage(
  source: string,
  target: string,
  signal?: AbortSignal,
): Promise<void> {
  const root = await realpath(source);
  const budget = { files: 0, bytes: 0 };
  async function visit(from: string, to: string): Promise<void> {
    signal?.throwIfAborted();
    const info = await lstat(from);
    if (info.isSymbolicLink())
      throw new Error("Local package links require a packed immutable package");
    if (info.isDirectory()) {
      await mkdir(to, { recursive: true });
      for (const name of (await readdir(from)).sort()) {
        if (name === ".git" || name === "node_modules") continue;
        await visit(join(from, name), join(to, name));
      }
      return;
    }
    if (!info.isFile()) throw new Error("Package contains a non-regular file");
    budget.files += 1;
    budget.bytes += info.size;
    if (budget.files > MAX_PACKAGE_FILES || budget.bytes > MAX_PACKAGE_BYTES)
      throw new Error("Package exceeds installation limits");
    await copyImmutableFile(from, to, info.mode);
  }
  await visit(root, target);
}

async function copyImmutableFile(from: string, to: string, mode: number): Promise<void> {
  // 硬链接共享 inode 会让配置候选修改旧授权代码；reflink 共享存储但保持写入隔离，缺失时普通复制。
  await copyFile(from, to, constants.COPYFILE_FICLONE);
  await chmod(to, mode & 0o777);
}

export async function cloneDshRevision(source: string, target: string): Promise<void> {
  const canonical = await realpath(source);
  const budget = { files: 0, bytes: 0 };
  async function visit(from: string, to: string): Promise<void> {
    const info = await lstat(from);
    if (info.isSymbolicLink()) {
      const destination = await realpath(from);
      inside(canonical, relative(canonical, destination));
      const link = await readlink(from);
      const value = isAbsolute(link)
        ? relative(dirname(to), join(target, relative(canonical, destination)))
        : link;
      await symlink(value, to);
      return;
    }
    if (info.isDirectory()) {
      await mkdir(to, { recursive: true });
      for (const name of (await readdir(from)).sort())
        await visit(join(from, name), join(to, name));
      return;
    }
    if (!info.isFile())
      throw new DshPackageError("DSH_INVALID_METADATA", "Revision contains a non-regular file");
    budget.files += 1;
    budget.bytes += info.size;
    if (budget.files > MAX_PACKAGE_FILES || budget.bytes > MAX_PACKAGE_BYTES)
      throw new DshPackageError("DSH_INVALID_METADATA", "Revision exceeds copy limits");
    await copyImmutableFile(from, to, info.mode);
  }
  await visit(canonical, target);
}

export async function hashDirectory(root: string, signal?: AbortSignal): Promise<string> {
  const canonical = await realpath(root);
  const hash = createHash("sha256");
  const budget = { files: 0, bytes: 0 };
  async function visit(path: string): Promise<void> {
    signal?.throwIfAborted();
    const info = await lstat(path);
    const name = relative(canonical, path).split(sep).join("/");
    if (info.isSymbolicLink()) {
      const destination = await realpath(path);
      inside(canonical, relative(canonical, destination));
      hash.update(`link\0${name}\0${await readlink(path)}\0`);
      return;
    }
    if (info.isDirectory()) {
      // 插件可导入任意扩展名；不能按 .tmp 等文件名猜测并排除可执行内容。
      for (const child of (await readdir(path)).sort()) await visit(join(path, child));
      return;
    }
    if (!info.isFile()) throw new Error("Installation contains a non-regular file");
    budget.files += 1;
    budget.bytes += info.size;
    if (budget.files > MAX_PACKAGE_FILES || budget.bytes > MAX_PACKAGE_BYTES)
      throw new Error("Installation exceeds integrity limits");
    hash.update(`file\0${name}\0${info.size}\0${info.mode & 0o111}\0`);
    for await (const chunk of createReadStream(path)) {
      signal?.throwIfAborted();
      hash.update(chunk as Buffer);
    }
    hash.update("\0");
  }
  await visit(canonical);
  return hash.digest("hex");
}
