// A szerver kérés forrás ellenőrzésének MÉRŐ ESZKÖZE (SPEC-017 7., 2026-11-05).
//
// MIT MÉR. Valódi Chromium, valódi Vite dev szerver (a `vite.config.ts` `/api`
// proxyjával) és valódi `apps/server` gyermek folyamat (ideiglenes adatbázissal),
// három jelenetben:
//
// 1. `sajat-felulet`: a Vite originjén nyitott lapról `GET` és `POST` a proxyn át,
//    és a közvetlen, kereszt-origin SSE kérés (`stream_ready` keret).
// 2. `csrf`: egy idegen originről (a `127.0.0.1` egy másik portja) nyitott lap
//    egyszerű, `no-cors` `POST` kérése a szerverre, `text/plain` JSON törzzsel.
// 3. `dns-rebinding`: a lap originje a `rebind.test` név a szerver portján, a név a
//    Chromium `--host-resolver-rules` kapcsolójával a `127.0.0.1` címre mutat, tehát
//    a lap a szerverhez SAJÁT originként fordul (a DNS rebinding támadás utolsó
//    lépése). A dokumentumot a `page.route` adja, minden más kérés a valódi szerverre megy.
//
// Jelenetenként a lap felől látott státusz és a szerveren létrejött workflow-k
// száma (Node `fetch` hívással olvasva, ami a forrás ellenőrzésen átmegy). Képet
// nem ír, csak `MEASUREMENT <json>` sorokat.
//
// FUTTATÁS (a gépen egyszerre csak egy Playwright folyamat, `.claude/CLAUDE.md` 11.):
//
//   cd apps/web && flock /tmp/playwright-gep.lock node measurement/request-source-check.ts
//
// A `MEASURE_SERVER_ROOT` env változó egy másik munkapéldány gyökerét adhatja (a
// javítás előtti szerver mérése); hiányában ennek a repónak a szervere fut. A
// `MEASURE_CHROMIUM_ARGS` szóközzel elválasztott további Chromium kapcsolókat ad: a
// `--disable-features=LocalNetworkAccessChecks` kikapcsolja a Chromium saját helyi
// hálózat védelmét, ami a DNS rebinding jelenetet a szervertől függetlenül megfogja
// (research 3.3), így a szerver saját védelme mérhető.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createServer as createViteServer } from 'vite';
import { listenOnLoopback } from '../e2e/run-view-stream.ts';

const WEB_ROOT = path.resolve(import.meta.dirname, '..');
const SERVER_ROOT = process.env['MEASURE_SERVER_ROOT'] ?? path.resolve(WEB_ROOT, '../..');
const PORT_REPORT = /EASTER_PROBE_PORT=(\d+)/u;
// eslint-disable-next-line unicorn/no-null -- a `CreateWorkflowRequest` két mezője kötelezően `null` értéket kap (SPEC-005 4.2)
const WORKFLOW_BODY = JSON.stringify({ name: 'meres', description: null, providerId: null });

function report(scenario: string, values: Readonly<Record<string, unknown>>): void {
  console.log(`MEASUREMENT ${JSON.stringify({ scenario, ...values })}`);
}

// A valódi szerver gyermek folyamat, ideiglenes adatbázissal; a port a stdout jelentéséből.
async function startServer(
  workDirectory: string,
  uiOrigin: string,
): Promise<{ readonly origin: string; readonly stop: () => void }> {
  const child = spawn(process.execPath, [path.join(SERVER_ROOT, 'apps/server/src/main.ts')], {
    cwd: workDirectory,
    env: {
      ...process.env,
      EASTER_SERVER_PORT: '0',
      EASTER_DB_FILE: path.join(workDirectory, 'meres.sqlite'),
      EASTER_LOG_DIRECTORY: path.join(workDirectory, 'naplo'),
      EASTER_SKILL_LIBRARY_DIRECTORY: path.join(workDirectory, 'skills'),
      EASTER_STREAM_DEV_ORIGIN: uiOrigin,
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const port = await new Promise<string>((resolve, reject) => {
    let buffered = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      buffered += chunk;
      const match = PORT_REPORT.exec(buffered);
      if (match?.[1] !== undefined) {
        resolve(match[1]);
      }
    });
    child.once('close', () => {
      reject(new Error('a szerver a port jelentése előtt kilépett'));
    });
  });
  return { origin: `http://127.0.0.1:${port}`, stop: () => child.kill('SIGTERM') };
}

async function countWorkflows(serverOrigin: string): Promise<number> {
  const response = await fetch(`${serverOrigin}/api/workflows?limit=100`);
  const body: unknown = await response.json();
  return Array.isArray(body) ? body.length : -1;
}

const workDirectory = mkdtempSync(path.join(tmpdir(), 'forras-meres-'));
// A felület szervere előbb kap portot (a szerver CORS originjéhez kell), a Vite
// middleware módban, a proxy szabállyal együtt, utána kötődik rá. A port az
// operációs rendszeré (`listenOnLoopback`, az `e2e-stream-server-free-port` invariáns).
const uiServer = createHttpServer();
const uiOrigin = `http://localhost:${String(await listenOnLoopback(uiServer))}`;
const server = await startServer(workDirectory, uiOrigin);
const serverPort = new URL(server.origin).port;
process.env['VITE_API_ORIGIN'] = uiOrigin;
process.env['VITE_STREAM_ORIGIN'] = server.origin;
const vite = await createViteServer({
  root: WEB_ROOT,
  configFile: path.join(WEB_ROOT, 'vite.config.ts'),
  server: { middlewareMode: true, hmr: false },
  appType: 'spa',
  logLevel: 'error',
});
uiServer.on('request', vite.middlewares);
const attacker = createHttpServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.end('<!doctype html><title>idegen</title>');
});
const attackerOrigin = `http://127.0.0.1:${String(await listenOnLoopback(attacker))}`;
const browser = await chromium.launch({
  args: [
    '--host-resolver-rules=MAP rebind.test 127.0.0.1',
    ...(process.env['MEASURE_CHROMIUM_ARGS'] ?? '').split(' ').filter((argument) => argument.length > 0),
  ],
});

try {
  const page = await browser.newPage();

  // 1. A saját felület: GET és POST a Vite proxyn át, és a közvetlen SSE kapcsolat.
  await page.goto(`${uiOrigin}/`);
  const before = await countWorkflows(server.origin);
  const own = await page.evaluate(
    async ({ body, streamUrl }) => {
      const listed = await globalThis.fetch('/api/workflows?limit=100');
      const created = await globalThis.fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      // A `fetch` kereszt-origin `cors` módban ugyanazt az `Origin` és `Sec-Fetch-Site`
      // fejlécet küldi, mint az `EventSource`, és a CORS ellenőrzés is ugyanaz.
      const stream = await globalThis.fetch(streamUrl);
      const reader = stream.body?.getReader();
      const firstChunk = reader === undefined ? undefined : await reader.read();
      await reader?.cancel();
      // A keret neve ASCII, tehát bájtonkénti karakterré alakítás elég a kereséshez.
      const isStreamReady = String.fromCodePoint(...(firstChunk?.value ?? [])).includes('event: stream_ready');
      return { listStatus: listed.status, createStatus: created.status, isStreamReady };
    },
    { body: WORKFLOW_BODY, streamUrl: `${server.origin}/events?streamId=meres` },
  );
  report('sajat-felulet', { ...own, createdOnServer: (await countWorkflows(server.origin)) - before });

  // 2. CSRF: egyszerű, preflight nélküli POST egy idegen originről.
  await page.goto(`${attackerOrigin}/`);
  const beforeCsrf = await countWorkflows(server.origin);
  const csrfResponseType = await page.evaluate(
    async ({ body, target }) => {
      const response = await globalThis.fetch(target, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body,
      });
      return response.type;
    },
    { body: WORKFLOW_BODY, target: `${server.origin}/api/workflows` },
  );
  report('csrf', {
    responseType: csrfResponseType,
    createdOnServer: (await countWorkflows(server.origin)) - beforeCsrf,
  });

  // 3. DNS rebinding: a lap originje a szerver portján álló idegen név.
  const rebindOrigin = `http://rebind.test:${serverPort}`;
  await page.route(`${rebindOrigin}/`, (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>rebind</title>' }),
  );
  await page.goto(`${rebindOrigin}/`);
  const beforeRebind = await countWorkflows(server.origin);
  page.on('console', (message) => {
    report('konzol', { text: message.text() });
  });
  const rebind = await page.evaluate(async (body) => {
    try {
      const created = await globalThis.fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const listed = await globalThis.fetch('/api/workflows?limit=100');
      const listText = await listed.text();
      return { createStatus: created.status, listStatus: listed.status, listBody: listText.slice(0, 90) };
    } catch (error) {
      return { browserBlocked: String(error) };
    }
  }, WORKFLOW_BODY);
  report('dns-rebinding', { ...rebind, createdOnServer: (await countWorkflows(server.origin)) - beforeRebind });
} finally {
  await browser.close();
  await vite.close();
  uiServer.close();
  attacker.close();
  server.stop();
  rmSync(workDirectory, { recursive: true, force: true });
}
