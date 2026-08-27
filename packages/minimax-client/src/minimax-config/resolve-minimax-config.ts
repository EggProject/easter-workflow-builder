import { readBaseUrl, readTimeoutMs, type EnvironmentReader } from '@easter-workflow-builder/env-reader';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/result';
import { DEFAULT_MINIMAX_BASE_URL, DEFAULT_MINIMAX_TIMEOUT_MS } from './default-config-value.ts';
import { ENV_MINIMAX_API_KEY, ENV_MINIMAX_BASE_URL, ENV_MINIMAX_TIMEOUT_MS } from './environment-variable-name.ts';
import type { MiniMaxConfig } from './minimax-config.ts';

/**
 * A MiniMax hívás konfigurációjának feloldása. Az API kulcs mindig a
 * `MINIMAX_API_KEY` változóból érkezik: a kereső és a képértelmező eszköz
 * ugyanazt a kulcsot használja, a saját mérés szerint (SPEC-002 5.10 szekció).
 * Hiányzó kulcs esetén nem kivétel keletkezik, hanem hibaág, aminek a szövege
 * megmondja az agentnek, melyik változót kell beállítani.
 */
export function resolveMiniMaxConfig(environment: EnvironmentReader): Outcome<MiniMaxConfig> {
  const apiKey = environment[ENV_MINIMAX_API_KEY];
  if (apiKey === undefined || apiKey.trim().length === 0) {
    return {
      kind: 'error',
      message: `Nincs beállítva a(z) ${ENV_MINIMAX_API_KEY} környezeti változó, ezért ez az eszköz most nem használható. Kérd meg a felhasználót, hogy állítsa be, vagy oldd meg a feladatot másik eszközzel.`,
    };
  }
  const timeout = readTimeoutMs(environment, ENV_MINIMAX_TIMEOUT_MS, DEFAULT_MINIMAX_TIMEOUT_MS);
  if (!isOkOutcome(timeout)) {
    return timeout;
  }
  return {
    kind: 'ok',
    value: {
      apiKey: apiKey.trim(),
      baseUrl: readBaseUrl(environment, ENV_MINIMAX_BASE_URL, DEFAULT_MINIMAX_BASE_URL),
      timeoutMs: timeout.value,
    },
  };
}
