import type { Outcome } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ExecutableNodeConfig } from './executable-node-config.ts';

/**
 * A SPEC-004 4.2 szekció fenntartott `branch_key` értékei, szó szerint: a
 * `loop` node két ága, a `human_approval` két döntési iránya, az
 * `error_handler` kimerülési ága és a minden node-on megengedett hibaág.
 *
 * A lista nem bővíthető megfontolás nélkül: minden tag egy olyan kulcs, aminek
 * a jelentését a motor maga adja, tehát egy `branch` node ugyanilyen nevű
 * kimenete a futásidejű élaktiválást tenné kétértelművé.
 */
const RESERVED_BRANCH_KEYS: ReadonlySet<string> = new Set([
  'continue',
  'exit',
  'approved',
  'rejected',
  'exhausted',
  'on_error',
]);

/**
 * A SPEC-004 4.2 szekció záró bekezdése: "Egy `branch` node `branches[].key`
 * értéke nem ütközhet ezekkel, különben a validáció
 * `reserved_branch_key_misuse` hibával elutasít."
 *
 * Ez **nem** a 4.7 táblázat sora, hanem a 4.2 szekció önálló szabálya, ezért
 * áll külön függvényben. Az ellenőrzés a config `branches[]` listáján megy, nem
 * az éleken: egy fenntartott kulcs akkor is tiltott, ha még egyetlen él sem
 * hivatkozik rá.
 */
export function validateReservedBranchKeys(configsById: ReadonlyMap<string, ExecutableNodeConfig>): Outcome<void> {
  for (const [nodeId, config] of configsById) {
    if (config.type !== 'branch') {
      continue;
    }
    for (const option of config.branches) {
      if (RESERVED_BRANCH_KEYS.has(option.key)) {
        return {
          kind: 'error',
          message: formatEngineErrorMessage(
            'reserved_branch_key_misuse',
            `A(z) ${nodeId} branch node ${option.key} kulcsa fenntartott branch_key érték`,
          ),
        };
      }
    }
  }

  return { kind: 'ok', value: undefined };
}
