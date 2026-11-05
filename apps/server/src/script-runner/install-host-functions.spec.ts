/* eslint-disable unicorn/no-null -- a port `cwd` mezőjének üres értéke a tárolt `null` (SPEC-014 5.3) */
import { readdirSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, symlink, truncate, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { RunContext, ScriptRunRequest } from '@easter-workflow-builder/engine';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildSandboxRunRequest } from './build-sandbox-run-request.ts';
import { runScript } from './run-script.ts';

// A szkript folyamatában futó `runScript` közvetlenül, a szülő kérés leképezésével (SPEC-017 4.2).
function run(scriptRequest: ScriptRunRequest): ReturnType<typeof runScript> {
  return runScript(buildSandboxRunRequest(scriptRequest, Date.now()));
}

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

// A 300 MB-os válasz mérete MB-ban és az elküldött bájtok száma.
const HUGE_RESPONSE_MB = 300;
const hugeResponse = { writtenBytes: 0 };

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
  if (request.url === '/huge') {
    // A 300 MB-os válasz (research `2026-11-04-szkript-csomopont.md` 10.3: a plafon előtt a
    // szerver folyamatot leállította); az elküldött bájtokat a teszt számolja.
    response.writeHead(200);
    const chunk = Buffer.alloc(2 ** 20, 'a');
    const writeNext = (remaining: number): void => {
      if (remaining === 0 || response.destroyed) {
        response.end();
        return;
      }
      hugeResponse.writtenBytes += chunk.byteLength;
      if (response.write(chunk)) {
        writeNext(remaining - 1);
        return;
      }
      response.once('drain', () => {
        writeNext(remaining - 1);
      });
    };
    response.on('error', ignoreClientAbort);
    writeNext(HUGE_RESPONSE_MB);
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
    fetchResponseLimitMb: null,
    fileReadLimitMb: null,
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
      const result = await run(request(`const r = await fetch("${target.origin}/hello"); return r;`));
      expect(result).toMatchObject({
        kind: 'succeeded',
        output: { status: 200, headers: { 'x-teszt': 'igen' }, body: 'szia' },
      });
    });

    it('az átirányítást nem követi', async () => {
      const result = await run(
        request(`const r = await fetch("${target.origin}/redirect"); return [r.status, r.headers.location];`),
      );
      expect(result).toStrictEqual({ kind: 'succeeded', output: [302, '/hello'] });
    });

    it('a nem HTTP séma elutasítása el nem kapva script_evaluation_failed, elkapva a szkript kezeli', async () => {
      await expect(run(request('await fetch("file:///etc/passwd"); return 1;'))).resolves.toStrictEqual({
        kind: 'failed',
        errorKind: 'script_evaluation_failed',
        message: 'a szkript hibát dobott: TypeError: a fetch csak http: és https: címet fogad, ez file: séma',
      });
      await expect(
        run(request('try { await fetch("ftp://x/"); } catch (e) { return e instanceof Error; }')),
      ).resolves.toStrictEqual({ kind: 'succeeded', output: true });
    });

    it('cím nélkül TypeError, a beállítás dobó gettere a sandboxban dob', async () => {
      await expect(run(request('await fetch(); return 1;'))).resolves.toMatchObject({
        message: 'a szkript hibát dobott: TypeError: a fetch címe szöveg kell legyen',
      });
      await expect(
        run(request(`await fetch("${target.origin}/hello", { get method() { throw new RangeError("rossz"); } });`)),
      ).resolves.toStrictEqual({
        kind: 'failed',
        errorKind: 'script_evaluation_failed',
        message: 'a szkript hibát dobott: RangeError: rossz',
      });
    });

    it('a lépés memória korlátjánál hosszabb válasz törzs elkapható TypeError, a gazda nem olvassa végig (T-015-12)', async () => {
      const source = `try { await fetch("${target.origin}/big"); return "olvasva"; } catch (e) { return e.name + ": " + e.message; }`;
      await expect(
        run(request(source, { memoryLimitMb: 16, fetchResponseLimitMb: null, fileReadLimitMb: null })),
      ).resolves.toStrictEqual({
        kind: 'succeeded',
        output: 'TypeError: a válasz törzse nagyobb, mint a lépés olvasási plafonja (fetchResponseLimitMb)',
      });
    });

    it('a 300 MB-os válasz az alapértelmezett olvasási plafonon (50 MB) elkapható TypeError, a gazda nem olvassa végig, és a szerver folyamat fut tovább (SPEC-014 5.4)', async () => {
      hugeResponse.writtenBytes = 0;
      const source = `try { await fetch("${target.origin}/huge"); return "olvasva"; } catch (e) { return e.name + ": " + e.message; }`;
      const result = await run(
        request(source, { memoryLimitMb: null, fetchResponseLimitMb: null, fileReadLimitMb: null }),
      );
      expect(result).toStrictEqual({
        kind: 'succeeded',
        output: 'TypeError: a válasz törzse nagyobb, mint a lépés olvasási plafonja (fetchResponseLimitMb)',
      });
      expect(hugeResponse.writtenBytes).toBeLessThan(HUGE_RESPONSE_MB * 2 ** 20);
      await expect(run(request('return 1;'))).resolves.toStrictEqual({ kind: 'succeeded', output: 1 });
    });

    it('a csomópont fetchResponseLimitMb mezője felülírja az alapértéket, a fájl plafonját nem érinti', async () => {
      await writeFile(path.join(fixtureDirectory.root, 'ket-mb.txt'), Buffer.alloc(2 * 2 ** 20, 'a'));
      const source =
        `const out = []; try { await fetch("${target.origin}/big"); out.push("olvasva"); } catch (e) { out.push(e.name); }` +
        ' out.push((await files.readText("ket-mb.txt")).length); return out;';
      await expect(
        run(request(source, { memoryLimitMb: 64, fetchResponseLimitMb: 1, fileReadLimitMb: null })),
      ).resolves.toStrictEqual({ kind: 'succeeded', output: ['TypeError', 2 * 2 ** 20] });
    });

    it('a határidőn függő válasz script_timed_out, és a kérés megszakad', async () => {
      const running = run(request(`await fetch("${target.origin}/hang"); return 1;`, { timeoutMs: 300 }));
      const { closed } = await nextHangingRequest();
      await expect(running).resolves.toStrictEqual({
        kind: 'failed',
        errorKind: 'script_timed_out',
        message: 'a szkript nem fejeződött be 300 ms alatt',
      });
      await closed;
    });
  });

  describe('files', () => {
    it('ír, olvas és listáz a cwd gyökér alatt', async () => {
      const source =
        'await files.writeText("a.txt", "árvíztűrő"); const text = await files.readText("a.txt"); const names = await files.list("."); return { text, names };';
      await expect(run(request(source))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: { text: 'árvíztűrő', names: ['a.txt'] },
      });
      await expect(readFile(path.join(fixtureDirectory.root, 'a.txt'), 'utf8')).resolves.toBe('árvíztűrő');
    });

    it('a lépés memória korlátjánál nagyobb fájl olvasása elkapható hiba (T-015-12)', async () => {
      await writeFile(path.join(fixtureDirectory.root, 'nagy.txt'), Buffer.alloc(17 * 2 ** 20, 'a'));
      const source =
        'try { await files.readText("nagy.txt"); return "olvasva"; } catch (e) { return e.name + ": " + e.message; }';
      await expect(
        run(request(source, { memoryLimitMb: 16, fetchResponseLimitMb: null, fileReadLimitMb: null })),
      ).resolves.toStrictEqual({
        kind: 'succeeded',
        output: 'Error: a fájl nagyobb, mint a lépés olvasási plafonja (fileReadLimitMb): nagy.txt',
      });
    });

    it('a 300 MB-os fájl az alapértelmezett olvasási plafonon (50 MB) elkapható hiba (SPEC-014 5.4)', async () => {
      // Ritka fájl: a 300 MB a lemezen nem foglal helyet, az olvasás viszont 300 MB-ot adna.
      await writeFile(path.join(fixtureDirectory.root, 'ritka.bin'), '');
      await truncate(path.join(fixtureDirectory.root, 'ritka.bin'), 300 * 2 ** 20);
      const source =
        'try { await files.readText("ritka.bin"); return "olvasva"; } catch (e) { return e.name + ": " + e.message; }';
      await expect(
        run(request(source, { memoryLimitMb: null, fetchResponseLimitMb: null, fileReadLimitMb: null })),
      ).resolves.toStrictEqual({
        kind: 'succeeded',
        output: 'Error: a fájl nagyobb, mint a lépés olvasási plafonja (fileReadLimitMb): ritka.bin',
      });
    });

    it('a csomópont fileReadLimitMb mezője felülírja az alapértéket: 1 MB-on a 2 MB-os fájl hiba, 3 MB-on olvasható', async () => {
      await writeFile(path.join(fixtureDirectory.root, 'ket-mb.txt'), Buffer.alloc(2 * 2 ** 20, 'a'));
      const source = 'try { return (await files.readText("ket-mb.txt")).length; } catch (e) { return e.name; }';
      await expect(run(request(source, { fileReadLimitMb: 1 }))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: 'Error',
      });
      await expect(run(request(source, { fileReadLimitMb: 3 }))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: 2 * 2 ** 20,
      });
    });

    it('a .. kivezetés és az abszolút útvonal elutasítva, a hibaüzenetben a gazda gyökere nincs', async () => {
      const outside = await run(request('await files.readText("../kint/titok.txt");'));
      expect(outside).toStrictEqual({
        kind: 'failed',
        errorKind: 'script_evaluation_failed',
        message: 'a szkript hibát dobott: Error: az útvonal a hozzáférés gyökerén kívülre mutat: ../kint/titok.txt',
      });
      const absolute = await run(request(`await files.list(${JSON.stringify(fixtureDirectory.base)});`));
      expect(absolute).toMatchObject({ kind: 'failed', errorKind: 'script_evaluation_failed' });
      const missing = await run(request('await files.readText("nincs.txt");'));
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
      await expect(run(request('return await files.readText("link.txt");'))).resolves.toMatchObject({
        kind: 'failed',
        message: 'a szkript hibát dobott: Error: az útvonal a hozzáférés gyökerén kívülre mutat: link.txt',
      });
      await expect(run(request('await files.writeText("kint-link/uj.txt", "x");'))).resolves.toMatchObject({
        kind: 'failed',
        message: 'a szkript hibát dobott: Error: az útvonal a hozzáférés gyökerén kívülre mutat: kint-link/uj.txt',
      });
      await expect(readFile(path.join(fixtureDirectory.base, 'kint', 'uj.txt'), 'utf8')).rejects.toHaveProperty(
        'code',
        'ENOENT',
      );
    });

    it('a null cwd gyökere a szerver folyamat munkakönyvtára (csak listázás)', async () => {
      const result = await run(request('return await files.list(".");', { cwd: null }));
      expect(result).toStrictEqual({ kind: 'succeeded', output: readdirSync(process.cwd()) });
    });
  });

  describe('a lépés vége és a gazda hívások', () => {
    it('a várt gazda hívás utáni gazdára kijutó hiba script_evaluation_failed', async () => {
      const source =
        'await files.list("."); let o = {}; let c = o; for (let i = 0; i < 1e5; i++) { c.x = {}; c = c.x; } return JSON.stringify(o);';
      await expect(run(request(source))).resolves.toStrictEqual({
        kind: 'failed',
        errorKind: 'script_evaluation_failed',
        message: 'a szkript futása a gazda oldalon megszakadt (RangeError)',
      });
    });

    it('a nem várt gazda hívás késői eredménye a lebontás után nem dob, és a következő lépés hibátlan', async () => {
      await expect(run(request('files.list("."); return 1;'))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: 1,
      });
      await expect(run(request('return (await files.list(".")).length;'))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: 0,
      });
    });
  });
});
