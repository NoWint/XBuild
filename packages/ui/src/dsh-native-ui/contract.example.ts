/**
 * dsh-native-ui 标准调用示例：agent 靠模仿写代码，这里放的就是该模仿的那份。
 */
import type { DshDispatch, DshResult } from "@zcode/shared/dsh-compat";
import {
  needsTrust,
  toDshCommand,
  trustChoiceFor,
  type DshDispatchPort,
  type DshManagementAction,
} from "./contract.js";

/**
 * 最常见的一次完整调用：授权一个已准备好的域。
 * 关键点：service 只当作 dispatch 端口；授权绑定 UI 已展示的 revision/digest。
 */
export async function exampleGrantPreparedDomain(
  service: Pick<DshDispatchPort, "dispatch">,
  scope: DshDispatch["scope"],
  domain: import("@zcode/shared/dsh-compat").DshInstalledDomain,
  userConfirmedNativeUi: boolean,
): Promise<DshResult | undefined> {
  if (!needsTrust(domain)) return undefined;
  const trust = trustChoiceFor(domain, userConfirmedNativeUi);
  // 缺失摘要时不授权，而不是拼一个假 digest。
  if (!trust) return undefined;
  const action: DshManagementAction = { kind: "grant", domainId: domain.domainId, trust };
  return service.dispatch({ scope, command: toDshCommand(action) });
}
