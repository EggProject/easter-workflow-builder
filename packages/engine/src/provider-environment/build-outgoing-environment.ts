import type { Outcome } from '@easter-workflow-builder/core';
import type {
  DisallowedEnvironmentRequirement,
  EnvironmentRequirement,
} from '@easter-workflow-builder/provider-capability';
import type { ProcessEnvironmentPort } from '../engine-port/process-environment-port.ts';
import { buildProviderEnvironmentBlock } from './build-provider-environment-block.ts';

/**
 * A lépés és a kapcsolat teszt kimenő `Options.env` objektuma (SPEC-012 3.1,
 * user döntés 2026-10-26: "Teljes környezet, tiltott változók nélkül").
 *
 * Megadott `env` mellett az alfolyamat környezete pontosan ez az objektum
 * (research 3., M-143), ezért a `PATH` és a `HOME` is csak innen juthat el.
 * Három lépés, ebben a sorrendben:
 *
 * 1. **Alap:** a szerver folyamat teljes környezete (`readAll`).
 * 2. **Szűrés:** a provider `disallowedEnv[]` minden neve kikerül.
 * 3. **Ráírás:** a `requiredEnv[]` blokkja (`buildProviderEnvironmentBlock`)
 *    felülírja az alapot. A tiltott név a ráírásban sem jelenhet meg, azt a
 *    blokk összeállítása már kizárja.
 * 4. **Az auto memory kikapcsolása** (SPEC-009 7.1, O-39): a
 *    `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` a ráírás UTÁN kerül a blokkba, tehát
 *    a szerver környezetében álló más érték nem nyer. A `settingSources: []`
 *    az auto memoryt nem kapcsolja ki, a hivatalos izolációs recept a kettőt
 *    együtt írja elő (`docs/research/2026-10-26-spec-009-forrasok.md` 8.
 *    szekció). A lépés és a kapcsolat teszt is ezen az úton kapja.
 *
 * Az eredmény értékei titkot is hordozhatnak: eseménybe, naplóba és
 * hibaüzenetbe nem kerülhetnek (a hibaág kizárólag a változó nevét adja).
 */
export function buildOutgoingEnvironment(
  requiredEnvironment: readonly EnvironmentRequirement[],
  disallowedEnvironment: readonly DisallowedEnvironmentRequirement[],
  processEnvironment: ProcessEnvironmentPort,
): Outcome<Readonly<Record<string, string>>> {
  const environmentBlock = buildProviderEnvironmentBlock(
    requiredEnvironment,
    disallowedEnvironment,
    processEnvironment,
  );

  if (environmentBlock.kind === 'error') {
    return environmentBlock;
  }

  const disallowedNames = new Set(disallowedEnvironment.map((requirement) => requirement.name));
  const filteredBase = Object.entries(processEnvironment.readAll()).filter(([name]) => !disallowedNames.has(name));

  return {
    kind: 'ok',
    value: { ...Object.fromEntries(filteredBase), ...environmentBlock.value, CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' },
  };
}
