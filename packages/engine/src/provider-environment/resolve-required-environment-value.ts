import type { Outcome } from '@easter-workflow-builder/core';
import { acceptedEnvironmentNames, type EnvironmentRequirement } from '@easter-workflow-builder/provider-capability';
import type { ProcessEnvironmentPort } from '../engine-port/process-environment-port.ts';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';

/**
 * Egyetlen `requiredEnv` bejegyzés feloldása (SPEC-004 11.3 táblázat 10. sora,
 * leíró mező: `requiredEnv[]`): `literal` forrásnál a leíró `literalValue`
 * mezőjét adja, a két process env forrásnál a `processEnvironment` port
 * olvasott értékét. A `process_env_alternatives` forrásnál a nevek az
 * `acceptedEnvironmentNames` sorrendjében, az első beállított nyer (SPEC-013
 * 4.3: a `name` az elsőbbségi).
 *
 * Az üres érték (`ANTHROPIC_AUTH_TOKEN=` egy `.env` sorban) hiányzónak számít,
 * ahogy a `tools/wire-probe` mérő eszközben is (SPEC-013 4.3): különben a
 * kulcs üres Bearer tokenként menne ki, miközben az alternatív név érvényes.
 *
 * Ha egyik név sincs beállítva (a port `null`-t vagy üres értéket ad),
 * `missing_provider_env` hibát ad. A hibaüzenet **kizárólag a változók nevét** tartalmazza, sosem az
 * értéket, `secret: false` esetén sem (SPEC-004 17. szekció 33. és 64.
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

  const names = acceptedEnvironmentNames(requirement);
  for (const name of names) {
    const value = processEnvironment.read(name);
    if (value !== null && value !== '') {
      return { kind: 'ok', value };
    }
  }

  return {
    kind: 'error',
    message: formatEngineErrorMessage(
      'missing_provider_env',
      `A(z) ${names.join(' vagy ')} kötelező provider env változó nincs beállítva`,
    ),
  };
}
