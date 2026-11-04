import path from 'node:path';

/**
 * Az abszolút `candidate` útvonal a `root` alatt áll-e (SPEC-014 5.4 "Fájl"):
 * előtag ellenőrzés a gyökér plusz útvonal elválasztó alakra, hogy a `/a/bc`
 * ne számítson a `/a/b` alattinak. A gyökér maga csak `isRootAllowed` mellett
 * elfogadott (a `files.list` gyökér listája, írásnál a szülő könyvtár). Ha a
 * gyökér maga is elválasztóra végződik (`/`), az előtag a gyökér.
 */
export function isWithinRoot(root: string, candidate: string, isRootAllowed: boolean): boolean {
  if (candidate === root) {
    return isRootAllowed;
  }
  return candidate.startsWith(root.endsWith(path.sep) ? root : `${root}${path.sep}`);
}
