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
// gépi kényszer: hat invariáns, mindegyik nem nulla kilépési kódú bukást ad a
// `bun run test` kapun, ami tagja a kilenc kapunak és szerepel a CI
// összesítő `ci` job `needs` listájában.
//
// A VÉDELEM KÉT RÉTEGE:
//
//   1. A COMMITOLT FA alakja (1 ... 5. invariáns). A git INDEXET olvassa
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
 */
const CHECKED_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.sh'];

/**
 * A fixtúra alsó korlátja élekben. Ugyanaz a szám, amit a fixtúra alakját
 * őrző `apps/web/e2e/showcase-graph.spec.ts` is használ: terméktermelési
 * elvárás a bizonyíték előállítására, nem mért érték.
 */
const MINIMUM_EDGE_COUNT = 5;

/**
 * A mért képek alsó korlátja. A szentesített csővezeték ma NÉGY képen mér
 * élenkénti kifestettséget: két elrendezés (nyitott beállítás panel és
 * kiválasztás nélküli vászon) a két témában. Ratchet: ha új mért kép
 * érkezik, ez a szám felfelé követi.
 */
const MINIMUM_MEASURED_IMAGE_COUNT = 4;

/**
 * Mindkét témában kell mért kép (`.claude/CLAUDE.md` 11. szekció).
 */
const REQUIRED_THEME_NAMES = ['light', 'dark'] as const;

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
 * A képernyőkép FÁJLBA írásának mintája: képernyőkép hívás, aminek az opció
 * objektumában `path` mező áll. Ez a pontos, mérhető választóvonal a
 * szentesített csővezeték és a pixel MÉRÉS között: az
 * `edge-paint-measurement.ts` és a `graph-edge-stroke.spec.ts` is hív
 * képernyőkép készítést, de `path` nélkül, memóriában tartott bufferre -
 * azok nem szállított képet állítanak elő.
 */
const SCREENSHOT_TO_FILE_PATTERN = new RegExp(String.raw`${SCREENSHOT_WORD}\(\s*\{[^)]{0,400}?\bpath\s*:`);

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
 * pixel mérés is ilyet hív), a PNG fájlnév mintával EGYÜTT viszont az: ez
 * fogja meg azt a kerülő utat, ami a buffert a hívástól elválasztva,
 * `writeFileSync` hívással írja lemezre.
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
 * Minden commitolt kódfájl a szentesített fájlon KÍVÜL. A git index a
 * bemenet, nem a lemez: egy nem commitolt, eldobható script amúgy sem
 * kerülhet be a repóba, és a CI is a commitolt fát látja.
 */
function listOtherCodeFiles(root: string): readonly CodeFile[] {
  return listTrackedFiles(root)
    .filter(
      (trackedPath) =>
        trackedPath !== SANCTIONED_CAPTURE_FILE &&
        CHECKED_EXTENSIONS.some((extension) => trackedPath.endsWith(extension)),
    )
    .map((trackedPath) => ({ trackedPath, content: readFileSync(path.join(root, trackedPath), 'utf8') }));
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

describe('a képernyőkép készítés egyetlen szentesített útja (gépi kényszer)', () => {
  it('(1) a szentesített fájlon kívül egyetlen commitolt fájl sem ír képernyőképet lemezre', () => {
    const root = repoRoot();
    const offenders = listOtherCodeFiles(root).filter(
      (file) => SCREENSHOT_TO_FILE_PATTERN.test(file.content) || SNAPSHOT_ASSERTION_PATTERN.test(file.content),
    );
    expect(offenders.map((file) => file.trackedPath)).toEqual([]);
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
    }
  });
});
