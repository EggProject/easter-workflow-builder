/* eslint-disable unicorn/no-null -- a `RunCompletion.errorKind`/`errorMessage` `null` értéke a "hiba nélkül zárt" jelentés (SPEC-004 13. szekció), nem helyőrző */
import { describe, expect, it } from 'vitest';
import type { UnhandledErrorRecord } from './unhandled-error-record.ts';
import { resolveRunCompletion } from './resolve-run-completion.ts';

describe('resolveRunCompletion', () => {
  it('kezeletlen hiba nélkül succeeded állapotot ad', () => {
    expect(resolveRunCompletion([])).toStrictEqual({
      status: 'succeeded',
      errorKind: null,
      errorMessage: null,
      failedBranchCount: 0,
    });
  });

  it('egyetlen kezeletlen hibánál failed, az adott hibaosztállyal', () => {
    const records: readonly UnhandledErrorRecord[] = [{ nodeId: 'lepes', errorKind: 'provider_call_failed' }];

    expect(resolveRunCompletion(records)).toStrictEqual({
      status: 'failed',
      errorKind: 'provider_call_failed',
      errorMessage:
        'A(z) lepes node kezeletlen hibája miatt a futás sikertelen; elhalt ágak száma: 1 (provider_call_failed).',
      failedBranchCount: 1,
    });
  });

  it('több kezeletlen hibánál az ELSŐ hibaosztálya kerül a futásra, és az üzenet megnevezi az ágak számát', () => {
    const records: readonly UnhandledErrorRecord[] = [
      { nodeId: 'elso', errorKind: 'agent_result_not_success' },
      { nodeId: 'masodik', errorKind: 'template_render_failed' },
      { nodeId: 'harmadik', errorKind: 'expression_evaluation_failed' },
    ];

    expect(resolveRunCompletion(records)).toStrictEqual({
      status: 'failed',
      errorKind: 'agent_result_not_success',
      errorMessage:
        'A(z) elso node kezeletlen hibája miatt a futás sikertelen; elhalt ágak száma: 3 (agent_result_not_success).',
      failedBranchCount: 3,
    });
  });

  it('fail_branch mellett is failed, akkor is, ha a többi ág sikeres volt (nincs partially_succeeded)', () => {
    const records: readonly UnhandledErrorRecord[] = [{ nodeId: 'ag', errorKind: 'branch_no_matching_edge' }];

    const completion = resolveRunCompletion(records);

    expect(completion.status).toBe('failed');
    expect(completion.status).not.toBe('succeeded');
  });
});
