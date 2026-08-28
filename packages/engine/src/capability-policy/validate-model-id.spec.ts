import { describe, expect, it } from 'vitest';
import type { Fact, ModelDescriptor } from '@easter-workflow-builder/provider-capability';
import { validateModelId } from './validate-model-id.ts';

function unknownFact<TValue>(): Fact<TValue> {
  return { state: 'unknown', reason: 'A mérés még nem futott le.', blockedBy: ['M-99'] };
}

function buildModel(id: string): ModelDescriptor<string, string> {
  return {
    id,
    family: 'fake-family',
    clientModelIdentifier: unknownFact<string>(),
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

describe('validateModelId', () => {
  it('a listában szereplő azonosítóra a megtalált modell leírót adja', () => {
    const wanted = buildModel('fake-model-b');

    expect(validateModelId([buildModel('fake-model-a'), wanted], 'fake-model-b')).toStrictEqual({
      kind: 'ok',
      value: wanted,
    });
  });

  it('a listában nem szereplő azonosítóra unknown_model_id hibát ad', () => {
    expect(validateModelId([buildModel('fake-model-a')], 'fake-model-z')).toStrictEqual({
      kind: 'error',
      message: 'A(z) fake-model-z modellazonosítót a provider leírója nem ismeri (unknown_model_id).',
    });
  });

  it('üres modellistán minden azonosító ismeretlen', () => {
    expect(validateModelId([], 'fake-model-a')).toStrictEqual({
      kind: 'error',
      message: 'A(z) fake-model-a modellazonosítót a provider leírója nem ismeri (unknown_model_id).',
    });
  });
});
