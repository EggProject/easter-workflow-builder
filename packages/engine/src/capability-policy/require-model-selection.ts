import type { Outcome } from '@easter-workflow-builder/core';
import type { ModelDescriptor } from '@easter-workflow-builder/provider-capability';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';

/**
 * Kötelező-e a lépésnek modellt választania (SPEC-004 11.3 táblázat 6. sora,
 * leíró mező: a `models` lista **hossza**).
 *
 * Ez az egyetlen sor, ami nem `Fact` mezőn áll, ezért `unknown` ága nincs (a
 * táblázat "nem alkalmazható" jelölése):
 *
 * - a lépés választott modellt (`AgentStepConfig.modelId`): az a lépés modellje,
 * - a lépés nem választott, és a leíró **pontosan egy** modellt ír le: az a
 *   lépés modellje modellválasztás nélkül is,
 * - a lépés nem választott, és a leíró nem pontosan egy modellt ír le:
 *   `model_not_selected`. Több modell közül a motor nem választ magától, üres
 *   listánál pedig nincs miből választani.
 */
export function requireModelSelection(
  models: readonly ModelDescriptor<string, string>[],
  stepModelId: string | null,
): Outcome<string> {
  if (stepModelId !== null) {
    return { kind: 'ok', value: stepModelId };
  }

  const [onlyModel, ...furtherModels] = models;

  if (onlyModel !== undefined && furtherModels.length === 0) {
    return { kind: 'ok', value: onlyModel.id };
  }

  return {
    kind: 'error',
    message: formatEngineErrorMessage(
      'model_not_selected',
      `A lépés nem választott modellt, a provider leírója pedig ${String(models.length)} modellt ír le`,
    ),
  };
}
