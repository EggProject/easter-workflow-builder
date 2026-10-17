import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_UNDO_MODIFIER_PREFERENCE,
  UNDO_MODIFIER_STORAGE_KEY,
  getBrowserLocalStorage,
  readUndoModifierPreference,
  type UndoModifierStorageAccessor,
} from './undo-modifier-storage.ts';

/**
 * Memóriabeli tároló a befecskendezéshez: a kezdő érték a beállítás kulcsára
 * kerül.
 */
function createMemoryStorage(initial?: string): { readonly accessor: UndoModifierStorageAccessor } {
  const entries = new Map<string, string>();
  if (initial !== undefined) {
    entries.set(UNDO_MODIFIER_STORAGE_KEY, initial);
  }
  return {
    accessor: () => ({
      // eslint-disable-next-line unicorn/no-null -- a `Storage#getItem` hiányzó bejegyzésre `null` értéket ad.
      getItem: (key) => entries.get(key) ?? null,
    }),
  };
}

/**
 * Dobó tároló: a privát ablak és a letiltott tárolás két alakja, az elérés
 * dobása és a metódus dobása.
 */
const THROWING_ACCESS: UndoModifierStorageAccessor = () => {
  throw new Error('a tárolás le van tiltva');
};
const THROWING_METHODS: UndoModifierStorageAccessor = () => ({
  getItem: () => {
    throw new Error('a tárolás le van tiltva');
  },
});

describe('undo-modifier-storage', () => {
  afterEach(() => {
    globalThis.localStorage.clear();
  });

  it('a kulcs a meglévő egg-előtagú camelCase mintát követi, az alapértelmezés az Automatikus', () => {
    expect(UNDO_MODIFIER_STORAGE_KEY).toBe('eggGraphEditorUndoModifier');
    expect(DEFAULT_UNDO_MODIFIER_PREFERENCE).toBe('auto');
  });

  describe('readUndoModifierPreference', () => {
    it('hiányzó bejegyzésre az alapértelmezést adja', () => {
      expect(readUndoModifierPreference(createMemoryStorage().accessor)).toBe('auto');
    });

    it.each(['auto', 'ctrl', 'meta'] as const)('a tárolt "%s" értéket adja vissza', (stored) => {
      expect(readUndoModifierPreference(createMemoryStorage(stored).accessor)).toBe(stored);
    });

    it.each(['', 'CTRL', 'cmd', '"ctrl"', 'null', '[]', '1'])(
      'hibás vagy ismeretlen "%s" értékre az alapértelmezést adja',
      (stored) => {
        expect(readUndoModifierPreference(createMemoryStorage(stored).accessor)).toBe('auto');
      },
    );

    it('dobó tároló elérésnél és dobó metódusnál is az alapértelmezést adja, nem tör el', () => {
      expect(readUndoModifierPreference(THROWING_ACCESS)).toBe('auto');
      expect(readUndoModifierPreference(THROWING_METHODS)).toBe('auto');
    });
  });

  describe('getBrowserLocalStorage', () => {
    it('a böngésző localStorage tárolóját adja, amiből az olvasás a tárolt értéket adja', () => {
      expect(getBrowserLocalStorage()).toBe(globalThis.localStorage);
      globalThis.localStorage.setItem(UNDO_MODIFIER_STORAGE_KEY, 'ctrl');
      expect(readUndoModifierPreference(getBrowserLocalStorage)).toBe('ctrl');
    });
  });
});
