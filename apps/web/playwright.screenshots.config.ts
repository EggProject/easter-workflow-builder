// A REPÓBAN ÉLŐ képernyőkép készítés Playwright konfiguracioja (2026-09-09).
//
// A `playwright.config.ts` teljes felallasat oroklik (webServer: `vite build`
// plusz `vite preview` a kotelezo `VITE_*` konfiguracioval, chromium projekt,
// `baseURL`), es CSAK a futtatando fajlok halmazat szukiti: kizarolag az
// `e2e/capture-screenshots.ts` fut. Az a fajl SZANDEKOSAN nem `.spec.ts`,
// ezert a `playwright.config.ts` alapertelmezett `testMatch` mintaja
// (`**/*.@(spec|test).?(c|m)[jt]s?(x)`) nem veszi fel - a `bun run test:e2e`
// kapu tehat valtozatlan marad.
//
// `fullyParallel: false`: a kepernyokepek egymas utan keszulnek, hogy a
// konzolra irt, per-el pixel meres sorrendje kovetheto legyen.
import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config.ts';

export default defineConfig({
  ...baseConfig,
  testMatch: 'capture-screenshots.ts',
  fullyParallel: false,
  workers: 1,
});
