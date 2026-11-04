import path from 'node:path';
import { isString } from '@easter-workflow-builder/typeguards';
import { isWithinRoot } from './is-within-root.ts';
import { outsideRootRejection } from './outside-root-rejection.ts';
import type { PathInRoot } from './path-in-root.ts';

/**
 * A `files` gazda függvény útvonalának szintaktikai ellenőrzése (SPEC-014 5.4
 * "Fájl"): szöveg, nem abszolút, és a `path.resolve(gyökér, útvonal)` eredménye
 * a gyökér alatt áll (`..` kivezetés elutasítva). A szimbolikus link ellenőrzése
 * (`fs.realpath`) a hívó dolga, mert az a fájlrendszert olvassa.
 */
export function resolvePathInRoot(root: string, requested: unknown, isRootAllowed: boolean): PathInRoot {
  if (!isString(requested)) {
    return { kind: 'rejected', name: 'TypeError', message: 'az útvonal szöveg kell legyen' };
  }
  if (path.isAbsolute(requested)) {
    return { kind: 'rejected', name: 'Error', message: `az útvonal nem lehet abszolút: ${requested}` };
  }
  const resolved = path.resolve(root, requested);
  if (!isWithinRoot(root, resolved, isRootAllowed)) {
    return outsideRootRejection(requested);
  }
  return { kind: 'path', path: resolved, requested };
}
