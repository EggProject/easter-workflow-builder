import { randomUUID } from 'node:crypto';
import { buildStreamUrl, type StreamFrame } from '@easter-workflow-builder/protocol';
import { readStreamFrames } from './read-stream-frames.ts';

export interface OpenEventStream {
  readonly streamId: string;
  readonly frames: AsyncGenerator<StreamFrame>;
  close(): Promise<void>;
}

/**
 * `GET /events` feliratkozás (SPEC-012 5.1 3. lépés): a kapcsolat felépül, és a
 * függvény a `stream_ready` keret megérkezése után tér vissza. A futásokra
 * feliratkozni a hívó dolga (`PUT /api/streams/:streamId/subscriptions`).
 */
export async function openEventStream(baseUrl: string, signal: AbortSignal): Promise<OpenEventStream> {
  const streamId = `proba-${randomUUID()}`;
  const response = await fetch(`${baseUrl}${buildStreamUrl(streamId)}`, { signal });
  if (response.body === null) {
    throw new Error('A stream válasznak nincs törzse.');
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  const frames = readStreamFrames(reader);
  const ready = await frames.next();
  if (ready.done === true || ready.value.event !== 'stream_ready') {
    await reader.cancel();
    throw new Error('A stream első kerete nem a stream_ready.');
  }
  return {
    streamId,
    frames,
    close: () => reader.cancel(),
  };
}
