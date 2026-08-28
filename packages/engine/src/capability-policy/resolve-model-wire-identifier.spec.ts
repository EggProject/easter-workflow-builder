import { describe, expect, it } from 'vitest';
import type { Fact, ModelDescriptor } from '@easter-workflow-builder/provider-capability';
import { resolveModelWireIdentifier } from './resolve-model-wire-identifier.ts';

function knownFact<TValue>(value: TValue): Fact<TValue> {
  return { state: 'known', value, evidence: [{ kind: 'measurement', id: 'M-01' }] };
}

function unknownFact<TValue>(): Fact<TValue> {
  return { state: 'unknown', reason: 'A mérés még nem futott le.', blockedBy: ['M-99'] };
}

// Szintetikus modell leíró: a `clientModelIdentifier` a teszt bemenete, a többi
// mező a `ModelDescriptor` alakjának kitöltése, és egyiket sem olvassa a
// vizsgált függvény.
function buildModel(clientModelIdentifier: Fact<string>): ModelDescriptor<string, string> {
  return {
    id: 'fake-model-wire-id',
    family: 'fake-family',
    clientModelIdentifier,
    contextWindow: unknownFact<number>(),
    effectiveContextWindowOnWire: unknownFact<number>(),
    maxOutputTokensRecommended: unknownFact<number>(),
    maxOutputTokensHard: unknownFact<number>(),
    maxOutputTokensWireCeiling: unknownFact<number>(),
    imageInput: unknownFact<boolean>(),
    videoInput: unknownFact<boolean>(),
    listedByModelsEndpoint: unknownFact<boolean>(),
  };
}

const differingIdentifier = buildModel(knownFact('fake-model-client-id'));
const matchingIdentifier = buildModel(knownFact('fake-model-wire-id'));
const unknownIdentifier = buildModel(unknownFact<string>());

describe('resolveModelWireIdentifier', () => {
  it('known: a kliens azonosítót adja, jelölés nélkül', () => {
    expect(resolveModelWireIdentifier(differingIdentifier)).toStrictEqual({
      outgoingModel: 'fake-model-client-id',
      modelIdentifierUnproven: false,
    });
  });

  it('known: az azonos kliens és wire azonosító is jelölés nélkül megy ki', () => {
    expect(resolveModelWireIdentifier(matchingIdentifier)).toStrictEqual({
      outgoingModel: 'fake-model-wire-id',
      modelIdentifierUnproven: false,
    });
  });

  it('unknown: a wire azonosítót adja változatlanul, és jelöli', () => {
    expect(resolveModelWireIdentifier(unknownIdentifier)).toStrictEqual({
      outgoingModel: 'fake-model-wire-id',
      modelIdentifierUnproven: true,
    });
  });
});
