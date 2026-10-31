import type { ReactNode } from "react";
import { Blocks, CalendarClock } from "lucide-react";
import { TID_AUTOMATIONS_OPEN } from "@zcode/shared/test-ids";
import type { ProjectSidebarProps } from "@/project-sidebar/contract.js";
import { Button } from "@/components/ui/button.js";
import { ZCodeAboutLogo } from "@/components/ui/ZCodeAboutLogo.js";
import { NewTaskButtonGroup } from "@/NewTaskButtonGroup.js";
import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import { WebRemoteControlDeviceHeader } from "@/web-remote-control/WebRemoteControlDeviceHeader.js";

/** 内置面板注册顺序在 UI 侧的镜像（与 core panel-registry.ts 的 builtinPanels 保持一致）。 */
export const BUILTIN_SIDEBAR_PANEL_IDS = [
  "panel.tasks",
  "panel.automations",
  "panel.pluginStore",
] as const;

/**
 * 按 panels.order/disabled 计算面板渲染序：order 先行（未注册的 id 忽略、重复去重），
 * 未列出的按注册序排尾，disabled 整体剔除。语义与 core 的 applyPanelOrder 一致；
 * ui 不依赖 core，故在此本地镜像，两侧改动需同步。
 */
export function applySidebarPanelOrder(
  registeredIds: readonly string[],
  panelsUi?: { order: string[]; disabled: string[] },
): string[] {
  const registered = new Set(registeredIds);
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const id of panelsUi?.order ?? []) {
    if (seen.has(id) || !registered.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  for (const id of registeredIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  const disabled = new Set(panelsUi?.disabled ?? []);
  return ordered.filter((id) => !disabled.has(id));
}

/** 顶部导航只展示 Shell 的选中状态，路由仍由 Shell 唯一持有。 */
export function ProjectSidebarNavigation({
  props,
  onCreate,
}: {
  props: Pick<
    ProjectSidebarProps,
    | "isWebRemoteControl"
    | "onOpenAutomations"
    | "automationsActive"
    | "onOpenPluginStore"
    | "pluginStoreActive"
    | "webRemoteControlWorkspaceSwitcher"
    | "panelsUi"
  >;
  onCreate(): void;
}) {
  const { intl } = useZCodeIntl();
  const deviceNavigation = props.webRemoteControlWorkspaceSwitcher?.deviceNavigation;
  // 面板槽位：入口按 disabled 隐藏、按 order 排序；缺省 = 全启用 + 内置注册顺序（与现状一致）。
  const disabledPanels = new Set(props.panelsUi?.disabled ?? []);
  const navPanels: { id: string; node: ReactNode }[] = [];
  // 远控主视图会把自动化和插件市场重置为聊天；入口必须一同隐藏，避免点击无效。
  if (!props.isWebRemoteControl && props.onOpenAutomations && !disabledPanels.has("panel.automations")) {
    navPanels.push({
      id: "panel.automations",
      node: (
        <Button
          key="panel.automations"
          variant="ghost"
          size="lg"
          className={`w-full justify-start gap-2 ${props.automationsActive ? "bg-selected text-foreground" : ""}`}
          aria-pressed={props.automationsActive ?? false}
          data-testid={TID_AUTOMATIONS_OPEN}
          // 点击事件不能进入业务导航的可选 automationId 参数。
          onClick={() => props.onOpenAutomations?.()}
        >
          <CalendarClock className="size-4" />
          {intl.formatMessage({ id: "workspace.openScheduledSettings" })}
        </Button>
      ),
    });
  }
  if (!props.isWebRemoteControl && !disabledPanels.has("panel.pluginStore")) {
    navPanels.push({
      id: "panel.pluginStore",
      node: (
        <Button
          key="panel.pluginStore"
          variant="ghost"
          size="lg"
          className={`w-full justify-start gap-2 ${props.pluginStoreActive ? "bg-selected text-foreground" : ""}`}
          aria-pressed={props.pluginStoreActive ?? false}
          data-testid="plugin-store-sidebar-open"
          onClick={() => props.onOpenPluginStore?.()}
        >
          <Blocks className="size-4" />
          {intl.formatMessage({ id: "workspace.openPluginsSettings" })}
        </Button>
      ),
    });
  }
  const orderedNavPanelIds = applySidebarPanelOrder(
    navPanels.map((entry) => entry.id),
    props.panelsUi,
  );
  const navPanelNodeById = new Map(navPanels.map((entry) => [entry.id, entry.node]));
  return (
    <div
      data-testid="sidebar-primary-navigation"
      className={`flex flex-col gap-1 px-2 py-3 ${props.isWebRemoteControl && !deviceNavigation ? "max-md:pt-11" : ""}`}
    >
      {/* Relay V2 远控：当前电脑是项目与任务的上一级，放在导航首行；手机端占用原顶部留白。 */}
      {deviceNavigation ? <WebRemoteControlDeviceHeader navigation={deviceNavigation} /> : null}
      {/* Xbuild：桌面端在新建任务上方常驻品牌标题（与下方按钮的图标列对齐）。 */}
      {!props.isWebRemoteControl ? (
        <div className="flex items-center gap-2 pb-1 pl-2.5 pr-2.5 pt-0.5" aria-label="XBuild">
          <ZCodeAboutLogo className="size-4 shrink-0 text-foreground" />
          <span className="text-ui-lg font-semibold tracking-tight text-foreground">XBuild</span>
        </div>
      ) : null}
      <NewTaskButtonGroup onCreateTask={onCreate} />
      {/* 内置面板入口（自动化/插件市场）按 panelsUi 重排；任务列表区域在调用方按 disabled 隐藏。 */}
      {orderedNavPanelIds.map((id) => navPanelNodeById.get(id))}
    </div>
  );
}
