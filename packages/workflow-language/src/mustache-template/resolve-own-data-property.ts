/**
 * Egy név szegmenseinek feloldása kizárólag saját adat tulajdonságon át
 * (SPEC-010 6.6). A konténer csak nem `null` objektum lehet (sima objektum vagy
 * tömb), tehát a primitív érték beépített tulajdonsága (`'abc'.length`) nem
 * találat (O-10), és a prototípus lánc (`constructor`, `toString`) sem. A
 * tulajdonság leíróját olvassuk, nem az értékét, így egy getter sem fut le; a
 * függvény értéket nem találatnak vesszük, tehát a hívó sosem kap meghívható
 * értéket.
 *
 * Az `undefined` visszatérés jelentése: nincs találat. A saját tulajdonságként
 * jelen lévő, de `undefined` értékű kulcs (a `RunContext` hatókörön kívüli
 * `item` mezője) is ide tartozik (SPEC-010 5.1 "vagy hiányzó név" oszlop).
 */
export function resolveOwnDataProperty(view: unknown, path: readonly string[]): unknown {
  let current: unknown = view;
  for (const segment of path) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    const descriptor = Object.getOwnPropertyDescriptor(current, segment);
    if (descriptor === undefined || !('value' in descriptor)) {
      return undefined;
    }
    const next: unknown = descriptor.value;
    current = next;
  }
  return typeof current === 'function' ? undefined : current;
}
