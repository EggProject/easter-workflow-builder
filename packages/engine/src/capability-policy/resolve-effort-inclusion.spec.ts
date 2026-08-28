/* eslint-disable unicorn/no-null -- a `stepEffort` paraméter `string | null`, mert a tárolt `AgentStepConfig.effort` mező SQL NULL értéke jelenti a "a lépés nem állít effortot" esetet (SPEC-003 4.4) */
import { describe, expect, it } from 'vitest';
import type { Fact } from '@easter-workflow-builder/provider-capability';
import { resolveEffortInclusion } from './resolve-effort-inclusion.ts';

function knownFact<TValue>(value: TValue): Fact<TValue> {
  return { state: 'known', value, evidence: [{ kind: 'measurement', id: 'M-01' }] };
}

function unknownFact<TValue>(): Fact<TValue> {
  return { state: 'unknown', reason: 'A mérés még nem futott le.', blockedBy: ['M-99'] };
}

const stepEffort = 'fake-effort-value';

describe('resolveEffortInclusion', () => {
  it('known igaz: továbbadja a lépés értékét', () => {
    expect(resolveEffortInclusion(knownFact(true), stepEffort)).toStrictEqual({ kind: 'ok', value: 'include' });
  });

  it('known hamis és a lépés effortot állít be: effort_unsupported hibát ad', () => {
    expect(resolveEffortInclusion(knownFact(false), stepEffort)).toStrictEqual({
      kind: 'error',
      message:
        'A lépés effort értéket állít be, amit a provider leírója szerint a provider nem fogad el (effort_unsupported).',
    });
  });

  it('known hamis, de a lépés nem állít effortot: elhagyja, hiba nélkül', () => {
    expect(resolveEffortInclusion(knownFact(false), null)).toStrictEqual({ kind: 'ok', value: 'omit' });
  });

  it('known igaz, de a lépés nem állít effortot: nincs mit kiküldeni', () => {
    expect(resolveEffortInclusion(knownFact(true), null)).toStrictEqual({ kind: 'ok', value: 'omit' });
  });

  it('unknown: elhagyja, akkor is, ha a lépés effortot állít be', () => {
    expect(resolveEffortInclusion(unknownFact<boolean>(), stepEffort)).toStrictEqual({ kind: 'ok', value: 'omit' });
  });
});
