import type { DshScope } from "@zcode/shared/dsh-compat";
import { dshAttachResultSchema } from "@zcode/shared/dsh-compat";
import type { IDshPluginService } from "./contract.js";

export async function exampleDshPluginService(
  service: IDshPluginService,
  scope: DshScope,
): Promise<void> {
  const { value } = await service.dispatch({
    scope,
    command: {
      kind: "attach",
      domainId: "example",
      attachmentId: "settings",
      clientMode: "desktop-continuous",
    },
  });
  const { attachment } = dshAttachResultSchema.parse(value);
  const subscription = service.onDynamicDshEvent({ scope, attachment })(() => {});
  try {
    await service.dispatch({
      scope,
      command: { kind: "invoke", attachment, callId: "plugins", request: { kind: "plugins" } },
    });
  } finally {
    subscription.dispose();
    await service.dispatch({ scope, command: { kind: "detach", attachment } });
  }
}
