import type { Outcome } from '@easter-workflow-builder/core';
import type { ProviderId } from '@easter-workflow-builder/provider-capability';
import { resolveEffectiveProvider } from '../provider-resolution/resolve-effective-provider.ts';
import type { ExecutableNodeConfig } from './executable-node-config.ts';

/**
 * A node saját, lépés szintű provider felülírása (SPEC-004 11.1 3. pont).
 *
 * Pontosan két config alak hordoz `providerId` mezőt, mert csak ez a kettő
 * indít agent hívást: az `agent_step` node, ahol a mező a config tetején áll,
 * és a `join` node `ai_synthesis` módja, ahol a `settings` alobjektum maga az
 * `AgentStepConfig`. Minden más node típusnál nincs mit felülírni.
 */
function stepProviderOverride(config: ExecutableNodeConfig): ProviderId | null {
  if (config.type === 'agent_step') {
    return config.providerId;
  }
  if (config.type === 'join' && config.mode === 'ai_synthesis') {
    return config.settings.providerId;
  }
  // eslint-disable-next-line unicorn/no-null -- a "nincs lépés szintű felülírás" állapot a `resolveEffectiveProvider` bemeneti típusában `null`, ugyanaz az érték, amit a tárolt config mezői hordoznak (SPEC-003 4.4)
  return null;
}

/**
 * A háromszintű provider feloldás végigfuttatása a gráf **minden** node-ján
 * (SPEC-004 4.8 2. lépés, 11.1). A feloldás magát a döntést nem itt hozza: a
 * `provider-resolution` téma `resolveEffectiveProvider` tiszta függvénye adja,
 * node-onként egyszer meghívva.
 *
 * **Minden node kap `effectiveProviderId` értéket, nem csak az agent
 * jellegűek.** Ez nem tervezési szabadság: a pillanatkép dokumentum
 * `SnapshotNode.effectiveProviderId` mezője kötelező, típusa `ProviderId`,
 * nullázhatatlan, node típustól függetlenül (SPEC-003 5.1). A nem agent
 * jellegű node-oknál (start, branch, fan_out, loop, human_approval,
 * error_handler, sub_workflow, `join` `merge`) nincs lépés szintű felülírás,
 * tehát rájuk a workflow és a globális szint dönt; a feloldott érték a
 * visszanézhetőséget szolgálja, futásidejű agent hívást nem.
 *
 * Ebből következik, hogy egy hiányzó globális alapértelmezés akkor is
 * `no_default_provider` hibát ad, ha a gráfban egyetlen agent lépés sincs. Ez
 * összhangban áll a SPEC-003 4.13 szekcióval, ami a globális alapértelmezés
 * hiányát a **futás indításának** feltételeként, nem lépésenkénti feltételként
 * fogalmazza meg.
 */
export function resolveNodeProviders(
  configsById: ReadonlyMap<string, ExecutableNodeConfig>,
  globalDefaultProviderId: ProviderId | null,
  workflowProviderId: ProviderId | null,
): Outcome<ReadonlyMap<string, ProviderId>> {
  const providerByNodeId = new Map<string, ProviderId>();

  for (const [nodeId, config] of configsById) {
    const resolved = resolveEffectiveProvider(
      globalDefaultProviderId,
      workflowProviderId,
      stepProviderOverride(config),
    );
    if (resolved.kind === 'error') {
      return resolved;
    }
    providerByNodeId.set(nodeId, resolved.value);
  }

  return { kind: 'ok', value: providerByNodeId };
}
