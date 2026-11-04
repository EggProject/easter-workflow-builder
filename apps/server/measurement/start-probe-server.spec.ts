import process from 'node:process';
import { describe, expect, it } from 'vitest';
import { startProbeServer } from './start-probe-server.ts';

const KEEP_ALIVE = 'setInterval(() => {}, 1000)';

describe('startProbeServer', () => {
  it('a gyermek EASTER_SERVER_PORT=0 értéket kap, és a jelentett portján érhető el', async () => {
    const script = [
      "const { createServer } = require('node:http');",
      "if (process.env.EASTER_SERVER_PORT !== '0') process.exit(9);",
      "const s = createServer((q, r) => r.end('{}'));",
      String.raw`s.listen(0, '127.0.0.1', () => process.stdout.write('EASTER_PROBE_PORT=' + s.address().port + '\n'));`,
      "process.on('SIGTERM', () => s.close(() => process.exit(0)));",
    ].join('\n');
    const server = await startProbeServer(
      { executable: process.execPath, args: ['-e', script] },
      process.env,
      [],
      new AbortController().signal,
    );
    const response = await fetch(`${server.baseUrl}/api/providers`);
    expect(response.status).toBe(200);
    await response.arrayBuffer();
    await server.stop();
  });

  it('ha az első stdout sor nem portjelentés, hiba jön, és a gyermek leáll', async () => {
    await expect(
      startProbeServer(
        { executable: process.execPath, args: ['-e', `console.log('valami'); ${KEEP_ALIVE}`] },
        process.env,
        [],
        new AbortController().signal,
      ),
    ).rejects.toThrow('A szerver első stdout sora nem portjelentés: valami');
  });

  it('a jelentés előtti megszakítás leállítja a gyermeket', async () => {
    const controller = new AbortController();
    const started = startProbeServer(
      { executable: process.execPath, args: ['-e', KEEP_ALIVE] },
      process.env,
      [],
      controller.signal,
    );
    controller.abort();
    await expect(started).rejects.toThrow('This operation was aborted');
  });
});
