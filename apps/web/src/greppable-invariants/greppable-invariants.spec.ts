// Tizenkét, megvalósítás nélküli, greppel ellenőrizhető invariáns teszt egy
// csoportban (T-008-31, SPEC-002 6.2 5. pont mintája: konfigurációs
// invariáns saját téma mappában, a mappa neve annak a dolognak a neve, amit
// őriz). Mindegyik a forrásfát olvassa vissza nyers szövegként, statikus
// elemzés helyett - ugyanaz a minta, mint a `vite-istanbul-include-invariant`
// témáé.
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
    const offenders = PRODUCT_FILES.filter((file) => /ResizeObserver|IntersectionObserver/.test(file.content));
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

  it('(9) nincs @xyflow/react import és nincs SPEC-008/SPEC-009 hatókörű fájl', () => {
    // Tényleges import utasítás mintáját keresi, nem puszta részsztringet:
    // egy pusztán szöveges említés (pl. ennek a tesztnek a saját címe vagy
    // egy magyarázó komment) nem termékkód import.
    const xyflowModuleName = ['@xyflow', 'react'].join('/');
    const importPattern = new RegExp(`from ['"]${xyflowModuleName}['"]`);
    const offenders = ALL_FILES.filter((file) => importPattern.test(file.content));
    expect(offenders.map((file) => file.relativePath)).toEqual([]);
    const outOfScopeThemeNames = new Set(['graph-editor', 'transcript-panel', 'settings-screen', 'workflow-canvas']);
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
});
