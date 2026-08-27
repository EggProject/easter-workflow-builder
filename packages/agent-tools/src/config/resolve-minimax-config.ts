import { isOkOutcome, type Outcome } from '@easter-workflow-builder/result';
import { DEFAULT_MINIMAX_BASE_URL, DEFAULT_MINIMAX_TIMEOUT_MS } from './default-config-value.ts';
import type { EnvironmentReader } from './environment-reader.ts';
import { ENV_MINIMAX_BASE_URL, ENV_MINIMAX_TIMEOUT_MS } from './environment-variable-name.ts';
import type { MiniMaxConfig } from './minimax-config.ts';
import { readBaseUrl } from './read-base-url.ts';
import { readTimeoutMs } from './read-timeout-ms.ts';

/**
 * A MiniMax hívás konfigurációjának feloldása. Az API kulcs változó NEVE
 * paraméter, mert a kereső és a képértelmező eszköz külön kulcsot használ.
 * Hiányzó kulcs esetén nem kivétel keletkezik, hanem hibaág, aminek a szövege
 * megmondja az agentnek, melyik változót kell beállítani.
 */
export function resolveMiniMaxConfig(
  environment: EnvironmentReader,
  apiKeyVariableName: string,
): Outcome<MiniMaxConfig> {
  const apiKey = environment[apiKeyVariableName];
  if (apiKey === undefined || apiKey.trim().length === 0) {
    return {
      kind: 'error',
      message: `Nincs beállítva a(z) ${apiKeyVariableName} környezeti változó, ezért ez az eszköz most nem használható. Kérd meg a felhasználót, hogy állítsa be, vagy oldd meg a feladatot másik eszközzel.`,
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
