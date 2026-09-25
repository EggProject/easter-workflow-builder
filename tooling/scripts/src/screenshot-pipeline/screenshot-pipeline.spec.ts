// GÉPI KÉNYSZER a képernyőkép készítés egyetlen szentesített útjára
// (2026-09-15, felhasználói kérés).
//
// A MÉRT HIBA, ami ezt a fájlt indokolja. A gráf éleinek eltűnése a
// szállított képernyőképeken HÁROMSZOR ment ki késznek jelentve. Az ok
// mindháromszor ugyanaz: a képernyőkép készítő script a repón KÍVÜL,
// eldobható helyen élt, minden munkamenet újraírta, és üres `edges` tömböt
// vagy két csomópontra szűkített gráfot adott a `readWorkflowGraph` mockon. A
// termékkód végig hibátlan volt
// (`docs/research/2026-09-09-graf-el-vonal-meres.md` 3. és 6. szekció).
//
// A fixtúra és a script azóta a repóban van, de a védelem KIZÁRÓLAG SZÖVEGES
// volt: egy mondat a `.claude/CLAUDE.md` 12. szekciójában és az `apps/web`
// CLAUDE.md fájljában. Semmi nem buktatta el azt a munkamenetet, ami megint
// saját, eldobható scriptet ír saját, éltelen fixtúrával. Ez a fájl az a
// gépi kényszer: kilenc invariáns, mindegyik nem nulla kilépési kódú bukást ad a
// `bun run test` kapun, ami tagja a kilenc kapunak és szerepel a CI
// összesítő `ci` job `needs` listájában.
//
// HATÓKÖR (user döntés, 2026-09-25): a védelem kizárólag a repóba commitolt
// forráskódot olvassa, és csak a böngésző képernyőkép, a videó és a trace kép
// lemezre írását tiltja a saját teszt- és segédkódunkban. A termék futását, az
// agentek futásidejű fájlírását (az Agent SDK eszközeivel) és a termékkód egyéb
// fájlírását nem érinti. A szándékos megkerülés (átnevezés, `call`/`bind`,
// összerakott kulcs vagy modulnév, SQLite, JSON becsempészés) elfogadott
// korlát (`.claude/CLAUDE.md` 12. szekció).
//
// A VÉDELEM KÉT RÉTEGE:
//
//   1. A COMMITOLT FA alakja (1 ... 5., 7., 8. és 9. invariáns). A git INDEXET
//      olvassa vissza nyers szövegként, statikus elemzés helyett - ugyanaz a minta,
//      mint a `no-em-dash` és a `no-preserve-symlinks` témáé. Ez fogja meg
//      azt az esetet, amikor egy munkamenet MÁSIK fájlba ír képernyőkép
//      készítést, vagy a szentesített script elszakad a fixtúrától.
//
//   2. A BIZONYÍTÉK FRISSESSÉGE (6. invariáns). A szentesített csővezeték
//      `apps/web/e2e/screenshot-manifest.json` néven bizonyítékot hagy a
//      repóban: annak a két fájlnak a `sha256` lenyomatát, amiből a kép
//      származik, és képenként a pixel méréssel igazoltan kifestett élek
//      azonosítóját. Ha a fixtúra vagy a szentesített script megváltozik és
//      a csővezeték nem futott le újra, a lenyomat elavul, és ez a kapu
//      bukik. Ez kényszeríti ki, hogy a fixtúra minden módosítása után a
//      VALÓDI Chromium futás lemérje a vonalakat: egy éltelen fixtúrával az
//      a futás elbukik, tehát friss manifeszt nem keletkezhet belőle.
//
// MIÉRT NEM BÁJTRA ÖSSZEHASONLÍTÁS a szállított képekkel. Mérve: a hat kép
// 630 kilobájt (73 ... 154 kB per PNG), tehát minden felületi változás
// ennyivel hizlalná a git történetet - és a Playwright saját dokumentációja
// kimondja, hogy a képernyőkép nem platformfüggetlen ("Screenshots differ
// between browsers and platforms due to different rendering, fonts and
// more", <https://playwright.dev/docs/test-snapshots>), ezért maga a
// hivatalos snapshot fájlnév is platformot kódol, és a `toHaveScreenshot`
// assertionnek `maxDiffPixels`/`threshold` opciója van. Egy aarch64 Linux
// sandboxban készült referencia kép tehát a CI x86-64 futóján eleve nem
// egyezne. A referencia kép útja ezért elutasítva.
//
// Megvalósítás fájl nélküli téma (`.claude/CLAUDE.md` 5. szekció, SPEC-002
// 6.2 5. pont): konfigurációs és szerkezeti invariánst őriz, saját téma
// mappában, a mappa neve annak a dolognak a neve, amit őriz.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A képernyőkép készítés EGYETLEN szentesített helye.
 */
const SANCTIONED_CAPTURE_FILE = 'apps/web/e2e/capture-screenshots.ts';

/**
 * A gráf fixtúra EGYETLEN szentesített helye.
 */
const FIXTURE_FILE = 'apps/web/e2e/showcase-graph.ts';

const MANIFEST_FILE = 'apps/web/e2e/screenshot-manifest.json';

const SCREENSHOTS_CONFIG_FILE = 'apps/web/playwright.screenshots.config.ts';

/**
 * Ez a fájl: a (8) és a (9) invariáns a saját forrásából ellenőrzi, hogy az
 * őrző blokkok szövege nem változott.
 */
const SELF_FILE = 'tooling/scripts/src/screenshot-pipeline/screenshot-pipeline.spec.ts';

/**
 * Minden JavaScript és TypeScript kiterjesztés, amit a telepített Playwright a
 * saját betöltőjén átenged (a `.d.*` deklarációs fájlok is ide esnek), és amit
 * a TypeScript modul referencia is ismer
 * (`docs/research/2026-09-25-kepernyokep-vedelem-hatokor.md` 5. szekció).
 *
 * Az `.mts` és a `.cts` 2026-09-15 óta, a `.jsx` 2026-09-25 óta szerepel a
 * listán (user döntés): előtte egy ilyen kiterjesztésű, képernyőképet lemezre
 * író fájl minden invariánson átcsúszott (független ellenőrzés).
 */
const CODE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

/**
 * A shell scriptek kiterjesztése. A `.bash` 2026-09-25 óta (user döntés).
 */
const SHELL_EXTENSIONS = ['.sh', '.bash'];

/**
 * A `package.json` fájlok scriptjei 2026-09-25 óta a shell scriptekkel azonos
 * ellenőrzést kapnak (user döntés).
 */
const PACKAGE_MANIFEST_NAME = 'package.json';

/**
 * A fixtúra alsó korlátja élekben. Ugyanaz a szám, amit a fixtúra alakját
 * őrző `apps/web/e2e/showcase-graph.spec.ts` is használ: terméktermelési
 * elvárás a bizonyíték előállítására, nem mért érték.
 */
const MINIMUM_EDGE_COUNT = 5;

/**
 * A mért képek alsó korlátja. A szentesített csővezeték 2026-09-15 óta MINDEN
 * szállított képen mér élenkénti kifestettséget: négy elrendezés (nyitott
 * beállítás panel, kiválasztás nélküli vászon, futás nézet és a nagyított
 * kivágat) a két témában. Korábban a nagyított kivágat két képe kimaradt,
 * tehát a frissesség bizonyíték a hat szállított képből csak négyre szólt.
 * Ratchet: ha új mért kép érkezik, ez a szám felfelé követi.
 */
const MINIMUM_MEASURED_IMAGE_COUNT = 8;

/**
 * Mindkét témában kell mért kép (`.claude/CLAUDE.md` 11. szekció).
 */
const REQUIRED_THEME_NAMES = ['light', 'dark'] as const;

/**
 * Minden képernyő, amiről kötelező mért kép. A `run-view` 2026-09-15-i
 * felhasználói kérés: a futás nézetre addig nulla szállított vizuális
 * bizonyíték volt, holott a felület megépült. A két név a kép fájlnevének
 * előtagja, tehát a mindkét témára szóló követelmény a téma nevekkel együtt
 * nyolc kombinációt ír le.
 */
const REQUIRED_SCREEN_NAMES = ['editor-', 'run-view-'] as const;

/**
 * A keresett szavak DARABOKBAN állnak, és futásidőben állnak össze, hogy a
 * minta a SAJÁT forrásfájlját ne buktassa meg: ez a fájl maga is a
 * vizsgált halmazban van. Ugyanaz a fogás, mint a `greppable-invariants`
 * téma `@xyflow/react` mintájánál, és ugyanaz a cél, mint a `no-em-dash`
 * téma `\u{2014}` escape-jénél.
 */
const SCREENSHOT_WORD = ['screen', 'shot'].join('');
const CAPITALIZED_SCREENSHOT_WORD = ['Screen', 'shot'].join('');
const SNAPSHOT_WORD = ['Snap', 'shot'].join('');
const PNG_EXTENSION = ['p', 'ng'].join('');
const SCREENSHOTS_WORD = `${SCREENSHOT_WORD}s`;
const TRACE_WORD = ['tra', 'ce'].join('');
const CDP_CAPTURE_WORD = ['capture', CAPITALIZED_SCREENSHOT_WORD].join('');
const CDP_SCREENCAST_WORD = ['start', 'Screen', 'cast'].join('');
const SCREENCAST_WORD = ['screen', 'cast'].join('');
const VIDEO_WORD = ['vid', 'eo'].join('');
const CONTEXT_VIDEO_WORD = ['record', 'Video'].join('');

/**
 * A `path` OPCIÓ mintája. Ez a pontos, mérhető választóvonal a szentesített
 * csővezeték és a pixel MÉRÉS között: az `edge-paint-measurement.ts`, a
 * `graph-edge-stroke.spec.ts` és a `select-chevron-position.spec.ts` is hív
 * képernyőkép készítést, de `path` nélkül, memóriában tartott bufferre - azok
 * nem szállított képet állítanak elő.
 *
 * MIÉRT NEM EGY ABLAKOS REGEX, ami a hívástól a `path` mezőig ér. Az első
 * alak a hívás után egy `[^)]{0,400}?` ablakban kereste a mezőt, és a tiltott
 * záró zárójel miatt BÁRMELY függvényhívás az opció objektumban, a `path` mező
 * ELŐTT hatástalanította (független ellenőrzés, 2026-09-15). Ezért az ablak
 * teljesen megszűnt: a képernyőkép kör és a függőségei egyetlen fájljának sem
 * lehet `path` kulcsa (`findScreenshotDiskWriters`).
 *
 * A kulcs minden alakja számít: a sima (`path:`), az idézőjeles (`'path':`) és
 * a rövidített (`{ path }`, `{ path, ... }`, `..., path }`, 2026-09-25 óta: a
 * `{ path, type: 'jpeg' }` opció objektum a csak kettőspontos alakot kereső
 * mintán átcsúszott), és a képernyőkép kör FÜGGŐSÉGEIBEN is
 * (2026-09-25 óta): enélkül egy másik fájlban álló opció objektum
 * (`export const opciók = { path: ..., type: 'jpeg' }`, a hívó fájlban
 * `képernyőkép(opciók)`) átcsúszott (független ellenőrzés). Egy változó
 * típusannotációja (`let path: string`) nem objektum kulcs, ezért kivétel;
 * mérve a commitolt fán a képernyőkép kör függőségeiben pontosan ez az egy
 * alak fordul elő (`packages/protocol` `build-route-path.ts`), tehát a
 * szigorítás ma nulla hamis jelzést ad.
 */
const PATH_OPTION_PATTERNS = [
  // sima kulcs, a változó típusannotációja nélkül
  /\bpath(?<!\b(?:let|const|var)\s+path)\s*:/,
  // idézőjeles kulcs
  /['"]path['"]\s*:/,
  // rövidített kulcs
  /[{,]\s*path\s*[,}]/,
] as const;

function hasPathOptionKey(content: string): boolean {
  return PATH_OPTION_PATTERNS.some((pattern) => pattern.test(content));
}

/**
 * Képernyőképet vagy videót készítő hívás: a Playwright API hívása, a CLI
 * `screenshot` alparancsa programból indítva (a parancs argumentum listájában
 * álló szó mint string literál), a Chrome DevTools Protocol `Page` doménjének
 * két képet adó metódusa (a képernyőkép és a screencast indítása,
 * `CDP_CAPTURE_WORD` és `CDP_SCREENCAST_WORD`,
 * <https://chromedevtools.github.io/devtools-protocol/tot/Page/>), és a
 * Playwright oldal screencast objektuma (`SCREENCAST_WORD`, 2026-09-25 óta:
 * `path` opcióval videót ment, a képkocka visszahívása JPEG adatot ad, research
 * 3. szekció). A metódusok neve darabokból áll össze, mert ez a fájl maga is a
 * vizsgált halmazban van.
 */
const CAPTURE_CALL_PATTERN = new RegExp(
  String.raw`${SCREENSHOT_WORD}\(|['"]${SCREENSHOT_WORD}['"]|\b${CDP_CAPTURE_WORD}\b|\b${CDP_SCREENCAST_WORD}\b|\.${SCREENCAST_WORD}\b`,
);

/**
 * A Playwright CLI a shell scriptben és a `package.json` scriptben: a
 * `playwright` szó, és vele együtt a `screenshot` alparancs vagy egy nem `off`
 * értékű `--trace` kapcsoló. Az alparancs a képet mindig a megadott fájlba írja
 * (<https://playwright.dev/docs/cli>); a `--trace` kapcsoló a config trace
 * opcióját írja felül (<https://playwright.dev/docs/test-cli>, research 4.
 * szekció), tehát ugyanaz a zárt lista vonatkozik rá, mint a config trace
 * opciójára.
 */
const PLAYWRIGHT_CLI_PATTERN = /\bplaywright\b/;
const SHELL_SCREENSHOT_PATTERN = new RegExp(String.raw`\b${SCREENSHOT_WORD}\b`);
const TRACE_FLAG_PATTERN = new RegExp(String.raw`--${TRACE_WORD}(?![\w-])(?!(?:=|\s+)['"]?off\b)`);

function isShellCapture(text: string): boolean {
  return PLAYWRIGHT_CLI_PATTERN.test(text) && (SHELL_SCREENSHOT_PATTERN.test(text) || TRACE_FLAG_PATTERN.test(text));
}

/**
 * A Playwright `use` beállításának képernyőkép opciója bármely olyan értékkel,
 * ami nem a szó szerinti `'off'`: a Playwright ilyenkor a tesztek
 * képernyőképét maga írja a teszt kimeneti könyvtárába ("Trace files,
 * screenshots and videos will appear in the test output directory",
 * <https://playwright.dev/docs/test-use-options>). ZÁRT LISTA: 2026-09-25-ig a
 * minta csak az objektumot és a nem `off` string literált tiltotta, tehát egy
 * nem literál érték (feltételes kifejezés, változó) átcsúszott (független
 * ellenőrzés); ma minden alak tiltott, ami nem pontosan `'off'`, a rövidített
 * kulcs is.
 */
const SCREENSHOT_OPTION_PATTERN = new RegExp(
  String.raw`(?:\b${SCREENSHOT_WORD}|['"]${SCREENSHOT_WORD}['"])\s*:(?!\s*['"]off['"])|[{,]\s*${SCREENSHOT_WORD}\s*[,}]`,
);

/**
 * A Playwright `use` beállításának videó opciója, ugyanazzal a zárt listával,
 * mint a képernyőkép opció: kizárólag a szó szerinti `'off'` engedett, az
 * objektum alak (`{ mode, size, show }`) a `mode: 'off'` értékkel sem, mert a
 * videó képkockái is lemezre írt képek (user döntés 2026-09-25; a videó a teszt
 * kimeneti könyvtárába kerül, research 1. szekció).
 */
const VIDEO_OPTION_PATTERN = new RegExp(
  String.raw`(?:\b${VIDEO_WORD}|['"]${VIDEO_WORD}['"])\s*:(?!\s*['"]off['"])|[{,]\s*${VIDEO_WORD}\s*[,}]`,
);

/**
 * A böngésző kontextus videó felvétel opciója (`CONTEXT_VIDEO_WORD`). Nincs
 * kikapcsolt értéke: a hiánya a kikapcsolt állapot, megadva mindig a megadott
 * könyvtárba ír (research 2. szekció). Ezért a szó bármely előfordulása tiltott.
 */
const CONTEXT_VIDEO_PATTERN = new RegExp(String.raw`\b${CONTEXT_VIDEO_WORD}\b`);

/**
 * A Playwright trace képernyőképei. A trace a teszt kimeneti könyvtárába
 * egy zip fájlba kerül, és alapból képernyőképeket is tartalmaz: a telepített
 * `playwright@1.62.1` (`lib/worker/workerProcessEntry.js`, `startIfNeeded`) a
 * trace opció képernyőkép kapcsolóját alapból bekapcsolja, a szöveges módnál
 * és a kapcsoló nélküli objektumnál is. A zipben lemezre kerülő kép is
 * lemezre írt kép (2026-09-25 óta tiltva, szabálykönyv 12. szekció).
 *
 * ZÁRT LISTA a `use` trace opciójára: kizárólag a szó szerinti `'off'`, vagy a
 * `{ mode: '<mód>', screenshots: false }` objektum engedett (a
 * `apps/web/playwright.config.ts` 2026-09-25 óta a szó szerinti `'off'`
 * értéket használja), minden más alak tiltott.
 */
const TRACE_OPTION_PATTERN = new RegExp(
  String.raw`(?:\b${TRACE_WORD}|['"]${TRACE_WORD}['"])\s*:(?!\s*['"]off['"]|\s*\{\s*mode\s*:\s*['"][a-z-]+['"]\s*,\s*${SCREENSHOTS_WORD}\s*:\s*false\s*\})|[{,]\s*${TRACE_WORD}\s*[,}]`,
);

/**
 * A trace képernyőkép kapcsolója bármely olyan értékkel, ami nem a szó
 * szerinti `false`: a `use` trace objektumában és a `tracing.start()`
 * opciójában ("captures screenshots in the trace", a telepített
 * `playwright-core` típusai) egyaránt. A `tracing.stop()` a zipet lemezre
 * írja.
 */
const SCREENSHOTS_OPTION_PATTERN = new RegExp(
  String.raw`(?:\b${SCREENSHOTS_WORD}|['"]${SCREENSHOTS_WORD}['"])\s*:(?!\s*false\b)|[{,]\s*${SCREENSHOTS_WORD}\s*[,}]`,
);

/**
 * Lemezre írni képes hivatkozás, a kép formátumától függetlenül, az alábbi
 * ismert írási utakon: a Node beépített fájlrendszer és folyamatindító
 * moduljának megnevezése string literálként (statikus és dinamikus import,
 * `require`, tehát a `writeFile*`, a stream, a fájlleíró és egy külső parancs
 * is ide fut), a `Bun.write`, és a Playwright két saját író hívása: a
 * tesztcsatolmány, amit a futó a lemezre ment ("used as the prefix of file name
 * when saving to disk",
 * <https://playwright.dev/docs/api/class-testinfo#test-info-attach>), és a
 * letöltés mentése (<https://playwright.dev/docs/api/class-download#download-save-as>).
 * Ami ezen a listán kívül ír (más író csomag, SQLite, sablon literállal vagy
 * futásidőben összerakott modulnév), azt a minta nem látja: szándékos
 * megkerülésként elfogadott korlát (user döntés 2026-09-25). A 2026-09-25-ig
 * élő alak csak a `path` opciót és a PNG fájlnevet nézte, és egy JPEG formátumú
 * képernyőkép hívás plusz `writeFileSync('x.jpg')` pár mind a hat invariánson
 * átment (mérve, egy független ellenőrzés és saját injekció).
 */
const DISK_WRITER_PATTERN = new RegExp(
  String.raw`['"](?:node:)?(?:fs|fs/promises|child_process)['"]|\bBun\.write\b|\.attach\(|\bsaveAs\(`,
);

/**
 * Fájlok, amik a képernyőkép körben (lásd `findScreenshotDiskWriters`)
 * jogosan írnak lemezre, a saját fájlukon kívül érvényes kivétellel: a
 * `coverage-fixture.ts` minden teszt után az istanbul lefedettségi adatot
 * menti a `.nyc_output/` alá, és szinte minden e2e teszt importálja, a
 * képernyőképet memóriában mérő pixel tesztek is. Saját fájlán belül a
 * képernyőkép hívás és a lemezre írás együttes tilalma rá is áll.
 */
const ALLOWED_WRITER_FILES: ReadonlySet<string> = new Set(['apps/web/e2e/coverage-fixture.ts']);

/**
 * Az import hivatkozás: statikus és dinamikus import, újraexportálás és
 * `require`. A fájlnév a string literál tartalma.
 */
const IMPORT_SPECIFIER_PATTERN = /\b(?:from|import|require)[\s(]*['"]([^'"]+)['"]/g;

/**
 * A Playwright saját, lemezre író képösszehasonlító assertionjei. A repo nem
 * használja őket (a vizuális bizonyíték útja a pixel mérés), és nem is
 * szabad: lemezre írt referencia képet hoznának be, amiről a fejléc
 * indoklása szól.
 */
const SNAPSHOT_ASSERTION_PATTERN = new RegExp(
  String.raw`toHave${CAPITALIZED_SCREENSHOT_WORD}\(|toMatch${SNAPSHOT_WORD}\(`,
);

/**
 * Bármilyen képernyőkép hívás, `path` opció nélkül is. Önmagában nem hiba (a
 * pixel mérés is ilyet hív); a PNG fájlnévvel együtt a 2. invariáns tiltja.
 * Az 1. invariáns bővebb mintából indul (`CAPTURE_CALL_PATTERN`).
 */
const ANY_SCREENSHOT_CALL = `${SCREENSHOT_WORD}(`;

/**
 * PNG fájlnév literál. Önmagában NEM tiltható: mérve hét commitolt fájl
 * tartalmazza jogosan (a `packages/core` média típus felsorolása és tesztjei,
 * plusz két e2e magyarázó komment), ezért csak a képernyőkép hívással együtt
 * jelez.
 */
const PNG_FILE_NAME_PATTERN = new RegExp(String.raw`\.${PNG_EXTENSION}\b`);

/**
 * Az őrző blokkok határai ebben a fájlban: a leírás blokk fejléce és az (1),
 * (2), (7), (8), (9) invariáns teljes szövege. A (8) és a (9) két független
 * kóddal ugyanazt a lenyomatot számolja belőlük, és a `GUARD_BLOCKS_SHA256`
 * értékkel veti össze. Így bármelyik blokk egyetlen helyen végzett gyengítése
 * (az állítás elhagyása vagy szűrése, egy blokk kihagyása `skip` vagy opció
 * objektum útján, a leírás blokk kihagyása, a (7) egy esetének törlése) bukik:
 * a (8) kihagyását a leírás blokkon kívül álló (9) fogja, a (9) kihagyását a
 * (8). A kezdő jel valódi sortöréssel indul, ezért a lenti string literálok
 * (amikben `\n` escape áll) nem illeszkednek rá.
 */
const GUARD_BLOCK_MARKERS: readonly (readonly [string, string])[] = [
  ["\ndescribe('a képernyőkép készítés egyetlen szentesített útja (gépi kényszer)'", '{\n'],
  ["\n  it('(1) ", '\n  });\n'],
  ["\n  it('(2) ", '\n  });\n'],
  ["\n  it('(7) ", '\n  });\n'],
  ["\n  it('(8) ", '\n  });\n'],
  ["\nit('(9) ", '\n});\n'],
];

/**
 * Az őrző blokkok rögzített lenyomata. Ha egy blokk szándékosan változik, az új
 * értéket a bukó (8) vagy (9) invariáns üzenete adja; az átírás tudatos lépés,
 * ugyanúgy, mint a manifeszt két lenyomatáé (`.claude/CLAUDE.md` 12. szekció).
 */
const GUARD_BLOCKS_SHA256 = 'a1d00455dd3d77e8f39e57cf3b6b46ad72d5045162da8aef2e79186c8636ac96';

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- a git a fejlesztoi/CI PATH resze, ugyanugy mint a tobbi wrapper scriptben
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

function listTrackedFiles(root: string): readonly string[] {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- a git a fejlesztoi/CI PATH resze, ugyanugy mint a tobbi wrapper scriptben
  const output = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
  return output.split('\n').filter((line) => line.length > 0);
}

function readTrackedFile(root: string, trackedPath: string): string {
  return readFileSync(path.join(root, trackedPath), 'utf8');
}

/**
 * Egy commitolt fájl tartalmának olvasója. A fa ellenőrzésénél a lemezről
 * olvas, a (7) szintetikus eseteinél memóriából.
 */
type ReadTrackedFile = (trackedPath: string) => string;

interface CodeFile {
  readonly trackedPath: string;
  readonly content: string;
}

function isCodePath(trackedPath: string): boolean {
  return CODE_EXTENSIONS.some((extension) => trackedPath.endsWith(extension));
}

function isShellPath(trackedPath: string): boolean {
  return SHELL_EXTENSIONS.some((extension) => trackedPath.endsWith(extension));
}

function isPackageManifestPath(trackedPath: string): boolean {
  return path.posix.basename(trackedPath) === PACKAGE_MANIFEST_NAME;
}

/**
 * A vizsgált forrásfájlok (JavaScript, TypeScript, shell) a commitolt fájlok
 * közül. A git index a bemenet, nem a lemez: egy nem commitolt, eldobható
 * script amúgy sem kerülhet be a repóba, és a CI is a commitolt fát látja. A
 * kiterjesztés szűrő ITT áll, a (7) által igazolt függvényen belül, hogy egy
 * kiterjesztés kivétele a listából a (7) esetén bukjon.
 */
function readScannedFiles(trackedPaths: readonly string[], read: ReadTrackedFile): readonly CodeFile[] {
  return trackedPaths
    .filter((trackedPath) => isCodePath(trackedPath) || isShellPath(trackedPath))
    .map((trackedPath) => ({ trackedPath, content: read(trackedPath) }));
}

function isObjectRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface PackageManifest {
  readonly trackedPath: string;
  readonly name: string | undefined;
  readonly scriptValues: readonly string[];
}

/**
 * A commitolt `package.json` fájlok neve és scriptjei.
 */
function readPackageManifests(trackedPaths: readonly string[], read: ReadTrackedFile): readonly PackageManifest[] {
  return trackedPaths
    .filter((trackedPath) => isPackageManifestPath(trackedPath))
    .map((trackedPath) => {
      const parsed: unknown = JSON.parse(read(trackedPath));
      const manifest: Readonly<Record<string, unknown>> = isObjectRecord(parsed) ? parsed : {};
      const scripts: Readonly<Record<string, unknown>> = isObjectRecord(manifest['scripts']) ? manifest['scripts'] : {};
      return {
        trackedPath,
        name: typeof manifest['name'] === 'string' ? manifest['name'] : undefined,
        scriptValues: Object.values(scripts).filter((value) => typeof value === 'string'),
      };
    });
}

/**
 * Egy fájl importjai a commitolt kódfájlok közül: relatív útvonal (pontos
 * fájlnévvel, vagy a vizsgált kiterjesztések egyikével kiegészítve) és
 * workspace csomag (a belépési pontja).
 */
function resolveImports(
  file: CodeFile,
  knownPaths: ReadonlySet<string>,
  packageEntries: ReadonlyMap<string, string>,
): readonly string[] {
  const imported: string[] = [];
  for (const match of file.content.matchAll(IMPORT_SPECIFIER_PATTERN)) {
    const specifier = match[1] ?? '';
    const packageEntry = packageEntries.get(specifier);
    if (packageEntry !== undefined) {
      imported.push(packageEntry);
      continue;
    }
    if (!specifier.startsWith('.')) {
      continue;
    }
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(file.trackedPath), specifier));
    const candidates = [base, ...CODE_EXTENSIONS.map((extension) => `${base}${extension}`)];
    imported.push(...candidates.filter((candidate) => knownPaths.has(candidate)));
  }
  return imported.filter((candidate) => knownPaths.has(candidate));
}

/**
 * Az irányított gráfban a kezdő halmazból elérhető csúcsok, a kezdőkkel együtt.
 */
function reachable(start: Iterable<string>, edges: ReadonlyMap<string, readonly string[]>): ReadonlySet<string> {
  const seen = new Set(start);
  const queue = [...seen];
  for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
    const unseen = (edges.get(next) ?? []).filter((neighbour) => !seen.has(neighbour));
    for (const neighbour of unseen) {
      seen.add(neighbour);
      queue.push(neighbour);
    }
  }
  return seen;
}

/**
 * A képernyőképet vagy videót lemezre író fájlok a szentesített fájlon kívül, a
 * kép formátumától függetlenül, a `DISK_WRITER_PATTERN` ismert írási útjain,
 * PUSZTA EGYÜTTES JELENLÉT alapján (karakterosztályos ablak nélkül,
 * `.claude/CLAUDE.md` 12. szekció).
 *
 * - Közvetlen író: a Playwright `use` képernyőkép és videó opciója, a
 *   kontextus videó felvétele, a trace képernyőképei, a CLI a shell vagy a
 *   `package.json` scriptből (`isShellCapture`), vagy a lemezre író
 *   képösszehasonlító assertion.
 * - A KÉPERNYŐKÉP KÖR: a képernyőképet készítő fájlok, és minden fájl, ami
 *   ezeket (közvetve is) importálja. Ezek egyike sem hivatkozhat lemezre
 *   írni képes modulra vagy hívásra, és a `path` opciót sem használhatja:
 *   a kép a hívótól a hívóig ugyanabban a körben halad.
 * - A KÖR FÜGGŐSÉGEI: mindaz, amit a kör (közvetve is) importál. Ezek nem
 *   hivatkozhatnak lemezre írni képes modulra, az `ALLOWED_WRITER_FILES`
 *   kivételével, és `path` kulcsuk sem lehet (2026-09-25 óta: egy másik
 *   fájlban álló opció objektum a kör felé haladva a hívás opciója lesz).
 *   Enélkül egy saját író segédfüggvény egy másik fájlban
 *   (`saveImage(név, await képernyőkép())`) átcsúszna.
 */
function findScreenshotDiskWriters(trackedPaths: readonly string[], read: ReadTrackedFile): readonly string[] {
  const files = readScannedFiles(trackedPaths, read);
  const manifests = readPackageManifests(trackedPaths, read);
  const packageEntries = new Map<string, string>();
  for (const manifest of manifests) {
    if (manifest.name !== undefined) {
      packageEntries.set(manifest.name, path.posix.join(path.posix.dirname(manifest.trackedPath), 'src', 'index.ts'));
    }
  }
  const knownPaths = new Set(files.map((file) => file.trackedPath));
  const contentOf = new Map(files.map((file) => [file.trackedPath, file.content]));
  const importsOf = new Map(files.map((file) => [file.trackedPath, resolveImports(file, knownPaths, packageEntries)]));
  const importersOf = new Map<string, string[]>();
  for (const [importer, imported] of importsOf) {
    for (const target of imported) {
      importersOf.set(target, [...(importersOf.get(target) ?? []), importer]);
    }
  }

  const direct = files.filter(
    (file) =>
      SCREENSHOT_OPTION_PATTERN.test(file.content) ||
      VIDEO_OPTION_PATTERN.test(file.content) ||
      CONTEXT_VIDEO_PATTERN.test(file.content) ||
      TRACE_OPTION_PATTERN.test(file.content) ||
      SCREENSHOTS_OPTION_PATTERN.test(file.content) ||
      SNAPSHOT_ASSERTION_PATTERN.test(file.content) ||
      (isShellPath(file.trackedPath) && isShellCapture(file.content)),
  );
  const directManifests = manifests.filter((manifest) => manifest.scriptValues.some((value) => isShellCapture(value)));
  const capturing = files
    .filter((file) => file.trackedPath !== SANCTIONED_CAPTURE_FILE && CAPTURE_CALL_PATTERN.test(file.content))
    .map((file) => file.trackedPath);
  const circle = reachable(capturing, importersOf);
  const dependencies = reachable(circle, importsOf);

  const offenders = new Set([...direct, ...directManifests].map((file) => file.trackedPath));
  for (const trackedPath of dependencies) {
    const content = contentOf.get(trackedPath) ?? '';
    const isAllowedWriter = !circle.has(trackedPath) && ALLOWED_WRITER_FILES.has(trackedPath);
    const isOffender = (DISK_WRITER_PATTERN.test(content) && !isAllowedWriter) || hasPathOptionKey(content);
    if (isOffender) {
      offenders.add(trackedPath);
    }
  }
  offenders.delete(SANCTIONED_CAPTURE_FILE);
  return [...offenders].toSorted((left, right) => (left < right ? -1 : Number(left > right)));
}

/**
 * A szentesített fájlon kívüli vizsgált fájlok, amik képernyőkép hívást és PNG
 * fájlnevet együtt tartalmaznak.
 */
function findPngScreenshotFiles(trackedPaths: readonly string[], read: ReadTrackedFile): readonly string[] {
  return readScannedFiles(trackedPaths, read)
    .filter(
      (file) =>
        file.trackedPath !== SANCTIONED_CAPTURE_FILE &&
        file.content.includes(ANY_SCREENSHOT_CALL) &&
        PNG_FILE_NAME_PATTERN.test(file.content),
    )
    .map((file) => file.trackedPath);
}

function sha256OfTrackedFile(root: string, trackedPath: string): string {
  return createHash('sha256')
    .update(readFileSync(path.join(root, trackedPath)))
    .digest('hex');
}

interface ManifestImage {
  readonly name: string;
  readonly paintedEdgeIds: readonly string[];
}

interface ScreenshotManifest {
  readonly fixtureSha256: string;
  readonly captureScriptSha256: string;
  readonly fixtureEdgeIds: readonly string[];
  readonly images: readonly ManifestImage[];
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isManifestImage(value: unknown): value is ManifestImage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    'paintedEdgeIds' in value &&
    isStringArray(value.paintedEdgeIds)
  );
}

function isScreenshotManifest(value: unknown): value is ScreenshotManifest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'fixtureSha256' in value &&
    typeof value.fixtureSha256 === 'string' &&
    'captureScriptSha256' in value &&
    typeof value.captureScriptSha256 === 'string' &&
    'fixtureEdgeIds' in value &&
    isStringArray(value.fixtureEdgeIds) &&
    'images' in value &&
    Array.isArray(value.images) &&
    value.images.every((image: unknown) => isManifestImage(image))
  );
}

function readManifest(root: string): ScreenshotManifest {
  const parsed: unknown = JSON.parse(readTrackedFile(root, MANIFEST_FILE));
  if (!isScreenshotManifest(parsed)) {
    throw new Error(
      `${MANIFEST_FILE} alakja nem a szentesített csővezetékből származik; futtasd újra: bun run screenshots`,
    );
  }
  return parsed;
}

interface PackageScripts {
  readonly scripts?: Readonly<Record<string, string>>;
}

function isPackageScripts(value: unknown): value is PackageScripts {
  return typeof value === 'object' && value !== null;
}

function readScripts(root: string, trackedPath: string): Readonly<Record<string, string>> {
  const parsed: unknown = JSON.parse(readTrackedFile(root, trackedPath));
  if (!isPackageScripts(parsed) || parsed.scripts === undefined) {
    return {};
  }
  return parsed.scripts;
}

/**
 * A (7) invariáns eseteinek import sora a Node fájlrendszer moduljából.
 */
function fsImport(names: string): string {
  return `import { ${names} } from 'node:fs';\n`;
}

/**
 * A (7) invariáns eseteinek Playwright config forrása egyetlen `use` opcióval.
 */
function useOption(name: string, value: string): string {
  return `export default { use: { ${name}: ${value} } };`;
}

/**
 * A (7) invariáns: a fa ellenőrzése memóriában tartott, szintetikus fájlokon.
 */
function checkSyntheticFiles(
  check: (trackedPaths: readonly string[], read: ReadTrackedFile) => readonly string[],
  files: readonly CodeFile[],
): readonly string[] {
  const contents = new Map(files.map((file) => [file.trackedPath, file.content]));
  return check(contents.keys().toArray(), (trackedPath) => contents.get(trackedPath) ?? '');
}

describe('a képernyőkép készítés egyetlen szentesített útja (gépi kényszer)', () => {
  it('(1) a szentesített fájlon kívül egyetlen commitolt fájl sem ír képernyőképet vagy videót lemezre az ismert írási utakon, az import gráfon át sem', () => {
    const root = repoRoot();
    expect(
      findScreenshotDiskWriters(listTrackedFiles(root), (trackedPath) => readTrackedFile(root, trackedPath)),
    ).toEqual([]);
  });

  it('(2) a szentesített fájlon kívül egyetlen commitolt fájl sem tart együtt képernyőkép hívást és PNG fájlnevet', () => {
    const root = repoRoot();
    expect(findPngScreenshotFiles(listTrackedFiles(root), (trackedPath) => readTrackedFile(root, trackedPath))).toEqual(
      [],
    );
  });

  it('(3) a képernyőkép Playwright configja pontosan a szentesített fájlt futtatja, egyetlen workeren', () => {
    const configSource = readTrackedFile(repoRoot(), SCREENSHOTS_CONFIG_FILE);
    expect(configSource).toContain("testMatch: 'capture-screenshots.ts'");
    expect(configSource).toContain('workers: 1');
    expect(configSource).toContain('fullyParallel: false');
  });

  it('(4) a `screenshots` npm scriptek a szentesített configra mutatnak', () => {
    const root = repoRoot();
    expect(readScripts(root, 'apps/web/package.json')['screenshots']).toBe(
      'playwright test --config playwright.screenshots.config.ts',
    );
    expect(readScripts(root, 'package.json')['screenshots']).toBe('cd apps/web && bun run screenshots');
  });

  it('(5) a szentesített fájl a fixtúrából veszi a gráfot, és nem tart sajátot', () => {
    const captureSource = readTrackedFile(repoRoot(), SANCTIONED_CAPTURE_FILE);
    // A fixtúra és a mockolás EGYETLEN forrása a `showcase-graph.ts` import.
    expect(captureSource).toContain("from './showcase-graph.ts'");
    expect(captureSource).toContain('installShowcaseMocks');
    // Saját gráf literál, saját route mock és saját REST mock telepítés
    // tiltott: pontosan ez a három volt a háromszori hiba mechanizmusa.
    expect(captureSource).not.toMatch(/\bnodes\s*:\s*\[/);
    expect(captureSource).not.toMatch(/\bedges\s*:\s*\[/);
    expect(captureSource).not.toContain('mockRoute(');
    expect(captureSource).not.toContain('installApiMocks(');
    expect(captureSource).not.toContain('page.route(');
  });

  it('(6) a bizonyíték manifeszt FRISS, és minden mért képen minden fixtúra él ki van festve', () => {
    const root = repoRoot();
    const manifest = readManifest(root);

    // A frissesség: a manifeszt annak a két fájlnak a lenyomatát hordozza,
    // amiből a kép származik. Bukás esetén a javítás NEM a manifeszt
    // kézi átírása, hanem a `bun run screenshots` újrafuttatása.
    expect(manifest.fixtureSha256).toBe(sha256OfTrackedFile(root, FIXTURE_FILE));
    expect(manifest.captureScriptSha256).toBe(sha256OfTrackedFile(root, SANCTIONED_CAPTURE_FILE));

    // Éltelen vagy elszegényített fixtúrából nem keletkezhet elfogadott
    // bizonyíték: ez a három állítás pontosan a háromszori hibát fogja meg.
    expect(manifest.fixtureEdgeIds.length).toBeGreaterThanOrEqual(MINIMUM_EDGE_COUNT);
    expect(new Set(manifest.fixtureEdgeIds).size).toBe(manifest.fixtureEdgeIds.length);
    const fixtureSource = readTrackedFile(root, FIXTURE_FILE);
    expect(manifest.fixtureEdgeIds.filter((edgeId) => !fixtureSource.includes(`id: '${edgeId}'`))).toEqual([]);

    expect(manifest.images.length).toBeGreaterThanOrEqual(MINIMUM_MEASURED_IMAGE_COUNT);
    for (const image of manifest.images) {
      expect(image.paintedEdgeIds).toEqual(manifest.fixtureEdgeIds);
    }

    const imageNames = manifest.images.map((image) => image.name);
    for (const themeName of REQUIRED_THEME_NAMES) {
      expect(imageNames.filter((name) => name.includes(themeName)).length).toBeGreaterThan(0);
      for (const screenName of REQUIRED_SCREEN_NAMES) {
        expect(imageNames.filter((name) => name.startsWith(screenName) && name.includes(themeName))).not.toEqual([]);
      }
    }
  });

  it('(7) az (1) és a (2) ellenőrzés elkapja az ismert kerülő utakat, és a memóriában mérő, jogos alakot átengedi', () => {
    // A minták darabokból állnak össze, hogy ez a fájl ne tartalmazza őket
    // szó szerint (lásd a `SCREENSHOT_WORD` doksiját).
    const call = `await page.${SCREENSHOT_WORD}({ type: 'jpeg' })`;
    const writerCase = (trackedPath: string): CodeFile => ({
      trackedPath,
      content: `${fsImport('writeFileSync')}writeFileSync('x.jpg', ${call});`,
    });
    // A vizsgált kiterjesztések a CODE_EXTENSIONS és a SHELL_EXTENSIONS
    // listától független literállal: egy kiterjesztés kivétele bármelyik
    // listából ezen a ponton bukik (független ellenőrzés, 2026-09-25).
    const everyCodeExtension = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
    const cases: readonly {
      readonly name: string;
      readonly files: readonly CodeFile[];
      readonly offenders: readonly string[];
    }[] = [
      ...everyCodeExtension.map((extension) => ({
        name: `JPEG kép és writeFileSync egy ${extension} fájlban`,
        files: [writerCase(`e2e/a${extension}`)],
        offenders: [`e2e/a${extension}`],
      })),
      {
        name: 'stream',
        files: [
          {
            trackedPath: 'e2e/a.ts',
            content: `${fsImport('createWriteStream')}createWriteStream('x.jpg').end(${call});`,
          },
        ],
        offenders: ['e2e/a.ts'],
      },
      {
        name: 'író segédfüggvény egy másik fájlban',
        files: [
          { trackedPath: 'e2e/save.ts', content: `${fsImport('writeFileSync')}export const save = writeFileSync;` },
          { trackedPath: 'e2e/a.ts', content: `import { save } from './save.ts';\nsave('x.jpg', ${call});` },
        ],
        offenders: ['e2e/save.ts'],
      },
      {
        name: 'író segédfüggvény require hívással betöltve',
        files: [
          { trackedPath: 'e2e/save.cjs', content: `${fsImport('writeFileSync')}module.exports = writeFileSync;` },
          { trackedPath: 'e2e/a.cjs', content: `const save = require('./save.cjs');\nsave('x.jpg', ${call});` },
        ],
        offenders: ['e2e/save.cjs'],
      },
      {
        name: 'író segédfüggvény dinamikus importtal betöltve',
        files: [
          { trackedPath: 'e2e/save.ts', content: `${fsImport('writeFileSync')}export const save = writeFileSync;` },
          {
            trackedPath: 'e2e/a.ts',
            content: `const { save } = await import('./save.ts');\nsave('x.jpg', ${call});`,
          },
        ],
        offenders: ['e2e/save.ts'],
      },
      {
        name: 'író segédfüggvény workspace csomagban',
        files: [
          { trackedPath: 'packages/io/package.json', content: JSON.stringify({ name: '@x/io' }) },
          { trackedPath: 'packages/io/src/index.ts', content: `export { save } from './save/save.ts';` },
          {
            trackedPath: 'packages/io/src/save/save.ts',
            content: `${fsImport('writeFileSync')}export const save = writeFileSync;`,
          },
          { trackedPath: 'e2e/a.ts', content: `import { save } from '@x/io';\nsave('x.jpg', ${call});` },
        ],
        offenders: ['packages/io/src/save/save.ts'],
      },
      {
        name: 'a képet visszaadó függvény importálója ír',
        files: [
          { trackedPath: 'e2e/shot.ts', content: `export const shoot = async (page) => ${call};` },
          {
            trackedPath: 'e2e/b.ts',
            content: `${fsImport('writeFileSync')}import { shoot } from './shot.ts';\nwriteFileSync('x.jpg', await shoot(page));`,
          },
        ],
        offenders: ['e2e/b.ts'],
      },
      {
        name: 'a path opció a hívónál',
        files: [
          {
            trackedPath: 'e2e/shot.ts',
            content: `export const shoot = async (page, options) => page.${SCREENSHOT_WORD}(options);`,
          },
          {
            trackedPath: 'e2e/b.ts',
            content: `import { shoot } from './shot.ts';\nawait shoot(page, { path: 'x.jpg' });`,
          },
        ],
        offenders: ['e2e/b.ts'],
      },
      {
        name: 'tesztcsatolmány',
        files: [{ trackedPath: 'e2e/a.ts', content: `await testInfo.attach('kép', { body: ${call} });` }],
        offenders: ['e2e/a.ts'],
      },
      {
        name: 'a CLI alparancsa programból',
        files: [
          {
            trackedPath: 'tools/a.ts',
            content: `import { execFileSync } from 'node:child_process';\nexecFileSync('playwright', ['${SCREENSHOT_WORD}', url, 'x.jpg']);`,
          },
        ],
        offenders: ['tools/a.ts'],
      },
      {
        name: 'a CLI alparancsa shell scriptből',
        files: [{ trackedPath: 'tools/a.sh', content: `bun x playwright --device=x ${SCREENSHOT_WORD} url x.jpg` }],
        offenders: ['tools/a.sh'],
      },
      {
        name: 'a CLI alparancsa bash scriptből',
        files: [{ trackedPath: 'tools/a.bash', content: `bun x playwright ${SCREENSHOT_WORD} url x.jpg` }],
        offenders: ['tools/a.bash'],
      },
      {
        name: 'a CLI alparancsa package.json scriptből',
        files: [
          {
            trackedPath: 'tools/package.json',
            content: JSON.stringify({ scripts: { shot: `bun x playwright ${SCREENSHOT_WORD} url x.jpg` } }),
          },
        ],
        offenders: ['tools/package.json'],
      },
      {
        name: 'a CLI trace kapcsolója package.json scriptből',
        files: [
          {
            trackedPath: 'tools/package.json',
            content: JSON.stringify({ scripts: { e2e: `playwright test --${TRACE_WORD} on` } }),
          },
        ],
        offenders: ['tools/package.json'],
      },
      {
        name: 'a CLI trace kapcsolója shell scriptből, egyenlőségjellel',
        files: [{ trackedPath: 'tools/a.sh', content: `bun x playwright test --${TRACE_WORD}=retain-on-failure` }],
        offenders: ['tools/a.sh'],
      },
      {
        name: 'a use képernyőkép opciója',
        files: [{ trackedPath: 'a.config.ts', content: `export default { use: { ${SCREENSHOT_WORD}: 'on' } };` }],
        offenders: ['a.config.ts'],
      },
      // 2026-09-25: a független ellenőrzés öt gyengítést talált, amit a fenti
      // esetek nem fogtak (Bun.write, saveAs, fs/promises, a képösszehasonlító
      // assertion minta, az opció értékének 'on'-ra szűkítése), és öt kerülő
      // utat (rövidített path, path a függőségben, nem literál opció érték, CDP,
      // trace képernyőkép). Az alábbi esetek ezeket zárják.
      {
        name: 'fs/promises, node: előtag nélkül',
        files: [
          {
            trackedPath: 'e2e/a.ts',
            content: `import { writeFile } from 'fs/promises';\nawait writeFile('x.jpg', ${call});`,
          },
        ],
        offenders: ['e2e/a.ts'],
      },
      {
        name: 'Bun.write',
        files: [{ trackedPath: 'e2e/a.ts', content: `await Bun.write('x.jpg', ${call});` }],
        offenders: ['e2e/a.ts'],
      },
      {
        name: 'letöltés mentése a képernyőkép mellett',
        files: [{ trackedPath: 'e2e/a.ts', content: `const kép = ${call};\nawait download.saveAs('x.jpg');` }],
        offenders: ['e2e/a.ts'],
      },
      {
        name: 'lemezre író képösszehasonlító assertion (képernyőkép)',
        files: [{ trackedPath: 'e2e/a.ts', content: `await expect(page).toHave${CAPITALIZED_SCREENSHOT_WORD}();` }],
        offenders: ['e2e/a.ts'],
      },
      {
        name: 'lemezre író képösszehasonlító assertion (pillanatkép)',
        files: [{ trackedPath: 'e2e/a.ts', content: `expect(${call}).toMatch${SNAPSHOT_WORD}();` }],
        offenders: ['e2e/a.ts'],
      },
      {
        name: 'a use képernyőkép opciója only-on-failure értékkel',
        files: [{ trackedPath: 'a.config.ts', content: useOption(SCREENSHOT_WORD, `'only-on-failure'`) }],
        offenders: ['a.config.ts'],
      },
      {
        name: 'a use képernyőkép opciója nem literál értékkel',
        files: [
          {
            trackedPath: 'a.config.ts',
            content: useOption(SCREENSHOT_WORD, `process.env['CI'] ? 'only-on-failure' : 'off'`),
          },
        ],
        offenders: ['a.config.ts'],
      },
      {
        name: 'a use képernyőkép opciója objektummal',
        files: [{ trackedPath: 'a.config.ts', content: useOption(SCREENSHOT_WORD, `{ mode: 'on', fullPage: true }`) }],
        offenders: ['a.config.ts'],
      },
      {
        name: 'a use képernyőkép opciója rövidített kulccsal',
        files: [
          {
            trackedPath: 'a.config.ts',
            content: `const ${SCREENSHOT_WORD} = 'on';\nexport default { use: { ${SCREENSHOT_WORD} } };`,
          },
        ],
        offenders: ['a.config.ts'],
      },
      {
        name: 'rövidített path kulcs a hívásban',
        files: [
          {
            trackedPath: 'e2e/a.ts',
            content: `const path = testInfo.outputPath('x.jpeg');\nawait page.${SCREENSHOT_WORD}({ path, type: 'jpeg' });`,
          },
        ],
        offenders: ['e2e/a.ts'],
      },
      {
        name: 'idézőjeles path kulcs a hívásban',
        files: [{ trackedPath: 'e2e/a.ts', content: `await page.${SCREENSHOT_WORD}({ 'path': 'x.jpg' });` }],
        offenders: ['e2e/a.ts'],
      },
      {
        name: 'a use képernyőkép opciója idézőjeles kulccsal',
        files: [{ trackedPath: 'a.config.ts', content: useOption(`'${SCREENSHOT_WORD}'`, `'on'`) }],
        offenders: ['a.config.ts'],
      },
      {
        name: 'trace idézőjeles kulccsal',
        files: [{ trackedPath: 'a.config.ts', content: useOption(`'${TRACE_WORD}'`, `'on'`) }],
        offenders: ['a.config.ts'],
      },
      {
        name: 'trace rövidített kulccsal',
        files: [
          {
            trackedPath: 'a.config.ts',
            content: `const ${TRACE_WORD} = 'on';\nexport default { use: { ${TRACE_WORD} } };`,
          },
        ],
        offenders: ['a.config.ts'],
      },
      {
        name: 'trace rögzítés képernyőképpel, idézőjeles kulccsal',
        files: [{ trackedPath: 'e2e/a.ts', content: `await context.tracing.start({ '${SCREENSHOTS_WORD}': true });` }],
        offenders: ['e2e/a.ts'],
      },
      {
        name: 'trace rögzítés képernyőképpel, rövidített kulccsal',
        files: [
          {
            trackedPath: 'e2e/a.ts',
            content: `const ${SCREENSHOTS_WORD} = true;\nawait context.tracing.start({ ${SCREENSHOTS_WORD} });`,
          },
        ],
        offenders: ['e2e/a.ts'],
      },
      {
        name: 'az opció objektum a path kulccsal egy másik fájlban',
        files: [
          { trackedPath: 'e2e/options.ts', content: `export const shotOptions = { type: 'jpeg', path: 'x.jpg' };` },
          {
            trackedPath: 'e2e/a.ts',
            content: `import { shotOptions } from './options.ts';\nawait page.${SCREENSHOT_WORD}(shotOptions);`,
          },
        ],
        offenders: ['e2e/options.ts'],
      },
      {
        name: 'CDP képernyőkép és writeFileSync',
        files: [
          {
            trackedPath: 'e2e/a.ts',
            content: `${fsImport('writeFileSync')}const { data } = await cdp.send('Page.${CDP_CAPTURE_WORD}');\nwriteFileSync('x.jpg', Buffer.from(data, 'base64'));`,
          },
        ],
        offenders: ['e2e/a.ts'],
      },
      {
        name: 'CDP screencast és writeFileSync',
        files: [
          {
            trackedPath: 'e2e/a.ts',
            content: `${fsImport('writeFileSync')}await cdp.send('Page.${CDP_SCREENCAST_WORD}');`,
          },
        ],
        offenders: ['e2e/a.ts'],
      },
      {
        name: 'trace szöveges móddal (alapból képernyőképpel)',
        files: [{ trackedPath: 'a.config.ts', content: useOption(TRACE_WORD, `'on'`) }],
        offenders: ['a.config.ts'],
      },
      {
        name: 'trace objektum a képernyőkép kikapcsolása nélkül',
        files: [{ trackedPath: 'a.config.ts', content: useOption(TRACE_WORD, `{ mode: 'on' }`) }],
        offenders: ['a.config.ts'],
      },
      {
        name: 'trace rögzítés képernyőképpel',
        files: [
          {
            trackedPath: 'e2e/a.ts',
            content: `await context.tracing.start({ ${SCREENSHOTS_WORD}: true });\nawait context.tracing.stop({ path: 'trace.zip' });`,
          },
        ],
        offenders: ['e2e/a.ts'],
      },
      // 2026-09-25 (user döntés): a videó felvétel is lemezre írt kép, és a
      // lefedettségi fixtúra kivétele nem terjed ki arra, ha maga készít képet.
      {
        name: 'a use videó opciója on értékkel',
        files: [{ trackedPath: 'a.config.ts', content: useOption(VIDEO_WORD, `'on'`) }],
        offenders: ['a.config.ts'],
      },
      {
        name: 'a use videó opciója nem literál értékkel',
        files: [
          {
            trackedPath: 'a.config.ts',
            content: useOption(VIDEO_WORD, `process.env['CI'] ? 'retain-on-failure' : 'off'`),
          },
        ],
        offenders: ['a.config.ts'],
      },
      {
        name: 'a use videó opciója objektummal, off módban is',
        files: [{ trackedPath: 'a.config.ts', content: useOption(VIDEO_WORD, `{ mode: 'off' }`) }],
        offenders: ['a.config.ts'],
      },
      {
        name: 'a use videó opciója idézőjeles kulccsal',
        files: [{ trackedPath: 'a.config.ts', content: useOption(`'${VIDEO_WORD}'`, `'on-first-retry'`) }],
        offenders: ['a.config.ts'],
      },
      {
        name: 'a use videó opciója rövidített kulccsal',
        files: [
          {
            trackedPath: 'e2e/a.spec.ts',
            content: `const ${VIDEO_WORD} = 'on';\ntest.use({ ${VIDEO_WORD} });`,
          },
        ],
        offenders: ['e2e/a.spec.ts'],
      },
      {
        name: 'a kontextus videó felvétele',
        files: [
          {
            trackedPath: 'e2e/a.ts',
            content: `const context = await browser.newContext({ ${CONTEXT_VIDEO_WORD}: { dir: 'v/' } });`,
          },
        ],
        offenders: ['e2e/a.ts'],
      },
      {
        name: 'az oldal screencast felvétele path opcióval',
        files: [{ trackedPath: 'e2e/a.ts', content: `await page.${SCREENCAST_WORD}.start({ path: 'v.webm' });` }],
        offenders: ['e2e/a.ts'],
      },
      {
        name: 'az oldal screencast képkockái writeFileSync hívással',
        files: [
          {
            trackedPath: 'e2e/a.ts',
            content: `${fsImport('writeFileSync')}await page.${SCREENCAST_WORD}.start({ onFrame: ({ data }) => writeFileSync('x.jpg', data) });`,
          },
        ],
        offenders: ['e2e/a.ts'],
      },
      {
        name: 'a lefedettségi fixtúra maga készít képet és ír',
        files: [writerCase('apps/web/e2e/coverage-fixture.ts')],
        offenders: ['apps/web/e2e/coverage-fixture.ts'],
      },
      {
        name: 'jogos: memóriában mért kép a lefedettségi fixtúrán át, olvasó teszt, kikapcsolt opciók, nem vizsgált kiterjesztés',
        files: [
          {
            trackedPath: 'apps/web/e2e/coverage-fixture.ts',
            content: `${fsImport('writeFileSync')}export const test = 1;`,
          },
          {
            trackedPath: 'apps/web/e2e/pixel.spec.ts',
            content: `import { test } from './coverage-fixture.ts';\nconst buffer = ${call};`,
          },
          {
            trackedPath: 'apps/web/e2e/reader.spec.ts',
            content: `${fsImport('readFileSync')}import { test } from './coverage-fixture.ts';`,
          },
          { trackedPath: 'b.config.ts', content: `export default { use: { ${SCREENSHOT_WORD}: 'off' } };` },
          { trackedPath: 'v.config.ts', content: useOption(VIDEO_WORD, `'off'`) },
          {
            trackedPath: 'apps/web/e2e/frames.spec.ts',
            content: `const frames = [];\nawait page.${SCREENCAST_WORD}.start({ onFrame: ({ data }) => frames.push(data) });`,
          },
          writerCase('docs/a.md'),
        ],
        offenders: [],
      },
      {
        name: 'jogos: kikapcsolt trace, képernyőkép nélküli trace mód, DOM pillanatképes trace rögzítés, változó típusannotációja a függőségben',
        files: [
          { trackedPath: 'c.config.ts', content: useOption(TRACE_WORD, `'off'`) },
          {
            trackedPath: 'd.config.ts',
            content: useOption(TRACE_WORD, `{ mode: 'on-first-retry', ${SCREENSHOTS_WORD}: false }`),
          },
          { trackedPath: 'e2e/trace.ts', content: `await context.tracing.start({ snapshots: true });` },
          {
            trackedPath: 'e2e/route.ts',
            content: `export const route = (template: string) => { let path: string = template; return path; };`,
          },
          {
            trackedPath: 'e2e/pixel.spec.ts',
            content: `import { route } from './route.ts';\nconst buffer = ${call};`,
          },
        ],
        offenders: [],
      },
      {
        name: 'jogos: a szentesített configra mutató script, kikapcsolt trace kapcsoló, más eszköz trace kapcsolója',
        files: [
          {
            trackedPath: 'apps/web/package.json',
            content: JSON.stringify({
              name: '@x/web',
              scripts: {
                [SCREENSHOTS_WORD]: 'playwright test --config playwright.screenshots.config.ts',
                e2e: `playwright test --${TRACE_WORD} off`,
                e2eEquals: `playwright test --${TRACE_WORD}='off'`,
                dev: `node --${TRACE_WORD}-warnings x.js && playwright test`,
              },
              devDependencies: { '@playwright/test': '1.62.1' },
            }),
          },
        ],
        offenders: [],
      },
    ];
    for (const testCase of cases) {
      expect(checkSyntheticFiles(findScreenshotDiskWriters, testCase.files), testCase.name).toEqual(testCase.offenders);
    }

    // A kivétel lista pontosan a lefedettségi fixtúra: egy újabb bejegyzés
    // ezen a ponton bukik.
    expect([...ALLOWED_WRITER_FILES]).toEqual(['apps/web/e2e/coverage-fixture.ts']);

    // A (2) ellenőrzés: képernyőkép hívás és PNG fájlnév együtt, a szentesített
    // fájlon kívül, minden vizsgált kiterjesztésen.
    const pngCall = `await page.${SCREENSHOT_WORD}();\nconst name = 'x.${PNG_EXTENSION}';`;
    expect(
      checkSyntheticFiles(findPngScreenshotFiles, [
        ...[...everyCodeExtension, '.sh', '.bash'].map((extension) => ({
          trackedPath: `e2e/a${extension}`,
          content: pngCall,
        })),
        { trackedPath: SANCTIONED_CAPTURE_FILE, content: pngCall },
        { trackedPath: 'e2e/only-call.ts', content: `await page.${SCREENSHOT_WORD}();` },
        { trackedPath: 'e2e/only-name.ts', content: `const name = 'x.${PNG_EXTENSION}';` },
      ]),
    ).toEqual([...everyCodeExtension, '.sh', '.bash'].map((extension) => `e2e/a${extension}`));
  });

  it('(8) az őrző blokkok szövege a rögzített lenyomatú (a leírás blokkon belüli ellenőrzés)', () => {
    const source = readTrackedFile(repoRoot(), SELF_FILE);
    const hash = createHash('sha256');
    for (const [startMarker, endMarker] of GUARD_BLOCK_MARKERS) {
      const start = source.indexOf(startMarker);
      expect(start, startMarker).toBeGreaterThanOrEqual(0);
      expect(source.lastIndexOf(startMarker), startMarker).toBe(start);
      hash.update(source.slice(start, source.indexOf(endMarker, start) + endMarker.length));
    }
    expect(hash.digest('hex')).toBe(GUARD_BLOCKS_SHA256);
  });
});

it('(9) az őrző blokkok szövege a rögzített lenyomatú (a leírás blokkon kívüli, a (8)-tól független ellenőrzés)', () => {
  const source = readTrackedFile(repoRoot(), SELF_FILE);
  const blocks = GUARD_BLOCK_MARKERS.map(([startMarker, endMarker]) => {
    const [, block = '', ...rest] = source.split(startMarker);
    expect(rest, startMarker).toEqual([]);
    return `${startMarker}${block.slice(0, block.indexOf(endMarker) + endMarker.length)}`;
  });
  expect(createHash('sha256').update(blocks.join('')).digest('hex')).toBe(GUARD_BLOCKS_SHA256);
});
