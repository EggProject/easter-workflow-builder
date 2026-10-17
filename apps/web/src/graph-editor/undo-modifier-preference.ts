/**
 * A visszavonás és az újra elvégzés billentyű módosítójának beállítása
 * (SPEC-008 5.10, O-31): `auto` (macOS-en `Cmd`, máshol `Ctrl`), `ctrl` vagy
 * `meta` (`Cmd`). A tömb sorrendje a választó opcióinak sorrendje.
 */
export const UNDO_MODIFIER_PREFERENCES = ['auto', 'ctrl', 'meta'] as const;

export type UndoModifierPreference = (typeof UNDO_MODIFIER_PREFERENCES)[number];
