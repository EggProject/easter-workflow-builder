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
// gépi kényszer: hét invariáns, mindegyik nem nulla kilépési kódú bukást ad a
// `bun run test` kapun, ami tagja a kilenc kapunak és szerepel a CI
// összesítő `ci` job `needs` listájában.
//
// A VÉDELEM KÉT RÉTEGE:
//
//   1. A COMMITOLT FA alakja (1 ... 5. és 7. invariáns). A git INDEXET olvassa
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
 * ELŐTT hatástalanította: mérve, egy kivágat számító hívást és utána a mezőt
 * tartalmazó opció objektum elkerülte (egy független ellenőrzés így vitte át a
 * védelmet, 2026-09-15). Bármilyen tiltott karakterosztállyal ugyanez a kerülő
 * út nyílna újra egy másik karakterrel, ezért az ablak teljesen megszűnt: a
 * fájlnak egyszerűen nem lehet EGYSZERRE képernyőkép hívása és `path`
 * opciója (2026-09-25 óta a képernyőkép kör egyetlen fájljának sem,
 * `findScreenshotDiskWriters`). Mérve a commitolt fán: erre a két minta
 * EGYÜTT pontosan egyetlen fájlra illeszkedik, a szentesített
 * `capture-screenshots.ts`-re, tehát a szigorítás ma nulla hamis jelzést ad.
 */
const PATH_OPTION_PATTERN = /\bpath\s*:/;

/**
 * Képernyőképet készítő hívás: a Playwright API hívása, vagy a CLI
 * `screenshot` alparancsa programból indítva (a parancs argumentum listájában
 * álló szó mint string literál).
 */
const CAPTURE_CALL_PATTERN = new RegExp(String.raw`${SCREENSHOT_WORD}\(|['"]${SCREENSHOT_WORD}['"]`);

/**
 * A CLI `screenshot` alparancsa shell scriptből: a `playwright` és a
 * `screenshot` szó egyazon `.sh` fájlban. Az alparancs a képet mindig a
 * megadott fájlba írja (<https://playwright.dev/docs/cli>), tehát ez önmagában
 * lemezre írás.
 */
const SHELL_CAPTURE_PATTERNS = [/\bplaywright\b/, new RegExp(String.raw`\b${SCREENSHOT_WORD}\b`)] as const;

/**
 * A Playwright `use` beállításának képernyőkép opciója bármely, `off`-tól
 * eltérő értékkel: a Playwright ilyenkor a tesztek képernyőképét maga írja a
 * teszt kimeneti könyvtárába ("Trace files, screenshots and videos will appear
 * in the test output directory", <https://playwright.dev/docs/test-use-options>).
 */
const SCREENSHOT_OPTION_PATTERN = new RegExp(String.raw`\b${SCREENSHOT_WORD}\s*:\s*(?:\{|['"](?!off['"]))`);

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
 * - Közvetlen író: a Playwright `use` képernyőkép opciója, a CLI alparancsa
 *   shell scriptből, vagy a lemezre író képösszehasonlító assertion.
 * - A KÉPERNYŐKÉP KÖR: a képernyőképet készítő fájlok, és minden fájl, ami
 *   ezeket (közvetve is) importálja. Ezek egyike sem hivatkozhat lemezre
 *   írni képes modulra vagy hívásra, és a `path` opciót sem használhatja:
 *   a kép a hívótól a hívóig ugyanabban a körben halad.
 * - A KÖR FÜGGŐSÉGEI: mindaz, amit a kör (közvetve is) importál. Ezek nem
 *   hivatkozhatnak lemezre írni képes modulra (a `path` kulcs itt szabad,
 *   mert egy függőség adatszerkezetében más jelentésű), az
 *   `ALLOWED_WRITER_FILES` kivételével. Enélkül egy saját író segédfüggvény
 *   egy másik fájlban (`saveImage(név, await képernyőkép())`) átcsúszna.
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
    const isOffender = circle.has(trackedPath)
      ? DISK_WRITER_PATTERN.test(content) || PATH_OPTION_PATTERN.test(content)
      : DISK_WRITER_PATTERN.test(content) && !ALLOWED_WRITER_FILES.has(trackedPath);
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
    ];
    for (const testCase of cases) {
      expect(findScreenshotDiskWriters(testCase.files, testCase.packageEntries ?? new Map()), testCase.name).toEqual(
        testCase.offenders,
      );
    }
  });
});
