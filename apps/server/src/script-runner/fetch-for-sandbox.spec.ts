import { once } from 'node:events';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fetchForSandbox } from './fetch-for-sandbox.ts';

// Helyi teszt szerver az operációs rendszer által kiosztott porton; valódi külső hívás nincs.
// A teszt szerver címe; a `beforeAll` tölti ki.
const target = { origin: '' };
const hangingRequests: IncomingMessage[] = [];

function ignoreClientAbort(): void {
  // A kliens bontásakor a kérés `error` (aborted) eseményt is kap; a teszt a bezárást figyeli.
}

function handle(request: IncomingMessage, response: ServerResponse): void {
  if (request.url === '/hello') {
    response.writeHead(200, { 'content-type': 'text/plain', 'x-teszt': 'igen' });
    response.end('szia');
    return;
  }
  if (request.url === '/echo') {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on('end', () => {
      response.writeHead(201);
      response.end(
        JSON.stringify({
          method: request.method,
          body: Buffer.concat(chunks).toString('utf8'),
          kliens: request.headers['x-kliens'],
          authorization: request.headers.authorization ?? 'nincs',
          cookie: request.headers.cookie ?? 'nincs',
        }),
      );
    });
    return;
  }
  if (request.url === '/redirect') {
    response.writeHead(302, { location: '/hello' });
    response.end();
    return;
  }
  hangingRequests.push(request);
}

const server: Server = createServer(handle);

beforeAll(async () => {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address: AddressInfo | string | null = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('a teszt szerver címe nem port');
  }
  target.origin = `http://127.0.0.1:${String(address.port)}`;
});

afterAll(async () => {
  server.closeAllConnections();
  server.close();
  await once(server, 'close');
});

function liveSignal(): AbortSignal {
  return new AbortController().signal;
}

// A teljesült eredmény JSON szövegének értelmezése; minden más eredmény a teszt hibája.
function resolvedValue(outcome: Awaited<ReturnType<typeof fetchForSandbox>>): unknown {
  if (outcome.kind !== 'resolved' || outcome.json === undefined) {
    throw new Error(`a kérés nem teljesült: ${JSON.stringify(outcome)}`);
  }
  return JSON.parse(outcome.json);
}

describe('fetchForSandbox', () => {
  it('GET kérésre a státuszt, a fejléceket és a törzset szövegként adja', async () => {
    const value = resolvedValue(await fetchForSandbox(`${target.origin}/hello`, undefined, liveSignal()));
    expect(value).toMatchObject({
      status: 200,
      headers: { 'content-type': 'text/plain', 'x-teszt': 'igen' },
      body: 'szia',
    });
  });

  it('a POST kérés a megadott metódussal, fejléccel és törzzsel megy, a gazda hitelesítő fejlécet és sütit nem tesz hozzá', async () => {
    const init = { method: 'POST', headers: { 'x-kliens': 'szkript' }, body: 'adat' };
    const value = resolvedValue(await fetchForSandbox(`${target.origin}/echo`, init, liveSignal()));
    expect(value).toMatchObject({ status: 201 });
    expect(value).toHaveProperty('body');
    const echoed: unknown = JSON.parse(
      typeof value === 'object' && value !== null && 'body' in value && typeof value.body === 'string'
        ? value.body
        : '',
    );
    expect(echoed).toStrictEqual({
      method: 'POST',
      body: 'adat',
      kliens: 'szkript',
      authorization: 'nincs',
      cookie: 'nincs',
    });
  });

  it('az átirányítást nem követi: a 302 státusz és a location fejléc látszik', async () => {
    const value = resolvedValue(await fetchForSandbox(`${target.origin}/redirect`, {}, liveSignal()));
    expect(value).toMatchObject({ status: 302, headers: { location: '/hello' }, body: '' });
  });

  it.each([
    ['file:', 'file:///etc/passwd'],
    ['data:', 'data:text/plain,szia'],
    ['ftp:', 'ftp://127.0.0.1/a'],
  ])('a nem HTTP séma elutasított, kérés nélkül: %s', async (scheme, url) => {
    await expect(fetchForSandbox(url, undefined, liveSignal())).resolves.toStrictEqual({
      kind: 'rejected',
      name: 'TypeError',
      message: `a fetch csak http: és https: címet fogad, ez ${scheme} séma`,
    });
  });

  it('az érvénytelen cím és a nem szöveg cím elutasított', async () => {
    await expect(fetchForSandbox('nem cím', undefined, liveSignal())).resolves.toStrictEqual({
      kind: 'rejected',
      name: 'TypeError',
      message: 'a fetch címe nem érvényes URL: nem cím',
    });
    await expect(fetchForSandbox(42, undefined, liveSignal())).resolves.toStrictEqual({
      kind: 'rejected',
      name: 'TypeError',
      message: 'a fetch címe szöveg kell legyen',
    });
  });

  it.each([
    ['ismeretlen mező', { credentials: 'include' }],
    ['nem szöveg fejléc', { headers: { a: 1 } }],
    ['nem objektum', 'GET'],
  ])('a nem dokumentált beállítás elutasított: %s', async (_name, init) => {
    await expect(fetchForSandbox(`${target.origin}/hello`, init, liveSignal())).resolves.toStrictEqual({
      kind: 'rejected',
      name: 'TypeError',
      message: 'a fetch beállítása csak method, headers és body mezőt tartalmazhat, szöveg értékkel',
    });
  });

  it('a hálózati hiba elutasított ígéret a gazda hiba típusnevével', async () => {
    const closed = createServer();
    closed.listen(0, '127.0.0.1');
    await once(closed, 'listening');
    const address: AddressInfo | string | null = closed.address();
    closed.close();
    await once(closed, 'close');
    const port = address !== null && typeof address !== 'string' ? address.port : 0;
    await expect(fetchForSandbox(`http://127.0.0.1:${String(port)}/`, undefined, liveSignal())).resolves.toStrictEqual({
      kind: 'rejected',
      name: 'TypeError',
      message: 'a hálózati kérés nem sikerült (TypeError)',
    });
  });

  it('a jel megszakítja a függő kérést, a szerver a kapcsolat bezárását látja', async () => {
    const controller = new AbortController();
    const pending = fetchForSandbox(`${target.origin}/hang`, undefined, controller.signal);
    await expect.poll(() => hangingRequests.length).toBe(1);
    const request = hangingRequests[0];
    if (request === undefined) {
      throw new Error('a függő kérés nem érkezett meg');
    }
    request.on('error', ignoreClientAbort);
    const closed = new Promise<void>((resolve) => {
      request.on('close', () => {
        resolve();
      });
    });
    controller.abort();
    await expect(pending).resolves.toMatchObject({ kind: 'rejected', name: 'TypeError' });
    await closed;
  });
});
