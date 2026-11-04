import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { readCappedBytes } from './read-capped-bytes.ts';

// Három darab, egyenként kétbájtos folyam.
function chunkSource(): Readable {
  return Readable.from([Buffer.from([1, 2]), Buffer.from([3, 4]), Buffer.from([5, 6])]);
}

describe('readCappedBytes', () => {
  it('a határon belüli és a pontosan határnyi folyamot összefűzve adja', async () => {
    await expect(readCappedBytes(chunkSource(), 10)).resolves.toStrictEqual(Buffer.from([1, 2, 3, 4, 5, 6]));
    await expect(readCappedBytes(chunkSource(), 6)).resolves.toStrictEqual(Buffer.from([1, 2, 3, 4, 5, 6]));
  });

  it('a határnál hosszabb folyamra undefined, és a folyam lezárul', async () => {
    const source = chunkSource();
    await expect(readCappedBytes(source, 3)).resolves.toBeUndefined();
    expect(source.destroyed).toBe(true);
  });

  it('az üres folyam üres puffer', async () => {
    await expect(readCappedBytes(Readable.from([]), 0)).resolves.toStrictEqual(Buffer.alloc(0));
  });
});
