import { findBlankTextField } from './find-blank-text-field.ts';
import type { NodeConfig } from './node-config.ts';
import { REQUIRED_TEXT_FIELD_PATHS } from './required-text-field-paths.ts';

function requiredTextFieldPathsOf(config: NodeConfig): readonly string[] {
  if (config.type !== 'join') {
    return REQUIRED_TEXT_FIELD_PATHS[config.type];
  }
  return config.mode === null ? [] : REQUIRED_TEXT_FIELD_PATHS.join[config.mode];
}

/**
 * A `replaceGraph` írás oldali ellenőrzése (SPEC-008 5.4, O-21): egy node
 * config első üres kötelező szöveg mezőjének útvonala (`branches.0.key`),
 * vagy `undefined`, ha minden kötelező szöveg mező ki van töltve. A
 * választatlan `join` (`mode: null`, O-33) átmegy: kötelező szöveg mezője
 * nincs, és a `null` mód elutasítása a `protocol` mentési sémájáé, nem a
 * `db`-é.
 */
export function findBlankRequiredTextField(config: NodeConfig): string | undefined {
  for (const path of requiredTextFieldPathsOf(config)) {
    const found = findBlankTextField(config, path);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}
