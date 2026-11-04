import { createServer, type Server } from 'node:http';
import process from 'node:process';
import { describe, expect, it } from 'vitest';
import { startProbeServer } from './start-probe-server.ts';

const KEEP_ALIVE = 'setInterval(() => {}, 1000)';

function listenOnFreePort(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('a teszt szerver nem kapott portot'));
        return;
      }
      resolve(address.port);
    });
  });
}

describe('startProbeServer', () => {
  it('reports-port: a gyermek EASTER_SERVER_PORT=0 értéket kap, és a jelentett portján érhető el', async () => {
    const script = [
      "const { createServer } = require('node:http');",
      "if (process.env.EASTER_SERVER_PORT !== '0') process.exit(9);",
      "const s = createServer((q, r) => r.end('{}'));",
      String.raw`s.listen(0, '127.0.0.1', () => process.stdout.write('EASTER_PROBE_PORT=' + s.address().port + '\n'));`,
      "process.on('SIGTERM', () => s.close(() => process.exit(0)));",
    ].join('\n');
    const server = await startProbeServer(
      { kind: 'reports-port', executable: process.execPath, args: ['-e', script] },
      process.env,
      [],
      new AbortController().signal,
    );
    const response = await fetch(`${server.baseUrl}/api/providers`);
    expect(response.status).toBe(200);
    await response.arrayBuffer();
    await server.stop();
  });

  it('reports-port: ha az első stdout sor nem portjelentés, hiba jön, és a gyermek leáll', async () => {
    await expect(
      startProbeServer(
        { kind: 'reports-port', executable: process.execPath, args: ['-e', `console.log('valami'); ${KEEP_ALIVE}`] },
        process.env,
        [],
        new AbortController().signal,
      ),
    ).rejects.toThrow('A szerver első stdout sora nem portjelentés: valami');
  });

  it('reports-port: a jelentés előtti megszakítás leállítja a gyermeket', async () => {
    const controller = new AbortController();
    const started = startProbeServer(
      { kind: 'reports-port', executable: process.execPath, args: ['-e', KEEP_ALIVE] },
      process.env,
      [],
      controller.signal,
    );
    controller.abort();
    await expect(started).rejects.toThrow('This operation was aborted');
  });

  it('assigned-port: a hívó által adott porton vár, a gyermek a kapott portot kapja', async () => {
    const httpServer = createServer((_request, response) => {
      response.end('[]');
    });
    const port = await listenOnFreePort(httpServer);
    try {
      const server = await startProbeServer(
        {
          kind: 'assigned-port',
          executable: process.execPath,
          args: ['-e', `if (process.env.EASTER_SERVER_PORT !== '${String(port)}') process.exit(9); ${KEEP_ALIVE}`],
          port,
        },
        process.env,
        [],
        new AbortController().signal,
      );
      expect(server.baseUrl).toBe(`http://127.0.0.1:${String(port)}`);
      await server.stop();
    } finally {
      await new Promise((resolve) => {
        httpServer.close(resolve);
      });
    }
  });
});
