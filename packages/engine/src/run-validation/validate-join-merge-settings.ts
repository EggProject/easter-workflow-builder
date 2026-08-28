import type { Outcome } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ExecutableNodeConfig } from './executable-node-config.ts';

/**
 * A SPEC-004 4.7 táblázat 10. sora: "a `join` `merge` módjának `settings`
 * rekordja üres", különben `unsupported_join_merge_setting`.
 *
 * A spec saját indoklása (4.7, "Miért utasítjuk el az ismeretlen `merge`
 * beállítást"): a SPEC-003 4.3 a `merge` mód alobjektumának egyetlen mezőjét
 * sem nevezi meg, és mezőt kitalálni tilos. Ha a motor csendben figyelmen
 * kívül hagyna egy ott álló kulcsot, a felhasználó azt hinné, hogy hat. Ezért
 * az üzenet **megnevezi** az elutasított kulcsokat.
 */
export function validateJoinMergeSettings(configsById: ReadonlyMap<string, ExecutableNodeConfig>): Outcome<void> {
  for (const [nodeId, config] of configsById) {
    if (config.type !== 'join') {
      continue;
    }
    if (config.mode !== 'merge') {
      continue;
    }
    const settingKeys = Object.keys(config.settings);
    if (settingKeys.length > 0) {
      return {
        kind: 'error',
        message: formatEngineErrorMessage(
          'unsupported_join_merge_setting',
          `A(z) ${nodeId} join node merge módja ismeretlen beállítási kulcsot hordoz: ${settingKeys.join(', ')}`,
        ),
      };
    }
  }

  return { kind: 'ok', value: undefined };
}
