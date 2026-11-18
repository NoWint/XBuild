import { useCallback, useMemo, useState } from "react";
import { Plus, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import type { DshInstalledDomain } from "@zcode/shared/dsh-compat";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { Switch } from "@/components/ui/switch.js";
import { useConfirmDialog } from "@/hooks/useConfirmDialog.js";
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import {
  canToggle,
  isBuiltinCatalog,
  needsTrust,
  toCatalogRow,
  trustChoiceFor,
  type DshManagementAction,
} from "@/dsh-native-ui/contract.js";
import { buildDshScope, useDshNativeUi } from "@/dsh-native-ui/useDshNativeUi.js";
import { isDomainPending } from "@/dsh-native-ui/store.js";

interface DshPluginsSectionProps {
  workspacePath?: string | null;
  workspaceIdentity?: string;
  remoteSessionId?: string | null;
}

/**
 * DSH 插件管理：来源、安装、授权、启停、更新、回滚、卸载与诊断。
 * 事实源是 CLI owner 的 overview；这里只渲染投影并转发动作，不做本地生命周期推断。
 */
export function DshPluginsSection({
  workspacePath,
  workspaceIdentity,
  remoteSessionId,
}: DshPluginsSectionProps) {
  const { intl } = useZCodeIntl();
  const scope = useMemo(
    () => buildDshScope({ workspacePath, workspaceIdentity, remoteSessionId }),
    [remoteSessionId, workspaceIdentity, workspacePath],
  );
  const { overview, loading, error, errorCode, pending, refresh, act } = useDshNativeUi(scope);
  const requestConfirmation = useConfirmDialog();
  const [catalogUrl, setCatalogUrl] = useState("");
  const [source, setSource] = useState("");

  const run = useCallback(
    async (action: DshManagementAction) => {
      try {
        await act(action);
      } catch {
        // store 已记录 error/errorCode；这里不重复提示，避免双 toast 与错误被覆盖。
      }
    },
    [act],
  );

  const addCatalog = useCallback(async () => {
    const url = catalogUrl.trim();
    if (!url) return;
    await run({ kind: "add-catalog", url });
    setCatalogUrl("");
  }, [catalogUrl, run]);

  const prepareSource = useCallback(async () => {
    const value = source.trim();
    if (!value) return;
    await run({ kind: "prepare", source: value });
    setSource("");
  }, [run, source]);

  const catalogs = overview ? overview.catalogs.map(toCatalogRow) : [];
  const domains = overview?.domains ?? [];
  const local = overview?.local;
  // 内置源常驻在最前，且没有远程地址可刷新/删除。
  const builtin = catalogs.find((catalog) => isBuiltinCatalog(catalog));
  const remoteCatalogs = catalogs.filter((catalog) => !isBuiltinCatalog(catalog));
  const builtinEntries = overview?.catalogs.find(isBuiltinCatalog)?.entries ?? [];

  if (!scope) {
    return (
      <div className="p-4 text-sm text-muted-foreground" data-testid="dsh-plugins-no-workspace">
        {intl.formatMessage({ id: "settings.plugins.dsh.noWorkspace" })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="dsh-plugins-section">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">
            {intl.formatMessage({ id: "settings.plugins.dsh.title" })}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {intl.formatMessage({ id: "settings.plugins.dsh.description" })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={loading}
          data-testid="dsh-plugins-refresh"
        >
          <RefreshCw className="mr-1 size-4" />
          {intl.formatMessage({ id: "settings.plugins.dsh.refresh" })}
        </Button>
      </header>

      {overview && (
        <p className="text-xs text-muted-foreground" data-testid="dsh-runtime-versions">
          {intl.formatMessage(
            { id: "settings.plugins.dsh.runtime" },
            {
              // runtimeVersions 以包全名为键（后端按已核实依赖闭包产出），不是短名。
              dsh: overview.runtimeVersions["@deepseek-ai/dsh"] ?? "-",
              cordis: overview.runtimeVersions["@deepseek-ai/cordis"] ?? "-",
            },
          )}
        </p>
      )}

      {error && (
        <div
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
          data-testid="dsh-plugins-error"
          data-error-code={errorCode ?? ""}
        >
          {error}
        </div>
      )}

      {builtinEntries.length > 0 && (
        <section className="flex flex-col gap-2" data-testid="dsh-builtin-market">
          <h3 className="text-sm font-medium">
            {intl.formatMessage({ id: "settings.plugins.dsh.builtin.title" })}
          </h3>
          <p className="text-xs text-muted-foreground">
            {intl.formatMessage({ id: "settings.plugins.dsh.builtin.hint" })}
          </p>
          <ul className="flex flex-col gap-1">
            {builtinEntries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-2 rounded-md border p-2"
                data-testid="dsh-builtin-entry"
                data-package-name={entry.packageName ?? ""}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {entry.name}
                    {entry.version && (
                      <span className="ml-1 text-xs text-muted-foreground">v{entry.version}</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{entry.description}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {entry.packageName}
                    {entry.category ? ` · ${entry.category}` : ""}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={pending.has(`catalog:${builtin?.id}:${entry.id}`)}
                  onClick={() =>
                    builtin &&
                    void run({
                      kind: "prepare-catalog",
                      catalogId: builtin.id,
                      entryId: entry.id,
                    })
                  }
                  data-testid="dsh-builtin-install"
                >
                  {intl.formatMessage({ id: "settings.plugins.dsh.builtin.install" })}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {local && local.plugins.length > 0 && (
        <section className="flex flex-col gap-2" data-testid="dsh-local-plugins">
          <h3 className="text-sm font-medium">
            {intl.formatMessage({ id: "settings.plugins.dsh.local.title" })}
          </h3>
          <p className="text-xs text-muted-foreground">
            {intl.formatMessage({ id: "settings.plugins.dsh.local.hint" }, { home: local.home })}
          </p>
          <ul className="flex flex-col gap-1">
            {local.plugins.map((plugin) => (
              <li
                key={`${plugin.profile}:${plugin.packageName}`}
                className="flex items-center justify-between gap-2 rounded-md border p-2"
                data-testid="dsh-local-plugin"
                data-package-name={plugin.packageName}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {plugin.packageName}
                    <span className="ml-1 text-xs text-muted-foreground">v{plugin.version}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {plugin.profile}
                    {plugin.capabilities.length ? ` · ${plugin.capabilities.join(" / ")}` : ""}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  disabled={plugin.alreadyInstalled || pending.has(`local:${plugin.directory}`)}
                  onClick={() => void run({ kind: "import-local", directory: plugin.directory })}
                  data-testid="dsh-local-import"
                >
                  {plugin.alreadyInstalled
                    ? intl.formatMessage({ id: "settings.plugins.dsh.local.imported" })
                    : intl.formatMessage({ id: "settings.plugins.dsh.local.import" })}
                </Button>
              </li>
            ))}
          </ul>
          {local.diagnostics.length > 0 && (
            <ul className="flex flex-col gap-1" data-testid="dsh-local-diagnostics">
              {local.diagnostics.map((diagnostic) => (
                <li key={diagnostic.subject} className="text-xs text-muted-foreground">
                  <span className="font-mono">{diagnostic.subject}</span> {diagnostic.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">
          {intl.formatMessage({ id: "settings.plugins.dsh.sources.title" })}
        </h3>
        <div className="flex gap-2">
          <Input
            value={catalogUrl}
            onChange={(event) => setCatalogUrl(event.target.value)}
            placeholder={intl.formatMessage({ id: "settings.plugins.dsh.sources.placeholder" })}
            data-testid="dsh-catalog-url"
          />
          <Button onClick={() => void addCatalog()} disabled={!catalogUrl.trim()} data-testid="dsh-catalog-add">
            <Plus className="mr-1 size-4" />
            {intl.formatMessage({ id: "settings.plugins.dsh.sources.add" })}
          </Button>
        </div>
        {remoteCatalogs.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="dsh-catalogs-empty">
            {intl.formatMessage({ id: "settings.plugins.dsh.sources.empty" })}
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {remoteCatalogs.map((catalog) => (
              <li
                key={catalog.id}
                className="flex items-center justify-between rounded-md border p-2"
                data-testid="dsh-catalog-row"
                data-catalog-id={catalog.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{catalog.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{catalog.url}</p>
                  <p className="text-xs text-muted-foreground">
                    {intl.formatMessage(
                      { id: "settings.plugins.dsh.sources.counts" },
                      { entries: catalog.entryCount, diagnostics: catalog.diagnosticCount },
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void run({ kind: "refresh-catalog", catalogId: catalog.id })}
                    disabled={pending.has(`catalog:${catalog.id}`)}
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void run({ kind: "remove-catalog", catalogId: catalog.id })}
                    disabled={pending.has(`catalog:${catalog.id}`)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">
          {intl.formatMessage({ id: "settings.plugins.dsh.install.title" })}
        </h3>
        <div className="flex gap-2">
          <Input
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder={intl.formatMessage({ id: "settings.plugins.dsh.install.placeholder" })}
            data-testid="dsh-source-input"
          />
          <Button
            variant="outline"
            onClick={() => void prepareSource()}
            disabled={!source.trim()}
            data-testid="dsh-source-prepare"
          >
            {intl.formatMessage({ id: "settings.plugins.dsh.install.prepare" })}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">
          {intl.formatMessage({ id: "settings.plugins.dsh.installed.title" })}
        </h3>
        {loading && domains.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {intl.formatMessage({ id: "settings.plugins.dsh.loading" })}
          </p>
        ) : domains.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="dsh-domains-empty">
            {intl.formatMessage({ id: "settings.plugins.dsh.installed.empty" })}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {domains.map((domain) => (
              <DshDomainRow
                key={domain.domainId}
                domain={domain}
                busy={isDomainPending(pending, domain)}
                onAct={run}
                onConfirm={requestConfirmation}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DshDomainRow({
  domain,
  busy,
  onAct,
  onConfirm,
}: {
  domain: DshInstalledDomain;
  busy: boolean;
  onAct: (action: DshManagementAction) => Promise<void>;
  onConfirm: (options: { title: string; description?: string }) => Promise<boolean>;
}) {
  const { intl } = useZCodeIntl();
  const trust = trustChoiceFor(domain, domain.compatibility !== "incompatible");

  const uninstall = async () => {
    const keepData = await onConfirm({
      title: intl.formatMessage({ id: "settings.plugins.dsh.uninstall.confirm" }, { name: domain.domainId }),
      description: intl.formatMessage({ id: "settings.plugins.dsh.uninstall.confirmDetail" }),
    });
    if (!keepData) return;
    // 默认保留插件数据（deleteData=false）；删除数据必须显式选择，不能被默认动作覆盖。
    await onAct({ kind: "uninstall", domainId: domain.domainId, deleteData: false });
  };

  return (
    <li
      className="flex flex-col gap-2 rounded-md border p-3"
      data-testid="dsh-domain-row"
      data-domain-id={domain.domainId}
      data-domain-state={domain.state}
      data-compatibility={domain.compatibility}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{domain.domainId}</p>
          <p className="truncate text-xs text-muted-foreground">
            {domain.revision?.packageName ?? domain.domainId}
            {domain.revision?.manifest.version ? ` · ${domain.revision.manifest.version}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" data-testid="dsh-domain-state">
            {domain.state}
          </Badge>
          <Badge variant={domain.compatibility === "native-equivalent" ? "secondary" : "outline"}>
            {domain.compatibility}
          </Badge>
        </div>
      </div>

      {needsTrust(domain) && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2" data-testid="dsh-domain-trust">
          <p className="flex items-center gap-1 text-xs">
            <ShieldAlert className="size-3.5" />
            {intl.formatMessage({ id: "settings.plugins.dsh.trust.explain" })}
          </p>
          <Button
            size="sm"
            className="mt-2"
            disabled={busy || !trust}
            onClick={() => trust && void onAct({ kind: "grant", domainId: domain.domainId, trust })}
            data-testid="dsh-domain-grant"
          >
            {intl.formatMessage({ id: "settings.plugins.dsh.trust.grant" })}
          </Button>
        </div>
      )}

      {domain.diagnostics.length > 0 && (
        <ul className="flex flex-col gap-1" data-testid="dsh-domain-diagnostics">
          {domain.diagnostics.map((diagnostic) => (
            <li key={`${diagnostic.code}:${diagnostic.message}`} className="text-xs text-muted-foreground">
              <span className="font-mono">{diagnostic.code}</span> {diagnostic.message}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs">
          <Switch
            checked={domain.enabled}
            disabled={busy || !canToggle(domain)}
            onCheckedChange={(enabled) =>
              void onAct({ kind: "set-enabled", domainId: domain.domainId, enabled })
            }
            data-testid="dsh-domain-enabled"
          />
          {intl.formatMessage({ id: "settings.plugins.dsh.enabled" })}
        </label>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => void onAct({ kind: "update", domainId: domain.domainId })}
          data-testid="dsh-domain-update"
        >
          {intl.formatMessage({ id: "settings.plugins.dsh.update" })}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={busy || !domain.previousRevision}
          onClick={() => void onAct({ kind: "rollback", domainId: domain.domainId })}
          data-testid="dsh-domain-rollback"
        >
          {intl.formatMessage({ id: "settings.plugins.dsh.rollback" })}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => void uninstall()}
          data-testid="dsh-domain-uninstall"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}
