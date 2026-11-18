import { useState } from "react";
import { createRoot } from "react-dom/client";
import type { IPlatformService, ZCodeTaskMeta } from "@zcode/shared";
import { WorkspaceSidebarFooter } from "@/WorkspaceSidebarFooter.js";
import { ZCodeIntlProvider, useZCodeIntl } from "@/i18n/IntlProvider.js";
import { TooltipProvider } from "@/components/ui/tooltip.js";
import { Collapsible } from "@/components/ui/collapsible.js";
import { ProjectNodeContent } from "@/project-sidebar/ProjectNodeContent.js";
import { MemoTaskItem } from "@/TaskListItem.js";
import { CommandCenterDialog } from "@/command-center/CommandCenterDialog.js";
import { attachTaskListRowActivity } from "@/v4/taskListRowActivity.js";
import { ProjectSidebarNavigation } from "@/project-sidebar/ProjectSidebarNavigation.js";
import { NewTaskButtonGroup } from "@/NewTaskButtonGroup.js";
import { DesktopTopOverlay } from "@/DesktopTopOverlay.js";
import "@/styles.css";

const params = new URLSearchParams(location.search);
const theme = params.get("theme") === "dark" ? "dark" : "light";
const locale = params.get("locale") === "en-US" ? "en-US" : "zh-CN";
document.documentElement.className = `theme-zai-${theme}`;
const longTitle = "A long conversation and project title ".repeat(8);
const task: ZCodeTaskMeta = {
  taskId: "fixture-task",
  traceId: "00000000000000000000000000000000" as ZCodeTaskMeta["traceId"],
  workspacePath: "/fixture/workspace",
  title: longTitle,
  createdAt: 1,
  updatedAt: 1,
  mode: "default",
};
const workflowTask = attachTaskListRowActivity(
  { ...task, taskId: "workflow-task" },
  {
    phase: "completedSuccess",
    lastActivityAt: 1,
    hasBackgroundWork: true,
    workflowActivity: {
      runs: [
        {
          runId: "fixture-run",
          status: "running",
          currentPhase: "Review",
          agentsWorking: 1,
          phases: [{ name: "Review", status: "running" }],
        },
      ],
    },
  },
);
const attentionTask = attachTaskListRowActivity(
  { ...task, taskId: "attention-task" },
  {
    phase: "running",
    lastActivityAt: 1,
    hasBackgroundWork: false,
    pendingInteractions: { permissionCount: 1, userInputCount: 0 },
  },
);

// 只在浏览器验收中提供固定输入；真实组件仍执行自身菜单、查询和键盘逻辑。
function SidebarAcceptance() {
  const { intl } = useZCodeIntl();
  const [action, setAction] = useState("none");
  const [expanded, setExpanded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [draft, setDraft] = useState("unsent draft");
  const [createCount, setCreateCount] = useState(0);
  const surface = params.get("surface");
  const sharedTaskProps = {
    workspacePath: task.workspacePath,
    isPinned: true,
    isActive: false,
    isArchiveConfirming: false,
    onSelectTask: (taskId: string) => setAction(`select:${taskId}`),
    onArchiveTaskInline: (event: React.MouseEvent, taskId: string) => {
      event.stopPropagation();
      setAction(`archive:${taskId}`);
    },
    onCancelArchiveConfirm: () => {},
    onTogglePinTask: (taskId: string, pinned: boolean) => setAction(`pin:${taskId}:${pinned}`),
    onStartRenameTask: () => {},
    onArchiveTask: () => {},
    onMarkTaskAsUnread: () => {},
    intl,
  };
  return (
    <div className="relative flex h-screen w-72 max-w-full flex-col justify-end bg-sidebar">
      {surface === "navigation" ? (
        <>
          <div className="flex-1">
            <ProjectSidebarNavigation
              props={{
                isWebRemoteControl: params.get("remote") === "1",
                onOpenAutomations: () => setAction("navigation:automations"),
                onOpenPluginStore: () => setAction("navigation:plugins"),
                webRemoteControlWorkspaceSwitcher:
                  params.get("device") === "1"
                    ? {
                        deviceNavigation: {
                          deviceName: "Fixture computer",
                          devicePlatform: "darwin",
                          chooseOtherDevice: () => setAction("navigation:device"),
                        },
                        listWorkspaces: async () => {
                          throw new Error("Workspace IO is outside presentation acceptance");
                        },
                        switchWorkspace: async () => {},
                      }
                    : undefined,
              }}
              onCreate={() => {
                setCreateCount((value) => value + 1);
                setAction("navigation:create");
              }}
            />
            <section aria-label="Disabled New Task">
              <NewTaskButtonGroup disabled onCreateTask={() => setAction("disabled:create")} />
            </section>
          </div>
          {params.get("remote") === "1" && params.get("device") !== "1" ? (
            <DesktopTopOverlay
              workspaceAbsPath={task.workspacePath}
              isSidebarVisible
              isDesktop={false}
              updateReadyVersion={null}
              updateState={null}
              toggleSidebarShortcutLabel=""
              newTaskShortcutLabel=""
              goBackShortcutLabel=""
              goForwardShortcutLabel=""
              canTaskNavBack
              canTaskNavForward
              canGoBack
              canGoForward
              showNewTaskButton
              appLogoUrl=""
              platform={{} as IPlatformService}
              onToggleSidebar={() => setAction("navigation:toggle")}
              onCreateTask={() => setAction("navigation:top-create")}
              onGoBack={() => setAction("navigation:back")}
              onGoForward={() => setAction("navigation:forward")}
            />
          ) : null}
          <output data-testid="create-count">{createCount}</output>
        </>
      ) : null}
      {surface === "rows" ? (
        <div className="flex flex-1 flex-col gap-2 py-4">
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <ProjectNodeContent
              project={{
                id: "fixture-project",
                hostId: "local",
                name: longTitle,
                nameOverridden: false,
                roots: [{ rootPath: task.workspacePath, position: 0, isPrimary: true }],
                position: 0,
                pinned: false,
                deleted: false,
                createdAt: 1,
                updatedAt: 1,
              }}
              expanded={expanded}
              onExpandedChange={setExpanded}
              isOpen={expanded}
              editable
              canOpen
              dragEnabled={false}
              attributes={{
                role: "button",
                tabIndex: 0,
                "aria-disabled": false,
                "aria-pressed": undefined,
                "aria-roledescription": "sortable",
                "aria-describedby": "",
              }}
              listeners={undefined}
              setActivatorNodeRef={() => {}}
              tasks={[]}
              onCreate={() => setAction("project:create")}
              onViewFiles={() => setAction("project:files")}
              onEdit={() => setAction("project:edit")}
              onDelete={() => setAction("project:delete")}
              onPin={() => setAction("project:pin")}
              onMove={() => {}}
              onSelect={() => {}}
              refresh={async () => {}}
            />
          </Collapsible>
          <ul className="px-2">
            <MemoTaskItem
              {...sharedTaskProps}
              task={task}
              onOpenFileTree={() => setAction("task:files")}
            />
            <MemoTaskItem
              {...sharedTaskProps}
              task={{ ...task, taskId: "timeline-task" }}
              variant="timeline"
            />
            <MemoTaskItem {...sharedTaskProps} task={workflowTask} />
            <MemoTaskItem {...sharedTaskProps} task={attentionTask} />
          </ul>
        </div>
      ) : null}
      {surface === "search" ? (
        <>
          <input
            aria-label="Unsent draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="button" onClick={() => setSearchOpen(true)}>
            Open search
          </button>
          <CommandCenterDialog
            open={searchOpen}
            onOpenChange={setSearchOpen}
            workspaceAbsPath={task.workspacePath}
            workspaceTabs={[]}
            commands={[
              {
                id: "fixture-settings",
                sectionId: "configure",
                titleId: "settings.title",
                icon: "settings",
                keywords: ["preferences", "settings"],
                shortcut: "Ctrl+,",
                run: () => setAction("search:settings"),
              },
              {
                id: "fixture-unavailable",
                sectionId: "configure",
                titleId: "app.logout",
                icon: "logout",
                keywords: ["logout"],
                disabled: true,
                run: () => setAction("search:disabled"),
              },
            ]}
            onSelectTask={() => setAction("search:task")}
            onOpenCodeViewer={() => setAction("search:file")}
          />
        </>
      ) : null}
      <WorkspaceSidebarFooter
        theme={theme}
        localeMenuValue={locale}
        onLocaleChange={(value) => setAction(`locale:${value}`)}
        onThemeChange={(value) => setAction(`theme:${value}`)}
        onSettingsButtonClick={() => setAction("settings")}
        onLogout={() => setAction("logout")}
        isDesktop={params.get("mobile") !== "1"}
        user={
          params.get("guest") === "1"
            ? null
            : {
                id: params.get("id") ?? "12345678901234567890",
                username: "Alex",
                displayName: params.get("name") ?? "Alex",
              }
        }
      />
      <output data-testid="fixture-action">{action}</output>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <ZCodeIntlProvider initialLocale={locale}>
    <TooltipProvider>
      <SidebarAcceptance />
    </TooltipProvider>
  </ZCodeIntlProvider>,
);
