import type { Outcome } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ExecutableNodeConfig } from '../run-validation/executable-node-config.ts';

/**
 * A futás bemenetének ellenőrzése a `start` node `inputFields` listája ellen
 * (SPEC-004 4.8 4. lépés): "minden `required: true` mezőnek szerepelnie kell,
 * különben `missing_required_input`".
 *
 * **Ez a lépés nem ír adatot** (4.8 zárómondata: az 1 ... 5. lépés egyetlen
 * adatot sem ír), tehát egy hiányzó kötelező mező soha nem hoz létre
 * `workflow_run` sort.
 *
 * **A `undefined` érték hiányzó mezőnek számít.** A bemenet
 * `Record<string, unknown>`, amiben egy kulcs jelen lehet `undefined`
 * értékkel; a spec "szerepelnie kell" fordulata az értékre vonatkozik, nem a
 * kulcs puszta jelenlétére, és egy `undefined` érték a kifejezés és a sablon
 * porton ugyanúgy "nincs érték" jelentésű, mint a hiányzó kulcs. Így nem
 * keletkezik két, egymástól alig megkülönböztethető hibaág sem.
 *
 * **Miért a térképet és a `startNodeId`-t kapja, nem a kész configot.** A
 * `start` node configját a hívó úgyis a `ValidatedRun` térképéből venné ki, és
 * a kivétel két olyan ágat szülne nála (nincs bejegyzés, illetve nem `start`
 * típusú), aminek a hibaosztálya (`invalid_start_node`, 4.7 táblázat 1. sora)
 * ehhez az ellenőrzéshez tartozik. Mindkét ág elérhető és tesztelhető, mert a
 * függvény önmagában hívható tetszőleges térképpel.
 */
export function validateRunInput(
  nodeConfigsById: ReadonlyMap<string, ExecutableNodeConfig>,
  startNodeId: string,
  input: Readonly<Record<string, unknown>>,
): Outcome<void> {
  const config = nodeConfigsById.get(startNodeId);
  if (config?.type !== 'start') {
    return {
      kind: 'error',
      message: formatEngineErrorMessage(
        'invalid_start_node',
        `A(z) ${startNodeId} azonosítóhoz nem tartozik start típusú node config`,
      ),
    };
  }

  for (const field of config.inputFields) {
    if (field.required && input[field.name] === undefined) {
      return {
        kind: 'error',
        message: formatEngineErrorMessage(
          'missing_required_input',
          `A futás bemenetéből hiányzik a(z) "${field.name}" kötelező mező`,
        ),
      };
    }
  }

  return { kind: 'ok', value: undefined };
}
