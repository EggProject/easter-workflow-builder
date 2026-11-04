/* eslint-disable unicorn/no-null -- a `ProcessEnvironmentPort.read` szerződése `string | null`, ahol a `null` a beállítatlan env változót jelenti, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import { buildOutgoingEnvironment, type ProcessEnvironmentPort } from '@easter-workflow-builder/engine';
import type { DisallowedEnvironmentRequirement } from '@easter-workflow-builder/provider-capability';
import { providerRegistry } from '@easter-workflow-builder/provider-registry';

/**
 * A két valódi provider leíró kimenő env szabálya (SPEC-012 3.2, 7., AC2, AC3,
 * AC6). A motor csomag a `provider-registry` csomagtól nem függ, a két oldal
 * egyszerre csak az `apps/server` csomagban látszik.
 *
 * **Ennek a mappának szándékosan nincs futásidejű forrásfájlja**
 * (`.claude/CLAUDE.md` 5. szekció, megvalósítás nélküli regressziós teszt).
 * A név táblák tételesek: egy új tiltott név felvétele ezen a teszten bukik,
 * amíg a tábla és a `reason` nem követi.
 */

const CLOUD_SELECTORS = ['CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY'] as const;
const UNVERIFIED_RANK_SELECTORS = ['CLAUDE_CODE_USE_ANTHROPIC_AWS', 'CLAUDE_CODE_USE_MANTLE'] as const;
const OTHER_AUTHENTICATORS = [
  'ANTHROPIC_PROFILE',
  'ANTHROPIC_FEDERATION_RULE_ID',
  'ANTHROPIC_ORGANIZATION_ID',
] as const;

const CLAUDE_SUBSCRIPTION_DISALLOWED = [
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_API_KEY',
  ...CLOUD_SELECTORS,
  ...UNVERIFIED_RANK_SELECTORS,
  ...OTHER_AUTHENTICATORS,
] as const;

const MINIMAX_DISALLOWED = [
  'CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING',
  'CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING',
  'MAX_THINKING_TOKENS',
  'ANTHROPIC_API_KEY',
  'CLAUDE_CODE_OAUTH_TOKEN',
  ...CLOUD_SELECTORS,
  ...UNVERIFIED_RANK_SELECTORS,
  ...OTHER_AUTHENTICATORS,
] as const;

interface DisallowedEntryHolder {
  readonly id: string;
  readonly disallowedEnv: readonly DisallowedEnvironmentRequirement[];
}

function processEnvironmentOf(values: Readonly<Record<string, string>>): ProcessEnvironmentPort {
  return { read: (name) => values[name] ?? null, readAll: () => values };
}

function namesOf(entries: readonly { readonly name: string }[]): ReadonlySet<string> {
  return new Set(entries.map((entry) => entry.name));
}

describe('a claude-subscription kimenő env szabálya', () => {
  const descriptor = providerRegistry['claude-subscription'];

  it('a tiltott nevek pontosan a SPEC-012 3.2 tábla nevei', () => {
    expect(namesOf(descriptor.disallowedEnv)).toStrictEqual(new Set(CLAUDE_SUBSCRIPTION_DISALLOWED));
  });

  it.each(CLAUDE_SUBSCRIPTION_DISALLOWED)('a(z) %s a környezetben állva sem jut ki, a PATH és a HOME igen', (name) => {
    const result = buildOutgoingEnvironment(
      descriptor.requiredEnv,
      descriptor.disallowedEnv,
      processEnvironmentOf({ [name]: 'nem-jut-ki', PATH: '/usr/bin', HOME: '/home/teszt' }),
    );

    expect(result).toStrictEqual({
      kind: 'ok',
      value: { PATH: '/usr/bin', HOME: '/home/teszt', CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' },
    });
  });

  it('a CLAUDE_CODE_OAUTH_TOKEN előfizetéses hitelesítő: átmegy (O-3)', () => {
    const result = buildOutgoingEnvironment(
      descriptor.requiredEnv,
      descriptor.disallowedEnv,
      processEnvironmentOf({ CLAUDE_CODE_OAUTH_TOKEN: 'atmegy', PATH: '/usr/bin' }),
    );

    expect(result).toStrictEqual({
      kind: 'ok',
      value: { CLAUDE_CODE_OAUTH_TOKEN: 'atmegy', PATH: '/usr/bin', CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' },
    });
  });
});

describe('a minimax kimenő env szabálya', () => {
  const descriptor = providerRegistry.minimax;

  it('a tiltott nevek pontosan a SPEC-012 3.2 tábla nevei', () => {
    expect(namesOf(descriptor.disallowedEnv)).toStrictEqual(new Set(MINIMAX_DISALLOWED));
  });

  it.each(MINIMAX_DISALLOWED)('a(z) %s a környezetben állva sem jut ki', (name) => {
    const result = buildOutgoingEnvironment(
      descriptor.requiredEnv,
      descriptor.disallowedEnv,
      processEnvironmentOf({ [name]: 'nem-jut-ki', ANTHROPIC_AUTH_TOKEN: 'kulcs-ertek', PATH: '/usr/bin' }),
    );

    expect(result.kind).toBe('ok');
    expect(result.kind === 'ok' ? Object.hasOwn(result.value, name) : undefined).toBe(false);
  });

  it('az ANTHROPIC_BASE_URL a leíró literálja, a kulcs az ANTHROPIC_AUTH_TOKEN értéke, a PATH és a HOME átmegy', () => {
    const result = buildOutgoingEnvironment(
      descriptor.requiredEnv,
      descriptor.disallowedEnv,
      processEnvironmentOf({
        ANTHROPIC_BASE_URL: 'https://mas.example',
        ANTHROPIC_AUTH_TOKEN: 'kulcs-ertek',
        PATH: '/usr/bin',
        HOME: '/home/teszt',
      }),
    );

    expect(result).toStrictEqual({
      kind: 'ok',
      value: {
        ANTHROPIC_BASE_URL: 'https://api.minimax.io/anthropic',
        ANTHROPIC_AUTH_TOKEN: 'kulcs-ertek',
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
        PATH: '/usr/bin',
        HOME: '/home/teszt',
        CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
      },
    });
  });

  it('csak ANTHROPIC_API_KEY mellett a kulcs ANTHROPIC_AUTH_TOKEN néven megy ki, az ANTHROPIC_API_KEY nem (SPEC-013 AC6)', () => {
    const result = buildOutgoingEnvironment(
      descriptor.requiredEnv,
      descriptor.disallowedEnv,
      processEnvironmentOf({ ANTHROPIC_API_KEY: 'masik-nev-kulcs', PATH: '/usr/bin' }),
    );

    expect(result).toStrictEqual({
      kind: 'ok',
      value: {
        ANTHROPIC_BASE_URL: 'https://api.minimax.io/anthropic',
        ANTHROPIC_AUTH_TOKEN: 'masik-nev-kulcs',
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
        PATH: '/usr/bin',
        CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
      },
    });
  });

  it('mindkét név mellett az ANTHROPIC_AUTH_TOKEN értéke megy ki (SPEC-013 AC7)', () => {
    const result = buildOutgoingEnvironment(
      descriptor.requiredEnv,
      descriptor.disallowedEnv,
      processEnvironmentOf({ ANTHROPIC_AUTH_TOKEN: 'elso', ANTHROPIC_API_KEY: 'masodik' }),
    );

    expect(result.kind === 'ok' ? result.value['ANTHROPIC_AUTH_TOKEN'] : undefined).toBe('elso');
    expect(result.kind === 'ok' ? Object.hasOwn(result.value, 'ANTHROPIC_API_KEY') : undefined).toBe(false);
  });

  it('a kulcs hiányára missing_provider_env hiba, kizárólag a nevekkel (SPEC-013 AC8)', () => {
    const result = buildOutgoingEnvironment(
      descriptor.requiredEnv,
      descriptor.disallowedEnv,
      processEnvironmentOf({ PATH: '/usr/bin' }),
    );

    expect(result).toStrictEqual({
      kind: 'error',
      message:
        'A(z) ANTHROPIC_AUTH_TOKEN vagy ANTHROPIC_API_KEY kötelező provider env változó nincs beállítva (missing_provider_env).',
    });
  });
});

describe('a tiltott bejegyzések bizonyíték kényszere (AC6)', () => {
  const descriptors: readonly DisallowedEntryHolder[] = Object.values(providerRegistry);
  const entries = descriptors.flatMap((descriptor) =>
    descriptor.disallowedEnv.map((entry) => ({ providerId: descriptor.id, entry })),
  );

  it.each(entries.map(({ providerId, entry }) => [providerId, entry.name, entry] as const))(
    '%s: a(z) %s bejegyzésnek van reason és nem üres evidence mezője',
    (_providerId, _name, entry) => {
      expect(entry.reason.length).toBeGreaterThan(0);
      expect(entry.evidence.length).toBeGreaterThan(0);
    },
  );

  it.each(descriptors.map((descriptor) => [descriptor.id, descriptor] as const))(
    '%s: az ANTHROPIC_AWS és a MANTLE választó reason szövege kimondja, hogy a rang nem ellenőrzött',
    (_providerId, descriptor) => {
      const unverifiedNames = new Set<string>(UNVERIFIED_RANK_SELECTORS);
      const unverified = descriptor.disallowedEnv.filter((entry) => unverifiedNames.has(entry.name));

      expect(unverified.map((entry) => entry.name)).toStrictEqual([...UNVERIFIED_RANK_SELECTORS]);
      for (const entry of unverified) {
        expect(entry.reason).toContain('nem ellenőrzött');
      }
    },
  );
});
