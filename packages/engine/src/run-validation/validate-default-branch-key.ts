import type { Outcome } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ExecutableNodeConfig } from './executable-node-config.ts';

/**
 * A SPEC-004 4.7 táblázat 6. sora: "a `defaultBranchKey`, ha nem `null`,
 * szerepel a `branches[]` listában", különben `branch_key_unknown`.
 *
 * Ugyanaz a hibaosztály, mint az 5. soré (`validateBranchEdgeKeys`), de más
 * feltétel, ezért külön sor a táblázatban és külön függvény itt: az 5. sor a
 * **kimenő élek** kulcsát nézi, ez pedig a config saját alapértelmezését. Egy
 * ismeretlen alapértelmezés akkor is hibás, ha egyetlen él sem hivatkozik rá.
 *
 * A `null` a "nincs alapértelmezett ág" állapot, ami megengedett: ilyenkor a
 * kifejezés eredményéhez nem illeszkedő érték a `branch_no_matching_edge`
 * futásidejű hibaága (SPEC-004 5.), nem indítási validációs hiba.
 */
export function validateDefaultBranchKey(configsById: ReadonlyMap<string, ExecutableNodeConfig>): Outcome<void> {
  for (const [nodeId, config] of configsById) {
    if (config.type !== 'branch') {
      continue;
    }
    const { defaultBranchKey } = config;
    if (defaultBranchKey === null) {
      continue;
    }
    if (config.branches.every((option) => option.key !== defaultBranchKey)) {
      return {
        kind: 'error',
        message: formatEngineErrorMessage(
          'branch_key_unknown',
          `A(z) ${nodeId} branch node defaultBranchKey értékét (${defaultBranchKey}) a branches lista nem tartalmazza`,
        ),
      };
    }
  }

  return { kind: 'ok', value: undefined };
}
