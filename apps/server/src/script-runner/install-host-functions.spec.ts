/* eslint-disable unicorn/no-null -- a port `cwd` mezőjének üres értéke a tárolt `null` (SPEC-014 5.3) */
import { readdirSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { RunContext, ScriptRunRequest } from '@easter-workflow-builder/engine';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runScript } from './run-script.ts';

// A `fetch` és a `files` gazda függvény a valódi futtatón át (SPEC-014 5.4, 6. szekció; AC8).
// Helyi teszt szerver az operációs rendszer által kiosztott porton; valódi külső hívás nincs.

const CONTEXT: RunContext = {
  input: {},
  steps: {},
  item: undefined,
  itemIndex: undefined,
  iteration: undefined,
  joinInputs: undefined,
  error: undefined,
};

// A teszt szerver címe; a `beforeAll` tölti ki.
const target = { origin: '' };
const hangingRequests: IncomingMessage[] = [];

function ignoreClientAbort(): void {
  // A kliens bontásakor a kérés `error` (aborted) eseményt is kap; a teszt a bezárást figyeli.
}

function handle(request: IncomingMessage, response: ServerResponse): void {
  if (request.url === '/hello') {
    response.writeHead(200, { 'x-teszt': 'igen' });
    response.end('szia');
    return;
  }
  if (request.url === '/big') {
    // A lépés 16 MB-os memória korlátjánál 1 MB-tal hosszabb törzs, megabájtos darabokban.
    response.writeHead(200);
    const chunk = Buffer.alloc(2 ** 20, 'a');
    const writeNext = (remaining: number): void => {
      if (remaining === 0) {
        response.end();
        return;
      }
      if (response.write(chunk)) {
        writeNext(remaining - 1);
        return;
      }
      response.once('drain', () => {
        writeNext(remaining - 1);
      });
    };
    response.on('error', ignoreClientAbort);
    writeNext(17);
    return;
  }
  if (request.url === '/redirect') {
    response.writeHead(302, { location: '/hello' });
    response.end();
    return;
  }
  // A függő kérés: a szerver nem válaszol, a kliens bontását a teszt figyeli.
  request.on('error', ignoreClientAbort);
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

// A teszt könyvtárai; a `beforeEach` tölti ki, tesztenként újat.
const fixtureDirectory = { base: '', root: '' };

beforeEach(async () => {
  fixtureDirectory.base = await mkdtemp(path.join(os.tmpdir(), 'install-host-functions-'));
  fixtureDirectory.root = path.join(fixtureDirectory.base, 'gyoker');
  await mkdir(fixtureDirectory.root);
  await mkdir(path.join(fixtureDirectory.base, 'kint'));
  await writeFile(path.join(fixtureDirectory.base, 'kint', 'titok.txt'), 'titok');
});

afterEach(async () => {
  await rm(fixtureDirectory.base, { recursive: true, force: true });
});

function request(source: string, overrides: Partial<ScriptRunRequest> = {}): ScriptRunRequest {
  return {
    source,
    runContext: CONTEXT,
    timeoutMs: 5000,
    cwd: fixtureDirectory.root,
    memoryLimitMb: 64,
    signal: new AbortController().signal,
    ...overrides,
  };
}

// A következő függő kérés megérkezése után a bontásának ígérete (a kliens megszakította a kérést).
// Objektumban, mert egy async függvényből visszaadott ígéretet a hívó már be is várna.
async function nextHangingRequest(): Promise<{ readonly closed: Promise<void> }> {
  const index = hangingRequests.length;
  await expect.poll(() => hangingRequests.length).toBeGreaterThan(index);
  const pending = hangingRequests[index];
  if (pending === undefined) {
    throw new Error('a függő kérés nem érkezett meg');
  }
  return {
    closed: new Promise<void>((resolve) => {
      pending.on('close', () => {
        resolve();
      });
    }),
  };
}

describe('installHostFunctions', () => {
  describe('fetch', () => {
    it('a GET kérés válasza { status, headers, body }', async () => {
      const result = await runScript(request(`const r = await fetch("${target.origin}/hello"); return r;`));
      expect(result).toMatchObject({
        kind: 'succeeded',
        output: { status: 200, headers: { 'x-teszt': 'igen' }, body: 'szia' },
      });
    });

    it('az átirányítást nem követi', async () => {
      const result = await runScript(
        request(`const r = await fetch("${target.origin}/redirect"); return [r.status, r.headers.location];`),
      );
      expect(result).toStrictEqual({ kind: 'succeeded', output: [302, '/hello'] });
    });

    it('a nem HTTP séma elutasítása el nem kapva script_evaluation_failed, elkapva a szkript kezeli', async () => {
      await expect(runScript(request('await fetch("file:///etc/passwd"); return 1;'))).resolves.toStrictEqual({
        kind: 'failed',
        errorKind: 'script_evaluation_failed',
        message: 'a szkript hibát dobott: TypeError: a fetch csak http: és https: címet fogad, ez file: séma',
      });
      await expect(
        runScript(request('try { await fetch("ftp://x/"); } catch (e) { return e instanceof Error; }')),
      ).resolves.toStrictEqual({ kind: 'succeeded', output: true });
    });

    it('cím nélkül TypeError, a beállítás dobó gettere a sandboxban dob', async () => {
      await expect(runScript(request('await fetch(); return 1;'))).resolves.toMatchObject({
        message: 'a szkript hibát dobott: TypeError: a fetch címe szöveg kell legyen',
      });
      await expect(
        runScript(
          request(`await fetch("${target.origin}/hello", { get method() { throw new RangeError("rossz"); } });`),
        ),
      ).resolves.toStrictEqual({
        kind: 'failed',
        errorKind: 'script_evaluation_failed',
        message: 'a szkript hibát dobott: RangeError: rossz',
      });
    });

    it('a lépés memória korlátjánál hosszabb válasz törzs elkapható TypeError, a gazda nem olvassa végig (T-015-12)', async () => {
      const source = `try { await fetch("${target.origin}/big"); return "olvasva"; } catch (e) { return e.name + ": " + e.message; }`;
      await expect(runScript(request(source, { memoryLimitMb: 16 }))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: 'TypeError: a válasz törzse nagyobb, mint a lépés memória korlátja',
      });
    });

    it('a határidőn függő válasz script_timed_out, és a kérés megszakad', async () => {
      const running = runScript(request(`await fetch("${target.origin}/hang"); return 1;`, { timeoutMs: 300 }));
      const { closed } = await nextHangingRequest();
      await expect(running).resolves.toStrictEqual({
        kind: 'failed',
        errorKind: 'script_timed_out',
        message: 'a szkript nem fejeződött be 300 ms alatt',
      });
      await closed;
    });

    it('a kérés külső megszakítása aborted, és a folyamatban lévő kérés megszakad', async () => {
      const controller = new AbortController();
      const running = runScript(
        request(`await fetch("${target.origin}/hang"); return 1;`, { signal: controller.signal, timeoutMs: 60_000 }),
      );
      const { closed } = await nextHangingRequest();
      controller.abort();
      await expect(running).resolves.toStrictEqual({ kind: 'aborted' });
      await closed;
    });
  });

  describe('files', () => {
    it('ír, olvas és listáz a cwd gyökér alatt', async () => {
      const source =
        'await files.writeText("a.txt", "árvíztűrő"); const text = await files.readText("a.txt"); const names = await files.list("."); return { text, names };';
      await expect(runScript(request(source))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: { text: 'árvíztűrő', names: ['a.txt'] },
      });
      await expect(readFile(path.join(fixtureDirectory.root, 'a.txt'), 'utf8')).resolves.toBe('árvíztűrő');
    });

    it('a lépés memória korlátjánál nagyobb fájl olvasása elkapható hiba (T-015-12)', async () => {
      await writeFile(path.join(fixtureDirectory.root, 'nagy.txt'), Buffer.alloc(17 * 2 ** 20, 'a'));
      const source =
        'try { await files.readText("nagy.txt"); return "olvasva"; } catch (e) { return e.name + ": " + e.message; }';
      await expect(runScript(request(source, { memoryLimitMb: 16 }))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: 'Error: a fájl nagyobb, mint a lépés memória korlátja: nagy.txt',
      });
    });

    it('a .. kivezetés és az abszolút útvonal elutasítva, a hibaüzenetben a gazda gyökere nincs', async () => {
      const outside = await runScript(request('await files.readText("../kint/titok.txt");'));
      expect(outside).toStrictEqual({
        kind: 'failed',
        errorKind: 'script_evaluation_failed',
        message: 'a szkript hibát dobott: Error: az útvonal a hozzáférés gyökerén kívülre mutat: ../kint/titok.txt',
      });
      const absolute = await runScript(request(`await files.list(${JSON.stringify(fixtureDirectory.base)});`));
      expect(absolute).toMatchObject({ kind: 'failed', errorKind: 'script_evaluation_failed' });
      const missing = await runScript(request('await files.readText("nincs.txt");'));
      expect(missing).toStrictEqual({
        kind: 'failed',
        errorKind: 'script_evaluation_failed',
        message: 'a szkript hibát dobott: Error: a fájl művelet nem sikerült (ENOENT): nincs.txt',
      });
      expect(JSON.stringify(missing)).not.toContain(fixtureDirectory.root);
    });

    it('a gyökéren kívülre mutató szimbolikus link olvasásra és írásra (szülő könyvtár link) elutasítva', async () => {
      await symlink(
        path.join(fixtureDirectory.base, 'kint', 'titok.txt'),
        path.join(fixtureDirectory.root, 'link.txt'),
      );
      await symlink(path.join(fixtureDirectory.base, 'kint'), path.join(fixtureDirectory.root, 'kint-link'));
      await expect(runScript(request('return await files.readText("link.txt");'))).resolves.toMatchObject({
        kind: 'failed',
        message: 'a szkript hibát dobott: Error: az útvonal a hozzáférés gyökerén kívülre mutat: link.txt',
      });
      await expect(runScript(request('await files.writeText("kint-link/uj.txt", "x");'))).resolves.toMatchObject({
        kind: 'failed',
        message: 'a szkript hibát dobott: Error: az útvonal a hozzáférés gyökerén kívülre mutat: kint-link/uj.txt',
      });
      await expect(readFile(path.join(fixtureDirectory.base, 'kint', 'uj.txt'), 'utf8')).rejects.toHaveProperty(
        'code',
        'ENOENT',
      );
    });

    it('a null cwd gyökere a szerver folyamat munkakönyvtára (csak listázás)', async () => {
      const result = await runScript(request('return await files.list(".");', { cwd: null }));
      expect(result).toStrictEqual({ kind: 'succeeded', output: readdirSync(process.cwd()) });
    });
  });

  describe('a lépés vége és a gazda hívások', () => {
    it('a várt gazda hívás utáni gazdára kijutó hiba script_evaluation_failed', async () => {
      const source =
        'await files.list("."); let o = {}; let c = o; for (let i = 0; i < 1e5; i++) { c.x = {}; c = c.x; } return JSON.stringify(o);';
      await expect(runScript(request(source))).resolves.toStrictEqual({
        kind: 'failed',
        errorKind: 'script_evaluation_failed',
        message: 'a szkript futása a gazda oldalon megszakadt (RangeError)',
      });
    });

    it('a nem várt gazda hívás késői eredménye a lebontás után nem dob, és a következő lépés hibátlan', async () => {
      await expect(runScript(request('files.list("."); return 1;'))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: 1,
      });
      await expect(runScript(request('return (await files.list(".")).length;'))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: 0,
      });
    });
  });
});
