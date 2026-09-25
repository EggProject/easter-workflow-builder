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
// gépi kényszer: nyolc invariáns, mindegyik nem nulla kilépési kódú bukást ad a
// `bun run test` kapun, ami tagja a kilenc kapunak és szerepel a CI
// összesítő `ci` job `needs` listájában.
//
// A VÉDELEM KÉT RÉTEGE:
//
//   1. A COMMITOLT FA alakja (1 ... 5., 7. és 8. invariáns). A git INDEXET olvassa
//      vissza nyers szövegként, statikus elemzés helyett - ugyanaz a minta,
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
 * Ez a fájl: a (8) invariáns a saját forrásából ellenőrzi, hogy az (1) a (7)
 * által igazolt ellenőrzést futtatja.
 */
const SELF_FILE = 'tooling/scripts/src/screenshot-pipeline/screenshot-pipeline.spec.ts';

/**
 * Az (1) invariáns törzsének kötelező hívása: a commitolt fán pontosan az a
 * függvény fut, amit a (7) a kerülő utakon igazol.
 */
const TREE_CHECK_CALL = 'findScreenshotDiskWriters(listCodeFiles(root), readPackageEntries(root))';

/**
 * Minden kiterjesztés, amiben egy képernyőkép készítő lépés megjelenhet:
 * TypeScript és JavaScript forrás, plusz a bash wrapperek.
 *
 * Az `.mts` és a `.cts` 2026-09-15 óta szerepel a listán. Enélkül egy
 * `.mts` kiterjesztésű, teljesen nyílt, `path` opciós képernyőkép hívást és
 * PNG fájlnevet tartalmazó fájl MINDKÉT invariánson átcsúszott, mérten (egy független
 * ellenőrzés így vitte át a védelmet). A két kiterjesztést a Node maga ismeri
 * fel TypeScript modulként, és a Playwright dokumentált `testMatch`
 * alapértelmezése is felveszi a `c`/`m` előtagos változatokat, tehát valós,
 * futó kódot tud hordozni.
 */
const CHECKED_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.sh'];

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
 * Képernyőképet készítő hívás: a Playwright API hívása, a CLI `screenshot`
 * alparancsa programból indítva (a parancs argumentum listájában álló szó
 * mint string literál), vagy a Chrome DevTools Protocol `Page` doménjének két
 * képet adó metódusa (a képernyőkép és a screencast indítása,
 * `CDP_CAPTURE_WORD` és `CDP_SCREENCAST_WORD`,
 * <https://chromedevtools.github.io/devtools-protocol/tot/Page/>): ezek a
 * képet base64 adatként adják vissza, ami egy fájlba írással ér lemezre
 * (2026-09-25 óta, független ellenőrzés). A két metódus neve darabokból áll
 * össze, mert ez a fájl maga is a vizsgált halmazban van.
 */
const CAPTURE_CALL_PATTERN = new RegExp(
  String.raw`${SCREENSHOT_WORD}\(|['"]${SCREENSHOT_WORD}['"]|\b${CDP_CAPTURE_WORD}\b|\b${CDP_SCREENCAST_WORD}\b`,
);

/**
 * A CLI `screenshot` alparancsa shell scriptből: a `playwright` és a
 * `screenshot` szó egyazon `.sh` fájlban. Az alparancs a képet mindig a
 * megadott fájlba írja (<https://playwright.dev/docs/cli>), tehát ez önmagában
 * lemezre írás.
 */
const SHELL_CAPTURE_PATTERNS = [/\bplaywright\b/, new RegExp(String.raw`\b${SCREENSHOT_WORD}\b`)] as const;

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
 * A Playwright trace képernyőképei. A trace a teszt kimeneti könyvtárába
 * egy zip fájlba kerül, és alapból képernyőképeket is tartalmaz: a telepített
 * `playwright@1.62.1` (`lib/worker/workerProcessEntry.js`, `startIfNeeded`) a
 * trace opció képernyőkép kapcsolóját alapból bekapcsolja, a szöveges módnál
 * és a kapcsoló nélküli objektumnál is. A zipben lemezre kerülő kép is
 * lemezre írt kép (2026-09-25 óta tiltva, szabálykönyv 12. szekció).
 *
 * ZÁRT LISTA a `use` trace opciójára: kizárólag a szó szerinti `'off'`, vagy a
 * `{ mode: '<mód>', screenshots: false }` objektum engedett (a
 * `apps/web/playwright.config.ts` ezt használja, a korábbi szöveges
 * `on-first-retry` módot megtartva, képernyőkép nélkül), minden más alak
 * tiltott.
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
 * Lemezre írni képes hivatkozás, a kép formátumától és az írás módjától
 * függetlenül: a Node beépített fájlrendszer és folyamatindító moduljának
 * megnevezése (statikus és dinamikus import, `require`, tehát a `writeFile*`,
 * a stream, a fájlleíró és egy külső parancs is ide fut), a `Bun.write`, és a
 * Playwright két saját író hívása: a tesztcsatolmány, amit a futó a
 * lemezre ment ("used as the prefix of file name when saving to disk",
 * <https://playwright.dev/docs/api/class-testinfo#test-info-attach>), és a
 * letöltés mentése (<https://playwright.dev/docs/api/class-download#download-save-as>).
 * A 2026-09-25-ig élő alak csak a `path` opciót és a PNG fájlnevet nézte, és
 * egy JPEG formátumú képernyőkép hívás plusz `writeFileSync('x.jpg')` pár
 * mind a hat invariánson átment (mérve, egy független ellenőrzés és saját
 * injekció).
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

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- a git a fejlesztoi/CI PATH resze, ugyanugy mint a tobbi wrapper scriptben
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

function listTrackedFiles(root: string): readonly string[] {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- a git a fejlesztoi/CI PATH resze, ugyanugy mint a tobbi wrapper scriptben
  const output = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
  return output.split('\n').filter((line) => line.length > 0);
}

interface CodeFile {
  readonly trackedPath: string;
  readonly content: string;
}

/**
 * Minden commitolt kódfájl, a szentesített fájllal együtt. A git index a
 * bemenet, nem a lemez: egy nem commitolt, eldobható script amúgy sem
 * kerülhet be a repóba, és a CI is a commitolt fát látja.
 */
function listCodeFiles(root: string): readonly CodeFile[] {
  return listTrackedFiles(root)
    .filter((trackedPath) => CHECKED_EXTENSIONS.some((extension) => trackedPath.endsWith(extension)))
    .map((trackedPath) => ({ trackedPath, content: readFileSync(path.join(root, trackedPath), 'utf8') }));
}

/**
 * Minden commitolt kódfájl a szentesített fájlon KÍVÜL.
 */
function listOtherCodeFiles(root: string): readonly CodeFile[] {
  return listCodeFiles(root).filter((file) => file.trackedPath !== SANCTIONED_CAPTURE_FILE);
}

/**
 * A workspace csomagok neve és a belépési pontjuk (`src/index.ts`), a
 * commitolt `package.json` fájlokból.
 */
function readPackageEntries(root: string): ReadonlyMap<string, string> {
  const entries = new Map<string, string>();
  const manifests = listTrackedFiles(root).filter((file) => file.endsWith('package.json'));
  for (const trackedPath of manifests) {
    const parsed: unknown = JSON.parse(readTrackedFile(root, trackedPath));
    if (typeof parsed === 'object' && parsed !== null && 'name' in parsed && typeof parsed.name === 'string') {
      entries.set(parsed.name, path.posix.join(path.posix.dirname(trackedPath), 'src', 'index.ts'));
    }
  }
  return entries;
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
    const candidates = [base, ...CHECKED_EXTENSIONS.map((extension) => `${base}${extension}`)];
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
 * A képernyőképet lemezre író fájlok a szentesített fájlon kívül, a kép
 * formátumától és az írás módjától függetlenül, PUSZTA EGYÜTTES JELENLÉT
 * alapján (karakterosztályos ablak nélkül, `.claude/CLAUDE.md` 12. szekció).
 *
 * - Közvetlen író: a Playwright `use` képernyőkép opciója, a trace
 *   képernyőképei, a CLI alparancsa shell scriptből, vagy a lemezre író
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
function findScreenshotDiskWriters(
  files: readonly CodeFile[],
  packageEntries: ReadonlyMap<string, string>,
): readonly string[] {
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
      TRACE_OPTION_PATTERN.test(file.content) ||
      SCREENSHOTS_OPTION_PATTERN.test(file.content) ||
      SNAPSHOT_ASSERTION_PATTERN.test(file.content) ||
      (file.trackedPath.endsWith('.sh') && SHELL_CAPTURE_PATTERNS.every((pattern) => pattern.test(file.content))),
  );
  const capturing = files
    .filter((file) => file.trackedPath !== SANCTIONED_CAPTURE_FILE && CAPTURE_CALL_PATTERN.test(file.content))
    .map((file) => file.trackedPath);
  const circle = reachable(capturing, importersOf);
  const dependencies = reachable(circle, importsOf);

  const offenders = new Set(direct.map((file) => file.trackedPath));
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

function readTrackedFile(root: string, trackedPath: string): string {
  return readFileSync(path.join(root, trackedPath), 'utf8');
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

describe('a képernyőkép készítés egyetlen szentesített útja (gépi kényszer)', () => {
  it('(1) a szentesített fájlon kívül egyetlen commitolt fájl sem ír képernyőképet lemezre, a formátumtól és az írás módjától függetlenül, az import gráfon át sem', () => {
    const root = repoRoot();
    expect(findScreenshotDiskWriters(listCodeFiles(root), readPackageEntries(root))).toEqual([]);
  });

  it('(2) a szentesített fájlon kívül egyetlen commitolt fájl sem tart együtt képernyőkép hívást és PNG fájlnevet', () => {
    const root = repoRoot();
    const offenders = listOtherCodeFiles(root).filter(
      (file) => file.content.includes(ANY_SCREENSHOT_CALL) && PNG_FILE_NAME_PATTERN.test(file.content),
    );
    expect(offenders.map((file) => file.trackedPath)).toEqual([]);
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

  it('(7) az (1) ellenőrzés elkapja az ismert kerülő utakat, és a memóriában mérő, jogos alakot átengedi', () => {
    // A minták darabokból állnak össze, hogy ez a fájl ne tartalmazza őket
    // szó szerint (lásd a `SCREENSHOT_WORD` doksiját).
    const call = `await page.${SCREENSHOT_WORD}({ type: 'jpeg' })`;
    const cases: readonly {
      readonly name: string;
      readonly files: readonly CodeFile[];
      readonly packageEntries?: ReadonlyMap<string, string>;
      readonly offenders: readonly string[];
    }[] = [
      {
        name: 'JPEG kép és writeFileSync egy fájlban',
        files: [{ trackedPath: 'e2e/a.ts', content: `${fsImport('writeFileSync')}writeFileSync('x.jpg', ${call});` }],
        offenders: ['e2e/a.ts'],
      },
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
        name: 'író segédfüggvény workspace csomagban',
        files: [
          { trackedPath: 'packages/io/src/index.ts', content: `export { save } from './save/save.ts';` },
          {
            trackedPath: 'packages/io/src/save/save.ts',
            content: `${fsImport('writeFileSync')}export const save = writeFileSync;`,
          },
          { trackedPath: 'e2e/a.ts', content: `import { save } from '@x/io';\nsave('x.jpg', ${call});` },
        ],
        packageEntries: new Map([['@x/io', 'packages/io/src/index.ts']]),
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
      {
        name: 'jogos: memóriában mért kép a lefedettségi fixtúrán át, olvasó teszt, kikapcsolt opció',
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
    ];
    for (const testCase of cases) {
      expect(findScreenshotDiskWriters(testCase.files, testCase.packageEntries ?? new Map()), testCase.name).toEqual(
        testCase.offenders,
      );
    }
  });

  it('(8) az (1) invariáns a (7) által igazolt ellenőrzést futtatja a commitolt fán', () => {
    // A (7) a függvényt igazolja, nem az (1) törzsét: ha az (1) visszaállna a
    // 2026-09-25 előtti alakjára (a képernyőkép hívás és a path opció együttes
    // jelenléte egy fájlban), a (7) zöld maradna, és a három ismert injekció
    // (JPEG plusz writeFileSync, stream, író segédfüggvény) átmenne a kapun
    // (független ellenőrzés). Ezért ez a fájl a saját forrásából ellenőrzi,
    // hogy az (1) törzse pontosan ezt a függvényt futtatja a commitolt fán.
    const source = readTrackedFile(repoRoot(), SELF_FILE);
    const start = source.indexOf("it('(1)");
    const end = source.indexOf("it('(2)");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(source.slice(start, end)).toContain(TREE_CHECK_CALL);
  });
});
