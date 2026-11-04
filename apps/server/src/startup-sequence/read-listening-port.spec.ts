import { createServer } from 'node:net';
import { describe, expect, it } from 'vitest';
import { readListeningPort } from './read-listening-port.ts';

describe('readListeningPort', () => {
  it('a 0 portra kötött szerver operációs rendszer által kiosztott portját adja', async () => {
    const server = createServer();
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    try {
      expect(readListeningPort(server)).toBeGreaterThan(0);
    } finally {
      await new Promise((resolve) => {
        server.close(resolve);
      });
    }
  });

  it('a nem IP címen (szöveges cím) és a még nem figyelő (null) szervernél kivételt dob', () => {
    expect(() => readListeningPort({ address: () => 'easter.sock' })).toThrow(
      'A szerver nem IP porton figyel (cím: easter.sock).',
    );
    // eslint-disable-next-line unicorn/no-null -- a Node `address()` a figyelés előtt valódi `null` értéket ad
    expect(() => readListeningPort({ address: () => null })).toThrow('A szerver nem IP porton figyel (cím: null).');
  });
});
