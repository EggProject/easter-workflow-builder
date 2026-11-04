import { createReadStream } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { describeFileError } from './describe-file-error.ts';
import type { HostCallOutcome } from './host-call-outcome.ts';
import { isWithinRoot } from './is-within-root.ts';
import { outsideRootRejection } from './outside-root-rejection.ts';
import { readCappedBytes } from './read-capped-bytes.ts';
import { resolvePathInRoot } from './resolve-path-in-root.ts';

/**
 * A sandbox `files.readText(path)` gazda oldala (SPEC-014 5.4 "Fájl"): a
 * szintaktikai ellenőrzés után az útvonal és a gyökér `fs.realpath` alakja
 * (minden szimbolikus link feloldva) is összevetve, így egy link nem vezet ki;
 * a tényleges olvasás a feloldott útvonalon, UTF-8 szövegként. Az ellenőrzés
 * és az olvasás közötti linkcsere ellen nem véd (TOCTOU, 5.10 3. pont). Az
 * olvasás legfeljebb `maxBytes` bájtig tart (a lépés memória korlátja), a
 * nagyobb fájl hiba: korlát nélkül egy nagy vagy végtelen fájl (`/dev/zero`) a
 * szerver folyamat memóriáját fogyasztotta (PLAN-015 T-015-12).
 */
export async function readTextInRoot(root: string, requested: unknown, maxBytes: number): Promise<HostCallOutcome> {
  const target = resolvePathInRoot(root, requested, false);
  if (target.kind === 'rejected') {
    return target;
  }
  try {
    const realRoot = await realpath(root);
    const realTarget = await realpath(target.path);
    if (!isWithinRoot(realRoot, realTarget, false)) {
      return outsideRootRejection(target.requested);
    }
    const bytes = await readCappedBytes(createReadStream(realTarget), maxBytes);
    if (bytes === undefined) {
      return {
        kind: 'rejected',
        name: 'Error',
        message: `a fájl nagyobb, mint a lépés memória korlátja: ${target.requested}`,
      };
    }
    return { kind: 'resolved', json: JSON.stringify(bytes.toString('utf8')) };
  } catch (error) {
    return describeFileError(error, target.requested);
  }
}
