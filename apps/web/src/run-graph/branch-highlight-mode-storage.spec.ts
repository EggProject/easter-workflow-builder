import { afterEach, describe, expect, it } from 'vitest';
import {
  BRANCH_HIGHLIGHT_MODE_STORAGE_KEY,
  DEFAULT_BRANCH_HIGHLIGHT_MODE,
  readStoredBranchHighlightMode,
  storeBranchHighlightMode,
} from './branch-highlight-mode-storage.ts';

/**
 * A dobó `localStorage` (privát ablak, letiltott tárolás, tele kvóta)
 * szimulálása: a valódi objektumot cseréljük le a hívás idejére, mert a
 * `try`/`catch` ágat kizárólag így lehet ténylegesen futtatni. Ugyanaz a
 * segédfüggvény, mint a `run-view-layout.spec.ts`-ben; a teszt segédfüggvényt
 * szándékosan nem emeljük ki közös modulba (a repó meglévő gyakorlata).
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

describe('branch-highlight-mode-storage', () => {
  afterEach(() => {
    globalThis.localStorage.clear();
  });

  it('a kulcs a meglévő egg-előtagú camelCase mintát követi, az alapértelmezés a legutóbbi választás', () => {
    expect(BRANCH_HIGHLIGHT_MODE_STORAGE_KEY).toBe('eggRunGraphBranchHighlightMode');
    expect(DEFAULT_BRANCH_HIGHLIGHT_MODE).toBe('latest');
  });

  describe('readStoredBranchHighlightMode', () => {
    it('hiányzó bejegyzésre az alapértelmezést adja', () => {
      expect(readStoredBranchHighlightMode()).toBe('latest');
    });

    it('a tárolt "latest" értéket adja vissza', () => {
      globalThis.localStorage.setItem(BRANCH_HIGHLIGHT_MODE_STORAGE_KEY, 'latest');
      expect(readStoredBranchHighlightMode()).toBe('latest');
    });

    it('a tárolt "all" értéket adja vissza', () => {
      globalThis.localStorage.setItem(BRANCH_HIGHLIGHT_MODE_STORAGE_KEY, 'all');
      expect(readStoredBranchHighlightMode()).toBe('all');
    });

    it.each(['', 'ALL', 'every', '"all"', 'null', '[]', '1'])(
      'hibás vagy ismeretlen "%s" értékre az alapértelmezést adja',
      (stored) => {
        globalThis.localStorage.setItem(BRANCH_HIGHLIGHT_MODE_STORAGE_KEY, stored);
        expect(readStoredBranchHighlightMode()).toBe('latest');
      },
    );

    it('dobó localStorage esetén az alapértelmezést adja, nem tör el', () => {
      withThrowingLocalStorage(() => {
        expect(readStoredBranchHighlightMode()).toBe('latest');
      });
    });
  });

  describe('storeBranchHighlightMode', () => {
    it('a mód szövegét írja a kulcsra, JSON nélkül', () => {
      storeBranchHighlightMode('all');
      expect(globalThis.localStorage.getItem(BRANCH_HIGHLIGHT_MODE_STORAGE_KEY)).toBe('all');
      storeBranchHighlightMode('latest');
      expect(globalThis.localStorage.getItem(BRANCH_HIGHLIGHT_MODE_STORAGE_KEY)).toBe('latest');
    });

    it('a mentett mód visszaolvasható', () => {
      storeBranchHighlightMode('all');
      expect(readStoredBranchHighlightMode()).toBe('all');
    });

    it('dobó localStorage esetén nem tör el', () => {
      withThrowingLocalStorage(() => {
        expect(() => {
          storeBranchHighlightMode('all');
        }).not.toThrow();
      });
    });
  });
});
