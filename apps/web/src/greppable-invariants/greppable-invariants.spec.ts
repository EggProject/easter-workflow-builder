// Huszonnégy, megvalósítás nélküli, greppel ellenőrizhető invariáns teszt egy
// csoportban (T-008-31, SPEC-002 6.2 5. pont mintája: konfigurációs
// invariáns saját téma mappában, a mappa neve annak a dolognak a neve, amit
// őriz). Mindegyik a forrásfát olvassa vissza nyers szövegként, statikus
// elemzés helyett - ugyanaz a minta, mint a `vite-istanbul-include-invariant`
// témáé. A T-009-24 lépéssel érkezett tizenhatodik (a transcript sorokban
// nem jelenhet meg költség mező, SPEC-008 AC37) TÖRÖLVE: a user 2026-09-23-i
// döntése ("Költség külön mezőként is látszódjon") a tiltást visszavonta, a
// költség SDK becslésként jelenik meg (`run-event-row` téma). A mai (16) és
// (17) a T-009-25 lépéssel érkezett (SPEC-008 AC39, AC40), a (18) a REST
// hibaüzenetekről szóló user döntéssel (2026-09-24, SPEC-007 8.4). A (19), a (20), a (21) és a
// (22) a T-009-33 hiányzó tételeinek pótlása (PLAN-009 F8 zárás, 2026-09-28): a React Flow
// `rf__` locator kizárólagosság az e2e alatt (1), a kézi időzítés tilalma az e2e alatt (10), a
// gráf szemantikai validáció kliens oldali tilalma (3), és a csomópont kártya méret egyetlen
// forrás szabálya (12). A (23) a PLAN-009 T-009-42 lépésével érkezett (SPEC-008 5.8, AC79): a
// `crypto.randomUUID(` hívás kizárólag a két böngésző oldali azonosító generátor fájlban áll. A
// (24) a PLAN-009 T-009-34 adverzariális átvizsgálásával érkezett (szabálykönyv 11. szekció): a
// `matchMedia(` hívás csak `prefers-*`/`forced-colors` literállal vagy token kötött töréspont
// konstanssal áll; ugyanez a lépés a meglévő invariánsok jóhiszemű kerülő alakjait is lezárta.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(directory, '..', '..', '..', '..');
const WEB_SRC = path.join(directory, '..');

interface SourceFile {
  readonly relativePath: string;
  readonly content: string;
}

function listSourceFiles(root: string, extensions: readonly string[]): readonly SourceFile[] {
  const entries: SourceFile[] = [];
  function walk(current: string): void {
    const directoryEntries = readdirSync(current, { withFileTypes: true });
    for (const entry of directoryEntries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (extensions.some((extension) => entry.name.endsWith(extension))) {
        entries.push({ relativePath: path.relative(root, fullPath), content: readFileSync(fullPath, 'utf8') });
      }
    }
  }
  walk(root);
  return entries;
}

/**
 * A doksi sorokat (JSDoc `*` folytatás és `//` egysoros komment) kiszűri,
 * mielőtt egy irodalmi minta jelenlétét vizsgálja - egy dokumentáló mondat
 * (pl. "GET /api/providers válaszából épül") nem termékkód literál.
 */
function stripCommentLines(content: string): string {
  return content
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith('*') && !trimmed.startsWith('//');
    })
    .join('\n');
}

function bracketDepthChange(character: string): number {
  if ('([{'.includes(character)) {
    return 1;
  }
  if (')]}'.includes(character)) {
    return -1;
  }
  return 0;
}

/**
 * A `start` helyen nyíló sztring vagy sablon literál záró jele utáni
 * index.
 */
function quotedLiteralEnd(text: string, start: number): number {
  const quote = text.charAt(start);
  let index = start + 1;
  while (index < text.length && text.charAt(index) !== quote) {
    index += text.charAt(index) === '\\' ? 2 : 1;
  }
  return index + 1;
}

/**
 * Egy hívás argumentumai a nyitó zárójel utáni szövegből, a legfelső szintű
 * vesszők mentén darabolva, a záró zárójelig. Zárójel párosítás a `(`, `[`,
 * `{` jeleken; a sztring és sablon literálok belsejét átlépi, hogy egy
 * literálban álló vessző vagy zárójel ne törje meg a darabolást.
 */
function readCallArguments(rest: string): readonly string[] {
  const callArguments: string[] = [];
  let argumentStart = 0;
  let depth = 0;
  let index = 0;
  while (index < rest.length) {
    const character = rest.charAt(index);
    if (["'", '"', '`'].includes(character)) {
      index = quotedLiteralEnd(rest, index);
      continue;
    }
    if (depth === 0 && (character === ')' || character === ',')) {
      callArguments.push(rest.slice(argumentStart, index).trim());
      if (character === ')') {
        return callArguments;
      }
      argumentStart = index + 1;
    }
    depth += bracketDepthChange(character);
    index += 1;
  }
  return callArguments;
}

/**
 * A `calleePattern` (globális minta, ami a hívás nyitó zárójelével zárul)
 * minden illeszkedésére a hívás argumentumlistája.
 */
function listCallArguments(content: string, calleePattern: RegExp): readonly (readonly string[])[] {
  return content
    .matchAll(calleePattern)
    .map((match) => readCallArguments(content.slice(match.index + match[0].length)))
    .toArray();
}

const NUMBER_LITERAL_PATTERN = /^(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE]\d+)?$/;

/**
 * Igaz, ha az argumentum számliterál, vagy kizárólag számliterálokból álló
 * aritmetikai kifejezés (`5000`, `0`, `1_000`, `5 * 1000`, `(5000)`).
 */
function isNumericConstantArgument(argument: string): boolean {
  const tokens = argument
    .replaceAll(/[\s()]/g, '')
    .split(/[+\-*/%]/)
    .filter((token) => token.length > 0);
  return tokens.length > 0 && tokens.every((token) => NUMBER_LITERAL_PATTERN.test(token));
}

/**
 * A workspace minden `package.json` fájlja, a repo gyökerétől a fájlrendszer
 * bejárásával, ugyanazon a halmazon, amit a `git ls-files` a `package.json`
 * mintára ad: a `node_modules` és a pont kezdetű (rejtett, eszköz és
 * worktree) könyvtárak kihagyva.
 */
function listWorkspacePackageJsonPaths(): readonly string[] {
  const packageJsonPaths: string[] = [];
  function walk(current: string): void {
    const directoryEntries = readdirSync(current, { withFileTypes: true });
    for (const entry of directoryEntries) {
      if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        walk(path.join(current, entry.name));
      } else if (entry.isFile() && entry.name === 'package.json') {
        packageJsonPaths.push(path.join(current, entry.name));
      }
    }
  }
  walk(REPO_ROOT);
  return packageJsonPaths;
}

const PRODUCT_FILES = listSourceFiles(WEB_SRC, ['.ts', '.tsx']).filter(
  (file) => !file.relativePath.endsWith('.spec.ts') && !file.relativePath.endsWith('.spec.tsx'),
);
const ALL_FILES = listSourceFiles(WEB_SRC, ['.ts', '.tsx']);
const WORKSPACE_PACKAGE_JSON_PATHS = listWorkspacePackageJsonPaths();

/**
 * A (11) és a (12) hatókörének pozitív oldala: a bejárás ténylegesen eléri
 * a workspace csomagjait.
 */
function expectWorkspacePackageJsonCoverage(): void {
  expect(WORKSPACE_PACKAGE_JSON_PATHS.map((packageJsonPath) => path.relative(REPO_ROOT, packageJsonPath))).toEqual(
    expect.arrayContaining([
      'package.json',
      path.join('apps', 'web', 'package.json'),
      path.join('packages', 'ui', 'package.json'),
    ]),
  );
}

describe('greppes invariáns tesztek (T-008-31)', () => {
  it('(1) nincs default React import', () => {
    const offenders = ALL_FILES.filter((file) => /^import React\b/m.test(file.content));
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
  });

  it('(2) nincs drótszintű típus vagy séma az apps/web/src alatt (nincs zod import)', () => {
    const offenders = ALL_FILES.filter((file) => /from ['"]zod['"]/.test(file.content));
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
  });

  it('(3) nincs .parse( és .parseAsync( hívás (a JSON.parse kivétel: az nem Zod séma hívás)', () => {
    const offenders = PRODUCT_FILES.filter((file) => /(?<!JSON)\.parse(?:Async)?\(/.test(file.content));
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
  });

  it('(4) nincs /api/ sztring literál termékkódban (kommenten kívül)', () => {
    const offenders = PRODUCT_FILES.filter((file) => stripCommentLines(file.content).includes('/api/'));
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
  });

  it('(5) nincs new EventSource( hívás a gyárfájlon kívül (a globális objektumon át minősített alak sem)', () => {
    const eventSourceConstruction = /\bnew\s+(?:(?:globalThis|window|self)\s*\.\s*)?EventSource\b/;
    const offenders = PRODUCT_FILES.filter(
      (file) =>
        eventSourceConstruction.test(file.content) && !file.relativePath.endsWith('browser-event-source-factory.ts'),
    );
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
  });

  it('(6) nincs Navigation API hivatkozás (window.navigation / globalThis.navigation / előtag nélküli navigation.)', () => {
    const offenders = PRODUCT_FILES.filter((file) => /\b(window|globalThis)\.navigation\b/.test(file.content));
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
    // Az előtag nélküli globális (`navigation.addEventListener(...)`) ugyanaz
    // az objektum. A negatív visszatekintés kizárja a tulajdonság elérést
    // (`x.navigation`, `#navigation`), a hosszabb azonosítót
    // (`historyNavigation`), és a sztringben vagy útvonalban álló szót
    // (`'./navigation.css'`, URL). A doksi sorok kiszűrve, mint a (4)-nél: a
    // `RunViewScreen.tsx` JSDoc-ja egy `navigation.html` URL-t idéz.
    const bareNavigationPattern = /(?<![\w$.#/\\'"`-])navigation\s*\??\.\s*[A-Za-z_$]/;
    const bareOffenders = PRODUCT_FILES.filter((file) => bareNavigationPattern.test(stripCommentLines(file.content)));
    expect(bareOffenders.map((file) => file.relativePath)).toEqual([]);
  });

  it('(7) nincs ResizeObserver és IntersectionObserver hivatkozás', () => {
    // A doksi sorok kiszűrve, ugyanazzal a `stripCommentLines` segédfüggvénnyel
    // és ugyanabból az okból, mint a (4) és a (14) ellenőrzésnél: a szabály a
    // tényleges API HIVATKOZÁST tiltja, nem azt a magyarázó mondatot, ami
    // leírja, miért nem használunk saját megfigyelőt (`graph-editor` téma,
    // 2026-09-05).
    const offenders = PRODUCT_FILES.filter((file) =>
      /ResizeObserver|IntersectionObserver/.test(stripCommentLines(file.content)),
    );
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
  });

  it('(8) nincs kitalált port, origin, lapméret vagy időkorlát szám (readFrontendConfig alapérték nélkül olvas)', () => {
    const configSource = readFileSync(path.join(WEB_SRC, 'frontend-config', 'read-frontend-config.ts'), 'utf8');
    expect(configSource).not.toMatch(/\?\?\s*\d/);
    const offenders = PRODUCT_FILES.filter((file) =>
      /localhost|127\.0\.0\.1|\[::1\]|:4173|:4174|:5173|:3000|:3001|:8080/.test(file.content),
    );
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
    // Kitalált idő szám (pl. toast `duration: 5000`) - a `use-toasts.ts`
    // csak a hívó által átadott `duration` VÁLTOZÓT olvassa, számliterált
    // sosem ír; termékkódban `pushToast`/`setTimeout` mellett numerikus
    // literál nem állhat, mert nincs rá dokumentált forrás.
    const timeoutOffenders = PRODUCT_FILES.filter((file) =>
      /(?:duration|setTimeout|setInterval)\s*[:(]\s*\d/.test(file.content),
    );
    expect(timeoutOffenders.map((file) => file.relativePath)).toEqual([]);
    // A hívás BÁRMELYIK argumentuma számít, nem csak az első: a
    // `setTimeout(() => ..., 5000)` alakban a késleltetés a második. A `0` is
    // számliterál, tehát ez sem engedett (a mai termékkódban nincs időzítő
    // hívás).
    const timerArgumentOffenders = PRODUCT_FILES.filter((file) =>
      listCallArguments(stripCommentLines(file.content), /\b(?:setTimeout|setInterval)\s*\(/g).some((callArguments) =>
        callArguments.some((argument) => isNumericConstantArgument(argument)),
      ),
    );
    expect(timerArgumentOffenders.map((file) => file.relativePath)).toEqual([]);
    // Idő jelentésű kulcs (`*Ms`, `*delay*`, `*duration*`) számliterállal.
    const timeKeyPattern = /(?<![\w$])\w*(?:Ms|[dD]elay\w*|[dD]uration\w*)['"]?\s*:\s*\.?\d/;
    const timeKeyOffenders = PRODUCT_FILES.filter((file) => timeKeyPattern.test(stripCommentLines(file.content)));
    expect(timeKeyOffenders.map((file) => file.relativePath)).toEqual([]);
  });

  it('(9) a @xyflow/react import kizárólag a három engedett témára szűkül, és nincs SPEC-009 hatókörű fájl', () => {
    // Tényleges import utasítás mintáját keresi, nem puszta részsztringet:
    // egy pusztán szöveges említés (pl. ennek a tesztnek a saját címe vagy
    // egy magyarázó komment) nem termékkód import. A SPEC-008 F3 fázisa óta
    // (PLAN-009 T-009-15, T-009-16) a `graph-node-card` és a `graph-editor`
    // ténylegesen importálja a könyvtárat; a harmadik engedett téma, a
    // `run-graph`, a SPEC-008 F4 fázisában érkezik (AC29, 12.3 szekció). A
    // korábbi, teljes tiltás (SPEC-008 jóváhagyása előtti állapot) ezzel a
    // szűkített, de nem nulla halmazzal váltódott fel.
    const xyflowModuleName = ['@xyflow', 'react'].join('/');
    const importPattern = new RegExp(`from ['"]${xyflowModuleName}['"]`);
    const allowedXyflowThemeNames = new Set(['graph-editor', 'graph-node-card', 'run-graph']);
    const offenders = ALL_FILES.filter(
      (file) =>
        importPattern.test(file.content) && !allowedXyflowThemeNames.has(file.relativePath.split(path.sep)[0] ?? ''),
    );
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
    // A `graph-auto-layout` téma szándékosan NEM engedett (SPEC-008 5.7: "az
    // elrendezés tiszta függvény, és nem importál @xyflow/react szimbólumot").
    // A `settings-screen` 2026-09-28 óta nem tiltott: a SPEC-008 5.11 (O-32)
    // a Beállítások képernyőt a módosító választójával ide hozza (SPEC-007 16.
    // szekció 3. kritériumának lazítása); a SPEC-009 többi eleme marad tiltva.
    const outOfScopeThemeNames = new Set(['skill-upload', 'mcp-server-config']);
    const themeDirectories = readdirSync(WEB_SRC, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(themeDirectories.filter((name) => outOfScopeThemeNames.has(name))).toEqual([]);
  });

  it('(10) a main.tsx elágazás nélküli: egyetlen import és egyetlen hívás', () => {
    const mainSource = readFileSync(path.join(WEB_SRC, 'app-mount', 'main.tsx'), 'utf8');
    const codeLines = mainSource
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    // A pontos, két soros egyezés önmagában kizár minden elágazást
    // (if/switch/ternária/&&/||): a fájl tartalma bájtra ez a két sor,
    // semmi más.
    expect(codeLines).toEqual(["import { mountApp } from './mount-app.tsx';", 'mountApp();']);
  });

  it('(11) nincs @vitejs/plugin-react a workspace package.json fájljaiban (SPEC-007 31. és 56. kritérium)', () => {
    expectWorkspacePackageJsonCoverage();
    const offenders = WORKSPACE_PACKAGE_JSON_PATHS.filter((packageJsonPath) =>
      readFileSync(packageJsonPath, 'utf8').includes('@vitejs/plugin-react'),
    );
    expect(offenders.map((packageJsonPath) => path.relative(REPO_ROOT, packageJsonPath))).toEqual([]);
  });

  it('(12) nincs @testing-library függőség a workspace package.json fájljaiban (SPEC-007 56. kritérium)', () => {
    expectWorkspacePackageJsonCoverage();
    const offenders = WORKSPACE_PACKAGE_JSON_PATHS.filter((packageJsonPath) =>
      readFileSync(packageJsonPath, 'utf8').includes('@testing-library'),
    );
    expect(offenders.map((packageJsonPath) => path.relative(REPO_ROOT, packageJsonPath))).toEqual([]);
  });

  it('(13) a vite.config.ts nem tartalmaz port számot, origin literált és timeout mezőt a proxy szabályban (SPEC-008 3.3, M-79)', () => {
    const viteConfigSource = readFileSync(path.join(WEB_SRC, '..', 'vite.config.ts'), 'utf8');
    expect(viteConfigSource).not.toMatch(/localhost|127\.0\.0\.1|\[::1\]|:4173|:4174|:5173|:3000|:3001|:8080/);
    // Bármely kulcs, aminek a nevében `timeout` áll, kis-nagybetűtől
    // függetlenül (`timeout`, `proxyTimeout`).
    expect(viteConfigSource).not.toMatch(/timeout[\w$]*['"]?\s*:/i);
  });

  it('(14) a dagre opciók közül kizárólag a rankdir: LR felülírt (SPEC-008 5.7, M-93, AC61)', () => {
    const forbiddenOptionNames = ['nodesep', 'ranksep', 'edgesep', 'marginx', 'marginy'];
    const offenders = PRODUCT_FILES.filter((file) => {
      const codeOnly = stripCommentLines(file.content);
      return forbiddenOptionNames.some((optionName) => codeOnly.includes(optionName));
    });
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
    // Pozitív lista (szabálykönyv 11. szekció: a dagre minden más opciót
    // saját alapértéken hagy, a `rankdir: 'LR'` kivételével): minden
    // `setGraph(` hívás egyetlen argumentuma pontosan ez az objektum literál,
    // és a dagre `layout(` hívása opció argumentum nélkül áll.
    const dagreGraphOptionCalls = PRODUCT_FILES.flatMap((file) =>
      listCallArguments(stripCommentLines(file.content), /\.setGraph\s*\(/g).map((callArguments) => ({
        file: file.relativePath,
        callArguments,
      })),
    );
    expect(dagreGraphOptionCalls.length).toBeGreaterThan(0);
    const onlyRankdirOption = /^\{rankdir:(['"])LR\1,?\}$/;
    const dagreGraphOptionOffenders = dagreGraphOptionCalls.filter(
      ({ callArguments }) =>
        callArguments.length !== 1 || !onlyRankdirOption.test((callArguments[0] ?? '').replaceAll(/\s/g, '')),
    );
    expect(dagreGraphOptionOffenders).toEqual([]);
    const layoutOptionOffenders = PRODUCT_FILES.filter(
      (file) =>
        /from ['"]@dagrejs\/dagre['"]/.test(file.content) &&
        listCallArguments(stripCommentLines(file.content), /\blayout\s*\(/g).some(
          (callArguments) => callArguments.length !== 1,
        ),
    );
    expect(layoutOptionOffenders.map((file) => file.relativePath)).toEqual([]);
  });

  it('(15) egyetlen ág sem függ mért csomópont geometriától (nincs `measured.`/`measured?.`/`measured[` olvasás és `getBoundingClientRect(` hívás)', () => {
    // A PLAN-009 T-009-15 elfogadási kritériuma szó szerint ezt a két mintát
    // kéri, és a SPEC-008 12.2 szabálya áll mögötte: a mért csomópont méret
    // KIZÁRÓLAG a React Flow saját `dimensions` változásából jut a nézeti
    // állapotba (`graph-editor/measured-node-sizes.ts`), tehát a termékkód sem
    // a `measured` tulajdonságot nem olvassa, sem a DOM-tól nem kér
    // geometriát. Enélkül a mérettől függő ágak csak valós böngészőben
    // lennének tesztelhetők, a happy-dom unit tesztek pedig nulla node méretet
    // látnak (M-53, M-54).
    //
    // A pont (`measured.`, `measured?.`, `measured[`) a tulajdonság OLVASÁSÁT
    // fogja meg. A mező ÍRÁSA (`measured: size`) szándékosan nem tiltott: az a
    // `withMeasuredNodeSize` egyetlen szentesített útja, amin a méret
    // visszakerül a könyvtárhoz.
    //
    // A doksi sorok kiszűrve, ugyanazzal a `stripCommentLines`
    // segédfüggvénnyel és ugyanabból az okból, mint a (4), a (7) és a (14)
    // ellenőrzésnél: mindkét minta ma pontosan azokban a magyarázó
    // kommentekben szerepel, amik kimondják, hogy nincs ilyen hivatkozás
    // (`GraphNodeCard.tsx`, `RunGraphCanvas.tsx`).
    const measuredGeometryPattern = /measured\s*(?:\?\.|\.|\[)|getBoundingClientRect\(/;
    const offenders = PRODUCT_FILES.filter((file) => measuredGeometryPattern.test(stripCommentLines(file.content)));
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
  });

  it('(16) a react-window 1.x két megszűnt lista komponensének neve sehol nem szerepel, sem a src, sem az e2e alatt (SPEC-008 AC39, M-69)', () => {
    // A két név a 2.x API-ban megszűnt (`List` és `Grid` a helyük), egy
    // elavult tutorial szerint írt kód nem fordulna le. A neveket a teszt
    // darabokból rakja össze, különben a saját forrása illeszkedne rájuk.
    const removedNames = [['Fixed', 'Size', 'List'].join(''), ['Variable', 'Size', 'List'].join('')];
    const e2eFiles = listSourceFiles(path.join(WEB_SRC, '..', 'e2e'), ['.ts', '.tsx']);
    const offenders = [...ALL_FILES, ...e2eFiles].filter((file) =>
      removedNames.some((name) => file.content.includes(name)),
    );
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
    // A pozitív oldal: a transcript ténylegesen a 2.x `List` komponenst használja.
    const panelSource = readFileSync(path.join(WEB_SRC, 'transcript-panel', 'TranscriptPanel.tsx'), 'utf8');
    expect(panelSource).toMatch(/import \{[^}]*\bList\b[^}]*\} from 'react-window';/);
  });

  it('(17) nincs görgetési pixel küszöb: termékkód nem olvas görgetési geometriát, az aljára tapadást a sorindex predikátum dönti el (SPEC-008 7.4, AC40)', () => {
    // Egy `scrollTop + clientHeight >= scrollHeight - X` alakú feltételhez
    // ezek közül legalább egy mező kellene; ha egyik sem szerepel a
    // termékkódban, pixel küszöb szám sem állhat sehol. A doksi sorok
    // kiszűrve, ugyanazzal a `stripCommentLines` segédfüggvénnyel és
    // ugyanabból az okból, mint a (4), a (7), a (14) és a (15) ellenőrzésnél:
    // a predikátum JSDoc-ja éppen ezt az elhagyott alternatívát nevezi meg.
    const scrollGeometryPattern =
      /\b(?:scrollTop|scrollHeight|scrollY|clientHeight|offsetHeight|pageYOffset|innerHeight|getClientRects)\b/;
    const offenders = PRODUCT_FILES.filter((file) => scrollGeometryPattern.test(stripCommentLines(file.content)));
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
    const predicateSource = readFileSync(path.join(WEB_SRC, 'transcript-panel', 'is-last-row-visible.ts'), 'utf8');
    expect(predicateSource).toContain('visibleRows.stopIndex === rowCount - 1');
  });

  it('(18) REST hibaág üzenete nem áll nyers role="alert" elemben: a maradék literál mind felsorolt, nem REST eredetű hely (SPEC-007 8.4, user döntés 2026-09-24)', () => {
    // A REST hívás `Outcome` hibaága a design system `danger` `Alert`
    // blokkjában jelenik meg, a szerepet a komponens adja, nem a hívó
    // literálja. A lista a NEM REST eredetű riasztásokat nevezi meg,
    // fájlonként a darabszámmal: egy új nyers riasztás itt bukik, és csak
    // kimondott döntéssel vehető fel. A JSX kifejezés alak (`role={'alert'}`)
    // is számít. A doksi sorok kiszűrve, mint a (17)-nél.
    const nonRestAlertCounts: Readonly<Record<string, number>> = {
      // a hiányzó `workflowId` query paraméter és a mentés előtti helyi séma ellenőrzés összesítője
      [path.join('graph-editor', 'GraphEditorScreen.tsx')]: 2,
      // a hiányzó `runId` query paraméter és a pillanatkép helyi vetítésének hibája
      [path.join('run-view', 'RunViewScreen.tsx')]: 2,
      // a futás saját hibája (a `RunDetail` mezői, nem hibaág)
      [path.join('run-control', 'RunControlBar.tsx')]: 1,
      // a szerkesztő panel két statikus figyelmeztetése
      [path.join('node-inspector', 'AgentDefinitionEntryFields.tsx')]: 1,
      [path.join('node-inspector', 'ScriptNodeFields.tsx')]: 1,
    };
    const alertCounts = Object.fromEntries(
      PRODUCT_FILES.map(
        (file) =>
          [
            file.relativePath,
            stripCommentLines(file.content).match(/role=(?:["']alert["']|\{\s*(["'`])alert\1\s*\})/gu)?.length ?? 0,
          ] as const,
      ).filter(([, count]) => count > 0),
    );
    expect(alertCounts).toEqual(nonRestAlertCounts);
  });

  it('(19) getByTestId kizárólag rf__ előtaggal áll az e2e alatt (SPEC-008 12.3, T-009-33 (1))', () => {
    // A kötött locator sorrend egyetlen kivétele a React Flow saját
    // `data-testid="rf__node-<id>"` (és `rf__edge-<id>`, `rf__wrapper`)
    // attribútuma; minden más `getByTestId` hívás a kivétel túlterjeszkedése.
    // Bármely `getByTestId` hivatkozás bukik, aminek az első argumentuma nem
    // `rf__` kezdetű sztring vagy sablon literál (változó, konstans, regex, és
    // a nem hívás alak is), és bármely `data-testid` szöveg, ami nem `rf__`
    // kezdetű értékre szűrő `=` vagy `^=` attribútum szelektor
    // (`[data-testid="foo"]`, `getAttribute('data-testid')`).
    const e2eFiles = listSourceFiles(path.join(WEB_SRC, '..', 'e2e'), ['.ts', '.tsx']);
    const nonReactFlowTestIdCall = /getByTestId(?!\s*\(\s*[`'"]rf__)/g;
    const nonReactFlowTestIdAttribute = /data-testid(?!\s*\^?=\s*["']?rf__)/g;
    const offenders: string[] = [];
    for (const file of e2eFiles) {
      const codeOnly = stripCommentLines(file.content);
      for (const match of [
        ...codeOnly.matchAll(nonReactFlowTestIdCall),
        ...codeOnly.matchAll(nonReactFlowTestIdAttribute),
      ]) {
        offenders.push(`${file.relativePath}: ${codeOnly.slice(match.index, match.index + 60)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('(20) nincs waitForTimeout, setTimeout, setInterval és sleep hívás az e2e alatt (docs/research/2026-08-29-playwright-teszt-szabalyok.md, T-009-33 (10))', () => {
    // A hivatalos Playwright doksi szó szerint tiltja a kézi, idő alapú
    // várakozást; minden e2e várakozás web-first assertion vagy
    // `page.waitForResponse()`. A doksi sorok kiszűrve, mert a projekt
    // szabálykönyve és a spec fájlok fejléc kommentje maga is idézi ezeket a
    // hívásneveket, magyarázatként, nem hívásként.
    const e2eFiles = listSourceFiles(path.join(WEB_SRC, '..', 'e2e'), ['.ts', '.tsx']);
    const forbiddenCallPattern = /\b(?:waitForTimeout|setTimeout|setInterval|sleep)\s*\(/;
    const offenders = e2eFiles.filter((file) => forbiddenCallPattern.test(stripCommentLines(file.content)));
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
  });

  it('(21) nincs gráf szemantikai validáció a kliensen: a szerver gráf-validációs hibaosztályai kizárólag a hibaüzenet leképezésben és a dokumentált kivételekben szerepelnek (SPEC-008 5.4, 13. szekció, T-009-33 (3))', () => {
    // A kör, a `loop` visszaél szabályai, a `fan_out` hatókör
    // kiegyensúlyozottsága és a többi gráf szemantikai validáció kizárólag a
    // szerveré (SPEC-008 5.4); a kliens csak a séma ALAKJÁT ellenőrzi. A
    // greppes kritérium a SPEC-008 13. szekciója szerinti "graph_cycle_detected
    // és társai" mintát követi: ha ezek az azonosítók bármely más fájlban
    // felbukkannak, az a validációs logika átmásolásának első jele.
    const graphValidationErrorClasses = [
      'graph_cycle_detected',
      'loop_back_edge_outside_body',
      'loop_missing_branch_edge',
      'reserved_branch_key_misuse',
      'unbalanced_fan_out_scope',
      'invalid_start_node',
      'dangling_edge',
      'unreachable_node',
      'unimplemented_node_type',
      'branch_key_unknown',
      'invalid_error_handler_edge',
      'malformed_node_config',
      'unhandled_error_policy_missing',
      'unsupported_join_merge_setting',
    ];
    // A megjelenítő leképezés (nem validáció) és a hozzá tartozó teszt, egy
    // REST hiba fixtúra teszt, és a szerkesztő statikus figyelmeztető szövege
    // (a motor hibájára hivatkozó magyarázat, nem ellenőrzés) a dokumentált
    // kivétel.
    const allowedFiles = new Set([
      path.join('protocol-error-message', 'protocol-error-class-message.ts'),
      path.join('protocol-error-message', 'protocol-error-class-message.spec.ts'),
      path.join('rest-client', 'perform-route-request.spec.ts'),
      path.join('graph-node-card', 'script-unimplemented-error-class.ts'),
      path.join('node-inspector', 'ScriptNodeFields.tsx'),
      path.join('node-inspector', 'ScriptNodeFields.spec.tsx'),
      // A saját listája ennek a tesztnek is tartalmazza a mintákat.
      path.join('greppable-invariants', 'greppable-invariants.spec.ts'),
    ]);
    const offenders = ALL_FILES.filter(
      (file) =>
        !allowedFiles.has(file.relativePath) &&
        graphValidationErrorClasses.some((errorClass) => file.content.includes(errorClass)),
    );
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
  });

  it('(22) a csomópont kártya mérete pontosan egyetlen konstansként áll (SPEC-008 5.7, M-94, T-009-33 (12))', () => {
    // A `graph-node-catalog` téma a kártya méret egyetlen forrása (a kártya
    // CSS-e egy custom propertyn át, a dagre hívás közvetlenül olvassa); a
    // konstansok tényleges értékét innen olvassa ki a teszt, hogy a szám
    // maga ne duplikálódjon a tesztben (a PRODUCT_FILES a .spec.ts/.spec.tsx
    // fájlokat már kizárja, tehát a szintetikus `measured` teszt fixtúrák nem
    // adnak hamis találatot).
    const catalogRelativePath = path.join('graph-node-catalog', 'graph-node-catalog.ts');
    const catalogSource = readFileSync(path.join(WEB_SRC, catalogRelativePath), 'utf8');
    const widthMatch = /export const GRAPH_NODE_CARD_WIDTH = (\d+);/.exec(catalogSource);
    const heightMatch = /export const GRAPH_NODE_CARD_HEIGHT = (\d+);/.exec(catalogSource);
    const width = widthMatch?.[1];
    const height = heightMatch?.[1];
    if (width === undefined || height === undefined) {
      throw new Error('a graph-node-catalog.ts nem tartalmazza a várt kártya méret konstansokat');
    }
    // A szám után egység is állhat (`358px`), ezért a jobb határ csak a
    // további számjegyet zárja ki; a bal határ az azonosítót, a tizedes
    // törtet és a hexa színkódot.
    const cardSizeNumberPattern = new RegExp(String.raw`(?<![\w.#])(?:${width}|${height})(?!\d)`);
    const offenders = PRODUCT_FILES.filter(
      (file) => file.relativePath !== catalogRelativePath && cardSizeNumberPattern.test(file.content),
    );
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
    // A CSS oldal: a kártya CSS-e a custom propertyt olvassa
    // (`var(--graph-node-card-width)`), tehát a két szám CSS fájlban sem
    // állhat. A blokk kommentek kiszűrve, mert a `graph-node-card.css`
    // fejléce a mért értéket magyarázatként idézi.
    const cssOffenders = listSourceFiles(WEB_SRC, ['.css']).filter((file) =>
      cardSizeNumberPattern.test(file.content.replaceAll(/\/\*[\s\S]*?\*\//g, '')),
    );
    expect(cssOffenders.map((file) => file.relativePath)).toEqual([]);
  });

  it('(23) a Web Crypto randomUUID hívása pontosan a két böngésző oldali azonosító generátor fájlban áll (SPEC-008 5.8, AC79)', () => {
    // A stream azonosító és a gráf elem azonosító generátora az egyetlen hely,
    // ahol a Web Crypto hívás megjelenik; minden más kód a portot kapja. A
    // mintát a teszt darabokból rakja össze, és a doksi sorokat kiszűri (mint a
    // (4), a (7) és a (15) ellenőrzésnél), különben a saját forrása és a port
    // típusfájljainak magyarázó mondata illeszkedne rá.
    const randomUuidCall = ['crypto', 'randomUUID('].join('.');
    const allowedFiles = [
      path.join('graph-editor', 'browser-graph-element-id-generator.ts'),
      path.join('stream-client', 'browser-stream-id-generator.ts'),
    ];
    const callers = ALL_FILES.filter((file) => stripCommentLines(file.content).includes(randomUuidCall)).map(
      (file) => file.relativePath,
    );
    expect(new Set(callers)).toEqual(new Set(allowedFiles));
    expect(callers).toHaveLength(allowedFiles.length);
  });

  it('(24) matchMedia( kizárólag prefers-*/forced-colors literállal vagy token kötött töréspont konstanssal áll (szabálykönyv 11. szekció, SPEC-008 10.)', () => {
    // Kitalált töréspont szám JS-ben sem állhat: a töréspont query literál
    // csak olyan konstansban állhat, amit egy regressziós teszt a
    // `design-token/breakpoints.css` tokenjéhez köt. A kulcs a konstans neve,
    // az érték a definiáló modul útja (a kötő teszt a `.spec.ts` párja). A
    // `packages/ui` forrását a fájlrendszerről olvassa, mint a (11) a gyökér
    // `package.json`-t és a `run-view-layout-band.spec.ts` a token fájlt.
    const tokenBoundQueryModules: Readonly<Record<string, string>> = {
      RUN_VIEW_HORIZONTAL_MEDIA_QUERY: path.join('run-view', 'run-view-layout-band'),
      RUN_VIEW_VERTICAL_MEDIA_QUERY: path.join('run-view', 'run-view-layout-band'),
      FOOTER_COMPACT_MEDIA_QUERY: path.join('graph-editor', 'footer-compact-media-query'),
    };
    for (const [constantName, modulePath] of Object.entries(tokenBoundQueryModules)) {
      const bindingSpec = readFileSync(path.join(WEB_SRC, `${modulePath}.spec.ts`), 'utf8');
      expect(bindingSpec).toMatch(new RegExp(String.raw`expect\(${constantName}\)\.toBe\(.*breakpointTokenValue\(`));
      const declaringFiles = PRODUCT_FILES.filter((file) =>
        new RegExp(String.raw`\b(?:const|let|var)\s+${constantName}\b`).test(file.content),
      ).map((file) => file.relativePath);
      expect(declaringFiles).toEqual([`${modulePath}.ts`]);
    }
    const preferenceQueryLiteral = /^(["'`])\((?:prefers-[\w-]+|forced-colors)\b[^()]*\)\1$/;
    const uiSource = path.join(REPO_ROOT, 'packages', 'ui', 'src');
    const uiProductFiles = listSourceFiles(uiSource, ['.ts', '.tsx']).filter(
      (file) => !file.relativePath.endsWith('.spec.ts') && !file.relativePath.endsWith('.spec.tsx'),
    );
    const scannedFiles = [
      ...PRODUCT_FILES.map((file) => ({ label: path.join('apps', 'web', 'src', file.relativePath), file })),
      ...uiProductFiles.map((file) => ({ label: path.join('packages', 'ui', 'src', file.relativePath), file })),
    ];
    const offenders: string[] = [];
    for (const { label, file } of scannedFiles) {
      const matchMediaCalls = listCallArguments(stripCommentLines(file.content), /\bmatchMedia\s*\(/g);
      for (const callArguments of matchMediaCalls) {
        const query = callArguments[0] ?? '';
        if (!preferenceQueryLiteral.test(query) && !Object.hasOwn(tokenBoundQueryModules, query)) {
          offenders.push(`${label}: ${query}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
