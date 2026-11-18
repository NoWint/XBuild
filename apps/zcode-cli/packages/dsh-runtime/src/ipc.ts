import { z } from 'zod';
import type { DshDomainErrorCode, DshJson } from './contract.js';

export const PROTOCOL_VERSION = 1;
export const MAX_FRAME_BYTES = 8 * 1024 * 1024;
export const STREAM_CHUNK_BYTES = 64 * 1024;
export const STARTUP_TIMEOUT_MS = 30_000;
export const SHUTDOWN_TIMEOUT_MS = 10_000;

const text = z.string().min(1);
const positive = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const base64 = z.string().regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
const notificationSchema = z.strictObject({ jsonrpc: z.literal('2.0'), method: text, params: z.json().optional() });
const remoteErrorSchema = z.strictObject({ code: text, message: z.string(), details: z.json() });
const remoteStreamSchema = z.discriminatedUnion('event', [
  z.strictObject({ peerId: text, streamId: text, event: z.literal('data'), value: z.json().optional() }),
  z.strictObject({ peerId: text, streamId: text, event: z.literal('end') }),
  z.strictObject({ peerId: text, streamId: text, event: z.literal('error'), error: remoteErrorSchema }),
]);
const streamSchema = z.discriminatedUnion('event', [
  z.strictObject({ streamId: text, event: z.literal('chunk'), chunkBase64: base64 }),
  z.strictObject({ streamId: text, event: z.literal('end') }),
  z.strictObject({ streamId: text, event: z.literal('error'), error: z.string() }),
]);
export const workspaceSchema = z.strictObject({
  workspacePath: text, workspaceIdentity: text.optional(), remoteSessionId: text.optional(),
});
export const workerOptionsSchema = z.strictObject({
  domainId: text, revision: text, generation: positive,
  workspace: workspaceSchema, profileDirectory: text, installationAnchor: text, dataDirectory: text,
  environment: z.record(text, z.string()),
});
export type WorkerOptions = z.infer<typeof workerOptionsSchema>;
export const hostOverlaySchema = z.array(z.record(z.string(), z.json()));
/**
 * 域自有跨重启配置层：只保存插件通过公开 ctx.loader.update() 改写的 config/disabled 增量。
 * 上游把这类变更留在内存 patch 里而不是配置文件 insert 行，缺少此层时重启即丢失。
 */
export const loaderStateSchema = z.array(z.strictObject({
  id: text,
  config: z.json().optional(),
  disabled: z.boolean().optional(),
}));
export type LoaderStateEntry = z.infer<typeof loaderStateSchema>[number];

export const requestSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('sdk'), method: text, params: z.json() }),
  z.strictObject({ kind: z.literal('plugins') }),
  z.strictObject({ kind: z.literal('client-graph') }),
  z.strictObject({ kind: z.literal('peer-open'), peerId: text, interactions: z.enum(['answer', 'none']) }),
  z.strictObject({ kind: z.literal('peer-close'), peerId: text }),
  z.strictObject({ kind: z.literal('remote-stream'), peerId: text, streamId: text, endpoint: text, payload: z.json() }),
  z.strictObject({ kind: z.literal('stream-uplink'), peerId: text, streamId: text, value: z.json().optional(), end: z.boolean().optional() }),
  z.strictObject({
    kind: z.literal('fetch'), peerId: text.optional(), path: text, method: z.enum(['GET', 'HEAD', 'POST']).optional(),
    headers: z.record(text, z.string()).optional(), bodyBase64: base64.optional(),
  }),
]);

const base = {
  protocolVersion: z.literal(PROTOCOL_VERSION), domainId: text, generation: positive,
};
const errorSchema = z.strictObject({ code: text, message: z.string(), details: z.json().optional() });
export type WireError = z.infer<typeof errorSchema>;
export const parentMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...base, type: z.literal('init'), options: workerOptionsSchema }),
  z.strictObject({ ...base, type: z.literal('request'), requestId: positive, request: requestSchema }),
  z.strictObject({ ...base, type: z.literal('cancel'), requestId: positive }),
  z.strictObject({ ...base, type: z.literal('stop') }),
  z.strictObject({ ...base, type: z.literal('exit') }),
  z.strictObject({ ...base, type: z.literal('host-result'), hostRequestId: positive, result: z.json() }),
  z.strictObject({ ...base, type: z.literal('host-error'), hostRequestId: positive, error: errorSchema }),
]);
export const childMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...base, type: z.literal('ready'), runtimeVersion: text }),
  z.strictObject({ ...base, type: z.literal('failed'), error: errorSchema, cleanupComplete: z.boolean() }),
  z.strictObject({ ...base, type: z.literal('stopped') }),
  z.strictObject({ ...base, type: z.literal('result'), requestId: positive, result: z.json() }),
  z.strictObject({ ...base, type: z.literal('error'), requestId: positive, error: errorSchema }),
  z.strictObject({ ...base, type: z.literal('settled'), requestId: positive }),
  z.strictObject({
    ...base, type: z.literal('event'), eventSeq: positive,
    kind: z.enum(['notification', 'stream']), payload: z.json(),
  }).superRefine((message, context) => {
    // JSON 合法不等于 carrier envelope 合法；未知嵌套字段不能推进 generation 的 event sequence。
    const schema = message.kind === 'notification' ? notificationSchema : z.union([streamSchema, remoteStreamSchema]);
    if (!schema.safeParse(message.payload).success) context.addIssue({ code: 'custom', message: 'Invalid native event carrier payload' });
  }),
  z.strictObject({ ...base, type: z.literal('host-request'), requestId: positive, hostRequestId: positive, method: text, params: z.json() }),
  z.strictObject({ ...base, type: z.literal('host-cancel'), hostRequestId: positive }),
]);
export type ParentMessage = z.infer<typeof parentMessageSchema>;
export type ChildMessage = z.infer<typeof childMessageSchema>;
export type Envelope = { protocolVersion: 1; domainId: string; generation: number };

export class DshDomainError extends Error {
  constructor(readonly code: DshDomainErrorCode, message: string, options?: ErrorOptions, readonly details?: DshJson) {
    super(message, options);
    this.name = 'DshDomainError';
  }
}

export function wireError(error: unknown, fallback: DshDomainErrorCode): WireError {
  return {
    code: error instanceof DshDomainError ? error.code : fallback,
    message: error instanceof Error ? error.message : String(error),
    ...(error instanceof DshDomainError && error.details !== undefined ? { details: error.details } : {}),
  };
}
export function fromWire(error: WireError, fallback: DshDomainErrorCode): DshDomainError {
  return new DshDomainError(fallback, error.message, undefined, error.details);
}

export function parseFrame<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> | undefined {
  try {
    const encoded = JSON.stringify(value);
    if (encoded === undefined || Buffer.byteLength(encoded) > MAX_FRAME_BYTES) return undefined;
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : undefined;
  } catch { return undefined; }
}

export function jsonValue(value: unknown): DshJson {
  // 上游返回对象可以有可选 undefined 字段；按 JSON 边界规范化，不能反射原生 Context 对象。
  const encoded = JSON.stringify(value);
  if (encoded === undefined || Buffer.byteLength(encoded) > MAX_FRAME_BYTES) {
    throw new DshDomainError('DSH_DOMAIN_PROTOCOL_ERROR', 'Native payload is not a bounded JSON value');
  }
  return z.json().parse(JSON.parse(encoded)) as DshJson;
}
