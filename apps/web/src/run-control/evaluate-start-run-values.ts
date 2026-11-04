import type { StartInputField } from '@easter-workflow-builder/protocol';
import { readStartRunField } from './read-start-run-field.ts';
import { EMPTY_START_RUN_FIELD_VALUE, type StartRunValues } from './start-run-values.ts';

/**
 * A kötelező, üresen hagyott mező hibaüzenete. Egyetlen helyen áll, mert a
 * kiértékelő és a tesztek is ezt hasonlítják.
 */
export const REQUIRED_START_FIELD_MESSAGE = 'Kötelező mező.';

/**
 * A nem értelmezhető JSON mező hibaüzenete (SPEC-016 5.4).
 */
export const INVALID_JSON_START_FIELD_MESSAGE = 'Érvénytelen JSON adat.';

export interface StartRunEvaluation {
  /**
   * A `StartRunRequest.input` mezőjébe kerülő objektum (SPEC-008 6.5, SPEC-016
   * 5.4): az üres mező kulcsa kimarad.
   */
  readonly input: Readonly<Record<string, unknown>>;
  /**
   * Mezőnév szerinti hibaüzenet; nem üres, ha a futás nem indulhat.
   */
  readonly errors: ReadonlyMap<string, string>;
}

/**
 * A szerkesztett értékek kiértékelése a mezőlista szerint: a küldendő
 * bemenet és a mezőnkénti hibák egyetlen bejárásban, hogy az értelmezés
 * (a JSON szöveg `JSON.parse` hívása) egyszer fusson, és a bemenet építőnek
 * ne kelljen olyan hibaágat hordoznia, ami a hibák ellenőrzése után sosem
 * futna le. A kötelező, de üres mező hibát ad; a hiányzó bemenet végső
 * ellenőrzése a motoré (`validateRunInput`, SPEC-004 4.8 4. lépés).
 *
 * Az `EMPTY_START_RUN_FIELD_VALUE` a modális nyitásának első renderére való,
 * amikor a `values` még üres, a nyitó állapotot pedig csak egy effekt írja be.
 */
export function evaluateStartRunValues(fields: readonly StartInputField[], values: StartRunValues): StartRunEvaluation {
  const input: Record<string, unknown> = {};
  const errors = new Map<string, string>();
  for (const field of fields) {
    const reading = readStartRunField(field, values[field.name] ?? EMPTY_START_RUN_FIELD_VALUE);
    if (reading.status === 'present') {
      input[field.name] = reading.value;
    } else if (reading.status === 'invalid_json') {
      errors.set(field.name, INVALID_JSON_START_FIELD_MESSAGE);
    } else if (field.required) {
      errors.set(field.name, REQUIRED_START_FIELD_MESSAGE);
    }
  }
  return { input, errors };
}
