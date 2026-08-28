import type { Outcome } from '@easter-workflow-builder/core';
import type { ModelDescriptor } from '@easter-workflow-builder/provider-capability';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';

/**
 * Ismeretlen modellazonosító elutasítása (SPEC-004 11.3 táblázat 7. sora,
 * leíró mező: `models[].id`): a feloldott modellazonosítónak szerepelnie kell
 * a leíró modellistájában, különben `unknown_model_id`.
 *
 * A sornak sincs `unknown` ága, mert a `models` lista nem `Fact`. A megtalált
 * leírót visszaadja, mert a rákövetkező két viselkedés (5. sor: a kimenő
 * `Options.model`, 8. sor: a `thinking` mód a modell **családjához**) ugyanezt
 * a leírót olvassa.
 */
export function validateModelId(
  models: readonly ModelDescriptor<string, string>[],
  modelId: string,
): Outcome<ModelDescriptor<string, string>> {
  const model = models.find((candidate) => candidate.id === modelId);

  if (model === undefined) {
    return {
      kind: 'error',
      message: formatEngineErrorMessage(
        'unknown_model_id',
        `A(z) ${modelId} modellazonosítót a provider leírója nem ismeri`,
      ),
    };
  }

  return { kind: 'ok', value: model };
}
