// A transcript görgetés mérő eszközének Playwright konfigurációja
// (2026-09-25, `measurement/transcript-scroll.ts`).
//
// A `playwright.config.ts` felállását örökli (chromium projekt, `baseURL`, a
// `webServer` kötelező `VITE_*` konfigurációja), két eltéréssel: kizárólag a
// mérő eszköz fut, egyetlen workeren (a `node:http` SSE szerver egyetlen
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
  testMatch: 'transcript-scroll.ts',
  fullyParallel: false,
  workers: 1,
  webServer:
    baseWebServer === undefined || Array.isArray(baseWebServer)
      ? baseWebServer
      : { ...baseWebServer, reuseExistingServer: false, env: { ...baseWebServer.env, VITE_COVERAGE: 'false' } },
});
