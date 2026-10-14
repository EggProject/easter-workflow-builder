import type { BranchHighlightMode } from './branch-highlight-mode.ts';

/**
 * Az ág kiemelés módjának perzisztált kulcsa (SPEC-008 6.6, 3. döntés): a
 * választást a böngésző megjegyzi, futásoktól függetlenül. A kulcs a meglévő
 * `eggGraphEditorLayout` és `eggRunViewUserLayout` betűzési mintáját követi
 * (`egg` előtag, utána a beállítás neve camelCase alakban); az érték maga a
 * mód szövege, `latest` vagy `all`, nem JSON.
 */
export const BRANCH_HIGHLIGHT_MODE_STORAGE_KEY = 'eggRunGraphBranchHighlightMode';

/**
 * A kapcsoló alapértelmezése: "csak a legutóbbi választás" (SPEC-008 6.6, 3.
 * döntés).
 */
export const DEFAULT_BRANCH_HIGHLIGHT_MODE: BranchHighlightMode = 'latest';

const BRANCH_HIGHLIGHT_MODES: readonly BranchHighlightMode[] = ['latest', 'all'];

/**
 * A tárolt mód, vagy az alapértelmezés. A hiányzó, a hibás és az ismeretlen
 * értékű bejegyzés az alapértelmezésre esik vissza, mint a dobó tárolás is: a
 * `try`/`catch` kötelező, mert privát ablakban és letiltott tárolás mellett
 * már a `localStorage` elérése is dobhat (`SecurityError`), és ez nem törheti
 * el a felületet (SPEC-008 6.1 és 6.6 mintája, `run-view-layout.ts`).
 *
 * A kiolvasott szöveg a két érvényes mód közül EGYENLŐSÉGGEL szűkül, nem
 * típus kényszerítéssel: ami egyikkel sem egyezik, az alapértelmezést kapja.
 */
export function readStoredBranchHighlightMode(): BranchHighlightMode {
  let stored: unknown;
  try {
    stored = globalThis.localStorage.getItem(BRANCH_HIGHLIGHT_MODE_STORAGE_KEY);
  } catch {
    // Szándékosan elnyelt: dobó tárolásnál a `stored` marad `undefined`, és
    // az alapértelmezés áll be.
  }
  return BRANCH_HIGHLIGHT_MODES.find((mode) => mode === stored) ?? DEFAULT_BRANCH_HIGHLIGHT_MODE;
}

/**
 * A mód elmentése. A `try`/`catch` itt is kötelező, ugyanazzal az indokkal: a
 * `setItem` privát ablakban, letiltott tárolás mellett és tele kvóta esetén is
 * dobhat. A mentés elmaradása nem hiba a felhasználó felé, csak annyit jelent,
 * hogy a következő betöltés az alapértelmezéssel indul.
 */
export function storeBranchHighlightMode(mode: BranchHighlightMode): void {
  try {
    globalThis.localStorage.setItem(BRANCH_HIGHLIGHT_MODE_STORAGE_KEY, mode);
  } catch {
    // Szándékosan elnyelt: a perzisztálás legjobb szándékú, nem kötelező.
  }
}
