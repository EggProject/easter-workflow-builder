# PLAN-009 F0 blokkoló mérések, 2026-09-05

Négy blokkoló mérés a SPEC-008 nyitva maradt O-2, O-3 és O-5 tételére, plusz az O-6
maradék, forrás nélküli számára (a csomópont kártya mérete, T-009-19 hatóköre, nem ez a
fájl). Minden mérés eldobható, repón kívüli munkakönyvtárban futott
(`/sessions/vigilant-clever-mendel/tmp/plan009-meres/`, natív ext4, nem a szinkronizált
`mnt/tmp` FUSE mount, mert az utóbbi nem engedélyezi a saját maga által írt fájlok
törlését - ez a tény maga is buktató, lásd a 5. szekciót). A repó `bun.lock` fájlja egyik
mérés alatt sem mozdult.

## 1. `@xyflow/react@12.11.6`, React 19.2.8, happy-dom 20.11.6 (M-50 ... M-53 megismétlése)

**Módszer.** Nyers `react-dom/client` `createRoot` + `act`, happy-dom `Window` osztály
kézzel bekötve a `globalThis`-re (`document`, `HTMLElement`, `SVGElement`, `Node`, `Text`,
`Element`, `customElements`, `getComputedStyle`, `ResizeObserver`,
`requestAnimationFrame`/`cancelAnimationFrame`, `IS_REACT_ACT_ENVIRONMENT = true`), Vitest
nélkül, mert a helyi `vitest` csomag bin szimlinkje a `bun install` alatt nem jött létre
ebben a sandboxban (5. szekció). A `navigator` globált Node 26 saját getterje védi, ezért
`Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable:
true })` kellett a sima értékadás helyett.

**Eredmény, két node + egy él, explicit `width`/`height` mezővel:**

| Attribútum                  | Mért érték                                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| wrapper `data-testid`       | `rf__wrapper`                                                                                                                      |
| wrapper `role`              | `application`                                                                                                                      |
| node `role`                 | `group`                                                                                                                            |
| node `aria-roledescription` | `node`                                                                                                                             |
| node `tabindex`             | `0`                                                                                                                                |
| node `data-id`              | `a`                                                                                                                                |
| node `data-testid`          | `rf__node-a`                                                                                                                       |
| node `style`                | `... visibility: visible; width: 150px; height: 40px; ...`                                                                         |
| `.react-flow__edges`        | **teljesen üres**: `innerHTML` `""`, `children.length` `0`, a `<Edge>` renderelés happy-dom alatt kivétel nélkül, de nem ír DOM-ot |

**Verdikt.** A `12.11.6` patch semmit nem változtatott a `12.11.5`-höz képest mért DOM
alakon (M-50 ... M-53 szó szerint megismétlődik), a licenc MIT változatlan (saját olvasás
a telepített `LICENSE` fájlon, `Copyright (c) 2019-2025 webkid GmbH`). Az él happy-dom
alatt itt sem rajzolódik ki semmilyen körülmények között. **A SPEC-008 2.1 táblázata nem
tér el a mért alaktól, a `12.11.6` verzió biztonsággal rögzíthető** (T-009-7).

## 2. O-3: `initialWidth`/`initialHeight` kontra `width`/`height` happy-dom alatt

**Módszer.** Ugyanaz a felállás, három külön render: (1) explicit `width`/`height`, (2)
semmilyen méret mező, (3) `initialWidth`/`initialHeight`.

| Eset                                   | Kirajzolt `style` (kivonat)                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| `width: 150, height: 40`               | `visibility: visible; width: 150px; height: 40px`                             |
| nincs méret mező                       | `visibility: hidden` (nincs `width`/`height` a style-ban)                     |
| `initialWidth: 150, initialHeight: 40` | `visibility: visible; width: 150px; height: 40px` - **azonos** az (1) esettel |

**Verdikt, O-3 lezárva.** Az `initialWidth`/`initialHeight` **ugyanúgy láthatóvá teszi** a
node-ot happy-dom alatt, mint a `width`/`height` (a forrás `measured.width ??
initialWidth` lánca ugyanoda fut ki, ha nincs `ResizeObserver` callback hívás). A doksi
(M-57) a `width`/`height` **közvetlen beállításától** óv a termékkódban, az
`initialWidth`/`initialHeight` mezőt nem sorolja tiltottként - ez a mérés megerősíti, hogy
ez a mező a dokumentált, biztonságos választás a teszt fixture-ökhöz. **A teszt fixture
mostantól `initialWidth`/`initialHeight` mezőt használ**, a termékkód pedig továbbra sem
állít egyik mezőt sem (a méretet a `style`/`className` prop adja, M-57 szerint).

## 3. O-5: `react-window@2.3.1` `rowHeight` soronként eltérő magassággal, valós Chromiumban

**A verzió eltér a research 3. szekciójától**: a `registry.npmjs.org/react-window/latest`
2026-09-05-i lekérdezése `2.3.1`-et ad, nem `2.3.0`-t (két forrás: az npm registry
`dist-tags.latest` mezője, és a `api.github.com/repos/bvaughn/react-window/tags` lista
legfrissebb bejegyzése, `2.3.1`, a `2.3.0` alatt). A `peerDependencies`
(`react`/`react-dom`: `^18.0.0 || ^19.0.0`) és a licenc (MIT) változatlan. **A katalógusba
a `2.3.1` kerül**, nem a `2.3.0` (T-009-7).

**Módszer.** `esbuild@0.27.2` IIFE bundle (`jsx: 'automatic'`), a pinelt
`@playwright/test@1.62.1` verzióhoz tartozó, a repóban már telepített `chromium` binárison
(szimlinkkel bekötve a mérési könyvtárba, 5. szekció), `flushSync` a szinkron
kényszerítéshez, ugyanúgy, mint a research 3. szekciójában. 50 elemű lista, soronként
20/35/50/65/80 px változó magassággal (ismétlődő mintázat), 300px magas konténerben.

**Eredmény, a `rowHeight` FÜGGVÉNY alakja** (`(index, { items }) => items[index].height`):

| index | várt magasság | mért `getBoundingClientRect().height`                      |
| ----- | ------------- | ---------------------------------------------------------- |
| 0     | 20            | 22 (a 2px a teszt sor `1px solid` kerete, mindkét oldalon) |
| 1     | 35            | 37                                                         |
| 2     | 50            | 52                                                         |
| 3     | 65            | 67                                                         |
| 4     | 80            | 82                                                         |
| 5-9   | ismétlődik    | ismétlődik                                                 |

A ténylegesen a DOM-ban álló sorok száma **10** az 50-ből (`domRowCount: 10`) - a
virtualizáció aktív, a 300px magas konténerhez illeszkedő ablak plusz overscan
renderelődik, nem mind az 50 sor.

**Eredmény, a `rowHeight` SZÁM alakja** (`44`): mind a 10 kirajzolt sor magassága
egyöntetűen `46` (`44 + 2px` keret) - a fix magasság is működik.

**Verdikt, O-5 lezárva.** A `react-window@2.3.1` `rowHeight` propja **valóban elfogad
soronkénti, eltérő magasságot adó függvényt**, valós Chromiumban mérve, és a ténylegesen
kirajzolt sormagasságok pontosan követik a függvény visszatérési értékét. **A SPEC-008 7.3
első, dokumentált kimenete (változó magasság, a tartalomból számítva) lép életbe**, nem a
tartalék, fix magasságú ág.

## 4. O-2: SSE a Vite `8.2.2` dev proxyján át, valós `EventSource`-szal

**Módszer.** `node:http` SSE forrás szerver (`:5501`, `/events`), ami minden kapcsolatra
2 eseményt küld 100ms-onként, `id:` sorral, majd `res.end()`-del lezárja a választ; egy
`vite@8.2.2` dev szerver (`:5173`) `server.proxy` szabállyal (`/events` -> `:5501`); egy
valós Chromium böngésző (Playwright, ugyanaz a bináris, mint a 3. szekcióban),
`EventSource('/events')`-szel a proxy originre kapcsolódva. **Fontos infrastrukturális
tanulság**: a háttérbe indított szerverfolyamatok NEM élik túl a bash hívások közötti
határt (minden `mcp__workspace__bash` hívás önálló shell), ezért a forrás szerver, a Vite
szerver és a Playwright hajtó szkript egyetlen bash hívásban indult és futott.

**Mért esemény sorozat, a forrás szerver naplójából és a böngésző konzoljából:**

| Kapcsolat | Bejövő `Last-Event-ID` fejléc | Küldött esemény id-k | Mi zárja le                       |
| --------- | ----------------------------- | -------------------- | --------------------------------- |
| #1        | (nincs)                       | 1, 2                 | forrás `res.end()` 2 esemény után |
| #2        | **`2`**                       | 3, 4                 | forrás `res.end()` 2 esemény után |
| #3        | **`4`**                       | 5, ...               | a teszt itt zárta a böngészőt     |

A böngésző oldalon minden lezárás után `onerror` (readyState `0`, CONNECTING) tüzelt, majd
a `retry: 300` direktíva szerint kb. 300ms múlva `onopen`, és a folytatás zökkenőmentes
volt: egyetlen esemény sem veszett el, egyetlen duplikáció sem történt.

**Verdikt, O-2 lezárva, "jó hír" irányban, DE a döntés nem változik.** A mérés szerint a
`vite@8.2.2` dev proxyján át **mind a lezárás, mind a `Last-Event-ID` fejléc helyesen
eljut** a forrásig - a SPEC-005 5.8 által hivatkozott, elavult `vitejs/vite` #12157/#13522
hiba ezen a verzión **nem reprodukálható**, összhangban az M-80 tényével (a hibát a
#13578 PR javította). **A termékdöntés (az SSE megkerüli a proxyt, közvetlenül a
`streamOrigin`-re megy) ennek ellenére változatlan marad**, mert ezt a SPEC-008 3.1
szekciója kifejezetten a mérés kimenetétől függetlennek mondja ki: a megkerülés a
szigorúbb, már beépített út, és a váltás nem hozna hasznot. **Ez a mérés kizárólag a
SPEC-005 5.8 indoklását pontosítja** (a hivatkozott hiba javítva van, a `timeout: 0`
workaround nem hivatalos forrásból származik), a hatóköre és az architektúra nem változik.

## 5. Infrastrukturális buktató, amit ez a munkamenet talált

**A `mnt/tmp` (FUSE-szinkronizált, a felhasználó gépén is látható `/private/tmp`) mappa
nem engedi törölni a benne, ebből a sandboxból írt fájlokat** (`rm` minden fájlra
`Operation not permitted` hibát ad, `lsattr` szerint nem fájlszintű immutable flag, hanem
a FUSE híd korlátozása). Emiatt a `bun install` extrahált csomagjai (pl.
`@playwright/test`, `vitest`) hiányosan/inkonzisztens állapotban maradtak (hiányzó
`playwright-core/lib/bootstrap.js`, hiányzó `vitest` bin szimlink), mert egy korábbi,
sikertelen törlési kísérlet féligkész állapotot hagyott hátra, amit nem lehetett
felülírni. **A megoldás**: minden eldobható mérés a natív `ext4` sandboxban futott
(`/sessions/<munkamenet>/tmp/`, NEM a `mnt/tmp` alatt), ahol a `bun install` és az `rm -rf`
hibátlanul működött. A már telepített Playwright Chromium és a hozzá tartozó
`playwright-core`/`playwright` csomag a repó saját `node_modules/.bun/` tárolójából lett
szimlinkkel bekötve a mérési könyvtárakba, hogy ne kelljen újra letölteni.
