import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isRecord, isString } from '@easter-workflow-builder/typeguards';
import { INSTALLED_AGENT_SDK_VERSION } from './installed-agent-sdk-version.ts';

const SDK_PACKAGE_NAME = '@anthropic-ai/claude-agent-sdk';

/**
 * A csomag saját `package.json` fájljából olvassa ki az SDK pinjét. Az
 * útvonal a teszt fájlhoz képest relatív, nem a futtatás munkakönyvtárához,
 * mert a Vitest a gyökér configból indul (`packages/engine` és `packages/db`
 * tesztjei ugyanígy dolgoznak).
 */
function readPinnedSdkVersion(): string {
  const text = readFileSync(new URL('../../package.json', import.meta.url), 'utf8');
  const parsed: unknown = JSON.parse(text);
  const dependencies = isRecord(parsed) ? parsed['dependencies'] : undefined;
  const pinned = isRecord(dependencies) ? dependencies[SDK_PACKAGE_NAME] : undefined;
  if (!isString(pinned)) {
    throw new Error(`a(z) ${SDK_PACKAGE_NAME} nem szerepel a package.json dependencies mezőjében`);
  }
  return pinned;
}

describe('INSTALLED_AGENT_SDK_VERSION', () => {
  it('megegyezik a package.json-ban pinelt SDK verzióval', () => {
    expect(INSTALLED_AGENT_SDK_VERSION).toBe(readPinnedSdkVersion());
  });

  it('pontos verzió, nem tartomány: se caret, se tilde nincs benne', () => {
    expect(INSTALLED_AGENT_SDK_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
