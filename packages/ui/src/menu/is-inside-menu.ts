/**
 * Igaz, ha a `target` az `anchor` vagy a `panel` valamelyikének (akár
 * közvetett) leszármazottja.
 *
 * A panel és az anchor a DOM-ban KÜLÖN ágon áll, mert a panel
 * `createPortal`-lal a `document.body`-ba kerül (lásd `Menu.tsx` fejléce),
 * ezért a "kívülre kattintás" és a "fókusz elhagyta a panelt" döntés
 * mindkettőt meg kell vizsgálja. Két komponens használja ugyanezzel a
 * jelentéssel: a `Menu` és a `SelectField` listbox panelje.
 */
export function isInsideMenu(
  anchor: HTMLElement | null,
  panel: HTMLElement | null,
  target: EventTarget | null,
): boolean {
  if (!(target instanceof Node)) {
    return false;
  }
  // eslint-disable-next-line @typescript-eslint/prefer-optional-chain -- mérve (bun run test, packages/ui/src/menu): az `anchor?.contains`/`panel?.contains` opcionális láncolás a v8 lefedettségi eszköznél ÖNÁLLÓ, mindkét oldalon lefedendő branch-et hoz létre, holott `anchor`/`panel` a hívási pontokon a gyakorlatban SOHA nem null (lásd a fenti dokumentációt) - a `!== null &&` forma ezt a branch-et NEM hozza létre.
  return (anchor !== null && anchor.contains(target)) || (panel !== null && panel.contains(target));
}
