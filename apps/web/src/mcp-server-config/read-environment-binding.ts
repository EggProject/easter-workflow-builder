/**
 * Egy deklarált névhez tartozó szerver oldali név a hozzárendelésből; üres
 * szöveg, ha nincs bejegyzés (a központi alapértelmezés dönt). A névlista
 * `Map`-en át keres, mert a POSIX név alak a `constructor` és a `__proto__`
 * nevet is engedi, amit egy sima objektum indexelése az `Object` prototípus
 * tagjára oldana fel.
 */
export function readEnvironmentBinding(bindings: Readonly<Record<string, string>>, declaredName: string): string {
  return new Map(Object.entries(bindings)).get(declaredName) ?? '';
}
