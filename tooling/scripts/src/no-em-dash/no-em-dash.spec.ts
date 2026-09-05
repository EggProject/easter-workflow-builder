// Regressziós teszt a gyökér `CLAUDE.md` 6. szekciójának abszolút szabályára:
// "Nincs gondolatjel (em dash). Soha." Ez a saját (nem vendorolt) szövegre és
// kódra vonatkozik: a `packages/ui` design system átemelt CSS fájljai
// szándékosan bájtazonosak az `eggproject-design` skill forrásával
// (`packages/ui/CLAUDE.md` "Szabályok" szekció, SPEC-007 4.2), ezért ki
// vannak zárva - egy automatikus javítás a bájtazonosságot csendben
// elrontaná. A kizárt fájlok pontos listája a `.prettierignore` "Vendorolt,
// valtozatlanul atemelt eggproject-design fajlok" blokkjának másolata.
//
// Megvalósítás fájl nélküli téma (`.claude/CLAUDE.md` 5. szekció, SPEC-002
// 6.2 5. pont): egyetlen szöveges keresés a git indexben tárolt fájlokon,
// nincs mit külön modulba szervezni. Ugyanaz a minta, mint a
// `no-preserve-symlinks` témáé.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Unicode escape, NEM literál karakter: egy literál em dash a saját
// forrásfájlt is megbuktatná a lenti keresésben (PLAN-009 T-009-1 alap
// mérése találta, a legutóbbi commit önmagát buktatta).
const EM_DASH = '\u{2014}';

const CHECKED_EXTENSIONS = ['.md', '.ts', '.tsx', '.css'];

// A `.prettierignore` vendorolt blokkjának mappa-előtagjai: a design-token
// és a self-hosted-font mappa MINDEN fájlja bájtra átemelt.
const VENDORED_PREFIXES = ['packages/ui/src/design-token/', 'packages/ui/src/self-hosted-font/'];

// A `.prettierignore` vendorolt blokkjának fájlonkénti bejegyzései: az
// egyes komponens CSS fájlok, amik szintén bájtra átemeltek, de a mappájuk
// többi fájlja (a `.tsx`) nem.
const VENDORED_FILES = new Set([
  'packages/ui/src/topnav-shell/topnav-shell.css',
  'packages/ui/src/button/button.css',
  'packages/ui/src/badge/badge.css',
  'packages/ui/src/card/card.css',
  'packages/ui/src/skeleton/skeleton.css',
  'packages/ui/src/loading-indicator/loading-indicator.css',
  'packages/ui/src/toast/toast.css',
  'packages/ui/src/text-field/text-field.css',
  'packages/ui/src/select-field/select-field.css',
  'packages/ui/src/form-control/form-control.css',
  'packages/ui/src/modal/modal.css',
  'packages/ui/src/tab/tab.css',
  'packages/ui/src/data-table/data-table.css',
  'packages/ui/src/menu/menu.css',
]);

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- a git a fejlesztoi/CI PATH resze, ugyanugy mint a tobbi wrapper scriptben
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

function listTrackedFiles(root: string): readonly string[] {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- a git a fejlesztoi/CI PATH resze, ugyanugy mint a tobbi wrapper scriptben
  const output = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
  return output.split('\n').filter((line) => line.length > 0);
}

function isCheckedExtension(trackedPath: string): boolean {
  return CHECKED_EXTENSIONS.some((extension) => trackedPath.endsWith(extension));
}

function isVendored(trackedPath: string): boolean {
  return VENDORED_FILES.has(trackedPath) || VENDORED_PREFIXES.some((prefix) => trackedPath.startsWith(prefix));
}

function findEmDashOffenders(root: string): readonly string[] {
  const offenders: string[] = [];
  for (const trackedPath of listTrackedFiles(root)) {
    if (!isCheckedExtension(trackedPath) || isVendored(trackedPath)) {
      continue;
    }
    const content = readFileSync(path.join(root, trackedPath), 'utf8');
    if (content.includes(EM_DASH)) {
      offenders.push(trackedPath);
    }
  }
  return offenders;
}

describe('em dash (gondolatjel) tilalom a saját tartalomban', () => {
  it('a repó saját .md/.ts/.tsx/.css fájljai nem tartalmaznak em dash-t', () => {
    expect(findEmDashOffenders(repoRoot())).toEqual([]);
  });

  it('a vendorolt kizárási lista ténylegesen a .prettierignore vendorolt bejegyzéseit tükrözi', () => {
    // Ha ez bukik, a fenti VENDORED_* lista elszakadt a .prettierignore-tól:
    // ott kell frissíteni a listát, nem itt kitágítani a kizárást.
    const prettierIgnore = readFileSync(path.join(repoRoot(), '.prettierignore'), 'utf8');
    for (const vendoredFile of VENDORED_FILES) {
      expect(prettierIgnore).toContain(vendoredFile);
    }
    for (const vendoredPrefix of VENDORED_PREFIXES) {
      expect(prettierIgnore).toContain(vendoredPrefix.replace(/\/$/, ''));
    }
  });
});
