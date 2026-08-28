import type { Outcome } from '@easter-workflow-builder/core';
import type {
  DisallowedEnvironmentRequirement,
  EnvironmentRequirement,
} from '@easter-workflow-builder/provider-capability';
import type { ProcessEnvironmentPort } from '../engine-port/process-environment-port.ts';
import { resolveRequiredEnvironmentValue } from './resolve-required-environment-value.ts';

/**
 * A lépés kimenő `Options.env` blokkjának összeállítása (SPEC-004 11.3
 * táblázat 10. és 11. sora, PLAN-005 T-005-14).
 *
 * A `disallowedEnv[]` neve **sosem** kerülhet be a kimenő blokkba: ez akkor is
 * igaz, ha egy név véletlenül a `requiredEnv[]` listában is szerepelne (ez
 * utóbbi eset egy védekező ellenőrzés, valós leíróban nem várt). A kizárás
 * ezért a feloldás **előtt** történik, hogy a tiltott, de hiányzó változóra se
 * fusson port olvasás és se adjon `missing_provider_env` hibát.
 */
export function buildProviderEnvironmentBlock(
  requiredEnvironment: readonly EnvironmentRequirement[],
  disallowedEnvironment: readonly DisallowedEnvironmentRequirement[],
  processEnvironment: ProcessEnvironmentPort,
): Outcome<Readonly<Record<string, string>>> {
  const disallowedNames = new Set(disallowedEnvironment.map((requirement) => requirement.name));
  const environmentBlock: Record<string, string> = {};

  for (const requirement of requiredEnvironment) {
    if (disallowedNames.has(requirement.name)) {
      continue;
    }

    const resolved = resolveRequiredEnvironmentValue(requirement, processEnvironment);

    if (resolved.kind === 'error') {
      return resolved;
    }

    environmentBlock[requirement.name] = resolved.value;
  }

  return { kind: 'ok', value: environmentBlock };
}
