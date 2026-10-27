/* eslint-disable unicorn/no-null -- a `ProcessEnvironmentPort.read` szerződése `string | null`, ahol a `null` a beállítatlan env változót jelenti, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { EnvironmentRequirement } from '@easter-workflow-builder/provider-capability';
import type { ProcessEnvironmentPort } from '../engine-port/process-environment-port.ts';
import { resolveRequiredEnvironmentValue } from './resolve-required-environment-value.ts';

const FAKE_EVIDENCE = [{ kind: 'measurement', id: 'M-99' }] as const;

function buildProcessEnvironment(values: Readonly<Record<string, string>>): ProcessEnvironmentPort {
  return {
    read: (name) => values[name] ?? null,
    readAll: () => values,
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

  describe('process_env_alternatives forrás (SPEC-013 4.4)', () => {
    const requirement: EnvironmentRequirement = {
      name: 'ANTHROPIC_AUTH_TOKEN',
      source: 'process_env_alternatives',
      alternativeNames: ['ANTHROPIC_API_KEY'],
      secret: true,
      purpose: 'fake purpose',
      evidence: FAKE_EVIDENCE,
    };

    it('csak a name áll: annak az értékét adja', () => {
      expect(
        resolveRequiredEnvironmentValue(requirement, buildProcessEnvironment({ ANTHROPIC_AUTH_TOKEN: 'elso-ertek' })),
      ).toStrictEqual({ kind: 'ok', value: 'elso-ertek' });
    });

    it('csak az alternatív név áll: annak az értékét adja', () => {
      expect(
        resolveRequiredEnvironmentValue(requirement, buildProcessEnvironment({ ANTHROPIC_API_KEY: 'masodik-ertek' })),
      ).toStrictEqual({ kind: 'ok', value: 'masodik-ertek' });
    });

    it('mindkettő áll: a name nyer (SPEC-013 4.3)', () => {
      expect(
        resolveRequiredEnvironmentValue(
          requirement,
          buildProcessEnvironment({ ANTHROPIC_AUTH_TOKEN: 'elso-ertek', ANTHROPIC_API_KEY: 'masodik-ertek' }),
        ),
      ).toStrictEqual({ kind: 'ok', value: 'elso-ertek' });
    });

    it('egyik sem áll: missing_provider_env, minden névvel, érték nélkül', () => {
      const result = resolveRequiredEnvironmentValue(
        requirement,
        buildProcessEnvironment({ MAS: 'fake-secret-value' }),
      );

      expect(result).toStrictEqual({
        kind: 'error',
        message:
          'A(z) ANTHROPIC_AUTH_TOKEN vagy ANTHROPIC_API_KEY kötelező provider env változó nincs beállítva (missing_provider_env).',
      });
      expect(result.kind === 'error' ? result.message : '').not.toMatch(/fake-secret-value/);
    });
  });
});
