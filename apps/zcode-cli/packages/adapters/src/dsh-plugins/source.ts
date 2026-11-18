import { isAbsolute, resolve } from "node:path";
import semver from "semver";
import type { DshPackageSource } from "./contract.js";
import { DshPackageError } from "./errors.js";

export const DSH_PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i;
const NPM_SPEC = /^((?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*)(?:@(.+))?$/i;
const GITHUB_REPOSITORY =
  /^([a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*)(?:#([a-z0-9][a-z0-9._/-]*))?$/i;
const DIST_TAG = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
const MAX_SPEC_LENGTH = 2048;
export function hasDshControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

export function parseDshSource(input: string, baseDirectory?: string): DshPackageSource {
  const spec = input.trim();
  if (
    !spec ||
    spec.length > MAX_SPEC_LENGTH ||
    hasDshControlCharacters(spec) ||
    spec.startsWith("-")
  ) {
    throw new Error("Invalid DSH package source");
  }
  if (
    spec.startsWith("file:") ||
    spec.startsWith("./") ||
    spec.startsWith("../") ||
    isAbsolute(spec)
  ) {
    const local = spec.startsWith("file:") ? spec.slice("file:".length) : spec;
    if (!local || local.startsWith("//"))
      throw new Error("Use an explicit local package directory");
    const path = baseDirectory ? resolve(baseDirectory, local) : resolve(local);
    return { kind: "directory", spec: `file:${path}`, path };
  }
  if (spec.startsWith("github:")) {
    const match = GITHUB_REPOSITORY.exec(spec.slice("github:".length));
    if (!match?.[1]) throw new Error("Invalid GitHub package source");
    return {
      kind: "github",
      spec,
      repository: match[1],
      ...(match[2] ? { ref: match[2] } : {}),
    };
  }
  if (/^https?:/i.test(spec)) {
    const url = new URL(spec);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new Error("DSH package URLs must use HTTPS without embedded credentials");
    }
    if (url.hostname === "github.com" && /^\/[^/]+\/[^/]+(?:\.git)?\/?$/.test(url.pathname)) {
      const repository = url.pathname
        .replace(/^\//, "")
        .replace(/\/$/, "")
        .replace(/\.git$/, "");
      return parseDshSource(`github:${repository}${url.hash}`);
    }
    if (!/\.(?:tgz|tar\.gz)$/i.test(url.pathname) || url.hash) {
      throw new Error("DSH HTTPS package sources must identify a tarball");
    }
    return { kind: "https", spec: url.href };
  }
  const match = NPM_SPEC.exec(spec);
  if (!match?.[1] || match[1].length > 214) throw new Error("Invalid npm package specifier");
  if (match[2] && !semver.validRange(match[2]) && !DIST_TAG.test(match[2])) {
    throw new Error("Invalid npm version or distribution tag");
  }
  return { kind: "npm", spec, packageName: match[1] };
}

export function normalizeDshSource(
  input: string | DshPackageSource,
  baseDirectory?: string,
): DshPackageSource {
  try {
    if (typeof input === "string") return parseDshSource(input, baseDirectory);
    if (!input || typeof input !== "object" || typeof input.spec !== "string")
      throw new Error("Invalid typed source");
    const source = parseDshSource(input.spec, baseDirectory);
    if (source.kind !== input.kind) throw new Error("Source kind does not match spec");
    if (source.kind === "npm" && (input.kind !== "npm" || source.packageName !== input.packageName))
      throw new Error("npm identity mismatch");
    if (source.kind === "directory" && (input.kind !== "directory" || source.path !== input.path))
      throw new Error("Directory identity mismatch");
    if (
      source.kind === "github" &&
      (input.kind !== "github" ||
        source.repository !== input.repository ||
        source.ref !== input.ref)
    )
      throw new Error("Git identity mismatch");
    if (source.kind === "https" && input.kind === "https" && input.integrity !== undefined) {
      if (
        !/^(?:sha256-[A-Za-z0-9+/]{43}=|sha384-[A-Za-z0-9+/]{64}|sha512-[A-Za-z0-9+/]{86}==)$/.test(
          input.integrity,
        )
      ) {
        throw new Error("Invalid tarball integrity");
      }
      return { ...source, integrity: input.integrity };
    }
    return source;
  } catch (error) {
    throw new DshPackageError("DSH_INVALID_SOURCE", "Invalid DSH package source declaration", {
      cause: error,
    });
  }
}

export function requireImmutableDshSource(source: DshPackageSource): void {
  // 分支和短 SHA 可再次解析为其他代码；准备 immutable revision 前必须锁定完整 commit。
  if (source.kind === "github" && !/^[a-f0-9]{40}$/i.test(source.ref ?? "")) {
    throw new DshPackageError("DSH_MUTABLE_SOURCE", "Git sources require a full immutable commit");
  }
  if (source.kind === "https" && !source.integrity) {
    throw new DshPackageError(
      "DSH_INTEGRITY_REQUIRED",
      "HTTPS tarballs require verifiable integrity",
    );
  }
}
