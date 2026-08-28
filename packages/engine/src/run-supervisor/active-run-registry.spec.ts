import { describe, expect, it } from 'vitest';
import type { Outcome } from '@easter-workflow-builder/core';
import type { RunCompletion } from '../error-policy/run-completion.ts';
import type { ActiveRunHandle } from './active-run-registry.ts';
import { createActiveRunRegistry } from './active-run-registry.ts';

/* eslint-disable unicorn/no-null -- a `RunCompletion` `succeeded` ágán az `errorKind` és az `errorMessage` valódi `null` érték (SPEC-004 8.4) */
const SUCCEEDED: Outcome<RunCompletion> = {
  kind: 'ok',
  value: { status: 'succeeded', errorKind: null, errorMessage: null, failedBranchCount: 0 },
};
/* eslint-enable unicorn/no-null */

function handleOf(runId: string, rootRunId = runId): ActiveRunHandle {
  let isStopRequested = false;
  return {
    runId,
    rootRunId,
    workflowId: 'wf-1',
    completion: Promise.resolve(SUCCEEDED),
    requestStop: () => {
      isStopRequested = true;
    },
    isStopRequested: () => isStopRequested,
  };
}

describe('createActiveRunRegistry', () => {
  it('a felvett kézikönyv azonosító szerint és listában is megtalálható', () => {
    const registry = createActiveRunRegistry();
    const handle = handleOf('run-1');

    registry.register(handle);

    expect(registry.get('run-1')).toBe(handle);
    expect(registry.list()).toStrictEqual([handle]);
  });

  it('ismeretlen azonosítóra undefined, üres nyilvántartásra üres lista', () => {
    const registry = createActiveRunRegistry();

    expect(registry.get('nincs-ilyen')).toBeUndefined();
    expect(registry.list()).toStrictEqual([]);
  });

  it('a release kiveszi a kézikönyvet, a többi bejegyzést érintetlenül hagyva', () => {
    const registry = createActiveRunRegistry();
    const first = handleOf('run-1');
    const second = handleOf('run-2', 'run-1');
    registry.register(first);
    registry.register(second);

    registry.release('run-1');

    expect(registry.get('run-1')).toBeUndefined();
    expect(registry.list()).toStrictEqual([second]);
  });

  it('a fa tagjai a rootRunId alapján szűrhetők a listából (a megszakítás útja)', () => {
    const registry = createActiveRunRegistry();
    registry.register(handleOf('run-1'));
    registry.register(handleOf('run-2', 'run-1'));
    registry.register(handleOf('run-3'));

    const tree = registry.list().filter((handle) => handle.rootRunId === 'run-1');

    expect(tree.map((handle) => handle.runId)).toStrictEqual(['run-1', 'run-2']);
  });

  it('a requestStop a kézikönyvön keresztül állítja a leállítási jelzést', () => {
    const handle = handleOf('run-1');

    expect(handle.isStopRequested()).toBe(false);
    handle.requestStop();

    expect(handle.isStopRequested()).toBe(true);
  });
});
