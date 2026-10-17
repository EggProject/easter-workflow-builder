import { describe, expect, it } from 'vitest';
import { isUndoModifierPreference } from './is-undo-modifier-preference.ts';
import { UNDO_MODIFIER_PREFERENCES, type UndoModifierPreference } from './undo-modifier-preference.ts';

/**
 * Csak az `UndoModifierPreference` típusú értéket fogadja: a fordító bukik, ha
 * a típusőr igaz ága nem szűkít.
 */
function describePreference(preference: UndoModifierPreference): string {
  return `beállítás: ${preference}`;
}

describe('isUndoModifierPreference', () => {
  it('a beállítás három érvényes szövegét elfogadja, a választó opcióinak sorrendjében', () => {
    expect(UNDO_MODIFIER_PREFERENCES).toEqual(['auto', 'ctrl', 'meta']);
    for (const preference of UNDO_MODIFIER_PREFERENCES) {
      expect(isUndoModifierPreference(preference)).toBe(true);
    }
  });

  it.each([
    { name: 'üres szöveg', value: '' },
    { name: 'nagybetűs alak', value: 'CTRL' },
    { name: 'a felirat szövege', value: 'Cmd' },
    { name: 'idézőjeles JSON szöveg', value: '"ctrl"' },
    // eslint-disable-next-line unicorn/no-null -- a `Storage#getItem` hiányzó bejegyzésre `null` értéket ad, ezt a guardnak ki kell szűrnie.
    { name: 'null', value: null },
    { name: 'undefined', value: undefined },
    { name: 'szám', value: 1 },
    { name: 'tömb', value: ['ctrl'] },
  ])('a(z) $name nem érvényes beállítás', ({ value }) => {
    expect(isUndoModifierPreference(value)).toBe(false);
  });

  it('igaz ág után a bemenet típusa a beállítás uniójára szűkül', () => {
    const input: unknown = 'meta';
    expect(isUndoModifierPreference(input) ? describePreference(input) : undefined).toBe('beállítás: meta');
  });
});
