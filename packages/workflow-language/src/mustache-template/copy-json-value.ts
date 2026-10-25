import { isPlainObject } from '@easter-workflow-builder/typeguards';
import type { JsonValue } from './json-value.ts';

/**
 * A másolat burkolója: a `copy` mező a tiszta JSON másolat. A burkoló miatt a
 * hiányzó másolat (`undefined`) nem keveredik a JSON értékekkel egy visszatérési
 * típusban.
 */
interface JsonCopy {
  readonly copy: JsonValue;
}

/**
 * A rekurzív másolás. Az `ancestors` a tömb és objektum gyökértől az aktuális
 * értékig vezető láncot adja: a láncban már álló konténer körkörös hivatkozás,
 * míg ugyanaz a konténer két testvér ágon (közös hivatkozás) nem az. A `copies`
 * a már kész konténerek másolata a forrás hivatkozás szerint: ugyanarra a
 * forrásra egy híváson belül ugyanaz a másolat jön vissza, így a közös
 * hivatkozás megmarad, és a másolás a forrás szerkezet méretével arányos (user
 * döntés 2026-10-25, O-16). A gyorsítótárba csak a kész másolat kerül. A mezőket
 * a tulajdonság leírón át olvassuk, így egy getter sem fut le (6.6 mintája); a
 * getteres tulajdonság és a tömb lyuka nem JSON adat. Az `undefined` jelentése:
 * az érték nem JSON adat.
 */
function copyWithin(
  value: unknown,
  ancestors: readonly object[],
  copies: Map<object, JsonValue>,
): JsonCopy | undefined {
  if (typeof value === 'string' || typeof value === 'boolean' || value === null) {
    return { copy: value };
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? { copy: value } : undefined;
  }
  if (!Array.isArray(value) && !isPlainObject(value)) {
    return undefined;
  }
  if (ancestors.includes(value)) {
    return undefined;
  }
  const known = copies.get(value);
  if (known !== undefined) {
    return { copy: known };
  }
  const chain = [...ancestors, value];
  const keys = Array.isArray(value)
    ? Array.from({ length: value.length }, (_, index) => String(index))
    : Object.keys(value);
  const entries: [string, JsonValue][] = [];
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !('value' in descriptor)) {
      return undefined;
    }
    const child: unknown = descriptor.value;
    const childCopy = copyWithin(child, chain, copies);
    if (childCopy === undefined) {
      return undefined;
    }
    entries.push([key, childCopy.copy]);
  }
  const copy = Array.isArray(value) ? entries.map(([, item]) => item) : Object.fromEntries(entries);
  copies.set(value, copy);
  return { copy };
}

/**
 * Az érték tiszta JSON másolata, ha minden mélységben JSON-ban ábrázolható
 * (SPEC-010 6.5, user döntés 2026-10-25: a szigorú kiírás mélyen is szigorú);
 * különben `undefined`. Szöveg, véges szám, logikai érték és `null` az; a tömb
 * és a sima objektum (prototípus alapú felismeréssel) akkor, ha minden eleme és
 * mezője az, és nem tartalmaz körkörös hivatkozást. Bármi más (`Map`, `Date`,
 * osztálypéldány, `BigInt`, `Symbol`, függvény, `Uint8Array`, `undefined`,
 * `NaN`, végtelen) nem.
 *
 * A másolat a bejárás közben olvasott adatból épül, új tömbökből és sima
 * objektumokból: a `JSON.stringify` így pontosan a vizsgált adatot írja ki, akkor
 * is, ha a bemenet egy `Proxy`, aminek a `get` csapdája mást adna, mint a
 * tulajdonság leíró (például egy `toJSON` függvényt).
 */
export function copyJsonValue(value: unknown): JsonValue | undefined {
  return copyWithin(value, [], new Map<object, JsonValue>())?.copy;
}
