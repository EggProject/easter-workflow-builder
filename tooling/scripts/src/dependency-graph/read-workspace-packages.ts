/**
 * A workspace csomagok `package.json`-jainak beolvasása: a névtér prefix
 * nélküli név, és a `dependencies`/`devDependencies` mezők workspace
 * (`@easter-workflow-builder/`) kulcsai, szintén prefix nélkül. Külső csomag
 * (pl. `zod`, `typescript`) nem kerül a listába, mert a gráf ellenőrző csak a
 * workspace éleket vizsgálja.
 *
 * A `git ls-files`-re épül, ugyanazzal az indokkal, mint a
 * `../casing/find-casing-mismatches.ts`: csak a git index által ismert,
 * commitolt fájlokat listázza, a lemezen árválkodó, nem tracked
 * `package.json`-t (pl. félbehagyott `bun add`) nem veszi figyelembe.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface WorkspacePackage {
  readonly name: string;
  readonly dependsOn: readonly string[];
  readonly devDependsOn: readonly string[];
}

const NAMESPACE_PREFIX = '@easter-workflow-builder/';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function shortName(fullName: string): string {
  return fullName.startsWith(NAMESPACE_PREFIX) ? fullName.slice(NAMESPACE_PREFIX.length) : fullName;
}

function workspaceNamesFrom(dependencyField: unknown): readonly string[] {
  if (!isObject(dependencyField)) {
    return [];
  }
  return Object.keys(dependencyField)
    .filter((key) => key.startsWith(NAMESPACE_PREFIX))
    .map((key) => shortName(key));
}

const PACKAGE_JSON_GLOBS = [
  'apps/*/package.json',
  'packages/*/package.json',
  'tooling/*/package.json',
  'tools/*/package.json',
];

function listPackageJsonPaths(repoRoot: string): readonly string[] {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- a git a fejlesztoi/CI PATH resze, ugyanugy mint a tobbi wrapper scriptben
  const output = execFileSync('git', ['ls-files', ...PACKAGE_JSON_GLOBS], { cwd: repoRoot, encoding: 'utf8' });
  return output.split('\n').filter((line) => line.length > 0);
}

function readWorkspacePackage(repoRoot: string, relativePath: string): WorkspacePackage {
  const manifest: unknown = JSON.parse(readFileSync(path.join(repoRoot, relativePath), 'utf8'));
  if (!isObject(manifest) || typeof manifest['name'] !== 'string') {
    throw new Error(`'${relativePath}': hiányzik vagy nem string a "name" mező`);
  }
  return {
    name: shortName(manifest['name']),
    dependsOn: workspaceNamesFrom(manifest['dependencies']),
    devDependsOn: workspaceNamesFrom(manifest['devDependencies']),
  };
}

export function readWorkspacePackages(repoRoot: string): readonly WorkspacePackage[] {
  return listPackageJsonPaths(repoRoot).map((relativePath) => readWorkspacePackage(repoRoot, relativePath));
}
