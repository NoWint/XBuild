import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ZCodeIntlProvider } from "@/i18n/IntlProvider.js";
import { ConversationDraftEmptyState } from "@/v4/ConversationDraftEmptyState.js";
import { Button } from "@/components/ui/button.js";
import { Input } from "@/components/ui/input.js";
import { MessageResponse } from "@/components/ai-elements/message.js";
import { Shimmer } from "@/components/ai-elements/shimmer.js";
import { DEFAULT_CODE_PREVIEW_SETTINGS } from "@/lib/codePreviewSettings.js";
import { TooltipProvider } from "@/components/ui/tooltip.js";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu.js";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog.js";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover.js";
import "@/styles.css";

// 仅为真实共享组件的浏览器验收夹具；不装配产品服务，不伪造 Agent 或会话状态。
const params = new URLSearchParams(location.search);
const theme = params.get("theme") === "dark" ? "dark" : "light";
document.documentElement.className = `theme-zai-${theme}${theme === "dark" ? " dark" : ""}`;
const codePreviewSettings = { ...DEFAULT_CODE_PREVIEW_SETTINGS, fontSizePx: 14 };

function DesignAcceptance() {
  const [action, setAction] = useState("none");
  return (
    <main className="h-full overflow-auto bg-background p-4 font-sans text-ui-base text-foreground sm:p-8">
      <div className="xb-reading-rail mx-auto flex min-w-0 flex-col gap-6">
        <span className="text-ui-caption text-foreground-subtle">
          Shared component acceptance · synthetic actions, no Agent runtime
        </span>
        <ConversationDraftEmptyState />
        <div className="xb-thinking-trigger" data-testid="motion-status">
          <Shimmer as="span">Status</Shimmer>
        </div>
        <section className="flex flex-wrap items-center gap-2" aria-label="Controls">
          <Button data-testid="primary-action" onClick={() => setAction("primary")}>
            Continue
          </Button>
          <Button variant="outline">Secondary</Button>
          <Button variant="ghost">Quiet action</Button>
          <Button disabled>Unavailable</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="menu-trigger">
                Options
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => setAction("menu")}>Apply option</DropdownMenuItem>
              <DropdownMenuItem disabled>Disabled option</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Unavailable options</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem disabled>No enabled option</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Open popover</Button>
            </PopoverTrigger>
            <PopoverContent aria-label="Details">
              <Input aria-label="Popover name" placeholder="Name" />
            </PopoverContent>
          </Popover>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogTitle>Preferences</DialogTitle>
              <DialogDescription>Only presentation and focus are under test.</DialogDescription>
              <Input aria-label="Dialog name" placeholder="Name" />
            </DialogContent>
          </Dialog>
        </section>
        <Input aria-label="Editable control" placeholder="Add a name" />
        <section className="xb-assistant-content" data-testid="markdown-surface">
          <MessageResponse
            theme={theme === "dark" ? "zai-dark" : "zai-light"}
            codePreviewSettings={codePreviewSettings}
          >
            {
              "## Reading surface\n\nA response keeps its reading rhythm, with **emphasis** and `inline code`.\n\n```typescript\nconst value = 2;\n```\n\n| File | State |\n| --- | --- |\n| main.ts | Ready |"
            }
          </MessageResponse>
        </section>
        <output data-testid="action-result">{action}</output>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <ZCodeIntlProvider initialLocale={params.get("locale") === "zh-CN" ? "zh-CN" : "en-US"}>
    <TooltipProvider>
      <DesignAcceptance />
    </TooltipProvider>
  </ZCodeIntlProvider>,
);
