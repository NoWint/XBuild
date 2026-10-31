// 自定义内核 RPC 契约（browser-safe：不 import node:fs，可被 renderer bundle 安全引用）。
import { ServiceChannels, type OverridesFileParsed } from "@zcode/shared";
import { createServiceDescriptor } from "../descriptors.js";

/** 覆盖文件的读写结果：path 供 UI 展示与排查。 */
export interface CustomizationOverridesSnapshot {
  overrides: OverridesFileParsed;
  path: string;
  warning?: string;
}

export interface ICustomizationService {
  load(params: {
    scope: "user" | "workspace";
    workspacePath?: string;
  }): Promise<CustomizationOverridesSnapshot>;
  save(params: {
    scope: "user" | "workspace";
    workspacePath?: string;
    overrides: OverridesFileParsed;
  }): Promise<{ path: string }>;
}

/** 描述符（同 ISettingService 的 interface + const 同名模式）。 */
export const ICustomizationService = createServiceDescriptor<ICustomizationService>(
  ServiceChannels.Customization,
);
