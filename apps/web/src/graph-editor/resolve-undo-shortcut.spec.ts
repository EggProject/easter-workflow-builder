import { afterEach, describe, expect, it } from 'vitest';
import { resolveUndoShortcut, type UndoShortcutAction, type UndoShortcutState } from './resolve-undo-shortcut.ts';

/**
 * A billentyű esemény a valódi útján, a célponton kiváltva: a döntés a
 * figyelőben fut, amikor a `composedPath()` már a cél elemtől indul.
 */
const NOT_SAVING: UndoShortcutState = { isSaving: false };

function resolveOn(
  target: EventTarget,
  init: KeyboardEventInit,
  state: UndoShortcutState = NOT_SAVING,
): UndoShortcutAction | undefined {
  let resolved: UndoShortcutAction | undefined;
  function listener(event: KeyboardEvent): void {
    resolved = resolveUndoShortcut(event, state);
  }
  document.addEventListener('keydown', listener);
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
  document.removeEventListener('keydown', listener);
  return resolved;
}

function appendToBody<T extends Element>(element: T): T {
  document.body.append(element);
  return element;
}

describe('resolveUndoShortcut', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  describe('a kezelt billentyűk (Ctrl módosító)', () => {
    it.each([
      { name: 'Ctrl+Z visszavon', init: { key: 'z', ctrlKey: true }, expected: 'undo' },
      { name: 'Ctrl+Shift+Z újra elvégez', init: { key: 'Z', ctrlKey: true, shiftKey: true }, expected: 'redo' },
      { name: 'Ctrl+Y újra elvégez', init: { key: 'y', ctrlKey: true }, expected: 'redo' },
      { name: 'bekapcsolt CapsLock mellett a Ctrl+Z visszavon', init: { key: 'Z', ctrlKey: true }, expected: 'undo' },
      {
        name: 'bekapcsolt CapsLock mellett a Ctrl+Y újra elvégez',
        init: { key: 'Y', ctrlKey: true },
        expected: 'redo',
      },
    ] as const)('$name', ({ init, expected }) => {
      expect(resolveOn(document, init)).toBe(expected);
    });

    it('a KeyboardEvent.key szerint dönt, a code mezőt nem nézi', () => {
      expect(resolveOn(document, { key: 'y', code: 'KeyZ', ctrlKey: true })).toBe('redo');
      expect(resolveOn(document, { key: 'z', code: 'KeyY', ctrlKey: true })).toBe('undo');
    });
  });

  describe('a nem kezelt billentyűk', () => {
    it.each([
      { name: 'módosító nélküli z', init: { key: 'z' } },
      { name: 'csak Meta+Z', init: { key: 'z', metaKey: true } },
      { name: 'Ctrl+Meta+Z', init: { key: 'z', ctrlKey: true, metaKey: true } },
      { name: 'Ctrl+Alt+Z', init: { key: 'z', ctrlKey: true, altKey: true } },
      { name: 'Ctrl+Alt+Y', init: { key: 'y', ctrlKey: true, altKey: true } },
      { name: 'Ctrl+Shift+Y', init: { key: 'Y', ctrlKey: true, shiftKey: true } },
      { name: 'Ctrl+A', init: { key: 'a', ctrlKey: true } },
      { name: 'Ctrl lenyomása önmagában', init: { key: 'Control', ctrlKey: true } },
    ] as const)('$name', ({ init }) => {
      expect(resolveOn(document, init)).toBeUndefined();
    });
  });

  describe('futó mentés (user döntés 2026-10-16)', () => {
    it.each([
      { name: 'Ctrl+Z', init: { key: 'z', ctrlKey: true } },
      { name: 'Ctrl+Shift+Z', init: { key: 'Z', ctrlKey: true, shiftKey: true } },
      { name: 'Ctrl+Y', init: { key: 'y', ctrlKey: true } },
    ] as const)('a(z) $name a mentés alatt nem kezelt, ugyanaz a billentyű mentés nélkül kezelt', ({ init }) => {
      expect(resolveOn(document, init, { isSaving: true })).toBeUndefined();
      expect(resolveOn(document, init, { isSaving: false })).toBeDefined();
    });
  });

  describe('a célpont szűrője (a React Flow törlés billentyűjének köre)', () => {
    it.each(['input', 'select', 'textarea'] as const)('a(z) %s elemen a mező natív visszavonása marad', (tagName) => {
      const field = appendToBody(document.createElement(tagName));
      expect(resolveOn(field, { key: 'z', ctrlKey: true })).toBeUndefined();
      expect(resolveOn(field, { key: 'y', ctrlKey: true })).toBeUndefined();
    });

    it('contenteditable elemen nem kezelt', () => {
      const editable = appendToBody(document.createElement('div'));
      editable.setAttribute('contenteditable', 'true');
      expect(resolveOn(editable, { key: 'z', ctrlKey: true })).toBeUndefined();
    });

    it('a .nokey osztályú elemen és a leszármazottján nem kezelt (a beállítás panel gombja)', () => {
      const panel = appendToBody(document.createElement('aside'));
      panel.className = 'node-inspector nokey';
      const button = document.createElement('button');
      panel.append(button);
      expect(resolveOn(panel, { key: 'z', ctrlKey: true })).toBeUndefined();
      expect(resolveOn(button, { key: 'z', ctrlKey: true })).toBeUndefined();
    });

    it('a .nokey körön kívüli gombon és a dokumentum törzsén kezelt', () => {
      const button = appendToBody(document.createElement('button'));
      expect(resolveOn(button, { key: 'z', ctrlKey: true })).toBe('undo');
      expect(resolveOn(document.body, { key: 'y', ctrlKey: true })).toBe('redo');
    });
  });
});
