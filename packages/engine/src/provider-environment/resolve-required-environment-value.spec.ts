/* eslint-disable unicorn/no-null -- a `ProcessEnvironmentPort.read` szerződése `string | null`, ahol a `null` a beállítatlan env változót jelenti, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { EnvironmentRequirement } from '@easter-workflow-builder/provider-capability';
import type { ProcessEnvironmentPort } from '../engine-port/process-environment-port.ts';
import { resolveRequiredEnvironmentValue } from './resolve-required-environment-value.ts';

const FAKE_EVIDENCE = [{ kind: 'measurement', id: 'M-99' }] as const;

function buildProcessEnvironment(values: Readonly<Record<string, string>>): ProcessEnvironmentPort {
  return {
    read: (name) => values[name] ?? null,
  };
}

describe('resolveRequiredEnvironmentValue', () => {
  it('literal forrásnál a leíró literalValue mezőjét adja', () => {
    const requirement: EnvironmentRequirement = {
      name: 'ANTHROPIC_BASE_URL',
      source: 'literal',
      literalValue: 'https://api.minimax.io/anthropic',
      secret: false,
      purpose: 'fake purpose',
      evidence: FAKE_EVIDENCE,
    };

    expect(resolveRequiredEnvironmentValue(requirement, buildProcessEnvironment({}))).toStrictEqual({
      kind: 'ok',
      value: 'https://api.minimax.io/anthropic',
    });
  });

  it('literal forrásnál, literalValue nélkül üres stringet ad', () => {
    const requirement: EnvironmentRequirement = {
      name: 'FAKE_LITERAL',
      source: 'literal',
      secret: false,
      purpose: 'fake purpose',
      evidence: FAKE_EVIDENCE,
    };

    expect(resolveRequiredEnvironmentValue(requirement, buildProcessEnvironment({}))).toStrictEqual({
      kind: 'ok',
      value: '',
    });
  });

  it('process_env_passthrough forrásnál a processEnvironment port olvasott értékét adja', () => {
    const requirement: EnvironmentRequirement = {
      name: 'ANTHROPIC_AUTH_TOKEN',
      source: 'process_env_passthrough',
      secret: true,
      purpose: 'fake purpose',
      evidence: FAKE_EVIDENCE,
    };

    expect(
      resolveRequiredEnvironmentValue(
        requirement,
        buildProcessEnvironment({ ANTHROPIC_AUTH_TOKEN: 'fake-secret-value' }),
      ),
    ).toStrictEqual({ kind: 'ok', value: 'fake-secret-value' });
  });

  it('process_env_passthrough forrásnál, ha a port null-t ad, missing_provider_env hibát ad, kizárólag a névvel', () => {
    const requirement: EnvironmentRequirement = {
      name: 'ANTHROPIC_AUTH_TOKEN',
      source: 'process_env_passthrough',
      secret: true,
      purpose: 'fake purpose',
      evidence: FAKE_EVIDENCE,
    };

    const result = resolveRequiredEnvironmentValue(requirement, buildProcessEnvironment({}));

    expect(result).toStrictEqual({
      kind: 'error',
      message: 'A(z) ANTHROPIC_AUTH_TOKEN kötelező provider env változó nincs beállítva (missing_provider_env).',
    });
    expect(result.kind === 'error' ? result.message : '').not.toMatch(/fake-secret-value/);
  });
});
