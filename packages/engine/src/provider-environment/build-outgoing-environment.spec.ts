/* eslint-disable unicorn/no-null -- a `ProcessEnvironmentPort.read` szerződése `string | null`, ahol a `null` a beállítatlan env változót jelenti, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type {
  DisallowedEnvironmentRequirement,
  EnvironmentRequirement,
} from '@easter-workflow-builder/provider-capability';
import type { ProcessEnvironmentPort } from '../engine-port/process-environment-port.ts';
import { buildOutgoingEnvironment } from './build-outgoing-environment.ts';

const FAKE_EVIDENCE = [{ kind: 'measurement', id: 'M-99' }] as const;

function buildProcessEnvironment(values: Readonly<Record<string, string>>): ProcessEnvironmentPort {
  return {
    read: (name) => values[name] ?? null,
    readAll: () => values,
  };
}

function buildLiteral(name: string, literalValue: string): EnvironmentRequirement {
  return { name, source: 'literal', literalValue, secret: false, purpose: 'fake', evidence: FAKE_EVIDENCE };
}

function buildPassthrough(name: string): EnvironmentRequirement {
  return { name, source: 'process_env_passthrough', secret: true, purpose: 'fake', evidence: FAKE_EVIDENCE };
}

function buildDisallowed(name: string): DisallowedEnvironmentRequirement {
  return { name, reason: 'fake reason', evidence: FAKE_EVIDENCE };
}

describe('buildOutgoingEnvironment', () => {
  it('alapként a folyamat teljes környezetét adja: a PATH és a HOME átmegy (SPEC-012 2.1 hiba)', () => {
    const result = buildOutgoingEnvironment([], [], buildProcessEnvironment({ PATH: '/usr/bin', HOME: '/home/teszt' }));

    expect(result).toStrictEqual({ kind: 'ok', value: { PATH: '/usr/bin', HOME: '/home/teszt' } });
  });

  it('a disallowedEnv minden neve kikerül az alapból, a többi változó megmarad', () => {
    const result = buildOutgoingEnvironment(
      [],
      [buildDisallowed('ANTHROPIC_API_KEY'), buildDisallowed('NINCS_A_KORNYEZETBEN')],
      buildProcessEnvironment({ PATH: '/usr/bin', ANTHROPIC_API_KEY: 'nem-jut-ki', CLAUDE_CODE_OAUTH_TOKEN: 'atmegy' }),
    );

    expect(result).toStrictEqual({ kind: 'ok', value: { PATH: '/usr/bin', CLAUDE_CODE_OAUTH_TOKEN: 'atmegy' } });
  });

  it('a requiredEnv blokkja felülírja az alapot, a literál a környezetben álló más értéket is', () => {
    const result = buildOutgoingEnvironment(
      [buildLiteral('ANTHROPIC_BASE_URL', 'https://szallito.example'), buildPassthrough('ANTHROPIC_AUTH_TOKEN')],
      [],
      buildProcessEnvironment({
        PATH: '/usr/bin',
        ANTHROPIC_BASE_URL: 'https://mas.example',
        ANTHROPIC_AUTH_TOKEN: 'kulcs-ertek',
      }),
    );

    expect(result).toStrictEqual({
      kind: 'ok',
      value: { PATH: '/usr/bin', ANTHROPIC_BASE_URL: 'https://szallito.example', ANTHROPIC_AUTH_TOKEN: 'kulcs-ertek' },
    });
  });

  it('a tiltott és kötelező ütközésnél a tiltott név a ráírásban sem jelenik meg', () => {
    const result = buildOutgoingEnvironment(
      [buildLiteral('MAX_THINKING_TOKENS', '0')],
      [buildDisallowed('MAX_THINKING_TOKENS')],
      buildProcessEnvironment({ MAX_THINKING_TOKENS: '10', PATH: '/usr/bin' }),
    );

    expect(result).toStrictEqual({ kind: 'ok', value: { PATH: '/usr/bin' } });
  });

  it('hiányzó kötelező változóra a hibaág kizárólag a nevet adja, a környezet értékeit nem', () => {
    const result = buildOutgoingEnvironment(
      [buildPassthrough('ANTHROPIC_AUTH_TOKEN')],
      [],
      buildProcessEnvironment({ TITKOS_MASIK: 'titkos-ertek' }),
    );

    expect(result).toStrictEqual({
      kind: 'error',
      message: 'A(z) ANTHROPIC_AUTH_TOKEN kötelező provider env változó nincs beállítva (missing_provider_env).',
    });
  });

  it('üres környezetre és üres leíróra üres objektumot ad', () => {
    expect(buildOutgoingEnvironment([], [], buildProcessEnvironment({}))).toStrictEqual({ kind: 'ok', value: {} });
  });

  it('alternatív bemeneti névből a kimenetben csak a name áll, a tiltott alternatív név nem (SPEC-013 4.2)', () => {
    const result = buildOutgoingEnvironment(
      [
        {
          name: 'ANTHROPIC_AUTH_TOKEN',
          source: 'process_env_alternatives',
          alternativeNames: ['ANTHROPIC_API_KEY'],
          secret: true,
          purpose: 'fake',
          evidence: FAKE_EVIDENCE,
        },
      ],
      [buildDisallowed('ANTHROPIC_API_KEY')],
      buildProcessEnvironment({ PATH: '/usr/bin', ANTHROPIC_API_KEY: 'kulcs-ertek' }),
    );

    expect(result).toStrictEqual({ kind: 'ok', value: { PATH: '/usr/bin', ANTHROPIC_AUTH_TOKEN: 'kulcs-ertek' } });
  });
});
