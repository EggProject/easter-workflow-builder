import type { AgentStepConfig } from '@easter-workflow-builder/db';
import type { ExecutableNodeConfig } from '../run-validation/executable-node-config.ts';
import type { SessionSourceNodes } from './session-source-nodes.ts';

/**
 * A node config agent lépés alobjektuma, vagy `undefined`, ha a node nem
 * futtat agent lépést. A két ág a SPEC-004 5. szekció táblázatának 2. és 5. sora: az `agent_step` node maga `AgentStepConfig` (a `type` mezővel
 * bővítve), az `ai_synthesis` módú `join` node pedig a `settings`
 * alobjektumában hordozza ugyanezt (SPEC-003 4.3).
 */
function readAgentStepConfig(config: ExecutableNodeConfig): AgentStepConfig | undefined {
  if (config.type === 'agent_step') {
    return config;
  }
  if (config.type === 'join' && config.mode === 'ai_synthesis') {
    return config.settings;
  }
  return undefined;
}

/**
 * A gráf session forrás node-jainak összegyűjtése a validált node configokból
 * (SPEC-004 6.4). A `forkSession` döntés bemenete, és önmagában is tiszta
 * függvény: a pillanatképből származó configokon dolgozik, adatbázis és port
 * nélkül.
 *
 * Miért **minden** agent lépés forrás, az `isolated` módú is, a
 * `SessionSourceNodes` típus doksijában áll.
 */
export function collectSessionSourceNodes(
  nodeConfigsById: ReadonlyMap<string, ExecutableNodeConfig>,
): SessionSourceNodes {
  const sourceNodeIds = new Set<string>();
  const continuedNodeIds = new Set<string>();

  for (const [nodeId, config] of nodeConfigsById) {
    const agentStepConfig = readAgentStepConfig(config);
    if (agentStepConfig === undefined) {
      continue;
    }
    sourceNodeIds.add(nodeId);
    if (agentStepConfig.sessionMode === 'continued') {
      continuedNodeIds.add(nodeId);
    }
  }

  return { sourceNodeIds, continuedNodeIds };
}
