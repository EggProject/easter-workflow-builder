import type { Outcome } from '@easter-workflow-builder/core';
import type { EnvironmentRequirement } from '@easter-workflow-builder/provider-capability';
import type { ProcessEnvironmentPort } from '../engine-port/process-environment-port.ts';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';

/**
 * Egyetlen `requiredEnv` bejegyzés feloldása (SPEC-004 11.3 táblázat 10. sora,
 * leíró mező: `requiredEnv[]`): `literal` forrásnál a leíró `literalValue`
 * mezőjét adja, `process_env_passthrough` forrásnál a `processEnvironment`
 * port olvasott értékét.
 *
 * Ha a port `null`-t ad (a változó nincs beállítva), `missing_provider_env`
 * hibát ad. A hibaüzenet **kizárólag a változó nevét** tartalmazza, sosem az
 * értékét, `secret: false` esetén sem (SPEC-004 17. szekció 33. és 64.
 * kritérium).
 *
 * **A `literal` ágnak nincs hiányzó érték esete.** Az `EnvironmentRequirement`
 * a `source` mezőn diszkriminált unió, és a `literal` ágon a `literalValue`
 * kötelező, tehát itt nincs mit ellenőrizni. A korábbi, üres stringre eső ág
 * típusilag sosem futhatott volna le, ezért a javítás a típus szűkítése volt,
 * nem egy futásidejű hibaág (`.claude/CLAUDE.md` 5. szekció).
 */
export function resolveRequiredEnvironmentValue(
  requirement: EnvironmentRequirement,
  processEnvironment: ProcessEnvironmentPort,
): Outcome<string> {
  if (requirement.source === 'literal') {
    return { kind: 'ok', value: requirement.literalValue };
  }

  const value = processEnvironment.read(requirement.name);

  if (value === null) {
    return {
      kind: 'error',
      message: formatEngineErrorMessage(
        'missing_provider_env',
        `A(z) ${requirement.name} kötelező provider env változó nincs beállítva`,
      ),
    };
  }

  return { kind: 'ok', value };
}
