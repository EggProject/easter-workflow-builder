import { describe, expect, it } from 'vitest';
import { readBinaryRequestBody } from './read-binary-request-body.ts';

async function* chunksOf(...chunks: readonly unknown[]): AsyncIterable<unknown> {
  for (const chunk of chunks) {
    yield await chunk;
  }
}

describe('readBinaryRequestBody', () => {
  it('a korlátig érkező darabokat egy pufferbe fűzi, a nem puffer darabot kihagyja', async () => {
    const body = await readBinaryRequestBody(chunksOf(Buffer.from('ab'), 'szöveg', Buffer.from('c')), 3);
    expect(body).toStrictEqual({ kind: 'complete', bytes: Buffer.from('abc') });
  });

  it('a pontosan a korlátnyi törzs elfogadott, az eggyel hosszabb túl nagy', async () => {
    const fourBytes = Buffer.alloc(4);
    const oneByte = Buffer.alloc(1);
    const atLimit = await readBinaryRequestBody(chunksOf(fourBytes), 4);
    const overLimit = await readBinaryRequestBody(chunksOf(fourBytes, oneByte), 4);
    expect(atLimit).toStrictEqual({ kind: 'complete', bytes: fourBytes });
    expect(overLimit).toStrictEqual({ kind: 'too_large' });
  });

  it('az üres törzs üres puffer', async () => {
    expect(await readBinaryRequestBody(chunksOf(), 4)).toStrictEqual({ kind: 'complete', bytes: Buffer.alloc(0) });
  });
});
