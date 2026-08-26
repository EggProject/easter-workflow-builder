import type { Fact } from '../evidence/fact.ts';

export interface EffortCapability {
  /**
  Elfogadja-e a provider a kérést, ha az `effort` be van állítva.
  */
  readonly accepted: Fact<boolean>;
  /**
  Melyik body mezőben jelenik meg. `null`, ha nem megy ki a dróton.
  */
  readonly wireField: Fact<string | null>;
}
