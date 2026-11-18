import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import type { IBroadcastService, IServiceAccessor } from "@zcode/services";
import type { IPlatformService } from "@zcode/shared";
import { FileTextIcon } from "lucide-react";
import { AssistantPreviewCards } from "@/AssistantPreviewCards.js";
import { PreviewPane } from "@/PreviewPane.js";
import { ContextAttachmentPill } from "@/v4/composer/ContextAttachmentPill.js";
import { PlatformProvider } from "@/hooks/usePlatform.js";
import { ServiceProvider } from "@/hooks/useServices.js";
import { TabStoreProvider } from "@/store/TabStoreProvider.js";
import { StoreProvider } from "@/store/StoreProvider.js";
import { ZCodeIntlProvider } from "@/i18n/IntlProvider.js";
import "@/styles.css";

const params = new URLSearchParams(location.search);
const locale = params.get("locale") === "en-US" ? "en-US" : "zh-CN";
localStorage.setItem("zcode-locale-preference", locale);
document.documentElement.className =
  params.get("theme") === "light" ? "theme-zai-light" : "theme-zai-dark dark";

// 浏览器夹具没有桌面宿主：整卡点击契约只关心回调是否恰好触发一次，
// 平台能力按 Web 形态关闭本地文件通道，fileService 固定回显存在。
const platform = { canOpenLocalFiles: false } as IPlatformService;
const broadcastService = {
  onMessage: () => ({ dispose() {} }),
  send: () => {},
} as unknown as IBroadcastService;
const services = {
  fileService: {
    checkFilesExist: async ({ paths }: { paths: string[] }) =>
      paths.map((path) => ({ path, exists: true })),
  },
} as unknown as IServiceAccessor;

const cards = [
  {
    id: "file-card",
    type: "file" as const,
    kind: "docx" as const,
    title: "项目 简介.docx",
    subtitleId: "chat.previewCards.docx" as const,
    path: "/workspace/项目 简介.docx",
  },
  {
    id: "web-card",
    type: "website" as const,
    title: "APC Local Preview",
    subtitleId: "chat.previewCards.website" as const,
    url: "http://127.0.0.1:41789/assistant-preview",
  },
];

function Fixture() {
  const [events, setEvents] = useState<string[]>([]);
  const [contextVisible, setContextVisible] = useState(true);
  const record = useCallback((event: string) => {
    setEvents((previous) => [...previous, event]);
  }, []);
  return (
    <main className="min-h-screen bg-background p-4 text-foreground">
      <div className="flex w-full max-w-2xl flex-col gap-3">
        <AssistantPreviewCards
          cards={cards}
          workspacePath="/workspace"
          onOpenCodeViewer={(source) => record(`codeViewer:${source.title}`)}
          onOpenBrowserUrl={(url) => record(`browserUrl:${url}`)}
        />
        {contextVisible ? (
          <ContextAttachmentPill
            icon={<FileTextIcon className="size-4 shrink-0" />}
            label="Context attachment"
            removeLabel="Remove context"
            onRemoveAll={() => {
              record("removeContext");
              setContextVisible(false);
            }}
          >
            <span>Context detail</span>
          </ContextAttachmentPill>
        ) : null}
        {params.get("surface") === "preview" ? (
          <div className="h-48 min-w-0">
            <PreviewPane
              source={{
                type: "text",
                title: "a-very-long-file-name-for-preview-header.ts",
                path: "/workspace/a/long/nested/directory/a-very-long-file-name-for-preview-header.ts",
                content: "const answer = 42;",
                language: "typescript",
              }}
              workspacePath="/workspace"
              onClose={() => {}}
              renderHeavyContent={false}
            />
          </div>
        ) : null}
      </div>
      <ol data-testid="preview-events" aria-label="preview events">
        {events.map((event, index) => (
          <li key={index}>{event}</li>
        ))}
      </ol>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <ZCodeIntlProvider initialLocale={locale}>
    <ServiceProvider services={services}>
      <PlatformProvider platform={platform}>
        <StoreProvider broadcastService={broadcastService}>
          <TabStoreProvider>
            <Fixture />
          </TabStoreProvider>
        </StoreProvider>
      </PlatformProvider>
    </ServiceProvider>
  </ZCodeIntlProvider>,
);
