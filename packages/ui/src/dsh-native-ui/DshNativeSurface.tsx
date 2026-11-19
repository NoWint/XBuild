import { useEffect, useRef, useState } from "react";
import type { DshScope } from "@zcode/shared/dsh-compat";
import { useWorkspaceServices } from "@/hooks/useWorkspaceServices.js";
import { logger } from "@/logger.js";
import { createDshNativeClient, type DshNativeClient } from "./native-client.js";
import { attachDshNativeTransport } from "./native-transport.js";

export interface DshNativeSurfaceProps {
  scope: DshScope;
  domainId: string;
  /** Native graph entry, not a Web URL. */
  entry: string;
  clientMode?: "desktop-continuous" | "web-remote-replayable";
}

/**
 * Mount an actual upstream DSH client graph into XBuild-owned DOM.
 * The service is resolved through the workspace-scoped Host; no direct window.zcode access.
 */
export function DshNativeSurface({ scope, domainId, entry, clientMode }: DshNativeSurfaceProps) {
  const services = useWorkspaceServices(scope.workspacePath, scope.remoteSessionId, scope.workspaceIdentity);
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let client: DshNativeClient | undefined;
    let unmount: (() => void) | undefined;
    const attachmentId = `native-ui-${globalThis.crypto.randomUUID()}`;
    setStatus("loading");
    setError(null);
    void (async () => {
      try {
        const transport = await attachDshNativeTransport({
          service: services.dshPluginService,
          scope,
          domainId,
          attachmentId,
          ...(clientMode ? { clientMode } : {}),
        });
        client = await createDshNativeClient({
          transport,
          graph: transport.clientGraph as unknown as import("./native-client.js").DshNativeClientGraph,
        });
        if (disposed) {
          await client.dispose();
          return;
        }
        // The original DSH entry fiber owns its surface; XBuild supplies the root slot.
        // Importing this entry materializes the original module factory, not a proxy card.
        await client.import(entry);
        if (!containerRef.current) throw new Error("Native UI root is not mounted");
        const renderer = client.context.get("uiRenderer") as {
          mount(container: HTMLElement): () => void;
        } | undefined;
        if (!renderer) throw new Error("The DSH client graph does not provide its native renderer");
        unmount = renderer.mount(containerRef.current);
        containerRef.current.dataset.dshEntry = entry;
        setStatus("ready");
      } catch (cause) {
        if (disposed) return;
        logger.warn("[dsh] native surface failed", { domainId, entry, error: String(cause) });
        setError(cause instanceof Error ? cause.message : String(cause));
        setStatus("error");
      }
    })();
    return () => {
      disposed = true;
      unmount?.();
      void client?.dispose().catch((cause: unknown) => {
        logger.warn("[dsh] native surface cleanup failed", { error: String(cause) });
      });
    };
  }, [clientMode, domainId, entry, scope, services]);

  return (
    <div className="flex flex-col gap-2" data-testid="dsh-native-surface">
      <div
        ref={containerRef}
        data-testid="dsh-native-root"
        data-native-entry={entry}
        className="min-h-0"
      />
      {status === "loading" && <p className="text-sm text-muted-foreground">Loading native interface…</p>}
      {status === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
