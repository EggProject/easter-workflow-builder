import { describe, expect, it } from 'vitest';
import {
  acceptedEnvironmentNames,
  isProviderId,
  type DisallowedEnvironmentRequirement,
  type EnvironmentRequirement,
} from '@easter-workflow-builder/provider-capability';
import { providerRegistry } from '@easter-workflow-builder/provider-registry';

/**
 * A "minden lépés csak a saját providere titkait kapja" szabály (SPEC-012 3.2
 * O-5, 7.) sodródás elleni védelme. A szabály nem futásidejű gyűjtés, hanem a
 * leírók adata: egy provider tiltott listája tartalmazza a másik provider
 * minden `secret: true` követelményének minden elfogadott bemeneti nevét (a
 * `name` és az `alternativeNames`, SPEC-013 4.5), kivéve a saját `requiredEnv[]`
 * neveit. A két leíró egyszerre csak az `apps/server` csomagban látszik.
 *
 * **Ennek a mappának szándékosan nincs futásidejű forrásfájlja**
 * (`.claude/CLAUDE.md` 5. szekció, megvalósítás nélküli regressziós teszt),
 * és a szabály futásidejű ágat nem hoz. Egy új provider vagy egy új titok
 * felvétele ezen a teszten bukik, amíg a tiltott listák nem követik.
 */

interface EnvironmentHolder {
  readonly requiredEnv: readonly EnvironmentRequirement[];
  readonly disallowedEnv: readonly DisallowedEnvironmentRequirement[];
}

function secretNamesOf(descriptor: EnvironmentHolder): readonly string[] {
  return descriptor.requiredEnv
    .filter((requirement) => requirement.secret)
    .flatMap((requirement) => acceptedEnvironmentNames(requirement));
}

function unprotectedSecretNames(
  protectedProvider: EnvironmentHolder,
  otherProvider: EnvironmentHolder,
): readonly string[] {
  const disallowedNames = new Set(protectedProvider.disallowedEnv.map((entry) => entry.name));
  const ownNames = new Set(protectedProvider.requiredEnv.map((requirement) => requirement.name));
  return secretNamesOf(otherProvider).filter((name) => !disallowedNames.has(name) && !ownNames.has(name));
}

const providerIds = Object.keys(providerRegistry).filter(isProviderId);

const orderedPairs = providerIds.flatMap((protectedId) =>
  providerIds.filter((otherId) => otherId !== protectedId).map((otherId) => [protectedId, otherId] as const),
);

describe('a másik provider titkai kikerülnek a kimenő környezetből', () => {
  it.each(orderedPairs)('%s lépése nem kapja meg a(z) %s titkait', (protectedId, otherId) => {
    expect(unprotectedSecretNames(providerRegistry[protectedId], providerRegistry[otherId])).toStrictEqual([]);
  });

  it('a szabály nem üres: a minimax titka mindkét néven, mindkettő a claude-subscription listáján áll', () => {
    expect(secretNamesOf(providerRegistry.minimax)).toStrictEqual(['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY']);
    const disallowedNames = providerRegistry['claude-subscription'].disallowedEnv.map((entry) => entry.name);
    expect(disallowedNames).toContain('ANTHROPIC_AUTH_TOKEN');
    expect(disallowedNames).toContain('ANTHROPIC_API_KEY');
  });

  it('a függvény tényleg jelzi a hiányzó védelmet: tiltott lista nélkül a másik titka védtelen', () => {
    const withoutProtection = { ...providerRegistry['claude-subscription'], disallowedEnv: [] };
    expect(unprotectedSecretNames(withoutProtection, providerRegistry.minimax)).toStrictEqual([
      'ANTHROPIC_AUTH_TOKEN',
      'ANTHROPIC_API_KEY',
    ]);
  });

  it.each(['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY'])(
    'bukik, ha a(z) %s kikerül a claude-subscription tiltott listájáról (SPEC-013 AC11)',
    (name) => {
      const descriptor = providerRegistry['claude-subscription'];
      const weakened = {
        ...descriptor,
        disallowedEnv: descriptor.disallowedEnv.filter((entry) => entry.name !== name),
      };
      expect(unprotectedSecretNames(weakened, providerRegistry.minimax)).toStrictEqual([name]);
    },
  );
});
