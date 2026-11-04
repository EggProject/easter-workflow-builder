import { realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isString } from '@easter-workflow-builder/typeguards';
import { describeFileError } from './describe-file-error.ts';
import type { HostCallOutcome } from './host-call-outcome.ts';
import { isWithinRoot } from './is-within-root.ts';
import { outsideRootRejection } from './outside-root-rejection.ts';
import { realpathIfExists } from './realpath-if-exists.ts';
import { resolvePathInRoot } from './resolve-path-in-root.ts';

/**
 * A sandbox `files.writeText(path, text)` gazda oldala (SPEC-014 5.4 "Fájl"),
 * UTF-8 szövegként. A szintaktikai ellenőrzés után:
 *
 * - létező cél: a `fs.realpath` alakja a gyökér alatt áll, és az írás oda megy;
 * - nem létező cél: a szülő könyvtár `fs.realpath` alakja a gyökér alatt (vagy
 *   maga a gyökér), és az írás a `wx` jelzővel megy, ami POSIX alatt a
 *   szimbolikus linkre (a nem létező célra mutatóra is) hibát ad (Node `fs` doksi
 *   "File system flags"; POSIX `open` `O_CREAT | O_EXCL`), tehát egy függő link
 *   sem vezet ki.
 *
 * Az ellenőrzés és az írás közötti linkcsere ellen nem véd (TOCTOU, 5.10 3.).
 */
export async function writeTextInRoot(root: string, requested: unknown, text: unknown): Promise<HostCallOutcome> {
  const target = resolvePathInRoot(root, requested, false);
  if (target.kind === 'rejected') {
    return target;
  }
  if (!isString(text)) {
    return { kind: 'rejected', name: 'TypeError', message: 'a beírandó tartalom szöveg kell legyen' };
  }
  try {
    const realRoot = await realpath(root);
    const existing = await realpathIfExists(target.path);
    if (existing !== undefined) {
      if (!isWithinRoot(realRoot, existing, false)) {
        return outsideRootRejection(target.requested);
      }
      await writeFile(existing, text, 'utf8');
      return { kind: 'resolved', json: undefined };
    }
    const parent = await realpath(path.dirname(target.path));
    if (!isWithinRoot(realRoot, parent, true)) {
      return outsideRootRejection(target.requested);
    }
    await writeFile(path.join(parent, path.basename(target.path)), text, { encoding: 'utf8', flag: 'wx' });
    return { kind: 'resolved', json: undefined };
  } catch (error) {
    return describeFileError(error, target.requested);
  }
}
