import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_UNDO_MODIFIER_PREFERENCE,
  UNDO_MODIFIER_STORAGE_KEY,
  getBrowserLocalStorage,
  readUndoModifierPreference,
  storeUndoModifierPreference,
  type UndoModifierStorageAccessor,
} from './undo-modifier-storage.ts';

/**
 * Memóriabeli tároló a befecskendezéshez: a kezdő érték a beállítás kulcsára
 * kerül, az `entries` térkép pedig a teszt számára láthatóvá teszi az írást.
 */
function createMemoryStorage(initial?: string): {
  readonly accessor: UndoModifierStorageAccessor;
  readonly entries: Map<string, string>;
} {
  const entries = new Map<string, string>();
  if (initial !== undefined) {
    entries.set(UNDO_MODIFIER_STORAGE_KEY, initial);
  }
  return {
    entries,
    accessor: () => ({
      // eslint-disable-next-line unicorn/no-null -- a `Storage#getItem` hiányzó bejegyzésre `null` értéket ad.
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => {
        entries.set(key, value);
      },
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
  setItem: () => {
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

  describe('storeUndoModifierPreference', () => {
    it.each(['auto', 'ctrl', 'meta'] as const)('a(z) "%s" szövegét írja a kulcsra, JSON nélkül', (preference) => {
      const { accessor, entries } = createMemoryStorage();
      storeUndoModifierPreference(accessor, preference);
      expect(entries.get(UNDO_MODIFIER_STORAGE_KEY)).toBe(preference);
      expect(readUndoModifierPreference(accessor)).toBe(preference);
    });

    it('dobó tároló elérésnél és dobó metódusnál sem dob tovább', () => {
      expect(() => {
        storeUndoModifierPreference(THROWING_ACCESS, 'meta');
      }).not.toThrow();
      expect(() => {
        storeUndoModifierPreference(THROWING_METHODS, 'meta');
      }).not.toThrow();
    });
  });

  describe('getBrowserLocalStorage', () => {
    it('a böngésző localStorage tárolóját adja, amin az írás és az olvasás körbejár', () => {
      storeUndoModifierPreference(getBrowserLocalStorage, 'ctrl');
      expect(globalThis.localStorage.getItem(UNDO_MODIFIER_STORAGE_KEY)).toBe('ctrl');
      expect(readUndoModifierPreference(getBrowserLocalStorage)).toBe('ctrl');
    });
  });
});
