import type { ProcessEnvironmentPort } from '@easter-workflow-builder/engine';
import { isString } from '@easter-workflow-builder/typeguards';

/**
 * A `process.env` bejegyzés típusa: a Node típusa az értéket `string |
 * undefined` alakban adja, az `undefined` értékű bejegyzések a `readAll`
 * pillanatképből kimaradnak.
 */
function isDefinedEntry(entry: [string, string | undefined]): entry is [string, string] {
  return isString(entry[1]);
}

/**
 * A folyamat környezeti változó port valódi implementációja: a `process.env`
 * felett, a hiányzó változót `null`-ra normalizálva (SPEC-004 3.2 táblázat,
 * `processEnvironment` sor - a port `read` metódusa `string | null` alakú,
 * nem `string | undefined`). Az üres érték (`NEV=`) nem hiányzó, szövegként
 * jön vissza (SPEC-009 6.4).
 *
 * A `read` csak a `process.env` saját bejegyzését olvassa (`Object.hasOwn`):
 * a puszta indexelés a prototípus lánc tagjait (`constructor`, `toString`,
 * `__proto__`) is visszaadná, függvényként vagy objektumként, így egy ilyen
 * nevű hiányzó változó nem `null` lenne (PLAN-012 T-012-27).
 *
 * A `readAll` a teljes környezet pillanatképe (SPEC-012 3.3): a lépés kimenő
 * `Options.env` objektuma erre épül.
 */
export function createProcessEnvironmentReader(): ProcessEnvironmentPort {
  return {
    read: (name) => {
      const value = process.env[name];
      // eslint-disable-next-line unicorn/no-null -- a ProcessEnvironmentPort.read szerződése `string | null`, a `db` és a többi port konvenciója (SPEC-004 3.2)
      return Object.hasOwn(process.env, name) && isString(value) ? value : null;
    },
    readAll: () => Object.fromEntries(Object.entries(process.env).filter(isDefinedEntry)),
  };
}
