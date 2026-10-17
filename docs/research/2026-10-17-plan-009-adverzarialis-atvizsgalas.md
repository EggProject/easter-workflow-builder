# PLAN-009 T-009-34: adverzariális átvizsgálás (2026-10-17)

|         |                                                                                                            |
| ------- | ---------------------------------------------------------------------------------------------------------- |
| Lépés   | PLAN-009 T-009-34                                                                                          |
| Dátum   | 2026-10-17                                                                                                 |
| Bázis   | `633e3a5` (a #46 feje; a `main` `b4c2b1a` squash commitjának fája bájtra azonos vele)                      |
| Hatókör | a PLAN-009 teljes terméke: `git diff feb87ba 633e3a5` (713 fájl), plusz a kapcsolódó research              |
| Spec    | [`../spec/SPEC-008-graf-szerkeszto-es-futas-nezet.md`](../spec/SPEC-008-graf-szerkeszto-es-futas-nezet.md) |
| Terv    | [`../plan/PLAN-009-graf-szerkeszto-es-futas-nezet.md`](../plan/PLAN-009-graf-szerkeszto-es-futas-nezet.md) |

## 1. Módszer

A PLAN-009 T-009-34 sora négy kategóriát kér (forrás nélküli szám, kitalált könyvtári viselkedés,
megkerülhető szabály, elszakadt CSS), plusz három külön tételt (a locator kivétel hatóköre, a
`node-config` két rekord alakja, az `agents` űrlap három nem megerősített mezője), és a jelentés
nevezze meg, mit NEM talált. A koordinátori feladat ehhez négy mai kockázatot tett: a Zod `when`
paraméter minimális verziója, a `nokey` osztály, a Chrome history intervention és a tooltip híd CSS.

- **Felderítés.** Tizenkét, egymástól független, csak olvasó átvizsgálás futott párhuzamosan,
  témánként szétvágva: az `apps/web` gráf szerkesztő és futás nézet témái, az `e2e` és a mérő
  eszköz, a csomagok (`ui`, `protocol`, `db`, `engine`, `core`, `apps/server`), a SPEC-008 két fele
  és a PLAN-009, a `CLAUDE.md` fájlok, öt research fájl, a megkerülhető szabályok, a CSS
  bájtazonosság, a PLAN külön tételei és a webes kockázatok.
- **Bizonyíték.** Könyvtári állítást a telepített forrás (`node_modules`, verzióval, fájl:sor),
  böngésző és spec állítást hivatalos doksi (Exa keresővel lekérve) igazol; a megkerülhető szabály
  rését egy eldobható worktree-ben beírt injekció igazolja (a régi teszt zöld maradt, a javított
  bukik).
- **Független ellenőrzés.** A javítások után egy külön ellenőrző a teljes diffet a valóság ellen
  vizsgálta (kb. 35 hivatkozás szúrópróbája, ebből 10 URL). Az általa talált hibák javítva: öt a
  `3d0f2a5` commitban, a hatodik (ennek a fájlnak a hiánya) ezzel a fájllal.

## 2. Összesítés

A darabszámok a 3-9. szekció tábláinak és felsorolásainak sorai.

| Kategória                             | Talált | Javítva vagy forrásolva | Nyitott                             |
| ------------------------------------- | ------ | ----------------------- | ----------------------------------- |
| 1. Forrás nélküli szám (3.)           | 23     | 13                      | 10 (O-34, O-35, O-36)               |
| 2. Kitalált könyvtári viselkedés (4.) | 43     | 43                      | 0                                   |
| 3. Megkerülhető szabály (5.)          | 26     | 24                      | 2 (O-37, a PDF hatóköre)            |
| 4. Elszakadt CSS (6.)                 | 3      | 3                       | 0                                   |
| 5. A PLAN külön tételei (7.)          | 3      | 1                       | 1 (O-38), 1 alacsony, nem javítva   |
| 6. A mai kockázatok (8.)              | 4      | 2                       | 0 (kettő rendben volt)              |
| Elavult dokumentáció (9.)             | 18     | 18                      | 2 új tétel (O-39, szabálykönyv 14.) |

A súlyosság a felderítés besorolása: magas az, ami jóhiszemű kódot átenged egy kikényszerített
szabályon, vagy egy kapu hamis biztonságot ad; közepes a hamis vagy cáfolt állítás, amire kód vagy
spec döntés épül; alacsony a hiányzó hivatkozás és a pontatlan megfogalmazás.

## 3. Forrás nélküli szám

| Hely                                                                   | Súly     | Rendezés                                                                  |
| ---------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| `graph-node-card.css` 4, 8, 12, 16 px térközök                         | közepes  | `--ep-space-1..4` tokenre cserélve (azonos érték, `spacing.css` 9-12)     |
| `graph-node-card.css` 12px és 0.04em címke, 600 súly                   | közepes  | a `.field__label` recept megnevezve; a 600 súly: O-35                     |
| `graph-editor-layout.ts`, `run-view-layout.ts` `[70, 30]`              | közepes  | O-34; a futás nézet hibás számítása (870/1440) törölve                    |
| `Resizable.tsx` `DEFAULT_RESTORE_SIZE_PERCENT = 50`                    | közepes  | O-34                                                                      |
| `Resizable.tsx` `COLLAPSED_SIZE_PERCENT = 5`                           | alacsony | forrás: a design system `Resizable.jsx` `[5, 95]` alsó határa             |
| `GraphNodeCard.tsx` `(i+1)/(N+1)` handle elosztás                      | alacsony | O-35, a hamis M-58 hivatkozás javítva                                     |
| `JsonTextAreaField.tsx` `rows={6}`, a három `lines={4}` skeleton       | alacsony | O-35                                                                      |
| `TextAreaField.tsx` `rows ?? 3`                                        | alacsony | forrás: a design system `textarea.html` `rows="3"`                        |
| `run-control.css` `0.04em`, `run-graph.css` 600 súly                   | alacsony | forrás: `input.css` `.field__label`, `accordion.css` `.accordion__header` |
| `run-event-row.css` "3400 pixel"                                       | közepes  | a research-ben nem álló szám törölve (12. szekció)                        |
| `transcript-panel.css` "1-3 képkocka"                                  | alacsony | törölve, a research 17 hivatkozás marad                                   |
| `approval-prompt.spec.ts` "240 pixel, 0,87 arány"                      | közepes  | törölve (12. szekció), mérés nem állította elő                            |
| `approval-prompt.spec.ts` `toBeLessThan(100)`                          | közepes  | a 60 px minimum a `resizable.css`-ből olvasva, pontos egyenlőséggel       |
| `approval-prompt.spec.ts`, `measurement/approval-panel.ts` 768 és 1024 | alacsony | a töréspont token értékéből olvasva                                       |
| `approval-prompt.spec.ts` `toPass` törzs `timeout: 1000`               | közepes  | O-36                                                                      |
| `select-chevron-position.spec.ts` szűrők (90, 0.7, 8/4)                | közepes  | O-36                                                                      |
| `edge-paint-measurement.ts` `CLIP_MARGIN = 8`                          | alacsony | O-36                                                                      |
| `sse-real-server.spec.ts` `0.5` két sor közti résre                    | alacsony | O-36                                                                      |
| `breadcrumb.spec.ts` "a 80px felezi"                                   | alacsony | hamis számtan (a felezőpont 93,4) javítva, a küszöb változatlan           |
| `graph-edge-stroke.spec.ts` 24, `approval-prompt.spec.ts` 5/95         | alacsony | research 5. szekció, SPEC-008 M-73 hivatkozás                             |
| SPEC-008 5.2 "legalább három mező" panel küszöb, 73. kritérium         | közepes  | O-35                                                                      |
| SPEC-008 5.5 "1920 observe, 960 callback", 2026-09-06-i mérés          | közepes  | "nem ellenőrzött" jelölés: a nyers rekord nincs a research alatt          |
| SPEC-008 1169 "huszonnégy téma"                                        | alacsony | törölve, a 11.4 táblára mutat                                             |

Megfigyelés, nem javítva: a `graph-editor-screen.css` `max-width: 768px` és a futás nézet
`min-width: 768px` töréspontja pontosan 768 px-en ellentétes sávot ad (mindkettő token érték, a
szabálykönyv 11. szekciója szerint a `min-width` az ajánlott alak). Alacsony súly.

## 4. Kitalált könyvtári és böngésző viselkedés

Cáfolt vagy hamis állítások (közepes súly, mind javítva forrással):

- `FitViewOnAutoLayout.tsx`: a `useReactFlow()` objektum nem a nézettől függ; a telepített
  `@xyflow/react` 12.11.6 `dist/esm/index.js` 1052-1236 szerint a `fitView` stabil.
- `GraphEditorCanvas.tsx`, `FitViewOnAutoLayout.tsx`: a provider ma kívül (`ReactFlowProvider`) áll,
  a telepített `Wrapper` (3748-3757) a meglévő tárolót használja.
- `GraphEditorScreen.tsx`: a TS szűkítés a nyíl függvénybe átmegy, a hoistolt függvény
  deklarációba nem (TypeScript 5.4 release note, microsoft/TypeScript #56908).
- `browser-history-location-port.ts`: a `structuredClone(undefined)` sikeres, a spec nem ír elő
  `null`-t; a `null` a `history.state` kezdőértéke (WHATWG HTML History interface).
- `use-run-view-layout-band.ts`: az `innerWidth` és a media query `width` a CSSOM View és a Media
  Queries 4 szerint ugyanaz a görgetősávos szélesség; az indok a `MediaQueryList` kiértékelése.
- `Resizable.tsx`: az APG Window Splitter minta az `Enter`-t felsorolja (nem eltérés).
- `Breadcrumb.tsx`: az APG nem írja elő a nem interaktív aktuális elemet (tervezési döntés).
- `resolve-image-data-url.ts`: a `Uint8Array` base64 a Node 25 óta (V8 14.1) érhető el, nem a Node
  22 óta (nodejs.org v25.0.0 kiadási jegyzet).
- `graph-edge-stroke.spec.ts` és a research `2026-09-09-graf-el-vonal-meres.md` 2. szekciója: a
  pixel metrika csak kis kivágaton "immunis" a pontmintára (a 7. szekció mérése szerint).
- `RunViewTranscriptSide.tsx`: a felfedés szabálya ellentmondott a `run-view-approval-reveal-adjustment.ts`
  ágainak.
- `GraphEditorScreen.tsx`: a vásznon nincs lusta `useState` állapot.
- SPEC-008 344: a WCAG ARIA17 nem "egyetlen megkötést" ad, hanem hármat.
- `packages/ui/CLAUDE.md`: a `contentMinimum` memoizálásának indoka a research
  `2026-09-24-jovahagyas-panel-helye.md` 17.5 szerint a hívás ténye, nem a függőségi lánc.

Túlzó vagy pontatlan állítások (alacsony súly, pontosítva forrással): `localStorage` hibák (HTML
Web Storage, MDN `setItem`), `pushState` `unused` paraméter (MDN), APG régió címke ("kerülendő",
nem "tilos"), `pointercancel` utáni események (Pointer Events 3, 4.1.3.3), ContextMenu `tabindex`
(APG Menubar), ButtonGroup név (APG Names and Descriptions: Discretionary), a Zod `when` kivétele
megszakító hiba után (zod 4.4.3 `v4/core/util.js` 536-545), a `hasPointerEvents` idézet
(`index.mjs` 2266), `-1px` margó átfedés, a mérő config elavult indoka. Forrás került a hiányzó
helyekre: dagre wiki, HTML number állapot, form beküldés, beágyazott `discriminatedUnion` (zod
4.4.3 `v4/core/schemas.js` 1128-1159), SQLite elsődleges kulcs hibakód (research
`2026-09-27-szerver-hibatorzs.md`), happy-dom `getBoundingClientRect` (20.11.6 `Element.js`).

Research fájlok (alacsony súly, javítva): `DOMMatrixReadOnly` pontosság (Geometry Interfaces
`double`, Chromium 151 mérés), az `all` és a `d` tulajdonság (CSS Cascade 4, mérés), egy feltevés
"nem ellenőrzött" jelölése, a `measured?.width ?? width ?? initialWidth` lánc fájl:sorral, a
`getElementsToRemove` csomagja és sora, a happy-dom `removeEventListener` sorrendje, a `useKeyPress`
újrakötés helye, egy hibás szekció hivatkozás, a felhasználói W3C wiki lap cseréje (SVG 2 15.6), az
RFC 9562 szakaszszámai, a `beforeunload` Chrome verzió (a források 117 és 119 között eltérnek: nem
ellenőrzött), a w3c/editing #509 jellege (megfigyelt viselkedés, nem spec), és egy személyes fork
link cseréje a WHATWG spec horgonyára. A `2026-10-14-kotelezo-mezok-es-start.md` elavult Zod
mondata "Felülírva" jelölést kapott.

## 5. Megkerülhető szabály

Mind injekcióval igazolva egy eldobható worktree-ben (a régi teszt zöld maradt, a javított bukik).

| Védelem                               | Jóhiszemű kerülő alak                                            | Súly     | Rendezés                |
| ------------------------------------- | ---------------------------------------------------------------- | -------- | ----------------------- |
| greppes (15) mért geometria           | `node.measured?.width`                                           | magas    | javítva                 |
| greppes (8) időkorlát szám            | `setTimeout(() => ..., 5000)`, `durationMs: 4000`                | magas    | javítva                 |
| töréspont invariáns                   | `(width >= 900px)`, `767.98px`, `em`, `@container`               | magas    | javítva                 |
| `playwright-worker-limit`             | `playwright test --workers=6` scriptben                          | magas    | javítva                 |
| `e2e-coverage-threshold`              | `.nycrc.json` `exclude` listával (az `apps` mappában is)         | magas    | javítva                 |
| `browser-safe-imports`                | workspace csomag a `devDependencies` alatt                       | magas    | javítva                 |
| greppes (19) `rf__` locator           | `getByTestId(KONST)`, regex, `[data-testid="foo"]`               | közepes  | javítva                 |
| greppes (20) kézi időzítés            | `setInterval` pollozás                                           | közepes  | javítva                 |
| greppes (8) origin                    | `127.0.0.1`, `[::1]`, `:3001`                                    | közepes  | javítva                 |
| greppes (13) proxy időkorlát          | `proxyTimeout`                                                   | közepes  | javítva                 |
| greppes (5) `EventSource`             | `new globalThis.EventSource(`                                    | közepes  | javítva                 |
| greppes (6) Navigation API            | csupasz `navigation.addEventListener`                            | közepes  | javítva                 |
| greppes (14) dagre opciók             | `ranker`/`align` felülírás                                       | közepes  | javítva (pozitív lista) |
| greppes (22) kártya méret             | `max-width: 358px` CSS-ben                                       | közepes  | javítva                 |
| greppes (11), (12) `package.json`     | tiltott függőség a `packages/ui` manifesztjében                  | közepes  | javítva                 |
| `run-view-layout-band`                | `matchMedia('(min-width: 900px)')` más fájlban                   | közepes  | új (24) invariáns       |
| `topnav-shell-byte-identity`          | későbbi `@media` felülírja a lánc tulajdonságot                  | közepes  | javítva                 |
| `*-byte-identity` (hét fájl)          | a jelölő ELÉ tett, erősebb szabály                               | közepes  | javítva                 |
| `screenshot-pipeline`                 | Chrome headless `--screenshot` shellből és `execFileSync`-ből    | közepes  | javítva                 |
| `screenshot-pipeline`                 | `page.pdf({ path })`, `--print-to-pdf`                           | alacsony | lezárva: 14. szekció    |
| greppes (17) görgetési geometria      | `getClientRects()`, `innerHeight`                                | alacsony | javítva                 |
| greppes (18) `role="alert"`           | `role={'alert'}`                                                 | alacsony | javítva                 |
| greppes (3) `.parse(`                 | `.parseAsync(`                                                   | alacsony | javítva                 |
| `e2e-stream-server-free-port`         | `({ port = 4174 } = {})`                                         | alacsony | javítva                 |
| `node-config-drift-protection`        | a `protocol` szám mezői `z.number()`, a `db` pozitív egészet vár | magas    | nyitott: O-37           |
| `AgentDefinitionEntryFields.spec.tsx` | a három nem megerősített mezőhöz vezérlő került volna            | közepes  | új unit teszt           |

A szigorítás kimondott, szándékos ára (a független ellenőrzés mérte, ma egyik sem bukik): a (19) a
`rf__` értéket adó segédfüggvényt, a (24) a `prefers-*` literált tartó konstanst nem engedi, a
(6) egy `navigation` nevű helyi változó tagelérését buktatja. A `playwright-worker-limit` rövid `-j`
alakja a független ellenőrzés után csak a `playwright` vagy `test:e2e` sorban tiltott (a `make
-j4` és a `jq -j` nem hamis pozitív). Nyitva maradt, nem kért rések: `@import ... (min-width)`, a
`ch`/`vw`/`pt` egység a töréspont invariánsban, és a nyc parancssori `--exclude`/`--include`
kapcsolója a riport scriptben.

## 6. Elszakadt CSS

- **Bájtazonosság: nincs hiba.** A `resizable.css`, `context-menu.css`, `pagination.css`,
  `drawer.css` a forrással bájtra azonos az `@import` sor kivételével; a `tooltip.css` komponens
  blokkja bájtra azonos, a kimaradt demó szabályok pontosan a fejlécben felsoroltak. A lenyomat
  literálok a forrásból újraszámolva egyeznek. A `tooltip-hover-bridge.css` 10 px-es hídja a forrás
  220., 236., 251. és 266. sorának `calc(100% + 10px)` távolságával egyezik.
- **Media query: nincs kitalált literál.** Minden szélesség alapú literál (1024, 768, 640) token
  érték, a három `matchMedia` konstanshoz tokenből olvasó teszt tartozik.
- **Talált, javítva:** a `.graph-node-card` kártya alakú saját osztály jelzés nélkül állt (a fejléc
  kimondja, hogy nem a `.card`); a `menu.css` fejléce három eltérést nem sorolt fel; a
  `node-inspector.css` a `drawer.css` reduced-motion szabályát kimondás nélkül hagyta ki (átemelve
  a `.node-inspector__close`-ra, ez a diff egyetlen viselkedés változása).

## 7. A PLAN-009 T-009-34 külön tételei

- **A locator kivétel nem terjedt túl.** 119 `getByTestId` hívás, mind `rf__` előtagú, mind
  csomópont, él vagy vászon konténer; a termékkód nem ad saját `data-testid` attribútumot.
- **A `node-config` séma nem szűkíti a két rekordot.** Az `agents` és a merge `settings`
  `z.record(z.string(), z.unknown())`; a mentési séma `superRefine`-ja egyiket sem nézi; kliens
  oldali saját validáló nincs. Rés: a sodródás védelem futásidejű ága csak üres `agents` mintát
  próbál, tehát egy `z.infer` típust nem változtató szűkítést (pl. `.refine`) nem fogna. Nem
  javítva, alacsony.
- **Az `agents` űrlap nem ajánlja fel a három mezőt.** A `criticalSystemReminder_EXPERIMENTAL`,
  az `observer` és az `observerMessage` csak olvasható sorként jelenik meg, ugyanaz a lista a
  SPEC-008 M-90-ben, a PLAN-009 T-009-18-ban, a research-ben és a kódban. Javítva a teszt rés: új
  unit teszt állítja, hogy nincs hozzájuk vezérlő. Mellékes találat: az 5.2 "üresen nem menthető"
  szabálya a `description`/`prompt` mezőre nincs megvalósítva (O-38).

## 8. A mai munka kockázatai

- **Zod `when`: javítva.** A `superRefine` második paramétere a zod 4.4.0-ban jelent meg (registry
  tarball: a 4.3.6 `v4/classic/schemas.d.ts` 39. sora egyparaméteres, a 4.4.0-é `params?:
core.$ZodSuperRefineParams`; a release v4.4.0 és a colinhacks/zod #5741). A `packages/protocol`
  alsó határa `^4.4.0`, a toolchain research új szekciója és egy regressziós teszt őrzi.
- **`nokey`: dokumentálva.** A reactflow.dev API referencia nem említi; a telepített
  `@xyflow/system` 0.0.82 `isInputDOMNode` (914-923) kezeli, és a karbantartók ajánlják
  (xyflow/xyflow #2254, #5037, #5729). A kód kommentje kimondja, a regressziót a
  `graph-node-delete.spec.ts` e2e őrzi.
- **Chrome history intervention: rendben, a levezetés jelölve.** A SPEC-008 és a research fő
  állítása egyezik a Chromium dokumentummal; az `Esc` és a modál viselkedése levezetés, amit a spec
  maga is "levezetett, nem mért"-nek mond. Két, a Chromium csapattól független elsődleges forrás
  nincs: nem ellenőrzött (a research 57.6 is így jelöli).
- **Tooltip híd: rendben.** A WCAG 2.2 1.4.13 "Hoverable" szövege egyezik a fejléccel; a
  pszeudo elem találata a szülőre irányul (csswg-drafts #4398, #12163, WPT), normatív mondat
  nélkül; a `[hidden]` elem `display: none`, tehát zárva nincs találati felület.

## 9. Elavult és ellentmondó dokumentáció

A SPEC-008 és a PLAN-009 átvezetései (javítva): az M-94 és az O-5 lezárva, a d3-hierarchy elvetés
indoka, az `aria-valuemin`/`max` a port szerint, tizenegy szerkesztett plusz két olvasható agent
mező, a döntés előtti állapotok jelölése (M-111, M-123, 606, 669, 685), a beállítás képernyő és az
öt útvonal (18., 54. kritérium, T-009-12), a tizenhat async és három nem-async pont (35. kritérium,
DoD 15), a `react-window` 2.3.1, a ratchet szabály (51. kritérium, PLAN-009 négy helye), a
nyitott kérdések száma (55. kritérium, DoD 20), a T-009-27 kulcsa és a panel helye, a T-009-24
költség megjelenítése, és research hivatkozások pótlása. A `CLAUDE.md` fájlok: verziószámok és
mérési narratíva helyett research hivatkozás (`apps/web`, `packages/ui`, `packages/engine`), a
mérő eszköz lista kiegészítése, a szabálykönyv e2e futtatási hivatkozása, a SPEC-002 4. és a
SPEC-005 3.4 a `protocol` `typeguards` függőségéről.

## 10. Nyitott kérdések

A SPEC-008 14.2 hat tételt tart, mindegyik a "mi a viselkedés addig" és a "mi zárná le" mezővel:

- **O-34** (érték): az alapértelmezett arányok (`[70, 30]` kétszer, a `Resizable` 50 százaléka).
- **O-35** (érték): a felületi értékek (600 súly, handle elosztás, `rows={6}`, a skeleton 4 sora,
  a "legalább három mező" küszöb).
- **O-36** (mérés): az e2e és a mérő segédek forrás nélküli számai.
- **O-37** (termékdöntés): a szám mezők szabálya a mentési sémában és az üzenet szövege.
- **O-38** (termékdöntés): az `agents` `description`/`prompt` "üresen nem menthető" szabálya.
- **O-39** (termékdöntés): a `fan_out`/`loop` tételes lista a csomópontra kattintva.

A szabálykönyv 14. szekciója új, 1. tételt kapott: a 15. szekció tiltja a nyers mért számot, a 11.
és 12. szekció PLAN-009 alatti bejegyzései hordozzák. A 12. szekció új bejegyzése nyitva hagyta a
`page.pdf` hatókörét. **A három termékdöntés (O-37, O-38, O-39), a `page.pdf` és a 14. szekció
tétele a user 2026-10-17-i döntésével lezárult, lásd a 14. szekciót.** Termékdöntésként jelezve, de nem felvett tétel: a jóváhagyás panel betöltés
közbeni `ProgressBar value={100}` jelzése a képernyőolvasónak 100 százalékot mond (a design system
határozatlan változata nincs átemelve).

## 11. Amit NEM talált

- **Bájtazonossági eltérés** a hat átemelt CSS-ben és a lenyomat literálokban: nincs.
- **Kitalált media query literál**: nincs.
- **A locator kivétel túlterjedése**: nincs.
- **A két rekord alak szűkítése** a sémában vagy a kliensen: nincs.
- **A három nem megerősített mező szerkeszthetősége**: nincs.
- **`waitForTimeout`, kézi `setTimeout`/`sleep` az e2e kódban**: nincs (a `measurement/` időzítői
  nem szivárogtak át).
- **Forrás nélküli szám** az `apps/server`, a `packages/db` és a `packages/engine` termékkódjában:
  nincs (csak mérési próza, javítva).
- **Rés** az `error-class-drift-protection`, a `design-token`, a `self-hosted-font` és a
  `brand-mark` védelemben: nincs.
- **Cáfolt könyvtári állítás** a SPEC-008 mérés táblájának telepített forrással ellenőrzött
  soraiban: nincs; a szúrópróbában ellenőrzött 26 research forrás hivatkozásból egyik sem cáfolt.

## 12. Áthelyezett mérési próza

A kódból törölt, máshol a `docs/research` alatt nem álló mérési mondatok szó szerint, a `633e3a5`
állapot sorszámával. Nyers rekordjuk a repóban nincs, újramérésük nem történt: nem ellenőrzött,
historikus adat.

- `apps/web/src/node-inspector/node-inspector.css:183-189`: "A fenntartott magasság a
  `--ep-space-5` token (20px), NEM a nála kisebb `--ep-space-4` (16px): a hibaüzenet a
  `--ep-text-meta` tokent viseli, ami `500 12px/1.4`, tehát a tényleges sormagassága 16,8px. 16px-es
  fenntartott sorral a mérés 0,8px elmozdulást mutatott a szomszédos mezőn
  (`apps/web/e2e/node-inspector.spec.ts`, "a hibaüzenet megjelenése nem tolja el a szomszédos
  mezőt"); a következő skálalépcső ezt nullára viszi."
- `apps/web/src/node-inspector/node-inspector.css:207-209`: "Enélkül a csoportosító dobozok üres,
  fenntartott sora mérten 32px felesleges rést nyitott a mezők között."
- `apps/web/src/node-inspector/node-inspector.css:81-85`: "Chromium 141 alatt mérve a korábbi
  `<Button variant="ghost" size="sm" icon>` bezáró gomb számított `color` értéke pontosan
  `rgb(138, 98, 32)` volt" (az `rgb` érték a `2026-09-09-elem-audit.md` 10. szekciójában áll, a
  Chromium verzió nem).
- `apps/web/src/graph-node-catalog/graph-node-catalog.ts:40-43`: "a végrehajtás során ezt egy
  pillanatra szándékosan kivett `script` bejegyzéssel is igazoltuk - a `bun run typecheck`
  `TS2741` hibával bukott ("Property 'script' is missing"), majd a bejegyzés visszaállítása után
  újra zöld lett."
- `apps/web/src/run-view/run-view-layout.ts:36-45`: "Másrészt MÉRT alsó korlát is van: a React Flow
  `minZoom` alapértelmezése `0.5`, a `fitView` pedig `zoom = szélesség / (tartalom * (1 + padding))`
  alakban számol, tehát a bemutató gráf 1582 pixeles tartalmi szélességéhez az 1440 pixeles
  referencia ablakon legalább 1582 * 0.5 * 1.1 = 870 pixel, azaz a szélesség kb. 61 százaléka
  kell, különben a nézet a `minZoom`-on megáll és a gráf jobb széle levágódik" (a számtan
  pontatlan: 870/1440 = 60,4 százalék).
- `apps/web/src/run-event-row/run-event-row.css:67`: "enélkül a cím egy 400 karakteres URL-nél mért
  3400 pixelre feszülne." (A `2026-09-23-transcript-panel-meresek.md` 4. szekciójának mért értékei
  mások.)
- `apps/web/src/run-graph/run-graph.css:23-25`: "nem reagált: a Playwright mérése szerint a
  `.react-flow__pane` fogta el a pointer eseményt."
- `apps/web/e2e/approval-prompt.spec.ts:912-914`: "Egy 240 pixeles húzásnál már a "Jóváhagyás"
  gomb is vízszintesen kilóg (mérve 0,87 arány): az a fix gombsor szélessége, nem a felfedés
  kérdése, a lezárt O-13 tétel rokona"

## 13. Ismert, nem javított apróságok

Alacsony súlyú, a felderítés által jelzett, de ebben a lépésben nem javított tételek: az
`apps/web/CLAUDE.md` egy `lucide` verziószáma; a szabálykönyv 2. szekciójának "nincs `gh`"
mondata a mai futtatókörnyezetben; a 15. szekció "a hibák a 11. szekcióba kerülnek" mondata (a
buktatók a 12. szekcióban állnak); a PLAN-009 T-009-4 történeti `react-window@2.3.0` említése; a
`2026-09-24-jovahagyas-panel-helye.md` 519. sorának "4,98 pixel" állítása (a 9.2 szekció 5 pixelt
ír); a research 9.4 és 10.3 eltérő mért értéke (69 és 74, a spec a 74-et hozza, az ok nem
ellenőrzött); az `approval-prompt.spec.ts` 60 pixeles pontos egyenlősége tört magasságnál
bukhatna (ma zöld); a `form-control-typography.spec.ts` szín állítása a számított `color`-on, nem
pixelen (bizonytalan).

## 14. A user döntései (2026-10-17) és az átvezetés

A döntések szövege a user szavaival, az átvezetés helye mellettük.

| Tétel                                       | Döntés                                  | Átvezetés                                                                                                       |
| ------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| O-37 szám mezők szabálya                    | "Mező alatti hiba."                     | SPEC-008 14.1 O-37 és 5.4, PLAN-009 T-009-60                                                                    |
| O-38 `agents` kötelező mezői                | "Üresen ne legyen menthető."            | SPEC-008 14.1 O-38 és 5.4, PLAN-009 T-009-60                                                                    |
| O-39 tételes lista a csomópontra            | "Épüljön meg most"                      | SPEC-008 14.1 O-39 és 6.3, PLAN-009 T-009-61                                                                    |
| `page.pdf({ path })`, `--print-to-pdf`      | "Igen, tiltsuk."                        | `screenshot-pipeline.spec.ts`, `2026-09-25-kepernyokep-vedelem-hatokor.md` 8. szekció, szabálykönyv 12.         |
| Playwright CLI `pdf`, CDP `Page.printToPDF` | a "Igen, tiltsuk." teljes megvalósítása | `screenshot-pipeline.spec.ts`, `2026-09-25-kepernyokep-vedelem-hatokor.md` 8.5 és 8.6 szekció, szabálykönyv 12. |
| Nyers mért számok a szabálykönyvben         | "Research hivatkozásra."                | szabálykönyv 11. és 12. szekció, 14. szekció tétele törölve; a számok a hivatkozott research szekciókban állnak |

**Ami az átvezetés után nyitva maradt.** A T-009-61 (O-39) megvalósítása előtt a megjelenítés módja
nincs rögzítve (SPEC-008 6.3), ezért a lépés megáll és kérdez.

**Lezárva a koordinátori review után (2026-10-17).** A Playwright CLI `pdf` alparancsa és a CDP
`Page.printToPDF` metódusa a PDF tiltásba került (`2026-09-25-kepernyokep-vedelem-hatokor.md` 8.5 és
8.6 szekció). A `better-sqlite3`, a `@xyflow/react` és a `@playwright/test` verziószáma és a telepített
forrás sorszámai kikerültek a szabálykönyvből (a 12. szekció SQLite elsődleges kulcs és billentyűs
törlés bejegyzése, a 11. szekció SSE mockolás bekezdése), a research szekciókra hivatkozás vette át a
helyüket. A szabálykönyvben bent maradtak: a hivatalos dokumentációból származó értékek (az 5000 ms és a
30000 ms alapértelmezés, a futtató gépek hivatalos erőforrás adatai), a CSS és a viewport konfigurációs
értékei, az azonosítók (futás azonosítók).
