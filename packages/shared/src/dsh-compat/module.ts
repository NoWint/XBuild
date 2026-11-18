/**
 * dsh-compat-protocol 模块清单（architecture-governance managed 模块）。
 * 层：domain。修改 requires 时同步更新 architecture-policy.yaml（检查器会校验两者一致）。
 */
export const dshCompatProtocolModule = {
  id: "dsh-compat-protocol",
  requires: [],
  provides: ["dsh-compat-protocol"],
  publicEntrypoints: ["index.ts", "contract.ts"],
} as const;
