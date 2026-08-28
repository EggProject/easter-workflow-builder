import type { Outcome } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ExecutableNodeConfig } from './executable-node-config.ts';

/**
 * A SPEC-004 8.2 3. pontja: "A `backoffMs` lista hossza validáláskor legalább
 * `maxAttempts - 1` kell legyen, különben a futás indítása
 * `insufficient_backoff_list` hibával elutasít."
 *
 * **Miért pont `maxAttempts - 1` a küszöb.** A kezelő a `backoffMs[attempt - 1]`
 * elemet olvassa (8.2 3. pont), és csak akkor vár, ha `attempt < maxAttempts`
 * (a 2. pont szerint `attempt >= maxAttempts` esetén már nincs újabb
 * kísérlet). A legnagyobb ténylegesen olvasott index tehát
 * `maxAttempts - 2`, vagyis `maxAttempts - 1` elem elég és kell.
 *
 * **Ismétlési szabályt nem találunk ki**: nincs "az utolsó érték ismétlődik"
 * viselkedés, mert arra nincs forrásunk (8.2 3. pont szó szerint). Ezért ez az
 * ellenőrzés a teljes listát kikényszeríti, és a végrehajtó nem pótol értéket.
 *
 * Ez a 4.7 táblázat tíz során **felüli**, tizenegyedik config szintű
 * ellenőrzés: a szabály nem a 4.7 táblázatban, hanem a 8.2 szekcióban áll,
 * ezért a T-005-15 nem tartalmazta (PLAN-005 T-005-24).
 */
export function validateErrorHandlerBackoff(configsById: ReadonlyMap<string, ExecutableNodeConfig>): Outcome<void> {
  for (const [nodeId, config] of configsById) {
    if (config.type !== 'error_handler') {
      continue;
    }
    const requiredLength = config.maxAttempts - 1;
    if (config.backoffMs.length < requiredLength) {
      return {
        kind: 'error',
        message: formatEngineErrorMessage(
          'insufficient_backoff_list',
          `A(z) ${nodeId} error_handler node backoffMs listája ${String(config.backoffMs.length)} elemű, de a maxAttempts (${String(config.maxAttempts)}) legalább ${String(requiredLength)} elemet igényel`,
        ),
      };
    }
  }

  return { kind: 'ok', value: undefined };
}
