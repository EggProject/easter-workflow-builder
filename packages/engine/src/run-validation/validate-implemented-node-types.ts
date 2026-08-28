import type { Outcome } from '@easter-workflow-builder/core';
import type { NodeConfig } from '@easter-workflow-builder/db';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ExecutableNodeConfig } from './executable-node-config.ts';

// A `script` jellegű ágak kiszűrése, típusszintű szűkítéssel. A predikátum
// alak (nem sima logikai függvény) azért kell, hogy a hívó ág a szűkített
// uniót lássa: ez a `Exclude<NodeConfig, ScriptNodeConfig | JoinScriptNodeConfig>`
// futásidejű párja.
function isExecutableNodeConfig(config: NodeConfig): config is ExecutableNodeConfig {
  if (config.type === 'join') {
    return config.mode !== 'script';
  }
  return config.type !== 'script';
}

// A hibaüzenetbe kerülő megnevezés: a `join` node `script` módja és a `script`
// node ugyanazt a hibaosztályt kapja, de nem ugyanaz a két eset.
function describeUnimplemented(config: NodeConfig): string {
  return config.type === 'join' ? 'a join node script módja' : 'a script node típus';
}

/**
 * A SPEC-004 4.7 táblázat 4. sora: "`script` node vagy `join` `script` mód
 * nincs a gráfban", különben `unimplemented_node_type` (F-19).
 *
 * A sikeres ág a típusszintűen szűkített `ExecutableNodeConfig` térképet adja
 * vissza. Ez a lépés termeli a SPEC-004 4.7 "A validáció eredménye típusszintű
 * szűkítés" bekezdésének garanciáját: a végrehajtó diszpécser kimerítő
 * `switch` szerkezetében nincs `script` ág, tehát nem keletkezik logikailag
 * sosem futó kódág.
 *
 * A bemenet a `validateNodeConfigs` kimenete, ezért a sorrend kötött: előbb
 * derül ki, hogy a config **érvényes** (`malformed_node_config`), és csak
 * utána, hogy **végrehajtható**.
 */
export function validateImplementedNodeTypes(
  configsById: ReadonlyMap<string, NodeConfig>,
): Outcome<ReadonlyMap<string, ExecutableNodeConfig>> {
  const executableConfigsById = new Map<string, ExecutableNodeConfig>();

  for (const [nodeId, config] of configsById) {
    if (!isExecutableNodeConfig(config)) {
      return {
        kind: 'error',
        message: formatEngineErrorMessage(
          'unimplemented_node_type',
          `A(z) ${nodeId} node ${describeUnimplemented(config)}, amit az első verzió nem hajt végre`,
        ),
      };
    }
    executableConfigsById.set(nodeId, config);
  }

  return { kind: 'ok', value: executableConfigsById };
}
