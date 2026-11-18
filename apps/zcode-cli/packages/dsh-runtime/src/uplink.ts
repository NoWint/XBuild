import { TypertGatewayError } from '@deepseek-ai/dsh-api-gateway';
import type { DshJson } from './contract.js';

const MAX_UPLINK_BYTES = 262_144;

/** One bounded carrier inbox; the native Gateway remains the value decoder. */
export class Uplink implements AsyncIterable<DshJson | undefined>, AsyncIterator<DshJson | undefined> {
  private readonly values: { value: DshJson | undefined; bytes: number }[] = [];
  private bytes = 0;
  private ended = false;
  private closed = false;
  private reader?: { resolve(value: IteratorResult<DshJson | undefined>): void; reject(error: unknown): void };
  private readonly abort = () => {
    this.reader?.reject(this.signal.reason);
    this.reader = undefined;
    this.release();
  };

  constructor(private readonly endpoint: string, private readonly signal: AbortSignal, private readonly cancel: (error: Error) => void) {
    signal.addEventListener('abort', this.abort, { once: true });
  }

  push(value: DshJson | undefined, end = false): void {
    this.signal.throwIfAborted();
    if (this.closed) return;
    if (this.ended) throw new Error('Native stream uplink is already half-closed');
    const bytes = Buffer.byteLength(JSON.stringify(value === undefined ? {} : { value }));
    if (this.bytes + bytes > MAX_UPLINK_BYTES) {
      // 无消费者的 uplink 不能无限堆积；用原始 Remote failure 取消，保留 Gateway 的失败语义。
      const error = new TypertGatewayError('gateway/uplink-overflow', this.endpoint, 'carrier uplink inbox overflow');
      this.cancel(error);
      throw error;
    }
    if (!end || value !== undefined) {
      if (this.reader) {
        this.reader.resolve({ value, done: false });
        this.reader = undefined;
      } else { this.values.push({ value, bytes }); this.bytes += bytes; }
    }
    if (end) {
      this.ended = true;
      if (this.reader) { this.reader.resolve({ value: undefined, done: true }); this.reader = undefined; }
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<DshJson | undefined> { return this; }

  next(): Promise<IteratorResult<DshJson | undefined>> {
    if (this.signal.aborted) return Promise.reject(this.signal.reason);
    const next = this.values.shift();
    if (next) { this.bytes -= next.bytes; return Promise.resolve({ value: next.value, done: false }); }
    if (this.closed || this.ended) return Promise.resolve({ value: undefined, done: true });
    return new Promise((resolve, reject) => { this.reader = { resolve, reject }; });
  }

  return(): Promise<IteratorResult<DshJson | undefined>> {
    this.reader?.resolve({ value: undefined, done: true });
    this.reader = undefined;
    this.release();
    return Promise.resolve({ value: undefined, done: true });
  }

  private release(): void {
    this.closed = true;
    this.values.length = 0;
    this.bytes = 0;
    this.signal.removeEventListener('abort', this.abort);
  }
}
