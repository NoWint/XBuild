import { describe, expect, it } from 'vitest';
import { childMessageSchema, parentMessageSchema, parseFrame, MAX_FRAME_BYTES } from '../src/ipc.js';

const envelope = { protocolVersion: 1, domainId: 'domain', generation: 3 };

describe('DSH process IPC schema boundary', () => {
  it('rejects nested notification drift rather than advertising a fabricated JSON-RPC envelope', () => {
    expect(parseFrame(childMessageSchema, { ...envelope, type: 'event', eventSeq: 1, kind: 'notification', payload: { jsonrpc: '1.0', method: 'session.event', extra: true } })).toBeUndefined();
  });
  it('rejects malformed and unknown stream fields before they can advance sequence', () => {
    expect(parseFrame(childMessageSchema, { ...envelope, type: 'event', eventSeq: 1, kind: 'stream', payload: { streamId: 'native', event: 'chunk', chunkBase64: 'not base64!!', unknown: true } })).toBeUndefined();
  });
  it('preserves absent Remote item values and requires exact Peer-scoped failure envelopes', () => {
    const frame = { ...envelope, type: 'event', eventSeq: 1, kind: 'stream' };
    expect(parseFrame(childMessageSchema, { ...frame, payload: { peerId: 'peer', streamId: 'remote', event: 'data' } })).toMatchObject({ payload: { event: 'data' } });
    expect(parseFrame(childMessageSchema, { ...frame, payload: { peerId: 'peer', streamId: 'remote', event: 'error', error: { code: 'native/failure', message: 'failed', details: {} } } })).toBeDefined();
    expect(parseFrame(childMessageSchema, { ...frame, payload: { peerId: 'peer', streamId: 'remote', event: 'data', unknown: true } })).toBeUndefined();
    expect(parseFrame(childMessageSchema, { ...frame, payload: { peerId: 'peer', streamId: 'remote', event: 'error', error: 'changed native error' } })).toBeUndefined();
  });
  it('refuses unsafe sequence ids, unknown frame fields and oversized JSON messages', () => {
    expect(parseFrame(childMessageSchema, { ...envelope, type: 'result', requestId: Number.MAX_SAFE_INTEGER + 1, result: null })).toBeUndefined();
    expect(parseFrame(childMessageSchema, { ...envelope, type: 'ready', runtimeVersion: '0.2.2-rc.3', credentials: 'must-not-cross' })).toBeUndefined();
    expect(parseFrame(childMessageSchema, { ...envelope, type: 'result', requestId: 1, result: 'x'.repeat(MAX_FRAME_BYTES) })).toBeUndefined();
  });
  it('rejects non-JSON host data and invalid binary request bodies before sending to native Connection', () => {
    expect(parseFrame(parentMessageSchema, { ...envelope, type: 'host-result', hostRequestId: 1, result: undefined })).toBeUndefined();
    expect(parseFrame(parentMessageSchema, { ...envelope, type: 'request', requestId: 1, request: { kind: 'fetch', path: '/api', method: 'POST', bodyBase64: '%%%invalid' } })).toBeUndefined();
  });
});
