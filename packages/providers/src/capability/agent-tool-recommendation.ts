import type { Fact } from '../evidence/fact.ts';
import type { AgentToolId } from './agent-tool-id.ts';

/**
 * Egy saját folyamatban futó eszköz ajánlása egy providerhez. A `recommended`
 * mező azért `Fact`, mert eszközönként külön bizonyíték tartozik hozzá.
 */
export interface AgentToolRecommendation {
  readonly toolId: AgentToolId;
  readonly recommended: Fact<boolean>;
}
