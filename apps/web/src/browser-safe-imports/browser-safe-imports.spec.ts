// Regressziós teszt, megvalósítás fájl nélkül (SPEC-002 6.2 5. pont).
//
// A MÉRT HIBA, ami ezt a fájlt indokolja (2026-09-05). A
// `packages/core/src/image-source/data-url/resolve-image-data-url.ts` első
// sora a `node:buffer` modult importálta. A `core` csomag felülete egyetlen
// barrel (`src/index.ts`, SPEC-002 6.6), az `apps/web` pedig érték szinten
// importál belőle (`isOkOutcome`), tehát a barrel MINDEN modulja bekerül a
// böngésző modulgráfjába. `vite build` alatt ez nem látszik, mert a Rolldown
// kirázza a nem használt exportot - `vite dev` alatt viszont nincs tree
// shaking, és a lap az első pillanatban elszáll:
// "Module node:buffer has been externalized for browser compatibility."
// Az e2e kapu nem fogta meg, mert az build + preview párt futtat.
//
// AMIT ŐRIZ. Az `apps/web` futásidejű (nem `devDependencies`) workspace
// függőségi zárt halmazában, plusz magában az `apps/web/src` fában egyetlen
// termékkód fájl sem hivatkozhat Node beépített modulra. A `node:` előtag
// vizsgálata TELJES: az `unicorn/prefer-node-protocol` szabály a
// `tooling/eslint-config` `unicorn.configs.recommended` készletében `error`
// szinten aktív, tehát előtag nélküli alak (`from 'buffer'`) nem is menne át
// a `lint` kapun.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = path.dirname(fileURLToPath(import.meta.url));
const WEB_PACKAGE_ROOT = path.join(directory, '..', '..');
const REPO_ROOT = path.join(WEB_PACKAGE_ROOT, '..', '..');
const WORKSPACE_ROOTS = ['packages', 'apps'] as const;
const WORKSPACE_SCOPE = '@easter-workflow-builder/';

/**
 * Minden `import`/`export ... from`, dinamikus `import()` és `require()`
 * hívás modulazonosítója, ami `node:` előtagot visel.
 */
const NODE_BUILTIN_SPECIFIER_PATTERN = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"](node:[^'"]+)['"]/g;

interface PackageManifest {
  readonly name?: string;
  readonly dependencies?: Record<string, string>;
}

interface WorkspacePackage {
  readonly directory: string;
  readonly workspaceDependencyNames: readonly string[];
}

function readPackageManifest(packageDirectory: string): PackageManifest {
  const parsed: unknown = JSON.parse(readFileSync(path.join(packageDirectory, 'package.json'), 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) {
    throw new TypeError(`nem objektum a package.json: ${packageDirectory}`);
  }
  return parsed;
}

function requiredPackageName(manifest: PackageManifest, packageDirectory: string): string {
  const { name } = manifest;
  if (name === undefined) {
    throw new Error(`névtelen workspace csomag: ${packageDirectory}`);
  }
  return name;
}

function listPackageDirectories(): readonly string[] {
  const directories: string[] = [];
  for (const workspaceRoot of WORKSPACE_ROOTS) {
    const rootDirectory = path.join(REPO_ROOT, workspaceRoot);
    const entries = readdirSync(rootDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        directories.push(path.join(rootDirectory, entry.name));
      }
    }
  }
  return directories;
}

/**
 * A workspace csomagnév -> könyvtár térkép, a `packages/` és az `apps/`
 * könyvtár tényleges tartalmából olvasva, nem beírt listából.
 */
function collectWorkspacePackages(): ReadonlyMap<string, WorkspacePackage> {
  const packages = new Map<string, WorkspacePackage>();
  for (const packageDirectory of listPackageDirectories()) {
    const manifest = readPackageManifest(packageDirectory);
    const dependencyNames = Object.keys(manifest.dependencies ?? {});
    packages.set(requiredPackageName(manifest, packageDirectory), {
      directory: packageDirectory,
      workspaceDependencyNames: dependencyNames.filter((name) => name.startsWith(WORKSPACE_SCOPE)),
    });
  }
  return packages;
}

function requiredPackage(packages: ReadonlyMap<string, WorkspacePackage>, name: string): WorkspacePackage {
  const entry = packages.get(name);
  if (entry === undefined) {
    throw new Error(`ismeretlen workspace csomag: ${name}`);
  }
  return entry;
}

/**
 * Az `apps/web` futásidejű workspace függőségeinek tranzitív lezártja,
 * magát az `apps/web` csomagot is beleértve. A `devDependencies` szándékosan
 * kimarad: az soha nem kerül a böngészőbe.
 */
function browserReachablePackageDirectories(): readonly string[] {
  const packages = collectWorkspacePackages();
  const webManifest = readPackageManifest(WEB_PACKAGE_ROOT);
  const visitedNames = new Set<string>();
  const pendingNames = [requiredPackageName(webManifest, WEB_PACKAGE_ROOT)];
  while (pendingNames.length > 0) {
    const currentName = pendingNames.pop() ?? '';
    if (!visitedNames.has(currentName)) {
      visitedNames.add(currentName);
      pendingNames.push(...requiredPackage(packages, currentName).workspaceDependencyNames);
    }
  }
  return [...visitedNames].map((name) => requiredPackage(packages, name).directory);
}

interface SourceFile {
  readonly relativePath: string;
  readonly content: string;
}

/**
 * A doksi sorokat (JSDoc `*` folytatás és `//` egysoros komment) kiszűri: egy
 * magyarázó mondat, ami magát a hibás importot idézi, nem termékkód import.
 * Ugyanaz a segédfüggvény, mint a `greppable-invariants` témában.
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

function isProductSourceFileName(fileName: string): boolean {
  return /\.tsx?$/.test(fileName) && !/\.spec\.tsx?$/.test(fileName);
}

function listProductSourceFiles(sourceRoot: string): readonly SourceFile[] {
  const files: SourceFile[] = [];
  function walk(current: string): void {
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (isProductSourceFileName(entry.name)) {
        files.push({
          relativePath: path.relative(REPO_ROOT, fullPath),
          content: stripCommentLines(readFileSync(fullPath, 'utf8')),
        });
      }
    }
  }
  walk(sourceRoot);
  return files;
}

function nodeBuiltinOffenders(): readonly string[] {
  const offenders: string[] = [];
  const packageDirectories = browserReachablePackageDirectories();
  for (const packageDirectory of packageDirectories) {
    const sourceFiles = listProductSourceFiles(path.join(packageDirectory, 'src'));
    for (const file of sourceFiles) {
      const matches = file.content.matchAll(NODE_BUILTIN_SPECIFIER_PATTERN);
      for (const match of matches) {
        offenders.push(`${file.relativePath}: ${match[1] ?? ''}`);
      }
    }
  }
  // Rendezés nincs: a bejárás sorrendje (a workspace könyvtár olvasása és a
  // `Set` beszúrási sorrendje) már determinisztikus, egy összehasonlító
  // függvény pedig itt csak zaj lenne.
  return offenders;
}

describe('a böngészőbe kerülő kódút Node beépített modul mentes', () => {
  it('az apps/web futásidejű workspace zárt halmaza a core, a protocol, a typeguards és a ui csomagot is tartalmazza', () => {
    const directories = browserReachablePackageDirectories().map((entry) => path.relative(REPO_ROOT, entry));
    expect(directories).toContain(path.join('apps', 'web'));
    expect(directories).toContain(path.join('packages', 'core'));
    expect(directories).toContain(path.join('packages', 'protocol'));
    expect(directories).toContain(path.join('packages', 'typeguards'));
    expect(directories).toContain(path.join('packages', 'ui'));
  });

  it('egyetlen termékkód fájl sem importál node: előtagú modult', () => {
    expect(nodeBuiltinOffenders()).toEqual([]);
  });
});
