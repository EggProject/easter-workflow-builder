// Vitest setup fájl az `apps/web` happy-dom projekthez. NEM a `src/` alatt
// áll (mint a `vitest.config.ts` sem), tehát a `coverage.include` mintáján
// kívül esik: nem termékkód, hanem tesztinfrastruktúra.
//
// Szó szerint ugyanaz a két javítás, amit a `packages/ui/vitest.setup.ts`
// fejléce indokol (docs/research/2026-09-01-spec007-f0-meresek.md, T-008-4):
// a React 19 `act()` környezet jelzése, és a Vitest happy-dom
// projekt-környezetében nem működő `globalThis.localStorage` pótlása. Az
// `apps/web` azért igényli ugyanezt, mert a `ThemeModeToggle` (packages/ui)
// az `app-shell` része, tehát a `useThemeMode` `localStorage` olvasása az
// `apps/web` komponens tesztjeiben is lefut. A setup fájl csomagonként külön
// kell: a Vitest projekt configok semmit nem örökölnek egymástól.
import { Storage } from 'happy-dom';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

Object.defineProperties(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true },
  localStorage: { value: new Storage(), configurable: true },
});
