/* eslint-disable unicorn/no-null -- a `stepModelId` paraméter `string | null`, mert a tárolt `AgentStepConfig.modelId` mező SQL NULL értéke jelenti a "a lépés nem választott modellt" esetet (SPEC-003 4.4) */
import { describe, expect, it } from 'vitest';
import type { Fact, ModelDescriptor } from '@easter-workflow-builder/provider-capability';
import { requireModelSelection } from './require-model-selection.ts';

function unknownFact<TValue>(): Fact<TValue> {
  return { state: 'unknown', reason: 'A mérés még nem futott le.', blockedBy: ['M-99'] };
}

// Ez a viselkedés kizárólag a lista **hosszát** olvassa, ezért a modell leíró
// többi mezője szándékosan `unknown`: ha bármelyiket olvasná, a teszt megbukna.
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

describe('requireModelSelection', () => {
  it('egyetlen modell és nincs választás: az az egy modell a lépés modellje', () => {
    expect(requireModelSelection([buildModel('fake-only-model')], null)).toStrictEqual({
      kind: 'ok',
      value: 'fake-only-model',
    });
  });

  it('több modell és nincs választás: model_not_selected hibát ad', () => {
    expect(requireModelSelection([buildModel('fake-model-a'), buildModel('fake-model-b')], null)).toStrictEqual({
      kind: 'error',
      message: 'A lépés nem választott modellt, a provider leírója pedig 2 modellt ír le (model_not_selected).',
    });
  });

  it('üres modellista és nincs választás: ugyanaz a hibaosztály, mert nincs miből választani', () => {
    expect(requireModelSelection([], null)).toStrictEqual({
      kind: 'error',
      message: 'A lépés nem választott modellt, a provider leírója pedig 0 modellt ír le (model_not_selected).',
    });
  });

  it('a lépés választott modellt: több modell mellett is azt adja vissza', () => {
    expect(
      requireModelSelection([buildModel('fake-model-a'), buildModel('fake-model-b')], 'fake-model-b'),
    ).toStrictEqual({ kind: 'ok', value: 'fake-model-b' });
  });

  it('a lépés választása erősebb, mint az egyetlen leírt modell', () => {
    expect(requireModelSelection([buildModel('fake-only-model')], 'fake-other-model')).toStrictEqual({
      kind: 'ok',
      value: 'fake-other-model',
    });
  });
});
