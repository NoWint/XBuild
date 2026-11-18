import { type IDisposable } from "@zcode/rpc";
import {
  dshAttachResultSchema,
  dshDispatchSchema,
  dshEventSchema,
  dshEventSubscriptionSchema,
  dshResultSchema,
  type DshAttachment,
  type DshDispatch,
  type DshEvent,
  type DshScope,
} from "@zcode/shared/dsh-compat";
import {
  readTrustedZCodeAgentV4Connection,
  withTrustedZCodeAgentV4Connection,
  type ZCodeAgentV4ConnectionContext,
} from "../zcode-agent/zcodeAgentConnectionScope.js";
import type { IZCodeAgentService } from "../zcode-agent/zcodeAgent.js";
import type { IDshPluginService } from "./contract.js";

export function createDshPluginService(dependencies: {
  zcodeAgentService: Pick<IZCodeAgentService, "dispatchDshPlugin" | "onDynamicDshPluginEvent">;
}): IDshPluginService {
  return {
    async dispatch(params) {
      return dshResultSchema.parse(
        await dependencies.zcodeAgentService.dispatchDshPlugin(
          dshDispatchSchema.parse(stripDshConnectionCarrier(params)),
        ),
      );
    },
    onDynamicDshEvent(params) {
      return dependencies.zcodeAgentService.onDynamicDshPluginEvent(params);
    },
  };
}

export function createUnsupportedDshPluginService(): IDshPluginService {
  const unsupported = () => {
    throw Object.assign(new Error("DSH plugins are not supported by this backend"), {
      code: "dsh.unsupported",
    });
  };
  return {
    async dispatch() {
      return unsupported();
    },
    onDynamicDshEvent() {
      return unsupported();
    },
  };
}

/** 内部 connection carrier 只在可信 Host relay 消费，不进入严格原生 RPC envelope。 */
export function stripDshConnectionCarrier<T extends object>(params: T): T {
  const clean = { ...params };
  Reflect.deleteProperty(clean, "__zcodeTrustedV4Connection");
  return clean;
}

export function dshScopeMatches(left: DshScope, right: DshScope): boolean {
  return (
    (left.workspaceIdentity?.trim() || left.workspacePath) ===
      (right.workspaceIdentity?.trim() || right.workspacePath) &&
    left.remoteSessionId === right.remoteSessionId
  );
}

interface Lease {
  scope: DshScope;
  attachment: DshAttachment;
  subscription: IDisposable;
}

export interface DshPluginConnectionScope {
  readonly service: IDshPluginService;
  dispose(): Promise<void>;
}

export function createDshPluginConnectionScope(
  base: IDshPluginService,
  context: ZCodeAgentV4ConnectionContext,
  expectedScope?: DshScope,
): DshPluginConnectionScope {
  const leases = new Map<string, Lease>();
  const subscriptions = new Set<IDisposable>();
  const pendingAttachments = new Set<Promise<unknown>>();
  let closed = false;
  let closePromise: Promise<void> | undefined;
  const assertOpen = () => {
    if (closed) throw new Error("dsh.connection.closed");
  };
  const assertScope = (scope: DshScope) => {
    if (
      expectedScope &&
      (!dshScopeMatches(scope, expectedScope) ||
        scope.workspacePath !== expectedScope.workspacePath)
    )
      throw new Error("dsh.attachment.notOwned");
  };
  const assertOwned = (scope: DshScope, attachment: DshAttachment): Lease => {
    const lease = leases.get(attachment.token);
    if (
      !lease ||
      !dshScopeMatches(lease.scope, scope) ||
      lease.attachment.attachmentId !== attachment.attachmentId ||
      lease.attachment.domainId !== attachment.domainId ||
      lease.attachment.revision !== attachment.revision ||
      lease.attachment.generation !== attachment.generation
    ) {
      throw new Error("dsh.attachment.notOwned");
    }
    return lease;
  };
  const forward = (params: DshDispatch) => withTrustedZCodeAgentV4Connection(params, context);
  const release = async (lease: Lease) => {
    leases.delete(lease.attachment.token);
    lease.subscription.dispose();
    return base.dispatch(
      forward({ scope: lease.scope, command: { kind: "detach", attachment: lease.attachment } }),
    );
  };
  const service: IDshPluginService = {
    async dispatch(input) {
      assertOpen();
      const downstream =
        context.role === "trusted-host-relay" ? readTrustedZCodeAgentV4Connection(input) : null;
      const params = dshDispatchSchema.parse(stripDshConnectionCarrier(input));
      assertScope(params.scope);
      const command = params.command;
      if ("attachment" in command) assertOwned(params.scope, command.attachment);
      if (command.kind === "detach") {
        const lease = assertOwned(params.scope, command.attachment);
        return release(lease);
      }
      if (command.kind !== "attach") return base.dispatch(forward(params));
      // 原因：共享 CLI 用 attachmentId 寻址；必须先按可信连接命名，避免另一窗口复用 UI id
      // 替换已有 Peer。返回的真实租约仍原样交给调用方，所有后续操作按 token/generation 验证。
      const attaching = (async () => {
        const forwarded = dshDispatchSchema.parse({
          ...params,
          command: {
            ...command,
            attachmentId: `${context.connectionId}:${command.attachmentId}`,
            clientMode: downstream?.clientMode ?? context.clientMode,
          },
        });
        const result = dshResultSchema.parse(await base.dispatch(forward(forwarded)));
        const { attachment } = dshAttachResultSchema.parse(result.value);
        if (closed) {
          await base.dispatch(
            forward({ scope: params.scope, command: { kind: "detach", attachment } }),
          );
          throw new Error("dsh.connection.closed");
        }
        let invalidated = false;
        let subscription: IDisposable | undefined;
        subscription = base.onDynamicDshEvent({ scope: params.scope })((event) => {
          if (event.domainId !== attachment.domainId || !dshScopeMatches(event.scope, params.scope))
            return;
          if (event.kind === "lifecycle" && event.generation !== attachment.generation) {
            leases.delete(attachment.token);
            invalidated = true;
            subscription?.dispose();
          }
        });
        if (invalidated) {
          subscription.dispose();
          throw new Error("dsh.attachment.notOwned");
        }
        for (const lease of leases.values()) {
          if (
            lease.attachment.attachmentId === attachment.attachmentId &&
            lease.attachment.domainId === attachment.domainId &&
            dshScopeMatches(lease.scope, params.scope)
          ) {
            leases.delete(lease.attachment.token);
            lease.subscription.dispose();
          }
        }
        leases.set(attachment.token, { scope: params.scope, attachment, subscription });
        return result;
      })();
      pendingAttachments.add(attaching);
      try {
        return await attaching;
      } finally {
        pendingAttachments.delete(attaching);
      }
    },
    onDynamicDshEvent(input) {
      assertOpen();
      const params = dshEventSubscriptionSchema.parse(stripDshConnectionCarrier(input));
      assertScope(params.scope);
      if (params.attachment) assertOwned(params.scope, params.attachment);
      return (listener) => {
        assertOpen();
        if (params.attachment) assertOwned(params.scope, params.attachment);
        const upstream = base.onDynamicDshEvent(params)((candidate) => {
          const parsed = dshEventSchema.safeParse(candidate);
          if (!parsed.success || closed || !dshScopeMatches(parsed.data.scope, params.scope))
            return;
          const event: DshEvent = parsed.data;
          if (params.attachment) {
            const attachment = params.attachment;
            if (
              !leases.has(attachment.token) ||
              event.domainId !== attachment.domainId ||
              event.revision !== attachment.revision ||
              event.generation !== attachment.generation ||
              (event.attachmentId !== undefined && event.attachmentId !== attachment.attachmentId)
            )
              return;
          } else if (event.attachmentId !== undefined || event.kind !== "lifecycle") {
            return;
          }
          listener(event);
        });
        const subscription: IDisposable = {
          dispose() {
            upstream.dispose();
            subscriptions.delete(subscription);
          },
        };
        subscriptions.add(subscription);
        return subscription;
      };
    },
  };
  return {
    service,
    dispose() {
      if (closePromise) return closePromise;
      closed = true;
      for (const subscription of subscriptions) subscription.dispose();
      closePromise = (async () => {
        await Promise.allSettled(pendingAttachments);
        await Promise.allSettled([...leases.values()].map(release));
      })();
      return closePromise;
    },
  };
}

/** raw Agent RPC 同样经过租约 facade，不能成为第二条未受控的原生调用路径。 */
export function scopeDshAgentService(
  agent: IZCodeAgentService,
  scope: DshPluginConnectionScope,
): IZCodeAgentService {
  return new Proxy(agent, {
    get(target, property) {
      if (property === "dispatchDshPlugin") return scope.service.dispatch.bind(scope.service);
      if (property === "onDynamicDshPluginEvent")
        return scope.service.onDynamicDshEvent.bind(scope.service);
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
