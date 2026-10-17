import { UNDO_MODIFIER_PREFERENCES, type UndoModifierPreference } from './undo-modifier-preference.ts';

const KNOWN_PREFERENCES: ReadonlySet<unknown> = new Set(UNDO_MODIFIER_PREFERENCES);

/**
 * Típusőr a tárolt beállításra. `unknown` bemenetet fogad, mert a
 * `localStorage`-ből érkező szöveg tetszőleges lehet: egy korábbi verzió más
 * értéke vagy kézzel átírt bejegyzés. A három érvényes szöveggel EGYENLŐSÉG
 * dönt, így nincs típus kényszerítés.
 */
export function isUndoModifierPreference(value: unknown): value is UndoModifierPreference {
  return KNOWN_PREFERENCES.has(value);
}
