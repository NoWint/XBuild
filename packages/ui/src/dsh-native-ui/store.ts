import { create } from "zustand";
import type {
  DshInstalledDomain,
  DshOverview,
  DshScope,
} from "@zcode/shared/dsh-compat";
import { dshOverviewSchema } from "@zcode/shared/dsh-compat";
import { logger } from "@/logger.js";
import { toDshCommand, type DshDispatchPort, type DshManagementAction } from "@/dsh-native-ui/contract.js";

/**
 * DSH 插件管理状态。
 * 事实源是 CLI owner 返回的 overview；这里只保存最近一次投影和 UI 忙碌标记，
 * 不做乐观合并、不缓存生命周期终态。切换 scope 必须 reset，避免跨工作区串数据。
 */
export interface DshNativeUiState {
  scopeKey: string | null;
  overview: DshOverview | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  /** 正在执行的域名/来源 id；按行禁用，不用全表 loading 掩盖。 */
  pending: ReadonlySet<string>;
  /** 最近一次失败动作的稳定错误码，用于区分权限/完整性/环境限制。 */
  errorCode: string | null;
  load(scope: DshScope, service: DshDispatchPort): Promise<void>;
  act(
    scope: DshScope,
    action: DshManagementAction,
    service: DshDispatchPort,
  ): Promise<void>;
  reset(): void;
}

function scopeKeyOf(scope: DshScope): string {
  return `${scope.workspaceIdentity?.trim() || scope.workspacePath}\u0000${scope.remoteSessionId ?? ""}`;
}

function errorCodeOf(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error) {
    const code = Reflect.get(error, "code");
    return typeof code === "string" ? code : null;
  }
  return null;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 读 overview 后按 schema 校验；不合法响应不写进状态，避免投影出半截数据。 */
function parseOverview(value: unknown): DshOverview {
  return dshOverviewSchema.parse(value);
}

/** 动作对应的行标记；目录类动作没有 domainId，用 catalogId/url 标识。 */
function pendingKeyOf(action: DshManagementAction): string {
  switch (action.kind) {
    case "add-catalog":
      return `catalog:${action.url}`;
    case "refresh-catalog":
    case "remove-catalog":
      return `catalog:${action.catalogId}`;
    case "prepare-catalog":
      return `catalog:${action.catalogId}:${action.entryId}`;
    case "prepare":
      return `source:${action.source}`;
    case "import-local":
      return `local:${action.directory}`;
    default:
      return `domain:${action.domainId}`;
  }
}

export const useDshNativeUiStore = create<DshNativeUiState>((set, get) => ({
  scopeKey: null,
  overview: null,
  loading: false,
  refreshing: false,
  error: null,
  pending: new Set<string>(),
  errorCode: null,

  async load(scope, service) {
    const key = scopeKeyOf(scope);
    const current = get();
    // 已切换到别的 scope 时，旧的 loading 标记不适用于新工作区。
    set({
      scopeKey: key,
      loading: current.scopeKey === key ? current.loading : true,
      refreshing: current.scopeKey === key ? current.refreshing : false,
      ...(current.scopeKey === key ? {} : { overview: null, error: null, errorCode: null }),
    });
    try {
      const result = await service.dispatch({ scope, command: { kind: "overview" } });
      if (get().scopeKey !== key) return;
      set({ overview: parseOverview(result.value), loading: false, refreshing: false, error: null, errorCode: null });
    } catch (error) {
      if (get().scopeKey !== key) return;
      logger.warn("[dsh] overview load failed", { error: messageOf(error) });
      set({ loading: false, refreshing: false, error: messageOf(error), errorCode: errorCodeOf(error) });
    }
  },

  async act(scope, action, service) {
    const key = scopeKeyOf(scope);
    const pendingKey = pendingKeyOf(action);
    const pending = new Set(get().pending);
    pending.add(pendingKey);
    set({ pending, error: null, errorCode: null });
    try {
      await service.dispatch({ scope, command: toDshCommand(action) });
      // 动作成功后以服务器投影为准；失败时不刷新，保留用户原本看到的终态。
      await get().load(scope, service);
    } catch (error) {
      logger.warn("[dsh] management action failed", { kind: action.kind, error: messageOf(error) });
      if (get().scopeKey === key) set({ error: messageOf(error), errorCode: errorCodeOf(error) });
      throw error;
    } finally {
      const next = new Set(get().pending);
      next.delete(pendingKey);
      set({ pending: next });
    }
  },

  reset() {
    set({
      scopeKey: null,
      overview: null,
      loading: false,
      refreshing: false,
      error: null,
      errorCode: null,
      pending: new Set<string>(),
    });
  },
}));

/** 域行是否处于忙碌（任一动作）。 */
export function isDomainPending(pending: ReadonlySet<string>, domain: DshInstalledDomain): boolean {
  return pending.has(`domain:${domain.domainId}`);
}
