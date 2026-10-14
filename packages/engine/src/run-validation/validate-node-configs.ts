import type { Outcome } from '@easter-workflow-builder/core';
import { isNodeConfig } from '@easter-workflow-builder/db';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import type { WellFormedNodeConfig } from './well-formed-node-config.ts';

/**
 * A SPEC-004 4.7 táblázat 8. sora: "minden node configja illeszkedik a saját
 * típusára", különben `malformed_node_config`.
 *
 * Két feltétel, mert az illeszkedés kétirányú (SPEC-003 4.3): a `config`
 * oszlop tartalma önmagában érvényes `NodeConfig` kell legyen (ezt a `db`
 * csomag `isNodeConfig` guardja dönti el, nem írjuk újra), **és** a config
 * diszkriminátora ugyanaz a `NodeType` érték kell legyen, mint a node saját
 * `type` mezője. A második feltétel nélkül egy `branch` node hordozhatna
 * érvényes `loop` configot.
 *
 * Harmadik feltétel: a `join` módja ki van választva. A `mode: null` ág
 * (SPEC-008 5.4, O-33) tárolható és a `db` guardján átmegy, a futás viszont
 * nem indulhat vele, ezért ugyanaz a hibaosztály utasítja el (user döntés
 * 2026-10-14).
 *
 * A sikeres ág a szűkített configokat adja vissza node azonosító szerint
 * (`WellFormedNodeConfig`): a guard és a módvizsgálat úgyis elvégezte a
 * szűkítést, ezért az eredményt eldobni és később újra kiszámolni felesleges
 * lenne (`ValidatedRun.nodeConfigsById`).
 */
export function validateNodeConfigs(graph: ExecutableGraph): Outcome<ReadonlyMap<string, WellFormedNodeConfig>> {
  const configsById = new Map<string, WellFormedNodeConfig>();

  for (const node of graph.nodesById.values()) {
    const { config } = node;
    if (!isNodeConfig(config)) {
      return {
        kind: 'error',
        message: formatEngineErrorMessage(
          'malformed_node_config',
          `A(z) ${node.id} node configja nem érvényes node config`,
        ),
      };
    }
    if (config.type !== node.type) {
      return {
        kind: 'error',
        message: formatEngineErrorMessage(
          'malformed_node_config',
          `A(z) ${node.id} node típusa ${node.type}, a configjáé viszont ${config.type}`,
        ),
      };
    }
    if (config.type === 'join' && config.mode === null) {
      return {
        kind: 'error',
        message: formatEngineErrorMessage('malformed_node_config', `A(z) ${node.id} join node módja nincs kiválasztva`),
      };
    }
    configsById.set(node.id, config);
  }

  return { kind: 'ok', value: configsById };
}
