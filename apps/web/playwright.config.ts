// Playwright 1.62.1 konfiguracio (SPEC-001 10. szekcio). A `webServer.env`
// negynek a VITE_ elotagu kotelezo felulet konfiguraciot allitja be
// buildidoben (SPEC-007 O-4, O-6, SPEC-008 3.3): enelkul a
// `readFrontendConfig` hibaagat adna, es minden e2e teszt a "Hianyzo
// kotelezo konfiguracio" hibakepernyot latna a valodi UI helyett.
//
// A VITE_API_ORIGIN es a VITE_STREAM_ORIGIN egy-egy FIX, buildidoben
// rogzitett origin (http://localhost:4174, lasd e2e/api-origin.ts), amit a
// legtobb teszt `page.route()`-tal fog el - nem kell, hogy ott tenylegesen
// fusson barmi. A `docs/research/2026-08-30-sse-mockolas-meres.md` szerinti
// EGYETLEN kivetel (Last-Event-ID ujracsatlakozas es kozbeni keret beszuras)
// sajat, celra irt `node:http` teszt szervere az operacios rendszer altal
// kiosztott szabad portra kotodik, es a buildidoben rogzitett origin fele
// indulo `GET /events` kerest a `route.continue({ url })` erre a portra
// iranyitja: a hivas valodi halozaton megy, mock nelkul, es a parhuzamos
// workerek szerverei nem utkoznek (e2e/run-view-stream.ts).
import { defineConfig, devices } from '@playwright/test';
import { API_ORIGIN, PREVIEW_ORIGIN, STREAM_ORIGIN } from './e2e/api-origin.ts';

const PREVIEW_PORT = Number(new URL(PREVIEW_ORIGIN).port);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  // A Playwright dokumentalt alapertelmezese: sikertelen teszt alapbol
  // NEM probalkozik ujra. Nincs sajat mérésünk, ami ettol elteritene.
  // Forras: https://playwright.dev/docs/test-retries -
  // "By default failing tests are not retried."
  retries: 0,
  // A Playwright CI utmutatoja a `workers: 1` erteket ajanlja CI-ben, hogy
  // a parhuzamos workerek ne versenyezzenek eroforrasokert egy tipikusan
  // gyengebb CI gepen (https://playwright.dev/docs/ci#workers). Helyi
  // futtatasnal a dokumentalt alapertelmezes (a logikai CPU magok fele,
  // https://playwright.dev/docs/test-parallel) tobb magos gepen harom
  // workernel tobbet inditana, ami megolheti a fejlesztoi gepet - ezert
  // lokalisan legfeljebb HAROM worker futhat (user keres 2026-09-24,
  // docs/research/2026-09-24-playwright-worker-korlat.md). A CI-agban a
  // viselkedes valtozatlan marad, a szam kesobbi meres targya.
  workers: Boolean(process.env['CI']) ? 1 : 3,
  reporter: 'list',
  use: {
    baseURL: PREVIEW_ORIGIN,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // A `build` lepes itt, kozvetlenul a szerver inditasa elott fut le
    // ujra (a turbo.json `test:e2e` taskja is fugg a `build`-tol, de az a
    // NORMAL, instrumentalatlan buildet keszitene el - lasd
    // vite.config.ts "requireEnv" megjegyzeset). A `VITE_COVERAGE=true`
    // env valtozo itt, kozvetlenul a build parancs elott aktivalja az
    // instrumentalast, hogy a `dist/` amit a `vite preview` kiszolgal,
    // tenylegesen tartalmazza a window.__coverage__ inicializalast.
    command: `vite build && vite preview --port ${String(PREVIEW_PORT)} --strictPort`,
    port: PREVIEW_PORT,
    reuseExistingServer: !process.env['CI'],
    env: {
      VITE_COVERAGE: 'true',
      VITE_API_ORIGIN: API_ORIGIN,
      VITE_STREAM_ORIGIN: STREAM_ORIGIN,
      VITE_LIST_LIMIT: '50',
      VITE_STREAM_REPLAY_LIMIT: '100',
    },
  },
});
