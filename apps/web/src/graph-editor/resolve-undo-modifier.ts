import type { UndoModifierPreference } from './undo-modifier-preference.ts';

/**
 * A feloldott módosító: `ctrl` esetén a `KeyboardEvent.ctrlKey`, `meta` esetén
 * a `KeyboardEvent.metaKey` (macOS-en a `Cmd`) számít (SPEC-008 5.10, M-120).
 */
export type UndoModifier = 'ctrl' | 'meta';

/**
 * A beállítás feloldása a ténylegesen használt módosítóra (SPEC-008 5.10,
 * O-31). `ctrl` és `meta` esetén a felhasználói ügynök nem számít. `auto`
 * esetén a felismerés ugyanaz a szabály, amivel a React Flow a saját
 * `multiSelectionKeyCode` alapértékét választja (a `navigator.userAgent`
 * tartalmazza a `Mac` szót, M-121): macOS-en `meta`, máshol `ctrl`, hogy a
 * szerkesztő két billentyű szabálya ugyanazon a platform döntésen álljon. A
 * felhasználói ügynök bemenet, tehát mindkét ág unit tesztben elérhető.
 */
export function resolveUndoModifier(preference: UndoModifierPreference, userAgent: string): UndoModifier {
  switch (preference) {
    case 'ctrl': {
      return 'ctrl';
    }
    case 'meta': {
      return 'meta';
    }
    case 'auto': {
      return userAgent.includes('Mac') ? 'meta' : 'ctrl';
    }
  }
}
