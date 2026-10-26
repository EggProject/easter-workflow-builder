import { describe, expect, it } from 'vitest';
import {
  isProviderId,
  type DisallowedEnvironmentRequirement,
  type EnvironmentRequirement,
} from '@easter-workflow-builder/provider-capability';
import { providerRegistry } from '@easter-workflow-builder/provider-registry';

/**
 * A "minden lépés csak a saját providere titkait kapja" szabály (SPEC-012 3.2
 * O-5, 7.) sodródás elleni védelme. A szabály nem futásidejű gyűjtés, hanem a
 * leírók adata: egy provider tiltott listája tartalmazza a másik provider
 * minden `secret: true` követelményének nevét, kivéve a saját `requiredEnv[]`
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
  return descriptor.requiredEnv.filter((requirement) => requirement.secret).map((requirement) => requirement.name);
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

  it('a szabály nem üres: a minimax titka az ANTHROPIC_AUTH_TOKEN, a claude-subscription listáján áll', () => {
    expect(secretNamesOf(providerRegistry.minimax)).toStrictEqual(['ANTHROPIC_AUTH_TOKEN']);
    expect(providerRegistry['claude-subscription'].disallowedEnv.map((entry) => entry.name)).toContain(
      'ANTHROPIC_AUTH_TOKEN',
    );
  });

  it('a függvény tényleg jelzi a hiányzó védelmet: tiltott lista nélkül a másik titka védtelen', () => {
    const withoutProtection = { ...providerRegistry['claude-subscription'], disallowedEnv: [] };
    expect(unprotectedSecretNames(withoutProtection, providerRegistry.minimax)).toStrictEqual(['ANTHROPIC_AUTH_TOKEN']);
  });
});
