import { findBlankTextField } from './find-blank-text-field.ts';
import type { NodeConfig } from './node-config.ts';
import { REQUIRED_TEXT_FIELD_PATHS } from './required-text-field-paths.ts';

/**
 * A `replaceGraph` írás oldali ellenőrzése (SPEC-008 5.4, O-21): egy node
 * config első üres kötelező szöveg mezőjének útvonala (`branches.0.key`),
 * vagy `undefined`, ha minden kötelező szöveg mező ki van töltve.
 */
export function findBlankRequiredTextField(config: NodeConfig): string | undefined {
  const paths: readonly string[] =
    config.type === 'join' ? REQUIRED_TEXT_FIELD_PATHS.join[config.mode] : REQUIRED_TEXT_FIELD_PATHS[config.type];
  for (const path of paths) {
    const found = findBlankTextField(config, path);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}
