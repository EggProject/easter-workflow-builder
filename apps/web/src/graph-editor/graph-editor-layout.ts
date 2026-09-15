/**
 * A gráf szerkesztő osztott elrendezésének perzisztált aránya (felhasználói
 * kérés, 2026-09-09: "legyen a layout ha lehet resizable, igy a user tudja
 * beallitani maganak hogy mekkora tavolsagot akar. Ezt localstorage -be le
 * kell menteni es betolteni").
 *
 * A kulcs a projekt meglévő `localStorage` kulcsának (`eggTheme`, lásd
 * `packages/ui` `theme-mode` téma) betűzési mintáját követi: `egg` előtag,
 * utána a beállítás neve camelCase alakban.
 */
export const GRAPH_EDITOR_LAYOUT_STORAGE_KEY = 'eggGraphEditorLayout';

/**
 * A kezdő arány, amikor nincs tárolt érték: a vászon kapja a nagyobb részt,
 * a beállítás panel a kisebbet. Ugyanaz a két szám, ami korábban közvetlenül
 * a `Resizable defaultSizes` propjában állt.
 */
export const DEFAULT_GRAPH_EDITOR_LAYOUT_SIZES: readonly number[] = [70, 30];

/**
 * Típusőr a tárolt értékre. `unknown` bemenetet fogad, mert a
 * `localStorage`-ből érkező szöveg tetszőleges JSON lehet: egy korábbi
 * verzió más alakja, vagy akár kézzel átírt érték. Pontosan két, véges és
 * pozitív szám az elfogadott alak; minden más esetben a hívó az
 * alapértelmezésre esik vissza.
 */
export function isLayoutSizePair(value: unknown): value is readonly number[] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((element: unknown) => typeof element === 'number' && Number.isFinite(element) && element > 0)
  );
}

/**
 * A tárolt arány, vagy az alapértelmezés. A `try`/`catch` kötelező: privát
 * ablakban és letiltott tárolás mellett már a `localStorage` elérése is
 * dobhat (`SecurityError`), a `JSON.parse` pedig hibás szövegre dob. Egyik
 * eset sem törheti el a felületet, mindkettő az alapértelmezésre esik vissza.
 */
export function readStoredLayoutSizes(): readonly number[] {
  try {
    const raw = globalThis.localStorage.getItem(GRAPH_EDITOR_LAYOUT_STORAGE_KEY);
    if (typeof raw !== 'string') {
      return DEFAULT_GRAPH_EDITOR_LAYOUT_SIZES;
    }
    const parsed: unknown = JSON.parse(raw);
    return isLayoutSizePair(parsed) ? parsed : DEFAULT_GRAPH_EDITOR_LAYOUT_SIZES;
  } catch {
    return DEFAULT_GRAPH_EDITOR_LAYOUT_SIZES;
  }
}

/**
 * Az arány elmentése. A `try`/`catch` itt is kötelező, és ugyanaz az
 * indoka: a `setItem` privát ablakban, letiltott tárolás mellett és tele
 * kvóta esetén is dobhat. A mentés elmaradása nem hiba a felhasználó felé,
 * csak annyit jelent, hogy a következő betöltés az alapértelmezéssel indul.
 */
export function storeLayoutSizes(sizes: readonly number[]): void {
  try {
    globalThis.localStorage.setItem(GRAPH_EDITOR_LAYOUT_STORAGE_KEY, JSON.stringify(sizes));
  } catch {
    // Szándékosan elnyelt: a perzisztálás legjobb szándékú, nem kötelező.
  }
}
