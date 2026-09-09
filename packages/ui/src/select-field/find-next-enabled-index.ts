/**
 * A `fromIndex` pozíciótól `step` irányban induló, körbeérő keresés első
 * olyan opciójának indexe, ami nincs letiltva; `-1`, ha nincs ilyen (üres
 * lista, vagy minden opció letiltott).
 *
 * A forrás `Select.jsx` négy külön segédfüggvénye (`firstEnabled`,
 * `lastEnabled`, `moveActive` előre és hátra) ugyanennek a keresésnek a négy
 * esete, ezért itt egyetlen függvény adja mind a négyet: az első
 * engedélyezett opció `fromIndex = -1, step = 1`, az utolsó
 * `fromIndex = options.length, step = -1`.
 *
 * A megvalósítás azért készít előre `isEnabled` és `visitOrder` listát,
 * hogy a ciklusban ne kelljen `options[index]` indexelés: a
 * `noUncheckedIndexedAccess` mellett az `T | undefined` kezelése olyan
 * `undefined` ágat vinne be, ami logikailag SOHA nem futna, és a 100
 * százalékos, kizárás nélküli lefedettségi küszöböt sértené.
 */
export function findNextEnabledIndex(
  options: readonly { readonly disabled?: boolean }[],
  fromIndex: number,
  step: 1 | -1,
): number {
  const count = options.length;
  const enabledFlags = options.map((option) => option.disabled !== true);
  const visitOrder = options
    .keys()
    .map((offset) => (((fromIndex + step * (offset + 1)) % count) + count) % count)
    .toArray();
  return visitOrder.find((index) => enabledFlags[index] === true) ?? -1;
}
