import type { ModelDescriptor } from '@easter-workflow-builder/provider-capability';
import { isKnownFact } from '@easter-workflow-builder/provider-capability';
import type { ModelIdentifierDecision } from './model-identifier-decision.ts';

/**
 * A kimenő `Options.model` érték (SPEC-004 11.3 táblázat 5. sora, leíró mezők:
 * `models[].id`, `models[].clientModelIdentifier`):
 *
 * - `known`: a motor a wire azonosítóból a kliens azonosítóra képez. A kettő
 *   eltérhet, mert a kliens azonosító vezérli a kliens oldali kontextusablakot
 *   és a beta headert, miközben a dróton más alak megy ki (a
 *   `ModelDescriptor.clientModelIdentifier` dokumentációja).
 * - `unknown`: a motor a **wire** azonosítót adja át változatlanul, és ezt a
 *   `step_started` payload `modelIdentifierUnproven` mezője jelöli. Kitalált
 *   kliens azonosító nincs (SPEC-004 11.2).
 *
 * Hibaága nincs: a modellazonosító érvényességét a 7. sor (`validateModelId`)
 * dönti el, ez a függvény már egy megtalált leírót kap.
 */
export function resolveModelWireIdentifier(model: ModelDescriptor<string, string>): ModelIdentifierDecision {
  if (isKnownFact(model.clientModelIdentifier)) {
    return { outgoingModel: model.clientModelIdentifier.value, modelIdentifierUnproven: false };
  }

  return { outgoingModel: model.id, modelIdentifierUnproven: true };
}
