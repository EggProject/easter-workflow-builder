import type { EnvironmentReader } from '@easter-workflow-builder/core';
import { acceptedEnvironmentNames, type EnvironmentRequirement } from '@easter-workflow-builder/provider-capability';
import { providerRegistry } from '@easter-workflow-builder/provider-registry';

function collectSecretEnvironmentNamesFor(requiredEnvironment: readonly EnvironmentRequirement[]): readonly string[] {
  return requiredEnvironment
    .filter((requirement) => requirement.secret)
    .flatMap((requirement) => acceptedEnvironmentNames(requirement));
}

/**
 * A két rögzített provider leírójának `requiredEnv` listájából a titkot
 * hordozó (`secret: true`) bejegyzések minden elfogadott bemeneti nevének
 * ÉRTÉKE, a jelenlegi process env-ből olvasva (SPEC-006 7.4 2. pont, SPEC-013
 * 4.6: egy `ANTHROPIC_API_KEY` néven érkezett kulcs is maszkolt). A logger ezt kapja `secretValues` gyanánt,
 * hogy egy hibaüzenet SZÖVEGÉBEN megjelenő titkot is kimaszkoljon, nem csak a
 * `redact` mezőnév alapú útvonalakat. A két provider közvetlenül, névvel
 * címzett - nem `Object.keys` iteráció -, mert a `.claude/CLAUDE.md` 9.
 * szekciója szerint pontosan kettő van, és egy generikus iteráció felett egy
 * típusőr sosem futó hamis ágat adna (`.claude/CLAUDE.md` 5. szekció).
 */
export function collectSecretEnvironmentValues(environment: EnvironmentReader): readonly string[] {
  const secretNames = [
    ...collectSecretEnvironmentNamesFor(providerRegistry['claude-subscription'].requiredEnv),
    ...collectSecretEnvironmentNamesFor(providerRegistry.minimax.requiredEnv),
  ];

  const values: string[] = [];
  for (const name of secretNames) {
    const value = environment[name];
    if (value !== undefined) {
      values.push(value);
    }
  }
  return values;
}
