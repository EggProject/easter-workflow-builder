/**
 * CLI belépési pont: kilistázza a workspace függőségi gráf SPEC-002 4.
 * szekció szerinti eltéréseit (hiányzó réteg-hozzárendelés, eszköz csomag
 * "dependencies" helyen, visszafelé vagy azonos rétegen belül mutató él,
 * kör). A `tooling/scripts/check-dependency-graph.sh` hívja.
 *
 * Kimenet: eltérésenként egy sor, `stdout`-ra. Üres kimenet + `0` kilépőkód =
 * nincs eltérés. Ha van eltérés, a kilépőkód `1`.
 */
import { execFileSync } from 'node:child_process';
import { findDependencyGraphViolations } from './find-dependency-graph-violations.ts';
import { PACKAGE_LAYER } from './package-layer.ts';
import { readWorkspacePackages } from './read-workspace-packages.ts';

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- a git a fejlesztoi/CI PATH resze, ugyanugy mint a tobbi wrapper scriptben
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

const packages = readWorkspacePackages(repoRoot());
const violations = findDependencyGraphViolations(packages, PACKAGE_LAYER);

for (const violation of violations) {
  console.log(`${violation.kind}: ${violation.message}`);
}

process.exitCode = violations.length === 0 ? 0 : 1;
