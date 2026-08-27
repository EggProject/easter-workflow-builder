/**
 * A függőségi gráf ellenőrzésének tiszta logikája: a `readWorkspacePackages`
 * eredményét és a `PACKAGE_LAYER` térképet veszi be, és a SPEC-002 4. szekció
 * szabályai szerinti eltéréseket adja vissza. Nem ír fájlba, nem hív `git`-et
 * - ezért unit tesztelhető szintetikus bemenettel is (lásd a `.spec.ts`-t),
 * a valós repóra a `check-dependency-graph.ts` CLI belépési pont hívja.
 *
 * Négy szabályt ellenőriz:
 * 1. minden csomagnak van réteg-hozzárendelése (`PACKAGE_LAYER`-ben szerepel)
 * 2. eszköz csomag (`'tool'` réteg) sosem áll `dependencies` helyen
 * 3. minden él (dependencies ÉS devDependencies) szigorúan csökkenő
 *    rétegszám felé mutat - "Rétegen belüli él nincs"
 * 4. a teljes gráf (dependencies + devDependencies élek mentén) körmentes
 */
import type { PackageLayer } from './package-layer.ts';
import type { WorkspacePackage } from './read-workspace-packages.ts';

export interface DependencyGraphViolation {
  readonly kind: 'missing-layer' | 'tool-in-dependencies' | 'not-strictly-decreasing-layer' | 'cycle';
  readonly message: string;
}

function findMissingLayerViolations(
  packages: readonly WorkspacePackage[],
  layerByName: Readonly<Record<string, PackageLayer>>,
): DependencyGraphViolation[] {
  return packages
    .filter((package_) => !Object.hasOwn(layerByName, package_.name))
    .map((package_) => ({
      kind: 'missing-layer' as const,
      message: `'${package_.name}': nincs réteg-hozzárendelés a package-layer.ts térképben`,
    }));
}

function findToolInDependenciesViolations(
  packages: readonly WorkspacePackage[],
  layerByName: Readonly<Record<string, PackageLayer>>,
): DependencyGraphViolation[] {
  const violations: DependencyGraphViolation[] = [];
  for (const package_ of packages) {
    for (const dependency of package_.dependsOn) {
      if (layerByName[dependency] === 'tool') {
        violations.push({
          kind: 'tool-in-dependencies',
          message: `'${package_.name}' -> '${dependency}': eszköz csomag nem szerepelhet "dependencies" helyen, csak "devDependencies"-ben`,
        });
      }
    }
  }
  return violations;
}

function findLayerDirectionViolationsForPackage(
  package_: WorkspacePackage,
  fromLayer: number,
  layerByName: Readonly<Record<string, PackageLayer>>,
): DependencyGraphViolation[] {
  const violations: DependencyGraphViolation[] = [];
  const dependencies = [...package_.dependsOn, ...package_.devDependsOn];
  for (const dependency of dependencies) {
    const toLayer = layerByName[dependency];
    if (typeof toLayer === 'number' && toLayer >= fromLayer) {
      violations.push({
        kind: 'not-strictly-decreasing-layer',
        message: `'${package_.name}' (L${String(fromLayer)}) -> '${dependency}' (L${String(toLayer)}): nem szigorúan csökkenő rétegszám felé mutat`,
      });
    }
  }
  return violations;
}

function findLayerDirectionViolations(
  packages: readonly WorkspacePackage[],
  layerByName: Readonly<Record<string, PackageLayer>>,
): DependencyGraphViolation[] {
  const violations: DependencyGraphViolation[] = [];
  for (const package_ of packages) {
    const fromLayer = layerByName[package_.name];
    if (typeof fromLayer === 'number') {
      violations.push(...findLayerDirectionViolationsForPackage(package_, fromLayer, layerByName));
    }
  }
  return violations;
}

// DFS alapú körkeresés a dependsOn + devDependsOn élek unióján. Az első
// talált kört adja vissza, a csomópontok listájával (a kör kezdő csomópontja
// megismétlődik a végén, hogy az él-lánc olvasható legyen).
function findCycle(packages: readonly WorkspacePackage[]): readonly string[] | undefined {
  const edgesByName = new Map<string, readonly string[]>(
    packages.map((package_) => [package_.name, [...package_.dependsOn, ...package_.devDependsOn]]),
  );

  const visited = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  function visit(name: string): readonly string[] | undefined {
    if (onStack.has(name)) {
      const cycleStartIndex = stack.indexOf(name);
      return [...stack.slice(cycleStartIndex), name];
    }
    if (visited.has(name)) {
      return undefined;
    }
    visited.add(name);
    stack.push(name);
    onStack.add(name);

    const dependencies = edgesByName.get(name) ?? [];
    for (const dependency of dependencies) {
      const cycle = visit(dependency);
      if (cycle !== undefined) {
        return cycle;
      }
    }

    stack.pop();
    onStack.delete(name);
    return undefined;
  }

  for (const package_ of packages) {
    const cycle = visit(package_.name);
    if (cycle !== undefined) {
      return cycle;
    }
  }
  return undefined;
}

function findCycleViolations(packages: readonly WorkspacePackage[]): DependencyGraphViolation[] {
  const cycle = findCycle(packages);
  if (cycle === undefined) {
    return [];
  }
  return [{ kind: 'cycle', message: `kör a függőségi gráfban: ${cycle.join(' -> ')}` }];
}

export function findDependencyGraphViolations(
  packages: readonly WorkspacePackage[],
  layerByName: Readonly<Record<string, PackageLayer>>,
): readonly DependencyGraphViolation[] {
  return [
    ...findMissingLayerViolations(packages, layerByName),
    ...findToolInDependenciesViolations(packages, layerByName),
    ...findLayerDirectionViolations(packages, layerByName),
    ...findCycleViolations(packages),
  ];
}
