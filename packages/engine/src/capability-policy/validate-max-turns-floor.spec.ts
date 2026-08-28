/* eslint-disable unicorn/no-null -- a `configuredMaxTurns` paraméter `number | null`, mert a tárolt `AgentStepConfig.maxTurns` mező SQL NULL értéke jelenti a "a lépés nem állít maxTurns értéket" esetet (SPEC-003 4.4), nem helyőrző `undefined` */
import { describe, expect, it } from 'vitest';
import type { Fact, StructuredOutputStrategy } from '@easter-workflow-builder/provider-capability';
import { validateMaxTurnsFloor } from './validate-max-turns-floor.ts';

function knownFact<TValue>(value: TValue): Fact<TValue> {
  return { state: 'known', value, evidence: [{ kind: 'measurement', id: 'M-01' }] };
}

function unknownFact<TValue>(): Fact<TValue> {
  return { state: 'unknown', reason: 'A mérés még nem futott le.', blockedBy: ['M-99'] };
}

// Szintetikus stratégia: a megfigyelt körszámok listája a teszt bemenete, a
// többi mező a `StructuredOutputStrategy` alakjának kitöltése.
function buildStrategy(observedRoundTrips: Fact<readonly number[]>): StructuredOutputStrategy {
  return {
    id: 'emit_output_tool',
    usable: knownFact(true),
    blockingWireDetail: unknownFact<string | null>(),
    observedRoundTrips,
  };
}

const ok = { kind: 'ok', value: undefined };
const observed = buildStrategy(knownFact<readonly number[]>([3, 5, 4]));
const singleObservation = buildStrategy(knownFact<readonly number[]>([3]));
const emptyObservation = buildStrategy(knownFact<readonly number[]>([]));
const unknownObservation = buildStrategy(unknownFact<readonly number[]>());

describe('validateMaxTurnsFloor', () => {
  it('known: a lista maximuma alatti maxTurns insufficient_max_turns hibát ad', () => {
    expect(validateMaxTurnsFloor(observed, 4)).toStrictEqual({
      kind: 'error',
      message:
        'A lépés maxTurns értéke (4) kisebb, mint a(z) emit_output_tool stratégia megfigyelt körszámainak maximuma (5) (insufficient_max_turns).',
    });
  });

  it('known: a lista maximumával megegyező maxTurns átmegy', () => {
    expect(validateMaxTurnsFloor(observed, 5)).toStrictEqual(ok);
  });

  it('known: a lista maximuma feletti maxTurns átmegy', () => {
    expect(validateMaxTurnsFloor(singleObservation, 10)).toStrictEqual(ok);
  });

  it('known, de üres megfigyelés lista: nincs alsó korlát, a legkisebb érték is átmegy', () => {
    expect(validateMaxTurnsFloor(emptyObservation, 1)).toStrictEqual(ok);
  });

  it('unknown: nem kényszerít minimumot', () => {
    expect(validateMaxTurnsFloor(unknownObservation, 1)).toStrictEqual(ok);
  });

  it('a lépés nem állít maxTurns értéket: nincs mihez hasonlítani, known lista mellett sem', () => {
    expect(validateMaxTurnsFloor(observed, null)).toStrictEqual(ok);
  });
});
