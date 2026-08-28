import type { StructuredOutputStrategy } from '@easter-workflow-builder/provider-capability';

/**
 * A strukturált kimenet stratégia feloldásának eredménye (SPEC-004 11.3
 * táblázat 1. sora).
 *
 * A `strategy` a leíróban ténylegesen megtalált stratégia leírója, hogy a hívó
 * ne keresse meg még egyszer: a `maxTurns` alsó korlátja (3. sor) ugyanennek a
 * stratégiának az `observedRoundTrips` mezőjéből jön.
 *
 * A `strategyUnproven` az `unknown` ág jelölése: a motor használja a
 * stratégiát, de a `step_started` esemény payloadja kiírja, hogy a
 * használhatóság mérése még nem futott le (`StepStartedPayload.strategyUnproven`).
 */
export interface StructuredOutputStrategyDecision {
  readonly strategy: StructuredOutputStrategy;
  readonly strategyUnproven: boolean;
}
