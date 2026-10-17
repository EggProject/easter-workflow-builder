import type { UndoModifier } from './resolve-undo-modifier.ts';

/**
 * A két gomb tippjének billentyű jelölése.
 */
export interface UndoShortcutLabels {
  readonly undo: string;
  readonly redo: string;
}

const MODIFIER_NAMES: Readonly<Record<UndoModifier, string>> = { ctrl: 'Ctrl', meta: 'Cmd' };

/**
 * A Visszavonás és az Újra gomb `Tooltip` jelölése a feloldott módosítóval
 * (SPEC-008 5.10, O-31): `Ctrl` esetén "Ctrl+Z" és "Ctrl+Shift+Z / Ctrl+Y",
 * `Cmd` esetén "Cmd+Z" és "Cmd+Shift+Z / Cmd+Y".
 */
export function formatUndoShortcutLabels(modifier: UndoModifier): UndoShortcutLabels {
  const name = MODIFIER_NAMES[modifier];
  return { undo: `${name}+Z`, redo: `${name}+Shift+Z / ${name}+Y` };
}
