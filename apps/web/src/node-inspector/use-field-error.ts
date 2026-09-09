import { useContext } from 'react';
import { FieldErrorsContext } from './field-errors-context.ts';
import { findFieldError } from './find-field-error.ts';

/**
 * Egy mező hibaüzenete a panel hibatérképéből, a mező `config`-on belüli
 * útvonala alapján (`promptTemplate`, `branches.0.key`, ...). A keresés
 * szabályai a `find-field-error.ts` fájlban állnak. A visszatérés
 * közvetlenül átadható a `TextField`, a `SelectField` és a `TextAreaField`
 * `error` propjának, mert mindhárom `string | undefined` alakot fogad.
 *
 * Szolgáltató nélkül (önálló komponens tesztben) a kontextus alapértelmezett,
 * üres térképe áll, tehát a hook mindig `undefined` értéket ad - nincs
 * hibaüzenet, és a komponens ugyanúgy renderelődik, mint korábban.
 */
export function useFieldError(path: string): string | undefined {
  return findFieldError(useContext(FieldErrorsContext), path);
}
