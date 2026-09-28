// Huszonkettő, megvalósítás nélküli, greppel ellenőrizhető invariáns teszt egy
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
// forrás szabálya (12).
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

const PRODUCT_FILES = listSourceFiles(WEB_SRC, ['.ts', '.tsx']).filter(
  (file) => !file.relativePath.endsWith('.spec.ts') && !file.relativePath.endsWith('.spec.tsx'),
);
const ALL_FILES = listSourceFiles(WEB_SRC, ['.ts', '.tsx']);

describe('greppes invariáns tesztek (T-008-31)', () => {
  it('(1) nincs default React import', () => {
    const offenders = ALL_FILES.filter((file) => /^import React\b/m.test(file.content));
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
  });

  it('(2) nincs drótszintű típus vagy séma az apps/web/src alatt (nincs zod import)', () => {
    const offenders = ALL_FILES.filter((file) => /from ['"]zod['"]/.test(file.content));
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
  });

  it('(3) nincs .parse( hívás (a JSON.parse kivétel: az nem Zod séma hívás)', () => {
    const offenders = PRODUCT_FILES.filter((file) => /(?<!JSON)\.parse\(/.test(file.content));
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
  });

  it('(4) nincs /api/ sztring literál termékkódban (kommenten kívül)', () => {
    const offenders = PRODUCT_FILES.filter((file) => stripCommentLines(file.content).includes('/api/'));
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
  });

  it('(5) nincs new EventSource( hívás a gyárfájlon kívül', () => {
    const offenders = PRODUCT_FILES.filter(
      (file) =>
        file.content.includes('new EventSource(') && !file.relativePath.endsWith('browser-event-source-factory.ts'),
    );
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
  });

  it('(6) nincs Navigation API hivatkozás (window.navigation / globalThis.navigation)', () => {
    const offenders = PRODUCT_FILES.filter((file) => /\b(window|globalThis)\.navigation\b/.test(file.content));
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
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
    const offenders = PRODUCT_FILES.filter((file) => /localhost|:4173|:4174|:5173|:3000|:8080/.test(file.content));
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
    // Kitalált idő szám (pl. toast `duration: 5000`) - a `use-toasts.ts`
    // csak a hívó által átadott `duration` VÁLTOZÓT olvassa, számliterált
    // sosem ír; termékkódban `pushToast`/`setTimeout` mellett numerikus
    // literál nem állhat, mert nincs rá dokumentált forrás.
    const timeoutOffenders = PRODUCT_FILES.filter((file) =>
      /(?:duration|setTimeout|setInterval)\s*[:(]\s*\d/.test(file.content),
    );
    expect(timeoutOffenders.map((file) => file.relativePath)).toEqual([]);
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
    const outOfScopeThemeNames = new Set(['settings-screen', 'skill-upload', 'mcp-server-config']);
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

  it('(11) nincs @vitejs/plugin-react a package.json fájlokban', () => {
    const packageJsonPaths = [path.join(WEB_SRC, '..', 'package.json'), path.join(REPO_ROOT, 'package.json')];
    for (const packageJsonPath of packageJsonPaths) {
      expect(readFileSync(packageJsonPath, 'utf8')).not.toContain('@vitejs/plugin-react');
    }
  });

  it('(12) nincs @testing-library függőség a package.json fájlokban', () => {
    const packageJsonPaths = [path.join(WEB_SRC, '..', 'package.json'), path.join(REPO_ROOT, 'package.json')];
    for (const packageJsonPath of packageJsonPaths) {
      expect(readFileSync(packageJsonPath, 'utf8')).not.toContain('@testing-library');
    }
  });

  it('(13) a vite.config.ts nem tartalmaz port számot, origin literált és timeout mezőt a proxy szabályban (SPEC-008 3.3, M-79)', () => {
    const viteConfigSource = readFileSync(path.join(WEB_SRC, '..', 'vite.config.ts'), 'utf8');
    expect(viteConfigSource).not.toMatch(/localhost|:4173|:4174|:5173|:3000|:3001|:8080/);
    expect(viteConfigSource).not.toMatch(/\btimeout\s*:/);
  });

  it('(14) nincs felülírt dagre nodesep/ranksep/edgesep/marginx/marginy opció (SPEC-008 5.7, M-93, AC61)', () => {
    const forbiddenOptionNames = ['nodesep', 'ranksep', 'edgesep', 'marginx', 'marginy'];
    const offenders = PRODUCT_FILES.filter((file) => {
      const codeOnly = stripCommentLines(file.content);
      return forbiddenOptionNames.some((optionName) => codeOnly.includes(optionName));
    });
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
  });

  it('(15) egyetlen ág sem függ mért csomópont geometriától (nincs `measured.` olvasás és `getBoundingClientRect(` hívás)', () => {
    // A PLAN-009 T-009-15 elfogadási kritériuma szó szerint ezt a két mintát
    // kéri, és a SPEC-008 12.2 szabálya áll mögötte: a mért csomópont méret
    // KIZÁRÓLAG a React Flow saját `dimensions` változásából jut a nézeti
    // állapotba (`graph-editor/measured-node-sizes.ts`), tehát a termékkód sem
    // a `measured` tulajdonságot nem olvassa, sem a DOM-tól nem kér
    // geometriát. Enélkül a mérettől függő ágak csak valós böngészőben
    // lennének tesztelhetők, a happy-dom unit tesztek pedig nulla node méretet
    // látnak (M-53, M-54).
    //
    // A pont (`measured.`) a tulajdonság OLVASÁSÁT fogja meg. A mező ÍRÁSA
    // (`measured: size`) szándékosan nem tiltott: az a `withMeasuredNodeSize`
    // egyetlen szentesített útja, amin a méret visszakerül a könyvtárhoz.
    //
    // A doksi sorok kiszűrve, ugyanazzal a `stripCommentLines`
    // segédfüggvénnyel és ugyanabból az okból, mint a (4), a (7) és a (14)
    // ellenőrzésnél: mindkét minta ma pontosan azokban a magyarázó
    // kommentekben szerepel, amik kimondják, hogy nincs ilyen hivatkozás
    // (`GraphNodeCard.tsx`, `RunGraphCanvas.tsx`).
    const measuredGeometryPattern = /measured\.|getBoundingClientRect\(/;
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
    const scrollGeometryPattern = /\b(?:scrollTop|scrollHeight|scrollY|clientHeight|offsetHeight|pageYOffset)\b/;
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
    // kimondott döntéssel vehető fel. A doksi sorok kiszűrve, mint a (17)-nél.
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
          [file.relativePath, stripCommentLines(file.content).match(/role=["']alert["']/gu)?.length ?? 0] as const,
      ).filter(([, count]) => count > 0),
    );
    expect(alertCounts).toEqual(nonRestAlertCounts);
  });

  it('(19) getByTestId kizárólag rf__ előtaggal áll az e2e alatt (SPEC-008 12.3, T-009-33 (1))', () => {
    // A kötött locator sorrend egyetlen kivétele a React Flow saját
    // `data-testid="rf__node-<id>"` (és `rf__edge-<id>`, `rf__wrapper`)
    // attribútuma; minden más `getByTestId` hívás a kivétel túlterjeszkedése.
    const e2eFiles = listSourceFiles(path.join(WEB_SRC, '..', 'e2e'), ['.ts', '.tsx']);
    const testIdCallPattern = /getByTestId\(\s*[`'"]([^`'"]*)/g;
    const offenders: string[] = [];
    for (const file of e2eFiles) {
      const codeOnly = stripCommentLines(file.content);
      for (const match of codeOnly.matchAll(testIdCallPattern)) {
        const literalPrefix = match[1] ?? '';
        if (!literalPrefix.startsWith('rf__')) {
          offenders.push(`${file.relativePath}: ${match[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('(20) nincs waitForTimeout, setTimeout és sleep hívás az e2e alatt (docs/research/2026-08-29-playwright-teszt-szabalyok.md, T-009-33 (10))', () => {
    // A hivatalos Playwright doksi szó szerint tiltja a kézi, idő alapú
    // várakozást; minden e2e várakozás web-first assertion vagy
    // `page.waitForResponse()`. A doksi sorok kiszűrve, mert a projekt
    // szabálykönyve és a spec fájlok fejléc kommentje maga is idézi ezeket a
    // hívásneveket, magyarázatként, nem hívásként.
    const e2eFiles = listSourceFiles(path.join(WEB_SRC, '..', 'e2e'), ['.ts', '.tsx']);
    const forbiddenCallPattern = /\b(?:waitForTimeout|setTimeout|sleep)\s*\(/;
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
    const cardSizeNumberPattern = new RegExp(String.raw`\b(?:${width}|${height})\b`);
    const offenders = PRODUCT_FILES.filter(
      (file) => file.relativePath !== catalogRelativePath && cardSizeNumberPattern.test(file.content),
    );
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
  });
});
