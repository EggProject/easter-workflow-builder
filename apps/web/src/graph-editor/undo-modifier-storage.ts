import { isUndoModifierPreference } from './is-undo-modifier-preference.ts';
import type { UndoModifierPreference } from './undo-modifier-preference.ts';

/**
 * A módosító beállítás perzisztált kulcsa (SPEC-008 5.10, O-31): böngészőnként
 * tárolt, mert eszközfüggő. A kulcs a meglévő `eggGraphEditorLayout` és
 * `eggRunViewUserLayout` betűzési mintáját követi (`egg` előtag, utána a
 * beállítás neve camelCase alakban); az érték maga a beállítás szövege
 * (`auto`, `ctrl` vagy `meta`), nem JSON.
 */
export const UNDO_MODIFIER_STORAGE_KEY = 'eggGraphEditorUndoModifier';

/**
 * Az alapértelmezés: a felhasználói ügynök dönt (SPEC-008 5.10, O-31).
 */
export const DEFAULT_UNDO_MODIFIER_PREFERENCE: UndoModifierPreference = 'auto';

/**
 * A tároló, késleltetve elérve: privát ablakban és letiltott tárolás mellett
 * már a `localStorage` elérése is dobhat (`SecurityError`), ezért a hívó nem
 * a kész objektumot, hanem az elérés módját adja át, és az elérés is a
 * `try`/`catch` védelme alatt fut.
 */
export type UndoModifierStorageAccessor = () => Pick<Storage, 'getItem' | 'setItem'>;

/**
 * A böngésző `localStorage` tárolója, a `UndoModifierStorageAccessor` alakban.
 */
export function getBrowserLocalStorage(): Storage {
  return globalThis.localStorage;
}

/**
 * A tárolt beállítás, vagy az alapértelmezés. A hiányzó, a hibás és az
 * ismeretlen értékű bejegyzés, és a dobó tároló is az alapértelmezésre esik
 * vissza: egyik eset sem törheti el a felületet (SPEC-008 5.10, 6.1 és 6.6
 * mintája).
 */
export function readUndoModifierPreference(getStorage: UndoModifierStorageAccessor): UndoModifierPreference {
  let stored: unknown;
  try {
    stored = getStorage().getItem(UNDO_MODIFIER_STORAGE_KEY);
  } catch {
    // Szándékosan elnyelt: dobó tárolásnál a `stored` marad `undefined`, és
    // az alapértelmezés áll be.
  }
  return isUndoModifierPreference(stored) ? stored : DEFAULT_UNDO_MODIFIER_PREFERENCE;
}

/**
 * A beállítás elmentése. A `try`/`catch` itt is kötelező, ugyanazzal az
 * indokkal: a `setItem` privát ablakban, letiltott tárolás mellett és tele
 * kvóta esetén is dobhat. A mentés elmaradása nem hiba a felhasználó felé,
 * csak annyit jelent, hogy a következő betöltés az alapértelmezéssel indul.
 */
export function storeUndoModifierPreference(
  getStorage: UndoModifierStorageAccessor,
  preference: UndoModifierPreference,
): void {
  try {
    getStorage().setItem(UNDO_MODIFIER_STORAGE_KEY, preference);
  } catch {
    // Szándékosan elnyelt: a perzisztálás legjobb szándékú, nem kötelező.
  }
}
