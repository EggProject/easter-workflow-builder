import { describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import { wrapResponseAsStreamSink } from './wrap-response-as-stream-sink.ts';

function listen(server: ReturnType<typeof createServer>): Promise<number> {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('nincs port'));
        return;
      }
      resolve(address.port);
    });
  });
}

function close(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => {
      resolve();
    });
  });
}

describe('wrapResponseAsStreamSink', () => {
  it('a write hívásokat a ServerResponse.write metódusára továbbítja', async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const sink = wrapResponseAsStreamSink(response);
      sink.write('event: teszt\ndata: {}\n\n');
      sink.close();
    });
    const port = await listen(server);

    const response = await fetch(`http://127.0.0.1:${String(port)}`);
    const text = await response.text();
    expect(text).toBe('event: teszt\ndata: {}\n\n');

    await close(server);
  });

  it('a close hívás lezárja a választ', async () => {
    const server = createServer((_request, response) => {
      const sink = wrapResponseAsStreamSink(response);
      sink.close();
    });
    const port = await listen(server);

    const response = await fetch(`http://127.0.0.1:${String(port)}`);
    expect(response.ok).toBe(true);

    await close(server);
  });
});
