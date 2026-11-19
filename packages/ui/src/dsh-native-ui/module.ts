/**
 * dsh-native-ui 模块清单（architecture-governance managed 模块）。
 * 层：adapters。修改 requires 时同步更新 architecture-policy.yaml（检查器会校验两者一致）。
 * 只依赖共享 DSH 协议与本包 UI 基元；不依赖 @zcode/services，服务经 DshDispatchPort 注入。
 */
export const dshNativeUiModule = {
  id: "dsh-native-ui",
  requires: ["dsh-compat-protocol", "ui"],
  provides: ["dsh-native-ui"],
  publicEntrypoints: ["index.ts", "contract.ts", "DshPluginsSection.tsx", "DshNativeSurface.tsx"],
} as const;
