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

**E2E futás.** A config változás után a `playwright test e2e/design-tokens.spec.ts
e2e/skeleton-theme.spec.ts` a gép Playwright zárján (`flock`) lefutott (3/3 zöld), és a teszt
kimeneti könyvtárban a `.last-run.json` fájlon kívül semmi nem keletkezett (nulla `.webm`, `.zip`,
`.png`, `.jpeg`). A betöltött config `use` mezője mindkét Playwright configban
`{ trace: 'off', video: 'off' }` (Node type stripping, közvetlen import).
