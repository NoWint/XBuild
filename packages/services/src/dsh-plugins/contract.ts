import type { Event } from "@zcode/rpc";
import { ServiceChannels } from "@zcode/shared";
import type {
  DshDispatch,
  DshEvent,
  DshEventSubscription,
  DshResult,
} from "@zcode/shared/dsh-compat";
import { createServiceDescriptor } from "../descriptors.js";

export interface IDshPluginService {
  /** 严格校验 envelope 后路由到既有 CLI owner；原生 JSON 不转换，无固定业务超时。 */
  dispatch(params: DshDispatch): Promise<DshResult>;
  /** scope 必须与 attachment 归属一致；只有当前连接获得的租约可订阅定向原生事件。 */
  onDynamicDshEvent(params: DshEventSubscription): Event<DshEvent>;
}

export const IDshPluginService = createServiceDescriptor<IDshPluginService>(
  ServiceChannels.DshPlugins,
);
