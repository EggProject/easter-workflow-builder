// Regressziós teszt a feltöltő mező sötét témás olvashatóságára (SPEC-009 O-54, user döntés
// 2026-10-28). A `file-upload-theme.css` kiegészítő fájl a bájtazonos `file-upload.css` mellett áll; a
// tényleges kontrasztot a valódi böngészős e2e méri (`apps/web/e2e/settings-screen.spec.ts`).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath: string): string {
  return readFileSync(path.join(directory, relativePath), 'utf8');
}

describe('a feltöltő mező téma szerinti felülete (kiegészítő CSS)', () => {
  it('a komponens a bájtazonos file-upload.css UTÁN húzza be a kiegészítő fájlt', () => {
    const component = read('FileUpload.tsx');
    const sourceIndex = component.indexOf("import './file-upload.css';");
    const themeIndex = component.indexOf("import './file-upload-theme.css';");

    expect(sourceIndex).toBeGreaterThan(-1);
    expect(themeIndex).toBeGreaterThan(sourceIndex);
  });

  it('a .dropzone háttere és szegélye a téma szerinti szerep token', () => {
    const css = read('file-upload-theme.css').replaceAll(/\/\*[\s\S]*?\*\//g, '');

    expect(css).toContain('border-color: var(--ep-border);');
    expect(css).toContain('background: var(--ep-bg-sunken);');
  });

  it('világos témában a két szerep token a forrás nyers tokenje, tehát a megjelenés változatlan', () => {
    const lightTheme = read('../design-token/theme-light.css');

    expect(lightTheme).toMatch(/--ep-bg-sunken:\s*var\(--ep-paper-100\);/);
    expect(lightTheme).toMatch(/--ep-border:\s*var\(--ep-paper-300\);/);
  });

  it('sötét témában mindkét szerep tokennek van saját értéke', () => {
    const darkTheme = read('../design-token/theme-dark.css');

    expect(darkTheme).toMatch(/--ep-bg-sunken:/);
    expect(darkTheme).toMatch(/--ep-border:/);
  });
});
