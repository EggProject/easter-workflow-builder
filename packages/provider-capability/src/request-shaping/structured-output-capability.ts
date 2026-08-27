import type { Fact } from '../evidence/fact/fact.ts';
import type { StructuredOutputStrategy } from './structured-output-strategy.ts';
import type { StructuredOutputStrategyId } from './structured-output-strategy-id.ts';

export interface StructuredOutputCapability {
  readonly strategies: readonly StructuredOutputStrategy[];
  readonly defaultStrategy: Fact<StructuredOutputStrategyId>;
  /**
  Q3: kimegy-e `output_config` akkor is, ha nem kérünk strukturált kimenetet.
  */
  readonly outputConfigAlwaysSent: Fact<boolean>;
  /**
  Q3: melyik body mezőben utazik az `effort`, ha egyáltalán.
  */
  readonly outputConfigWireField: Fact<string | null>;
}
