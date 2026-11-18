import { z } from "zod";
import {
  dshAttachmentSchema, dshClientModeSchema, dshClientRequestSchema, dshGrantSchema,
  dshIdentifierSchema, dshJsonSchema, dshPositiveSchema, dshScopeSchema,
  dshSourceSchema, dshTextSchema, DSH_LIMITS,
} from "./values.js";

export const DSH_METHODS = { dispatch: "plugins/dsh/dispatch", event: "plugins/dsh/event" } as const;
const domain = { domainId: dshIdentifierSchema };
const attached = { attachment: dshAttachmentSchema };
export const dshCommandSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("overview") }),
  z.strictObject({ kind: z.literal("add-catalog"), url: dshTextSchema }),
  z.strictObject({ kind: z.literal("refresh-catalog"), catalogId: dshIdentifierSchema }),
  z.strictObject({ kind: z.literal("remove-catalog"), catalogId: dshIdentifierSchema }),
  z.strictObject({
    kind: z.literal("prepare"), domainId: dshIdentifierSchema.optional(),
    source: z.union([dshTextSchema, dshSourceSchema]).optional(),
    catalogId: dshIdentifierSchema.optional(), entryId: dshIdentifierSchema.optional(),
    baseBundles: z.array(dshTextSchema).max(1024).optional(),
    configPatches: z.array(dshJsonSchema).max(10_000).optional(),
  }).refine((value) => value.source !== undefined
    ? value.catalogId === undefined && value.entryId === undefined
    : value.catalogId !== undefined && value.entryId !== undefined,
  "Select an explicit source or a catalog entry"),
  z.strictObject({ kind: z.literal("grant"), ...domain, grant: dshGrantSchema }),
  z.strictObject({ kind: z.literal("set-enabled"), ...domain, enabled: z.boolean() }),
  z.strictObject({ kind: z.literal("configure"), ...domain, patches: z.array(dshJsonSchema).max(10_000) }),
  z.strictObject({ kind: z.literal("update"), ...domain }),
  z.strictObject({ kind: z.literal("rollback"), ...domain, revision: dshIdentifierSchema.optional() }),
  z.strictObject({ kind: z.literal("uninstall"), ...domain, deleteData: z.boolean().optional() }),
  z.strictObject({ kind: z.literal("attach"), ...domain, attachmentId: dshIdentifierSchema, clientMode: dshClientModeSchema }),
  z.strictObject({ kind: z.literal("detach"), ...attached }),
  z.strictObject({ kind: z.literal("invoke"), ...attached, callId: dshIdentifierSchema, request: dshClientRequestSchema }),
  z.strictObject({ kind: z.literal("cancel"), ...attached, callId: dshIdentifierSchema }),
  z.strictObject({ kind: z.literal("answer"), ...attached, hostRequestId: dshIdentifierSchema, result: dshJsonSchema }),
  z.strictObject({ kind: z.literal("events"), ...attached, afterSequence: z.number().int().nonnegative() }),
]);
export type DshCommand = z.infer<typeof dshCommandSchema>;
export const dshDispatchSchema = z.strictObject({
  scope: dshScopeSchema, command: dshCommandSchema,
  traceId: dshTextSchema.optional(),
});
export type DshDispatch = z.infer<typeof dshDispatchSchema>;
export const dshResultSchema = z.strictObject({ value: dshJsonSchema });
export type DshResult = z.infer<typeof dshResultSchema>;

export const dshEventSchema = z.strictObject({
  scope: dshScopeSchema, domainId: dshIdentifierSchema,
  revision: dshIdentifierSchema, generation: dshPositiveSchema,
  attachmentId: dshIdentifierSchema.optional(),
  sequence: dshPositiveSchema,
  kind: z.enum(["notification", "stream", "host-request", "host-request-cancelled", "call-settled", "lifecycle"]),
  payload: dshJsonSchema,
});
export type DshEvent = z.infer<typeof dshEventSchema>;
export const dshPendingQuestionSchema = z.strictObject({
  hostRequestId: dshIdentifierSchema, callId: dshIdentifierSchema,
  method: dshTextSchema, params: dshJsonSchema,
});
export type DshPendingQuestion = z.infer<typeof dshPendingQuestionSchema>;
export const dshReplaySchema = z.strictObject({
  events: z.array(dshEventSchema).max(DSH_LIMITS.replayEvents),
  nextSequence: z.number().int().nonnegative(),
  gap: z.boolean(),
  questions: z.array(dshPendingQuestionSchema).max(1024).default([]),
});
export type DshReplay = z.infer<typeof dshReplaySchema>;
export const dshAttachResultSchema = z.strictObject({
  attachment: dshAttachmentSchema,
  clientGraph: dshJsonSchema,
  nativeUi: z.boolean(),
  runtimeVersion: dshTextSchema,
});
export type DshAttachResult = z.infer<typeof dshAttachResultSchema>;
export const dshEventSubscriptionSchema = z.strictObject({
  scope: dshScopeSchema,
  attachment: dshAttachmentSchema.optional(),
});
export type DshEventSubscription = z.infer<typeof dshEventSubscriptionSchema>;
