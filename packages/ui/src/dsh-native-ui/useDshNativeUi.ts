import { useCallback, useEffect, useMemo } from "react";
import type { DshScope } from "@zcode/shared/dsh-compat";
import { useWorkspaceServices } from "@/hooks/useWorkspaceServices.js";
import type { DshDispatchPort, DshManagementAction } from "@/dsh-native-ui/contract.js";
import { useDshNativeUiStore } from "@/dsh-native-ui/store.js";

/**
 * 匹配 `workspaceIdentity?.trim() || workspacePath` 的隔离键语义：
 * 身份优先，路径只作本地 fallback，避免同路径不同远端身份互相复用域。
 */
export function buildDshScope(input: {
  workspacePath: string | null | undefined;
  workspaceIdentity?: string | null;
  remoteSessionId?: string | null;
}): DshScope | null {
  if (!input.workspacePath) return null;
  const identity = input.workspaceIdentity?.trim();
  return {
    workspacePath: input.workspacePath,
    ...(identity ? { workspaceIdentity: identity } : {}),
    ...(input.remoteSessionId ? { remoteSessionId: input.remoteSessionId } : {}),
  };
}

/**
 * DSH 插件管理入口：把真实 service 收窄成 dispatch 端口，并驱动 store。
 * UI 组件只依赖返回的投影与动作，不直接接触协议或文件系统。
 */
export function useDshNativeUi(scope: DshScope | null) {
  const services = useWorkspaceServices(scope?.workspacePath ?? null, scope?.remoteSessionId ?? null, scope?.workspaceIdentity ?? undefined);
  const port = useMemo<DshDispatchPort>(
    () => ({ dispatch: (params) => services.dshPluginService.dispatch(params) }),
    [services],
  );
  const overview = useDshNativeUiStore((state) => state.overview);
  const loading = useDshNativeUiStore((state) => state.loading);
  const refreshing = useDshNativeUiStore((state) => state.refreshing);
  const error = useDshNativeUiStore((state) => state.error);
  const errorCode = useDshNativeUiStore((state) => state.errorCode);
  const pending = useDshNativeUiStore((state) => state.pending);
  const scopeKey = useDshNativeUiStore((state) => state.scopeKey);
  const load = useDshNativeUiStore((state) => state.load);
  const actStore = useDshNativeUiStore((state) => state.act);
  const reset = useDshNativeUiStore((state) => state.reset);

  const expectedKey = scope ? `${scope.workspaceIdentity?.trim() || scope.workspacePath}\u0000${scope.remoteSessionId ?? ""}` : null;

  useEffect(() => {
    if (!scope || expectedKey === null) {
      // 无活动工作区时清空，避免把上一个工作区的 DSH 域显示成当前工作区。
      reset();
      return;
    }
    if (scopeKey === expectedKey) return;
    void load(scope, port);
  }, [expectedKey, load, port, reset, scope, scopeKey]);

  const refresh = useCallback(async () => {
    if (!scope) return;
    await load(scope, port);
  }, [load, port, scope]);

  const act = useCallback(
    async (action: DshManagementAction) => {
      if (!scope) return;
      await actStore(scope, action, port);
    },
    [actStore, port, scope],
  );

  return {
    scope,
    overview,
    loading,
    refreshing,
    error,
    errorCode,
    pending,
    refresh,
    act,
  };
}
