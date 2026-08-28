import { describe, expect, it } from 'vitest';
import type { Fact, StructuredOutputStrategy } from '@easter-workflow-builder/provider-capability';
import { resolveStructuredOutputStrategy } from './resolve-structured-output-strategy.ts';

// A tesztek szintetikus, kitalált leíró részletet építenek: valódi provider
// leírót a motor tesztje nem importálhat, mert a motor nem függ a
// `provider-registry` csomagtól (SPEC-004 17. szekció 57. kritérium).
function knownFact<TValue>(value: TValue): Fact<TValue> {
  return { state: 'known', value, evidence: [{ kind: 'measurement', id: 'M-01' }] };
}

function unknownFact<TValue>(): Fact<TValue> {
  return { state: 'unknown', reason: 'A mérés még nem futott le.', blockedBy: ['M-99'] };
}

function buildStrategy(usable: Fact<boolean>): StructuredOutputStrategy {
  return {
    id: 'emit_output_tool',
    usable,
    blockingWireDetail: unknownFact<string | null>(),
    observedRoundTrips: knownFact<readonly number[]>([3]),
  };
}

describe('resolveStructuredOutputStrategy', () => {
  it('known igaz: a stratégia használható, és nincs jelölés', () => {
    const strategy = buildStrategy(knownFact(true));

    expect(resolveStructuredOutputStrategy([strategy], 'emit_output_tool')).toStrictEqual({
      kind: 'ok',
      value: { strategy, strategyUnproven: false },
    });
  });

  it('known hamis: structured_output_strategy_unsupported hibát ad', () => {
    const strategy = buildStrategy(knownFact(false));

    expect(resolveStructuredOutputStrategy([strategy], 'emit_output_tool')).toStrictEqual({
      kind: 'error',
      message:
        'A(z) emit_output_tool strukturált kimenet stratégia a provider leírója szerint nem használható (structured_output_strategy_unsupported).',
    });
  });

  it('unknown: használható, de strategyUnproven jelölést kap', () => {
    const strategy = buildStrategy(unknownFact<boolean>());

    expect(resolveStructuredOutputStrategy([strategy], 'emit_output_tool')).toStrictEqual({
      kind: 'ok',
      value: { strategy, strategyUnproven: true },
    });
  });

  it('a leíró nem írja le a kért stratégiát: ugyanaz a hibaosztály, más indoklással', () => {
    const strategy = buildStrategy(knownFact(true));

    expect(resolveStructuredOutputStrategy([strategy], 'sdk_output_format')).toStrictEqual({
      kind: 'error',
      message:
        'A(z) sdk_output_format strukturált kimenet stratégiát a provider leírója nem írja le (structured_output_strategy_unsupported).',
    });
  });

  it('több stratégia közül a kért azonosítójút választja ki', () => {
    const usable = buildStrategy(knownFact(true));
    const other: StructuredOutputStrategy = { ...buildStrategy(knownFact(false)), id: 'sdk_output_format' };

    expect(resolveStructuredOutputStrategy([other, usable], 'emit_output_tool')).toStrictEqual({
      kind: 'ok',
      value: { strategy: usable, strategyUnproven: false },
    });
  });
});
