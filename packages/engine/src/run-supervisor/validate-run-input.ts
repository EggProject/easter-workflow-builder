import type { Outcome } from '@easter-workflow-builder/core';
import { isBoolean, isNumber, isString, isStringArray } from '@easter-workflow-builder/typeguards';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ExecutableNodeConfig } from '../run-validation/executable-node-config.ts';

/**
 * A `start` node egy bemeneti mezője (a `valueKind` szerinti unió, SPEC-016 5.1).
 */
type StartInputField = Extract<ExecutableNodeConfig, { readonly type: 'start' }>['inputFields'][number];

/**
 * Az érték elvárt típusának leírása, ha az érték nem felel meg a mező
 * `valueKind` típusának (SPEC-016 5.5 táblázat), különben `undefined`. A
 * `json` ágon nincs ellenőrzés: a drót JSON-t ad, más érték nem érkezhet, egy
 * ottani ellenőrző ág tehát garantáltan sosem futna.
 */
function describeInputTypeMismatch(field: StartInputField, value: unknown): string | undefined {
  switch (field.valueKind) {
    case 'text': {
      return isString(value) ? undefined : 'szöveg';
    }
    case 'number': {
      return isNumber(value) ? undefined : 'véges szám';
    }
    case 'boolean': {
      return isBoolean(value) ? undefined : 'logikai érték';
    }
    case 'choice': {
      return isString(value) && field.options.includes(value)
        ? undefined
        : `az opciók egyike (${field.options.join(', ')})`;
    }
    case 'list': {
      return isStringArray(value) ? undefined : 'szövegek tömbje';
    }
    case 'json': {
      return undefined;
    }
  }
}

/**
 * A futás bemenetének ellenőrzése a `start` node `inputFields` listája ellen
 * (SPEC-004 4.8 4. lépés): "minden `required: true` mezőnek szerepelnie kell,
 * különben `missing_required_input`". A kötelező mezők után minden **jelen
 * lévő** mező értéke a `valueKind` típusára is ellenőrzött, eltérésnél
 * `invalid_input_type` (SPEC-016 5.5).
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

  for (const field of config.inputFields) {
    const value = input[field.name];
    if (value === undefined) {
      continue;
    }
    const expected = describeInputTypeMismatch(field, value);
    if (expected !== undefined) {
      return {
        kind: 'error',
        message: formatEngineErrorMessage(
          'invalid_input_type',
          `A futás bemenetének "${field.name}" mezője nem a beállított típusú, elvárt: ${expected}`,
        ),
      };
    }
  }

  return { kind: 'ok', value: undefined };
}
