import type { Outcome } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';

/**
 * A leíró és a telepített SDK verzió egyezése (SPEC-004 11.3 táblázat 17.
 * sora, leíró mező: `sdkVersionPin`):
 *
 * - egyezik: a futás indulhat,
 * - eltér: `provider_descriptor_sdk_mismatch`, és a hibaüzenet **mindkét**
 *   verziót megnevezi (SPEC-004 17. szekció 63. kritérium).
 *
 * A sornak nincs `unknown` ága, mert a `sdkVersionPin` egyszerű szöveg, nem
 * `Fact`.
 *
 * Ez szándékosan blokkoló: a leíró minden `Fact` értéke egy konkrét SDK verzió
 * ellen futtatott mérésből származik, tehát verzióváltás után a mérések újra
 * futtatandók (SPEC-004 16. szekció kockázati táblázata).
 *
 * **Két szöveget hasonlít össze, és semmi mást.** A telepített verzió
 * megállapítása nem ennek a témának a dolga, és nem is lehet az: a motor nem
 * függ az Agent SDK csomagtól (SPEC-004 17. szekció 58. kritérium), tehát nem
 * kérdezheti le. Az érték előállítása a motor összeállításáé, a hívás pedig a
 * futás indítási validációé (`run-validation`, T-005-15).
 */
export function validateSdkVersionMatch(descriptorPin: string, installedVersion: string): Outcome<void> {
  if (descriptorPin === installedVersion) {
    return { kind: 'ok', value: undefined };
  }

  return {
    kind: 'error',
    message: formatEngineErrorMessage(
      'provider_descriptor_sdk_mismatch',
      `A provider leírója a(z) ${descriptorPin} SDK verzióhoz készült, a telepített verzió viszont ${installedVersion}`,
    ),
  };
}
