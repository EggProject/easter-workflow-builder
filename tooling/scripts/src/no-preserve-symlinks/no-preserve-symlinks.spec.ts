// Regressziós teszt a SPEC-006 3.6 és M-4 mérésre, a PLAN-007 T-007-3 lépés
// második fele.
//
// Saját méréssel igazolt (M-4, Node v26.7.0, 2026-08-29): a `--preserve-symlinks`
// kapcsoló a workspace szimlinket (`node_modules/@easter-workflow-builder/<név>`
// -> `packages/<név>`) a szimlink útvonalán azonosítja, nem a célja valós lemez
// útvonalán, és ez pontosan azt a feloldást töri el, amire a monorepo forrás
// szintű fogyasztása épül: a `node_modules` alatti TypeScript fájlokat a Node
// megtagadja (M-2), és a szimlink `--preserve-symlinks` mellett a
// `node_modules` útvonalon azonosítva pontosan ebbe a tiltásba futna.
//
// Ez a teszt megvalósítás nélküli témában áll (`.claude/CLAUDE.md` 5. szekció):
// egyetlen szöveges keresés a forrásfákban és az npm scriptekben, nincs mit
// külön modulba szervezni.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const FORBIDDEN_FLAG = '--preserve-symlinks';

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- a git a fejlesztoi/CI PATH resze, ugyanugy mint a tobbi wrapper scriptben
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

function listTrackedFiles(root: string, prefix: string): readonly string[] {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- a git a fejlesztoi/CI PATH resze, ugyanugy mint a tobbi wrapper scriptben
  const output = execFileSync('git', ['ls-files', prefix], { cwd: root, encoding: 'utf8' });
  return output.split('\n').filter((line) => line.length > 0);
}

interface PackageJsonScripts {
  readonly scripts?: Readonly<Record<string, string>>;
}

function isPackageJsonScripts(value: unknown): value is PackageJsonScripts {
  return typeof value === 'object' && value !== null;
}

function readServerPackageScripts(root: string): Readonly<Record<string, string>> {
  const rawConfig = readFileSync(path.join(root, 'apps/server/package.json'), 'utf8');
  const parsed: unknown = JSON.parse(rawConfig);
  if (!isPackageJsonScripts(parsed) || parsed.scripts === undefined) {
    return {};
  }
  return parsed.scripts;
}

describe('nincs --preserve-symlinks az apps/server forrásában és scriptjeiben', () => {
  it('az apps/server/src egyetlen fájlja sem tartalmazza a kapcsolót', () => {
    const root = repoRoot();
    const offendingFiles: string[] = [];

    for (const trackedPath of listTrackedFiles(root, 'apps/server/src')) {
      const sourceText = readFileSync(path.join(root, trackedPath), 'utf8');
      if (sourceText.includes(FORBIDDEN_FLAG)) {
        offendingFiles.push(trackedPath);
      }
    }

    expect(offendingFiles).toEqual([]);
  });

  it('az apps/server/package.json egyetlen npm scriptje sem tartalmazza a kapcsolót', () => {
    const scripts = readServerPackageScripts(repoRoot());
    const offendingScripts = Object.entries(scripts)
      .filter(([, command]) => command.includes(FORBIDDEN_FLAG))
      .map(([name]) => name);

    expect(offendingScripts).toEqual([]);
  });
});
