import type { AgentStepConfig } from '@easter-workflow-builder/db';
import type { Outcome } from '@easter-workflow-builder/core';
import { validateAgentStepCapabilities } from '../agent-step/validate-agent-step-capabilities.ts';
import { validateSdkVersionMatch } from '../capability-policy/validate-sdk-version-match.ts';
import type { ExecutableNodeConfig } from '../run-validation/executable-node-config.ts';
import type { NodePlan } from './run-execution.ts';

/**
 * A node agent lépés alobjektuma, vagy `undefined`, ha a node nem futtat agent
 * lépést. Ugyanaz a két ág, amit a `collectSessionSourceNodes` is
 * megkülönböztet (SPEC-004 5. szekció táblázatának 2. és 5. sora).
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
 * A SPEC-004 4.8 3. lépésének **provider** fele: a 11.2 szekció szerinti
 * leíró alapú ellenőrzések **száraz** lefuttatása minden agent jellegű node-ra,
 * a node-jára feloldott provider leírójával, a futás létrehozása **előtt**.
 *
 * Két ellenőrzés fut node-onként:
 *
 * 1. `validateSdkVersionMatch`: a leíró `sdkVersionPin` mezője és a telepített
 *    SDK verzió egyezése (11.3 táblázat 17. sora,
 *    `provider_descriptor_sdk_mismatch`, mindkét verzió megnevezésével).
 * 2. `validateAgentStepCapabilities`: a 11.3 táblázat lépéshez kötött tíz sora
 *    egyetlen menetben (`model_not_selected`, `unknown_model_id`,
 *    `thinking_mode_unsupported`, `effort_unsupported`,
 *    `forced_tool_choice_silently_dropped`,
 *    `structured_output_strategy_unsupported`, `insufficient_max_turns`).
 *
 * **A számított döntéseket szándékosan eldobjuk.** A hívó itt csak azt kérdezi,
 * indulhat-e a futás; a döntések (kimenő modell azonosító, `thinking`,
 * `effort`, stratégia) a lépés végrehajtásakor, az `Options` összeállításával
 * egy menetben születnek újra (`agent-node-lifecycle.ts`). Az eltárolásuk azt
 * jelentené, hogy a futás indításakor befagyasztott döntés és a lépéskori
 * `Options` két, egymástól elcsúszható úton áll elő; a függvény tiszta, tehát
 * a kétszeri futtatás ugyanazt az eredményt adja.
 *
 * **Miért csak az agent jellegű node-ok.** A leíró minden mezője az agent
 * hívásról szól; a `start`, a `branch`, a `fan_out`, a `loop`, a
 * `human_approval`, az `error_handler`, a `sub_workflow` és a `join` `merge`
 * módja egyetlen provider hívást sem indít (5. szekció táblázatának "Provider
 * hívás" oszlopa), tehát a leírójukból semmi nem következik. Az
 * `effectiveProviderId` értéket ettől függetlenül minden node megkapja, mert
 * a pillanatkép mezője kötelező (SPEC-003 5.1).
 */
export function validateProviderCapabilities(
  nodePlans: ReadonlyMap<string, NodePlan>,
  installedAgentSdkVersion: string,
): Outcome<void> {
  for (const [nodeId, plan] of nodePlans) {
    const agentStepConfig = readAgentStepConfig(plan.config);
    if (agentStepConfig === undefined) {
      continue;
    }

    const sdkVersion = validateSdkVersionMatch(plan.descriptor.sdkVersionPin, installedAgentSdkVersion);
    if (sdkVersion.kind === 'error') {
      return { kind: 'error', message: `A(z) ${nodeId} node providere: ${sdkVersion.message}` };
    }

    const capabilities = validateAgentStepCapabilities(agentStepConfig, plan.descriptor);
    if (capabilities.status === 'failed') {
      return { kind: 'error', message: `A(z) ${nodeId} node: ${capabilities.errorMessage}` };
    }
  }

  return { kind: 'ok', value: undefined };
}
