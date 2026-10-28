import type { PlannedZipEntry } from './planned-zip-entry.ts';

function parentPaths(entryPath: string): readonly string[] {
  const segments = entryPath.split('/');
  return segments.slice(0, -1).map((_, index) => segments.slice(0, index + 1).join('/'));
}

/**
 * Az első ütköző útvonal, vagy `undefined` (SPEC-009 5.4 3. pont): két azonos,
 * vagy csak kis-nagybetűben eltérő útvonalú bejegyzés, mert a kis-nagybetűt nem
 * érzékeny fájlrendszeren (a fejlesztői gép macOS) az egyik felülírná a
 * másikat. A kulcs a név NFC alakja is (PLAN-012 T-012-27, ZIP 2. találat),
 * mert a macOS fájlrendszere a Unicode normalizálásban eltérő nevet (például
 * az előre komponált és a kombináló ékezetes `é`) ugyanannak a fájlnak látja. Ugyanide tartozik, ha egy útvonal fájlként és könyvtárként (egy
 * másik bejegyzés szülőjeként) is szerepel, mert a kettő ugyanazon a helyen
 * nem fér el.
 */
export function findPathCollision(entries: readonly PlannedZipEntry[]): string | undefined {
  const seen = new Set<string>();
  const directories = new Set<string>();
  const files: string[] = [];
  for (const entry of entries) {
    const key = entry.path.normalize('NFC').toLowerCase();
    if (seen.has(key)) {
      return entry.path;
    }
    seen.add(key);
    if (entry.kind === 'file') {
      files.push(key);
    } else {
      directories.add(key);
    }
    for (const parent of parentPaths(key)) {
      directories.add(parent);
    }
  }
  return files.find((file) => directories.has(file));
}
