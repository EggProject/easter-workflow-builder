/**
 * A kimenő `Options.model` érték feloldásának eredménye (SPEC-004 11.3
 * táblázat 5. sora).
 *
 * Az `outgoingModel` az az érték, amit a motor ténylegesen átad: `known`
 * esetén a kliens azonosító, `unknown` esetén változatlanul a wire azonosító.
 * A `modelIdentifierUnproven` ez utóbbi esetet jelöli, és a `step_started`
 * payload `modelIdentifierUnproven` mezőjébe kerül.
 */
export interface ModelIdentifierDecision {
  readonly outgoingModel: string;
  readonly modelIdentifierUnproven: boolean;
}
