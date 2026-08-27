import type { Fact } from '@easter-workflow-builder/evidence';
import type { AgentToolId } from '@easter-workflow-builder/agent-tool-id';

/**
 * Egy saját folyamatban futó eszköz ajánlása egy providerhez. A `recommended`
 * mező azért `Fact`, mert eszközönként külön bizonyíték tartozik hozzá.
 */
export interface AgentToolRecommendation {
  readonly toolId: AgentToolId;
  readonly recommended: Fact<boolean>;
}
