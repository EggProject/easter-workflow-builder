// Regressziós teszt a T-002-24 gráf ellenőrzőhöz (SPEC-002 4. szekció,
// "Rétegbesorolás, mind a 32 csomagra" táblázata). Szintetikus, kézzel
// összeállított csomaglistákkal dolgozik, NEM a valós repó gráfjával -
// ezért a teszt eredménye független attól, hogy a repóban éppen áll-e
// megoldatlan rétegzési kérdés (lásd `packages/engine/CLAUDE.md`,
// "Ellentmondás a SPEC-002-ben"). A valós gráfot a
// `check-dependency-graph.sh` futtatja, ami nem Vitesten keresztül fut.
import { describe, expect, it } from 'vitest';
import { findDependencyGraphViolations } from './find-dependency-graph-violations.ts';
import type { PackageLayer } from './package-layer.ts';
import type { WorkspacePackage } from './read-workspace-packages.ts';

function createWorkspacePackage(
  name: string,
  dependsOn: readonly string[] = [],
  developmentDependsOn: readonly string[] = [],
): WorkspacePackage {
  return { name, dependsOn, devDependsOn: developmentDependsOn };
}

const CLEAN_LAYERS: Readonly<Record<string, PackageLayer>> = {
  base: 0,
  middle: 1,
  top: 2,
  'build-tool': 'tool',
};

describe('findDependencyGraphViolations', () => {
  it('tiszta gráfra üres listát ad', () => {
    const packages = [
      createWorkspacePackage('base'),
      createWorkspacePackage('middle', ['base']),
      createWorkspacePackage('top', ['middle'], ['build-tool']),
    ];
    expect(findDependencyGraphViolations(packages, CLEAN_LAYERS)).toStrictEqual([]);
  });

  it('hiányzó réteg-hozzárendelést jelez', () => {
    const packages = [createWorkspacePackage('base'), createWorkspacePackage('ismeretlen-csomag', ['base'])];
    const violations = findDependencyGraphViolations(packages, CLEAN_LAYERS);
    const violation = violations.find((candidate) => candidate.kind === 'missing-layer');
    expect(violation?.message).toContain('ismeretlen-csomag');
  });

  it('eszköz csomagot "dependencies" helyen jelez', () => {
    const packages = [createWorkspacePackage('base'), createWorkspacePackage('top', ['base', 'build-tool'])];
    const violations = findDependencyGraphViolations(packages, CLEAN_LAYERS);
    const violation = violations.find((candidate) => candidate.kind === 'tool-in-dependencies');
    expect(violation?.message).toContain('build-tool');
  });

  it('visszafelé mutató élt jelez', () => {
    const packages = [createWorkspacePackage('base', ['top']), createWorkspacePackage('top')];
    const violations = findDependencyGraphViolations(packages, CLEAN_LAYERS);
    const violation = violations.find((candidate) => candidate.kind === 'not-strictly-decreasing-layer');
    expect(violation?.message).toContain("'base'");
  });

  it('azonos rétegen belüli élt jelez', () => {
    const sameLayer: Readonly<Record<string, PackageLayer>> = { a: 1, b: 1 };
    const packages = [createWorkspacePackage('a', ['b']), createWorkspacePackage('b')];
    const violations = findDependencyGraphViolations(packages, sameLayer);
    expect(violations.some((violation) => violation.kind === 'not-strictly-decreasing-layer')).toBe(true);
  });

  it('szándékosan bevezetett kört jelez, és a hibaüzenet megnevezi az érintett csomagokat', () => {
    const cyclicLayers: Readonly<Record<string, PackageLayer>> = { a: 0, b: 0, c: 0 };
    const packages = [
      createWorkspacePackage('a', ['b']),
      createWorkspacePackage('b', ['c']),
      createWorkspacePackage('c', ['a']),
    ];
    const violations = findDependencyGraphViolations(packages, cyclicLayers);
    const cycleViolation = violations.find((violation) => violation.kind === 'cycle');
    expect(cycleViolation?.message).toContain('a -> b -> c -> a');
  });
});
