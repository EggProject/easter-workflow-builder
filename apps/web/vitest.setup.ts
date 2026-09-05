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

/**
 * A globális `fetch` lezárása: unit teszt nem szólíthat meg hálózatot.
 *
 * A `mountApp` a valódi `browserFetchFunction` portot adja tovább, és a
 * létrehozott React gyökeret nem adja vissza, tehát az a teszt, ami a
 * belépési pontot futtatja, nem tudja leszerelni. Stub nélkül a képernyő
 * effektje ténylegesen a hálózatra ment, és a késve, a fájl lefutása UTÁN
 * megérkező DNS hiba React állapotfrissítést váltott ki már leszerelt
 * happy-dom környezetben - a CI-ban `ReferenceError: window is not defined`
 * alakú, a futást megbuktató kezeletlen hiba (PR #11, run 33933773721),
 * helyben zöld, mert ott a DNS hiba a teszten belül megérkezett.
 *
 * A lezárás determinisztikussá teszi ezt a hibaosztályt: a hívás azonnal,
 * még a mikrotask sorban elutasít, tehát a teszt lefutása után nincs
 * függőben lévő hálózati művelet. Az a teszt, aminek tényleges válaszra van
 * szüksége, továbbra is szabadon felülírja (`Object.assign(globalThis, {
 * fetch })`), ezért `writable: true` - a másik két tulajdonságot senki nem
 * írja felül, azoknál nem kell.
 */
function forbiddenFetch(): Promise<never> {
  return Promise.reject(
    new Error('Unit teszt nem szólíthat meg hálózatot: cseréld le a globalThis.fetch függvényt a tesztben.'),
  );
}

Object.defineProperties(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true },
  localStorage: { value: new Storage(), configurable: true },
  fetch: { value: forbiddenFetch, configurable: true, writable: true },
});
