/* eslint-disable unicorn/no-null -- a `stepThinking` paraméter `ThinkingMode | null`, mert a tárolt `AgentStepConfig.thinking` mező SQL NULL értéke jelenti a "a lépés nem állít thinking módot" esetet (SPEC-003 4.4) */
import { describe, expect, it } from 'vitest';
import type { Fact, ThinkingMode } from '@easter-workflow-builder/provider-capability';
import { resolveThinkingMode } from './resolve-thinking-mode.ts';

function knownFact<TValue>(value: TValue): Fact<TValue> {
  return { state: 'known', value, evidence: [{ kind: 'measurement', id: 'M-01' }] };
}

function unknownFact<TValue>(): Fact<TValue> {
  return { state: 'unknown', reason: 'A mérés még nem futott le.', blockedBy: ['M-99'] };
}

const family = 'fake-family';
const knownModes: Readonly<Record<string, Fact<readonly ThinkingMode[]>>> = {
  [family]: knownFact<readonly ThinkingMode[]>(['disabled', 'adaptive']),
};
const unknownModes: Readonly<Record<string, Fact<readonly ThinkingMode[]>>> = {
  [family]: unknownFact<readonly ThinkingMode[]>(),
};

describe('resolveThinkingMode', () => {
  it('known: a listán szereplő mód kimegy', () => {
    expect(resolveThinkingMode(knownModes, family, 'adaptive')).toStrictEqual({ kind: 'ok', value: 'include' });
  });

  it('known: a listán nem szereplő mód thinking_mode_unsupported hibát ad', () => {
    expect(resolveThinkingMode(knownModes, family, 'always_on')).toStrictEqual({
      kind: 'error',
      message:
        'A(z) always_on thinking mód nem szerepel a(z) fake-family modellcsalád megengedett módjai között (thinking_mode_unsupported).',
    });
  });

  it('unknown: a motor elhagyja a thinking mezőt, hiba nélkül', () => {
    expect(resolveThinkingMode(unknownModes, family, 'always_on')).toStrictEqual({ kind: 'ok', value: 'omit' });
  });

  it('a modellcsaládhoz nincs bejegyzés: ugyanaz a visszaesés, mint az unknown ágon', () => {
    expect(resolveThinkingMode({}, family, 'adaptive')).toStrictEqual({ kind: 'ok', value: 'omit' });
  });

  it('a lépés nem állít thinking módot: a mező elmarad, known lista mellett is', () => {
    expect(resolveThinkingMode(knownModes, family, null)).toStrictEqual({ kind: 'ok', value: 'omit' });
  });
});
