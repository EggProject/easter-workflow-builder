import { readdir, realpath } from 'node:fs/promises';
import { describeFileError } from './describe-file-error.ts';
import type { HostCallOutcome } from './host-call-outcome.ts';
import { isWithinRoot } from './is-within-root.ts';
import { outsideRootRejection } from './outside-root-rejection.ts';
import { resolvePathInRoot } from './resolve-path-in-root.ts';

/**
 * A sandbox `files.list(path)` gazda oldala (SPEC-014 5.4 "Fájl"): a könyvtár
 * bejegyzéseinek neve, a `readdir` sorrendjében. A gyökér maga is listázható
 * (`"."`); a szimbolikus link ellenőrzése a `readTextInRoot` mintája szerint.
 */
export async function listInRoot(root: string, requested: unknown): Promise<HostCallOutcome> {
  const target = resolvePathInRoot(root, requested, true);
  if (target.kind === 'rejected') {
    return target;
  }
  try {
    const realRoot = await realpath(root);
    const realTarget = await realpath(target.path);
    if (!isWithinRoot(realRoot, realTarget, true)) {
      return outsideRootRejection(target.requested);
    }
    return { kind: 'resolved', json: JSON.stringify(await readdir(realTarget)) };
  } catch (error) {
    return describeFileError(error, target.requested);
  }
}
