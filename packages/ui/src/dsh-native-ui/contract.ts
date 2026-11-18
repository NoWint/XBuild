/**
 * dsh-native-ui 对外契约：DSH 插件在 XBuild 设置页的管理面。
 * 只定义「谁拥有什么状态、UI 如何消费」；原生运行时与包管理由 CLI/Host 拥有，
 * UI 不直接触达文件系统、包管理器或原生 Cordis 对象图。
 */
import type {
  DshCatalog,
  DshDispatch,
  DshInstalledDomain,
  DshJson,
  DshResult,
} from "@zcode/shared/dsh-compat";

/** 兼容等级；UI 只展示证据给出的等级，不自行提升。 */
export type DshCompatibilityLevel = DshInstalledDomain["compatibility"];

/** 域生命周期投影；与后端 state 一一对应，不做乐观合并。 */
export type DshDomainState = DshInstalledDomain["state"];

/**
 * UI 侧对服务的唯一端口形状：只暴露 dispatch。
 * 这样本模块不依赖 @zcode/services，调用方用真实 service 适配即可。
 */
export interface DshDispatchPort {
  dispatch(params: DshDispatch): Promise<DshResult>;
}

/**
 * 授权必须绑定用户已看到的确切 revision + digest。
 * executionMode/filesystem 等权限由 UI 以用户显式确认的选择传入，不设默认放行。
 */
export interface DshTrustChoice {
  readonly revision: string;
  readonly digest: string;
  readonly nativeUi: boolean;
}

/**
 * 管理动作：全部经 `IDshPluginService.dispatch` 到达单一 CLI owner。
 * 这里只是把 DshCommand 收窄成 UI 实际可发起的子集，避免 UI 拼任意 envelope。
 */
export type DshManagementAction =
  | { kind: "refresh-catalog"; catalogId: string }
  | { kind: "add-catalog"; url: string }
  | { kind: "remove-catalog"; catalogId: string }
  | { kind: "prepare"; source: string; baseBundles?: string[] }
  | { kind: "prepare-catalog"; catalogId: string; entryId: string }
  /** 导入本机已安装的插件：来源用本地目录，保留原始包字节。 */
  | { kind: "import-local"; directory: string }
  | { kind: "grant"; domainId: string; trust: DshTrustChoice }
  | { kind: "set-enabled"; domainId: string; enabled: boolean }
  | { kind: "configure"; domainId: string; patches: DshJson[] }
  | { kind: "update"; domainId: string }
  | { kind: "rollback"; domainId: string }
  | { kind: "uninstall"; domainId: string; deleteData?: boolean };

/**
 * 管理面接口：一次只做一个动作，状态以服务器返回的 overview 为准。
 * 所有方法在失败时抛出稳定错误，不返回伪造成功。
 */
export interface DshNativeUiContract {
  /** 读取当前 scope 的 overview；幂等，不改任何生命周期状态。 */
  load(scopeKey: string): Promise<void>;
  /** 重新拉取 overview；用户主动刷新时使用，与 load 同义。 */
  refresh(scopeKey: string): Promise<void>;
  /** 发起一个管理动作并刷新 overview；失败保留原状态并暴露 error。 */
  act(scopeKey: string, action: DshManagementAction): Promise<void>;
  /** 清空缓存；切换工作区或断开远端时调用。 */
  reset(): void;
}

/** UI 可直接展示的来源行；保留原始 id/url 用于诊断。 */
export interface DshCatalogRow {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly entryCount: number;
  readonly diagnosticCount: number;
}

export function toCatalogRow(catalog: DshCatalog): DshCatalogRow {
  return {
    id: catalog.id,
    name: catalog.name,
    url: catalog.url,
    entryCount: catalog.entries.length,
    diagnosticCount: catalog.diagnostics.length,
  };
}

/**
 * 把 UI 动作翻译成后端 DshDispatch 的 command。
 * 不包含 scope 权限提升；scope 由调用方按当前工作区单独提供。
 */
export function toDshCommand(action: DshManagementAction): DshDispatch["command"] {
  switch (action.kind) {
    case "refresh-catalog":
      return { kind: "refresh-catalog", catalogId: action.catalogId };
    case "add-catalog":
      return { kind: "add-catalog", url: action.url };
    case "remove-catalog":
      return { kind: "remove-catalog", catalogId: action.catalogId };
    case "prepare":
      return {
        kind: "prepare",
        source: action.source,
        ...(action.baseBundles ? { baseBundles: action.baseBundles } : {}),
      };
    case "prepare-catalog":
      return { kind: "prepare", catalogId: action.catalogId, entryId: action.entryId };
    case "import-local":
      // 本地目录必须显式写成 file: 绝对路径，后端按目录来源做完整性校验与物化。
      return { kind: "prepare", source: `file:${action.directory}` };
    case "grant":
      // 原生代码在域内以不受限文件系统/网络/子进程运行；这些权限必须由用户显式确认后写入，
      // 因此 UI 不提供默认值，只透传用户在确认界面做出的选择。
      return {
        kind: "grant",
        domainId: action.domainId,
        grant: {
          revision: action.trust.revision,
          digest: action.trust.digest,
          nativeCode: true,
          nativeUi: action.trust.nativeUi,
          executionMode: "trusted-process",
          filesystem: "unrestricted",
          network: true,
          subprocess: true,
          installationScripts: [],
        },
      };
    case "set-enabled":
      return { kind: "set-enabled", domainId: action.domainId, enabled: action.enabled };
    case "configure":
      return { kind: "configure", domainId: action.domainId, patches: action.patches };
    case "update":
      return { kind: "update", domainId: action.domainId };
    case "rollback":
      return { kind: "rollback", domainId: action.domainId };
    case "uninstall":
      return {
        kind: "uninstall",
        domainId: action.domainId,
        ...(action.deleteData === undefined ? {} : { deleteData: action.deleteData }),
      };
  }
}

/** 域是否还需用户授权：有 prepared revision 但尚无 grant。 */
export function needsTrust(domain: DshInstalledDomain): boolean {
  return domain.state === "awaiting-trust" && domain.preparedRevision !== undefined;
}

/** 只有 running 状态才能被停用；只有可信状态才能启用。 */
export function canToggle(domain: DshInstalledDomain): boolean {
  return domain.state === "running" || domain.state === "stopped" || domain.enabled;
}

/** 内置源判定：内置源不可刷新/删除，UI 据此隐藏对应按钮而不是让请求失败。 */
export const DSH_BUILTIN_CATALOG_ORIGIN = "xbuild://dsh-builtin";

export function isBuiltinCatalog(catalog: { url: string }): boolean {
  return catalog.url === DSH_BUILTIN_CATALOG_ORIGIN;
}

/** 从域摘要读出授权所需的 revision/digest；缺失时不提供授权入口，避免伪造绑定。 */
export function trustChoiceFor(
  domain: DshInstalledDomain,
  nativeUi: boolean,
): DshTrustChoice | undefined {
  const summary = domain.revision;
  if (!summary || summary.revision !== domain.preparedRevision) return undefined;
  return { revision: summary.revision, digest: summary.digest, nativeUi };
}
