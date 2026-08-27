import { describe, expect, it } from 'vitest';
import { DEFAULT_MINIMAX_BASE_URL, DEFAULT_MINIMAX_TIMEOUT_MS } from './default-config-value.ts';
import { ENV_MINIMAX_API_KEY, ENV_MINIMAX_BASE_URL, ENV_MINIMAX_TIMEOUT_MS } from './environment-variable-name.ts';
import { resolveMiniMaxConfig } from './resolve-minimax-config.ts';

describe('resolveMiniMaxConfig', () => {
  it('hibaágat ad, ha a kulcs változó hiányzik', () => {
    const outcome = resolveMiniMaxConfig({}, ENV_MINIMAX_API_KEY);
    if (outcome.kind !== 'error') {
      throw new Error('hibaágat vártunk');
    }
    expect(outcome.message).toContain(ENV_MINIMAX_API_KEY);
  });

  it('hibaágat ad, ha a kulcs változó csak szóközt tartalmaz', () => {
    expect(resolveMiniMaxConfig({ [ENV_MINIMAX_API_KEY]: ' ' }, ENV_MINIMAX_API_KEY).kind).toBe('error');
  });

  it('továbbadja a hibás timeout hibaágát', () => {
    const outcome = resolveMiniMaxConfig(
      { [ENV_MINIMAX_API_KEY]: 'kulcs', [ENV_MINIMAX_TIMEOUT_MS]: 'sok' },
      ENV_MINIMAX_API_KEY,
    );
    expect(outcome.kind).toBe('error');
  });

  it('alapértelmezésekkel oldja fel a konfigurációt', () => {
    expect(resolveMiniMaxConfig({ [ENV_MINIMAX_API_KEY]: ' kulcs ' }, ENV_MINIMAX_API_KEY)).toStrictEqual({
      kind: 'ok',
      value: { apiKey: 'kulcs', baseUrl: DEFAULT_MINIMAX_BASE_URL, timeoutMs: DEFAULT_MINIMAX_TIMEOUT_MS },
    });
  });

  it('figyelembe veszi a felülírásokat', () => {
    const outcome = resolveMiniMaxConfig(
      {
        SAJAT_KULCS: 'abc',
        [ENV_MINIMAX_BASE_URL]: 'https://sajat.example/',
        [ENV_MINIMAX_TIMEOUT_MS]: '1000',
      },
      'SAJAT_KULCS',
    );
    expect(outcome).toStrictEqual({
      kind: 'ok',
      value: { apiKey: 'abc', baseUrl: 'https://sajat.example', timeoutMs: 1000 },
    });
  });
});
