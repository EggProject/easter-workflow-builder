import type { Fact } from '../evidence/fact/fact.ts';
import type { StructuredOutputStrategyId } from './structured-output-strategy-id.ts';

export interface StructuredOutputStrategy {
  readonly id: StructuredOutputStrategyId;
  /**
  Használható-e ezzel a providerrel.
  */
  readonly usable: Fact<boolean>;
  /**
  Ha nem használható: melyik konkrét drótrészlet blokkolja. `null`, ha nincs blokkoló.
  */
  readonly blockingWireDetail: Fact<string | null>;
  /**
  Hány modellkör kellett a kikényszerítéshez a mérésben.
  */
  readonly observedRoundTrips: Fact<readonly number[]>;
}
