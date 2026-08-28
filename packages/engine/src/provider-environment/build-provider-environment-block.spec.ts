/* eslint-disable unicorn/no-null -- a `ProcessEnvironmentPort.read` szerződése `string | null`, ahol a `null` a beállítatlan env változót jelenti, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type {
  DisallowedEnvironmentRequirement,
  EnvironmentRequirement,
} from '@easter-workflow-builder/provider-capability';
import type { ProcessEnvironmentPort } from '../engine-port/process-environment-port.ts';
import { buildProviderEnvironmentBlock } from './build-provider-environment-block.ts';

const FAKE_EVIDENCE = [{ kind: 'measurement', id: 'M-99' }] as const;

function buildProcessEnvironment(values: Readonly<Record<string, string>>): ProcessEnvironmentPort {
  return {
    read: (name) => values[name] ?? null,
  };
}

function buildLiteralRequirement(name: string, literalValue: string): EnvironmentRequirement {
  return {
    name,
    source: 'literal',
    literalValue,
    secret: false,
    purpose: 'fake purpose',
    evidence: FAKE_EVIDENCE,
  };
}

function buildPassthroughRequirement(name: string, isSecret: boolean): EnvironmentRequirement {
  return {
    name,
    source: 'process_env_passthrough',
    secret: isSecret,
    purpose: 'fake purpose',
    evidence: FAKE_EVIDENCE,
  };
}

function buildDisallowed(name: string): DisallowedEnvironmentRequirement {
  return { name, reason: 'fake reason', evidence: FAKE_EVIDENCE };
}

describe('buildProviderEnvironmentBlock', () => {
  it('literal forrású requiredEnv bejegyzésre a literalValue kerül az env blokkba', () => {
    const result = buildProviderEnvironmentBlock(
      [buildLiteralRequirement('ANTHROPIC_BASE_URL', 'https://api.minimax.io/anthropic')],
      [],
      buildProcessEnvironment({}),
    );

    expect(result).toStrictEqual({
      kind: 'ok',
      value: { ANTHROPIC_BASE_URL: 'https://api.minimax.io/anthropic' },
    });
  });

  it('process_env_passthrough forrású requiredEnv bejegyzésre a port értéke kerül az env blokkba', () => {
    const result = buildProviderEnvironmentBlock(
      [buildPassthroughRequirement('ANTHROPIC_AUTH_TOKEN', false)],
      [],
      buildProcessEnvironment({ ANTHROPIC_AUTH_TOKEN: 'fake-token-value' }),
    );

    expect(result).toStrictEqual({ kind: 'ok', value: { ANTHROPIC_AUTH_TOKEN: 'fake-token-value' } });
  });

  it('hiányzó kötelező process env változóra missing_provider_env hibát ad', () => {
    const result = buildProviderEnvironmentBlock(
      [buildPassthroughRequirement('ANTHROPIC_AUTH_TOKEN', false)],
      [],
      buildProcessEnvironment({}),
    );

    expect(result).toStrictEqual({
      kind: 'error',
      message: 'A(z) ANTHROPIC_AUTH_TOKEN kötelező provider env változó nincs beállítva (missing_provider_env).',
    });
  });

  it('a disallowedEnv nevei kimaradnak az env blokkból, még a requiredEnv listával átfedésben is', () => {
    const result = buildProviderEnvironmentBlock(
      [
        buildLiteralRequirement('ANTHROPIC_BASE_URL', 'https://api.minimax.io/anthropic'),
        // Ez a bejegyzés a disallowedEnv listán is szerepel, és hiányzó process
        // env változóra hivatkozik: a kizárásnak a feloldás előtt kell
        // történnie, így ez a hiányzó érték sosem okoz hibát.
        buildPassthroughRequirement('DISALLOWED_AND_MISSING', true),
      ],
      [buildDisallowed('DISALLOWED_AND_MISSING'), buildDisallowed('NOT_IN_REQUIRED_ENV')],
      buildProcessEnvironment({}),
    );

    expect(result).toStrictEqual({
      kind: 'ok',
      value: { ANTHROPIC_BASE_URL: 'https://api.minimax.io/anthropic' },
    });
  });

  it('üres requiredEnv és üres disallowedEnv listán üres env blokkot ad', () => {
    expect(buildProviderEnvironmentBlock([], [], buildProcessEnvironment({}))).toStrictEqual({
      kind: 'ok',
      value: {},
    });
  });

  it('titkos env változóra a sikeres env blokk a tényleges értéket tartalmazza', () => {
    const result = buildProviderEnvironmentBlock(
      [buildPassthroughRequirement('ANTHROPIC_AUTH_TOKEN', true)],
      [],
      buildProcessEnvironment({ ANTHROPIC_AUTH_TOKEN: 'super-secret-value' }),
    );

    expect(result).toStrictEqual({ kind: 'ok', value: { ANTHROPIC_AUTH_TOKEN: 'super-secret-value' } });
  });

  it('titkos env változó hiányára a hibaüzenet kizárólag a nevet tartalmazza, az értéket sosem', () => {
    const result = buildProviderEnvironmentBlock(
      [buildPassthroughRequirement('ANTHROPIC_AUTH_TOKEN', true)],
      [],
      // A port ugyanarra a névre egy másik hívásban titkot adna vissza, de
      // ebben a tesztben a változó hiányzik: a hibaüzenet ekkor sem
      // tartalmazhat semmilyen titok-szerű literált, csak a nevet.
      buildProcessEnvironment({}),
    );

    expect(result.kind).toBe('error');
    const message = result.kind === 'error' ? result.message : '';
    expect(message).toBe(
      'A(z) ANTHROPIC_AUTH_TOKEN kötelező provider env változó nincs beállítva (missing_provider_env).',
    );
    expect(message).not.toMatch(/secret/i);
    expect(message).not.toMatch(/super-secret-value/);
  });
});
