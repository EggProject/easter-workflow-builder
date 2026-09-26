# Képernyőkép védelem: videó, trace, kiterjesztések és hatókör (2026-09-25)

Kiváltó esemény: egy független ellenőrzés a `decfa69` commiton további kerülő utakat mért a
`tooling/scripts/src/screenshot-pipeline/` védelmén, és a user 2026-09-25-én döntött a hatókörről
(`.claude/CLAUDE.md` 12. szekció). Ez a fájl a döntések végrehajtásához szükséges, forrással
igazolt tényeket és a saját méréseket tartja. A kódban csak a szekció száma áll.

Minden tény két független forrásból: a hivatalos playwright.dev (illetve typescriptlang.org)
dokumentáció, és a telepített csomag saját forrása vagy típusdefiníciója
(`node_modules/.bun/playwright@1.62.1/node_modules/playwright/`, a továbbiakban `playwright`, és
`node_modules/.bun/playwright-core@1.62.1/node_modules/playwright-core/`, a továbbiakban
`playwright-core`).

## 1. A `use` videó opciója

- **Doksi:** <https://playwright.dev/docs/test-use-options>, "Recording Options": a képernyőkép, a
  videó és a trace alapból ki van kapcsolva, és "Trace files, screenshots and videos will appear
  in the test output directory". A "Video modes" táblázat hét módot sorol fel (`off`, `on`,
  `retain-on-failure`, `retain-on-first-failure`, `retain-on-failure-and-retries`,
  `on-first-retry`, `on-all-retries`). <https://playwright.dev/docs/videos>: "By default videos are
  off", és az objektum alak `{ mode, size, show }`.
- **Telepített forrás:** `playwright/types/test.d.ts` 7101. sor: a típus
  `VideoMode | 'retry-with-video' | { mode: VideoMode, size?, show? }`, a 7106. sor a `VideoMode`
  uniója a fenti hét értékkel; a leírás szerint "Defaults to `'off'`".
- **Következmény:** a kikapcsolt állapot egyetlen szó szerinti alakja a `'off'` string. A védelem
  zárt listája csak ezt engedi (user döntés 2026-09-25: a videó felvétel is kép).

## 2. A böngésző kontextus videó felvétele

- **Doksi:** <https://playwright.dev/docs/videos>: kézzel létrehozott kontextusnál a felvételt a
  `browser.newContext()` videó opciója indítja egy megadott könyvtárba.
- **Telepített forrás:** `playwright-core/types/types.d.ts` 11326. sor (és a többi
  kontextus létrehozó metódusnál ugyanígy): "Enables video recording for all pages into
  `recordVideo.dir` directory. If not specified videos are not recorded."
- **Következmény:** az opciónak nincs kikapcsolt értéke, a hiánya a kikapcsolt állapot. A védelem
  ezért a nevének bármely előfordulását tiltja.

## 3. Az oldal screencast objektuma (Playwright 1.62)

- **Doksi:** <https://playwright.dev/docs/api/class-screencast>, `start`: "When path is provided,
  it saves video recording to the specified file. When onFrame is provided, delivers JPEG-encoded
  frames to the callback."
- **Telepített forrás:** `playwright-core/types/types.d.ts` 5752. sor (az oldal `screencast`
  mezője) és 18107. sor (ugyanez a leírás a `start` metódusnál).
- **Következmény:** a screencast képernyőkép hívásnak számít a védelemben: a `path` opció és a
  képkockák lemezre írása ugyanúgy tiltott a képernyőkép körben, mint a képernyőképé; a
  memóriában maradó képkocka nem.

## 4. A trace kikapcsolt alakja és a CLI kapcsoló

- **Doksi:** <https://playwright.dev/docs/test-use-options>, "Trace modes": az `on-first-retry` mód
  "first retry only" rögzít, az `off` soha. <https://playwright.dev/docs/trace-viewer>: az
  `on-first-retry` "will produce a `trace.zip` file for each test that was retried", újrapróbálkozás
  nélkül tehát nem keletkezik trace. <https://playwright.dev/docs/test-cli>: a `--trace <mode>`
  kapcsoló "Force tracing mode", ugyanazzal a hét értékkel.
- **Telepített forrás:** `playwright/types/test.d.ts` 7105. sor (`TraceMode`), és
  `playwright/lib/program.js` 221. sor: `"--trace <mode>", { description: "Force tracing mode",
choices: kTraceModes }`.
- **Következmény:** az `apps/web/playwright.config.ts` a `retries: 0` mellett halott
  `on-first-retry` módról a szó szerinti `'off'` értékre vált. A `--trace` kapcsoló a shell és a
  `package.json` scriptben ugyanazt a zárt listát kapja: csak az `off` érték engedett.

## 5. A vizsgált kiterjesztések halmaza

- **Telepített forrás:** `playwright/lib/common/index.js` 1179. sor: a Playwright betöltő
  pontosan a `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.mts`, `.cjs`, `.cts` kiterjesztésre
  regisztrálja a saját átalakítását, és a 476. sor a kiterjesztés nélküli import feloldását is
  ezen a nyolcon próbálja. A 639. sor az alapértelmezett `testMatch` minta:
  `**/*.@(spec|test).?(c|m)[jt]s?(x)`.
- **Doksi:** <https://playwright.dev/docs/api/class-testconfig#test-config-test-match> ugyanezt a
  mintát adja meg alapértékként. A TypeScript modul referencia
  (<https://www.typescriptlang.org/docs/handbook/modules/reference>) a `.ts`, `.tsx`, `.mts`,
  `.cts`, `.js`, `.jsx`, `.mjs`, `.cjs` (és a `.d.*`) fájlokat ismeri modulként.
- **Következmény:** a `testMatch` minta formálisan a `.mtsx` jellegű alakokat is illeszti, de a
  betöltő ezekre nem regisztrál átalakítást, ezért a védelem a nyolc betölthető kiterjesztést
  vizsgálja. A korábbi listáról a `.jsx` hiányzott. A `.d.mts` és a `.d.cts` a `.mts` és a
  `.cts` végződéssel együtt vizsgált.

## 6. Mérések (saját, 2026-09-25)

**Injekciók.** Egy ideiglenes git indexen (`GIT_INDEX_FILE`, a valódi index érintetlen) egyenként
felvett, nem commitolt fájlok, a spec fájl önálló futtatásával:

| Injekció                                             | Régi alak (`decfa69`) | Új alak                      |
| ---------------------------------------------------- | --------------------- | ---------------------------- |
| `.jsx` fájl: JPEG képernyőkép plusz `writeFileSync`  | 8/8 zöld              | az (1) bukik, a fájlt nevezi |
| `package.json` script: a CLI `screenshot` alparancsa | 8/8 zöld              | az (1) bukik                 |
| `.bash` fájl: a CLI `screenshot` alparancsa          | 8/8 zöld              | az (1) bukik                 |
| config: videó opció `'on'`                           | 8/8 zöld              | az (1) bukik                 |
| config: videó opció feltételes kifejezéssel          | nem futott            | az (1) bukik                 |
| config: videó opció objektummal                      | nem futott            | az (1) bukik                 |
| a kontextus videó felvétele                          | 8/8 zöld              | az (1) bukik                 |
| az oldal screencast felvétele `path` opcióval        | 8/8 zöld              | az (1) bukik                 |
| `package.json` script: `playwright test --trace on`  | 8/8 zöld              | az (1) bukik                 |

A commitolt fán 9/9 zöld.

**Gyengítések.** A spec fájl egy-egy pontú módosítása, önálló futtatással, utána visszaállítva:
mind a harmincöt bukik. Az őrző blokkok gyengítése (az (1) állítás elhagyása, szűrése, opció
objektumos kihagyása; a (2) állításának semlegesítése; a (8) és a (9) kihagyása vagy az
állításuk törlése; a leírás blokk kihagyása; a lenyomat konstans vagy a blokk jelek átírása; a (7)
egy állításának törlése vagy a ciklusa kiürítése) a (8) és/vagy a (9) invariánson bukik. A
(2) két konstansának semlegesítése, a nyolc kód kiterjesztés és a két shell kiterjesztés
egyenkénti kivétele, a `require` és az `import` import-él törlése, a kivétel lista bővítése vagy a
kivétel kiterjesztése a képernyőkép körre, a `package.json` ellenőrzés, a videó opció, a
kontextus videó, a screencast, a `--trace` kapcsoló és a shell ellenőrzés kiiktatása a (7)
invariánson bukik. AST elemzést egyik sem igényelt.

A (8) és a (9) invariáns, amire a bekezdés hivatkozik, 2026-09-25 óta törölve, lásd a 7. szekciót.

**E2E futás.** A config változás után a `playwright test e2e/design-tokens.spec.ts
e2e/skeleton-theme.spec.ts` a gép Playwright zárján (`flock`) lefutott (3/3 zöld), és a teszt
kimeneti könyvtárban a `.last-run.json` fájlon kívül semmi nem keletkezett (nulla `.webm`, `.zip`,
`.png`, `.jpeg`). A betöltött config `use` mezője mindkét Playwright configban
`{ trace: 'off', video: 'off' }` (Node type stripping, közvetlen import).

## 7. Egyszerűsítés: a hatókör a megvalósításban, a lenyomat törlése, három rés (2026-09-25)

Kiváltó esemény: egy független ellenőrzés a `0bf5685` commiton mérte, hogy a hatókör mondata hű,
a megvalósítás nem (a kapu a termékkódot is olvasta), hogy a (8) és a (9) lenyomat invariáns
túlbonyolítás, és három jóhiszemű rést talált. A döntések a `.claude/CLAUDE.md` 12. szekció
hetedik bejegyzésében állnak, itt a tények és a mérések.

### 7.1 A JavaScript kiterjesztésű import TypeScript párja

- **Telepített forrás:** `playwright/lib/common/index.js` 471. sor, `kExtLookups`: a betöltő a
  nem létező `.js` fájl helyett sorban a `.jsx`, `.ts`, `.tsx`, a `.jsx` helyett a `.tsx`, a
  `.cjs` helyett a `.cts`, a `.mjs` helyett a `.mts` fájlt próbálja.
- **Doksi:** <https://www.typescriptlang.org/docs/handbook/modules/reference.html>, "File
  extension substitution": a `/mod.js` futásidejű keresés TypeScript párja `/mod.ts`, `/mod.tsx`,
  a `/mod.mjs` párja `/mod.mts`, a `/mod.cjs` párja `/mod.cts`.
- **Független megerősítés:** a Turborepo `64e5946` commitja
  (<https://github.com/vercel/turbo/commit/64e5946522b319cee5efceb2ce105ce49ab3d3bf>) ugyanezt
  a leképezést valósítja meg a `nodenext` feloldásra.
- **Következmény:** az import feloldás a pontos fájlnév és a kiterjesztés nélküli alak mellett a
  betöltő leképezését is próbálja (`JAVASCRIPT_EXTENSION_SUBSTITUTES`).

### 7.2 Mi kerül a hiba esetén feltöltött artefaktumba

- **Telepített forrás:** `playwright/lib/index.js` 700. sor: hibás teszt után a futó a teszt
  kimeneti könyvtárába `error-context.md` fájlt ír (`lib/errorContext.js`
  `buildErrorContext`: utasítás, a teszt adatai, a hibaüzenet, az oldal akadálymentességi
  pillanatképe), és ez az automatikus `_setupArtifacts` fixtúrában fut, a trace és a
  képernyőkép beállítástól függetlenül.
- **Független megerősítés:** a `microsoft/playwright` #39670 PR
  (<https://github.com/microsoft/playwright/pull/39670>) vezette be a hibás tesztenkénti
  `error-context.md` fájlt.
- **Doksi:** <https://playwright.dev/docs/test-reporters>: a HTML riport alapból a
  `playwright-report` mappába kerül; a `list` reporter csak a terminálra ír.
- **Doksi:** <https://github.com/actions/upload-artifact#uploading-hidden-files> és a v4.4.0
  kiadási jegyzet (<https://github.com/actions/upload-artifact/releases/tag/v4.4.0>): a ponttal
  kezdődő fájlokat a lépés alapból kihagyja (`include-hidden-files` alapértéke `false`).
- **Saját mérés:** egy ideiglenes, a repón kívül tartott Playwright config (`trace: 'off'`,
  `video: 'off'`, `reporter: 'list'`) egy bukó és egy zöld teszttel, a gép Playwright zárján
  (`flock`): a `test-results` alatt pontosan a `.last-run.json` és a bukó teszt
  `error-context.md` fájlja keletkezett, `playwright-report` mappa nem.
- **Következmény:** a `ci.yml` "Upload Playwright report" lépése (307-312. sor) nem halott: hiba
  esetén a hibás tesztek `error-context.md` fájljait tölti fel. A `**/playwright-report/**`
  mintája és a lépés neve viszont halott, trace fájl pedig nem keletkezik. A `ci.yml`
  érintetlen (workflow fájlt a munkamenet tokenje nem pusholhat); a SPEC-001 12. szekció
  artefaktum táblázata javítva.

### 7.3 A változtatás

- A termékkód (a `packages/*/src` és az `apps/*/src` nem teszt fájlja) csak akkor vizsgált, ha
  Playwright csomagot importál (`@playwright/*`, `playwright`, `playwright-core`). A commitolt fán
  ma egy ilyen fájl sincs.
- A pillanatkép assertion (`toMatchSnapshot`) író minta lett, nem közvetlen: a Vitest azonos
  nevű assertionje szöveges pillanatképet ír, nem böngésző képet, a képernyőkép körben viszont a
  kép a hívóig eljut, és ott bukik.
- A YAML (`.yml`, `.yaml`) a shell scriptekkel azonos ellenőrzést kap.
- A nem `off` értékű `--trace` kapcsoló a `playwright` szó nélkül is tiltott. A commitolt fán
  nincs más eszköz pontosan `--trace` nevű kapcsolója (mérve: nulla találat a shell, YAML és
  `package.json` fájlokban).
- A (8), a (9), a `GUARD_BLOCK_MARKERS`, a `GUARD_BLOCKS_SHA256` és a `SELF_FILE` törölve (50 nem
  üres sor). A (7) megmaradt, és új esetei a fenti négy pontot őrzik.

### 7.4 Mérések (saját, 2026-09-25)

**Módszer.** A HEAD fája (`git archive`) két ideiglenes, a repón kívüli git repóba kibontva: az
egyikben a régi, a másikban az új spec fájllal. Az injekciók ezekben a próba fákban készültek,
a spec fájl a repóból futott, `GIT_DIR` és `GIT_WORK_TREE` a próba fára mutatva (a valódi index és
munkakönyvtár érintetlen). A régi alak futtatásához a repóbeli spec fájl ideiglenesen a HEAD
állapotra állt, utána vissza.

| Injekció (termékkód, illetve unit teszt)                                      | Régi alak (`0bf5685`) | Új alak |
| ----------------------------------------------------------------------------- | --------------------- | ------- |
| naplózási szint `trace` kulcsa a `packages/logger` egy fájljában              | az (1) bukik          | 7/7     |
| MIME térkép `video` kulcsa a `packages/core` egy fájljában                    | az (1) bukik          | 7/7     |
| Vitest pillanatkép assertion egy termékfájlban                                | az (1) bukik          | 7/7     |
| Vitest pillanatkép assertion egy `packages/logger` unit tesztben              | az (1) bukik          | 7/7     |
| `'screenshot'` literál a `tool-minimax-understand-image` egy fájljában        | az (1) bukik, 2 fájl  | 7/7     |
| képernyőkép hívás egy kommentben a `packages/core/src/index.ts` fájlban       | az (1) bukik, 31 fájl | 7/7     |
| workflow lépés: `bun x playwright test --trace on` a `ci.yml` fájlban         | 9/9                   | az (1)  |
| `package.json` script: `bun run test:e2e -- --trace=on`                       | 9/9                   | az (1)  |
| e2e: `import { save } from './inj-save.js'` egy `.ts` író fájlra, JPEG képpel | 9/9                   | az (1)  |

A korábbi tizennyolc kerülő út (a `741f63e` három, a `decfa69` hat és a `0bf5685` kilenc
injekciója: `.jsx` író, `package.json` és `.bash` CLI képernyőkép, a videó opció három alakja, a
kontextus videó, a screencast `path` opciója, a `package.json` `--trace on`, a rövidített és a
másik fájlban álló `path`, a nem literál képernyőkép opció, a CDP képernyőkép, a trace két alakja,
a JPEG plusz `writeFileSync`, a stream és a két fájlra bontott író) az új alakon egyenként az (1)
invariánson bukik, a fájlt megnevezve. Az injekció nélküli fán a régi alak 9/9, az új 7/7 zöld.

**Az új kód gyengítései.** A spec fájl egy-egy pontú módosítása a próba fán, utána visszaállítva:
a YAML kivétele a listából, a `playwright` szó feltételének visszaállítása a `--trace` kapcsolóra,
a JavaScript kiterjesztés párjainak törlése, a termék szűrő törlése, a Playwright import kivétel
törlése, a teszt fájl kivétel törlése, a pillanatkép assertion törlése az író mintából, és
visszahelyezése a közvetlen mintába: mind a nyolc a (7) invariánson bukik (6/7).

**Elfogadott korlát (a hatókör következménye).** Egy termékcsomag író függvénye, amit egy teszt
a képével hív, nem látszik, mert a termékkód fájlírása a hatókörön kívül esik; az eszköz
csomagban (`tooling/*`, `tools/*`) álló ugyanilyen függvény továbbra is bukik (a (7) esete).
