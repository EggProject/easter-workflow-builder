import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_GRAPH_EDITOR_LAYOUT_SIZES,
  GRAPH_EDITOR_LAYOUT_STORAGE_KEY,
  isLayoutSizePair,
  readStoredLayoutSizes,
  storeLayoutSizes,
} from './graph-editor-layout.ts';

/**
 * A dobó `localStorage` (privát ablak, letiltott tárolás, tele kvóta)
 * szimulálása: a valódi objektumot cseréljük le a hívás idejére, mert a
 * `try`/`catch` ágat kizárólag így lehet ténylegesen futtatni.
 */
function withThrowingLocalStorage(body: () => void): void {
  const original = globalThis.localStorage;
  const throwing: Storage = {
    get length(): number {
      throw new Error('a tárolás le van tiltva');
    },
    clear: () => {
      throw new Error('a tárolás le van tiltva');
    },
    getItem: () => {
      throw new Error('a tárolás le van tiltva');
    },
    key: () => {
      throw new Error('a tárolás le van tiltva');
    },
    removeItem: () => {
      throw new Error('a tárolás le van tiltva');
    },
    setItem: () => {
      throw new Error('a tárolás le van tiltva');
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: throwing, configurable: true });
  try {
    body();
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true });
  }
}

describe('graph-editor-layout', () => {
  afterEach(() => {
    globalThis.localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('isLayoutSizePair', () => {
    it('két véges, pozitív számot tartalmazó tömbre igaz', () => {
      expect(isLayoutSizePair([70, 30])).toBe(true);
    });

    it.each([
      ['nem tömb', { first: 70, second: 30 }],
      ['üres tömb', []],
      ['egy elemű tömb', [100]],
      ['három elemű tömb', [40, 30, 30]],
      ['nem szám elem', [70, '30']],
      ['nem véges elem', [70, Infinity]],
      ['NaN elem', [NaN, 30]],
      ['nulla elem', [0, 100]],
      ['negatív elem', [-10, 110]],
    ])('a %s alakra hamis', (_label, value: unknown) => {
      expect(isLayoutSizePair(value)).toBe(false);
    });
  });

  describe('readStoredLayoutSizes', () => {
    it('tárolt érték nélkül az alapértelmezést adja', () => {
      expect(readStoredLayoutSizes()).toEqual(DEFAULT_GRAPH_EDITOR_LAYOUT_SIZES);
    });

    it('érvényes tárolt értéket ad vissza', () => {
      globalThis.localStorage.setItem(GRAPH_EDITOR_LAYOUT_STORAGE_KEY, JSON.stringify([55, 45]));
      expect(readStoredLayoutSizes()).toEqual([55, 45]);
    });

    it('hibás JSON esetén az alapértelmezésre esik vissza', () => {
      globalThis.localStorage.setItem(GRAPH_EDITOR_LAYOUT_STORAGE_KEY, 'nem JSON');
      expect(readStoredLayoutSizes()).toEqual(DEFAULT_GRAPH_EDITOR_LAYOUT_SIZES);
    });

    it('érvényes JSON, de rossz alak esetén az alapértelmezésre esik vissza', () => {
      globalThis.localStorage.setItem(GRAPH_EDITOR_LAYOUT_STORAGE_KEY, JSON.stringify({ left: 70 }));
      expect(readStoredLayoutSizes()).toEqual(DEFAULT_GRAPH_EDITOR_LAYOUT_SIZES);
    });

    it('dobó localStorage esetén az alapértelmezésre esik vissza, nem tör el', () => {
      withThrowingLocalStorage(() => {
        expect(readStoredLayoutSizes()).toEqual(DEFAULT_GRAPH_EDITOR_LAYOUT_SIZES);
      });
    });
  });

  describe('storeLayoutSizes', () => {
    it('a kulcsra írja a JSON alakot', () => {
      storeLayoutSizes([60, 40]);
      expect(globalThis.localStorage.getItem(GRAPH_EDITOR_LAYOUT_STORAGE_KEY)).toBe('[60,40]');
    });

    it('dobó localStorage esetén elnyeli a hibát', () => {
      withThrowingLocalStorage(() => {
        expect(() => {
          storeLayoutSizes([60, 40]);
        }).not.toThrow();
      });
    });
  });
});
