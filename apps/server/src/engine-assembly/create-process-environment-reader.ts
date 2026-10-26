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
 * felett, `null`-ra normalizálva a hiányzó/üres esetet (SPEC-004 3.2
 * táblázat, `processEnvironment` sor - a port `read` metódusa `string | null`
 * alakú, nem `string | undefined`).
 *
 * A `readAll` a teljes környezet pillanatképe (SPEC-012 3.3): a lépés kimenő
 * `Options.env` objektuma erre épül.
 */
export function createProcessEnvironmentReader(): ProcessEnvironmentPort {
  return {
    read: (name) => {
      // eslint-disable-next-line unicorn/no-null -- a ProcessEnvironmentPort.read szerződése `string | null`, a `db` és a többi port konvenciója (SPEC-004 3.2)
      return process.env[name] ?? null;
    },
    readAll: () => Object.fromEntries(Object.entries(process.env).filter(isDefinedEntry)),
  };
}
