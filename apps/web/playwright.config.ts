// Playwright 1.62.1 alap konfiguracio (SPEC-001 10. szekcio). Az
// `apps/web` meg nem a tenyleges alkalmazas (lasd vite.config.ts
// megjegyzese) - ez a konfiguracio es a `e2e/smoke.spec.ts` a Playwright
// vazat igazolja, valodi UI nelkul.
import { defineConfig, devices } from '@playwright/test';

const PREVIEW_PORT = 4173;

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
  // gyengebb CI gepen. Helyi futtatasnal az alapertelmezes (automatikus,
  // CPU-magok fele) marad, ezert a kulcs CI-n kivul MARAD KI teljesen -
  // az `exactOptionalPropertyTypes` (tooling/tsconfig/base.json) mellett
  // egy explicit `undefined` ertek nem fogadhato el, mert a Playwright
  // sajat `workers` tipusa (`string | number`) nem tartalmazza az
  // `undefined`-ot.
  // Forras: https://playwright.dev/docs/ci#workers
  ...(Boolean(process.env['CI']) && { workers: 1 }),
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${String(PREVIEW_PORT)}`,
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
    command: 'vite build && vite preview --port 4173 --strictPort',
    port: PREVIEW_PORT,
    reuseExistingServer: !process.env['CI'],
    env: {
      VITE_COVERAGE: 'true',
    },
  },
});
