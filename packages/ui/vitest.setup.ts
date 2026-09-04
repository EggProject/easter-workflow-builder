// Vitest setup fájl a `packages/ui` happy-dom projekthez. NEM a `src/` alatt
// áll (mint a `vitest.config.ts` sem), tehát a `coverage.include` mintáján
// (`packages/*/src/**/*.{ts,tsx}`) kívül esik: nem termékkód, hanem
// tesztinfrastruktúra, ugyanúgy, mint maga a konfigurációs fájl.
//
// Két, sajat méréssel feltárt hiba javítása (docs/research/2026-09-01-spec007-f0-meresek.md,
// T-008-4). Statikus importtal kezdődik, hogy a fájl ES modulként forduljon
// (a `declare global` kizárólag modul fájlban engedélyezett).
import { Storage } from 'happy-dom';

// 1. React 19 `act()` figyelmeztetés. A React 19 az `act()` hívást csak akkor
//    tekinti "konfigurált" környezetnek, ha a `globalThis.IS_REACT_ACT_ENVIRONMENT`
//    érték `true`. Forrás: https://react.dev/reference/react/act
//    ("Before your test, set global.IS_REACT_ACT_ENVIRONMENT to true").
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// 2. A `globalThis.localStorage` a Vitest happy-dom projekt-környezetében NEM
//    működik javítás nélkül: a Node.js 26 saját, natív (kísérleti, flag nélkül
//    üres) `localStorage` property-je "in global"-ként jelen van, a Vitest
//    `populateGlobal` segédfüggvénye pedig csak egy kötött kulcslistát másol
//    át a happy-dom `Window` példányról, és a `localStorage` nincs ezen a
//    listán - tehát a natív, üres property soha nem cserélődik le. A happy-dom
//    saját `Storage` osztályát írjuk a helyére; a natív property
//    `configurable: true`, tehát felülírható.
Object.defineProperties(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true },
  localStorage: { value: new Storage(), configurable: true },
});
