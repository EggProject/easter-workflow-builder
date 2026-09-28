// A mérő eszközök Playwright konfigurációja (2026-09-25): a transcript
// görgetés (`measurement/transcript-scroll.ts`, `bun run measure:transcript`),
// a jóváhagyás panel (`measurement/approval-panel.ts`,
// `bun run measure:approval`) és a futás nézet sáv-váltási pontja
// (`measurement/run-view-band.ts`, `bun run measure:run-view-band`, 2026-09-28,
// O-7). A három npm script a fájlnév szűrővel választ.
//
// A `playwright.config.ts` felállását örökli (chromium projekt, `baseURL`, a
// `webServer` kötelező `VITE_*` konfigurációja), két eltéréssel: kizárólag a
// mérő eszközök futnak, egyetlen workeren (a `node:http` SSE szerver egyetlen
// portra kötődik), és a build NEM instrumentált. A `vite.config.ts` az
// istanbul instrumentálást csak `VITE_COVERAGE=true` mellett kapcsolja be
// (`requireEnv`); az instrumentált kód lassabb, és a verseny mérése időzítés
// érzékeny, ezért itt a változó `false`.
import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config.ts';

const baseWebServer = baseConfig.webServer;

export default defineConfig({
  ...baseConfig,
  testDir: './measurement',
  testMatch: ['transcript-scroll.ts', 'approval-panel.ts', 'run-view-band.ts'],
  fullyParallel: false,
  workers: 1,
  webServer:
    baseWebServer === undefined || Array.isArray(baseWebServer)
      ? baseWebServer
      : { ...baseWebServer, reuseExistingServer: false, env: { ...baseWebServer.env, VITE_COVERAGE: 'false' } },
});
