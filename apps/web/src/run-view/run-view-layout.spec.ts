import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_GRAPH_EDITOR_LAYOUT_SIZES } from '../graph-editor/graph-editor-layout.ts';
import {
  DEFAULT_RUN_VIEW_LAYOUT_SIZES,
  RUN_VIEW_LAYOUT_STORAGE_KEY,
  readStoredRunViewLayoutSizes,
  storeRunViewLayoutSizes,
} from './run-view-layout.ts';

/**
 * A dobó `localStorage` (privát ablak, letiltott tárolás, tele kvóta)
 * szimulálása: a valódi objektumot cseréljük le a hívás idejére, mert a
 * `try`/`catch` ágat kizárólag így lehet ténylegesen futtatni. Ugyanaz a
 * segédfüggvény, mint a `graph-editor-layout.spec.ts`-ben; a teszt
 * segédfüggvényt szándékosan nem emeljük ki közös modulba, mert egy
 * termékkódban nem létező fogalomnak nem gyártunk absztrakciót.
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

describe('run-view-layout', () => {
  afterEach(() => {
    globalThis.localStorage.clear();
  });

  it('a kulcs eltér a gráf szerkesztőétől, az alapértelmezés viszont ugyanaz az arány', () => {
    expect(RUN_VIEW_LAYOUT_STORAGE_KEY).toBe('eggRunViewLayout');
    expect(DEFAULT_RUN_VIEW_LAYOUT_SIZES).toEqual(DEFAULT_GRAPH_EDITOR_LAYOUT_SIZES);
  });

  describe('readStoredRunViewLayoutSizes', () => {
    it('tárolt érték nélkül az alapértelmezést adja', () => {
      expect(readStoredRunViewLayoutSizes()).toEqual(DEFAULT_RUN_VIEW_LAYOUT_SIZES);
    });

    it('érvényes tárolt értéket ad vissza', () => {
      globalThis.localStorage.setItem(RUN_VIEW_LAYOUT_STORAGE_KEY, JSON.stringify([45, 55]));
      expect(readStoredRunViewLayoutSizes()).toEqual([45, 55]);
    });

    it('hibás JSON esetén az alapértelmezésre esik vissza', () => {
      globalThis.localStorage.setItem(RUN_VIEW_LAYOUT_STORAGE_KEY, 'nem JSON');
      expect(readStoredRunViewLayoutSizes()).toEqual(DEFAULT_RUN_VIEW_LAYOUT_SIZES);
    });

    it('érvényes JSON, de rossz alak esetén az alapértelmezésre esik vissza', () => {
      globalThis.localStorage.setItem(RUN_VIEW_LAYOUT_STORAGE_KEY, JSON.stringify([100]));
      expect(readStoredRunViewLayoutSizes()).toEqual(DEFAULT_RUN_VIEW_LAYOUT_SIZES);
    });

    it('dobó localStorage esetén az alapértelmezésre esik vissza, nem tör el', () => {
      withThrowingLocalStorage(() => {
        expect(readStoredRunViewLayoutSizes()).toEqual(DEFAULT_RUN_VIEW_LAYOUT_SIZES);
      });
    });

    it('a szerkesztő kulcsára írt érték nem szivárog át', () => {
      globalThis.localStorage.setItem('eggGraphEditorLayout', JSON.stringify([20, 80]));
      expect(readStoredRunViewLayoutSizes()).toEqual(DEFAULT_RUN_VIEW_LAYOUT_SIZES);
    });
  });

  describe('storeRunViewLayoutSizes', () => {
    it('a kulcsra írja a JSON alakot, és a visszaolvasás ugyanazt adja', () => {
      storeRunViewLayoutSizes([35, 65]);
      expect(globalThis.localStorage.getItem(RUN_VIEW_LAYOUT_STORAGE_KEY)).toBe('[35,65]');
      expect(readStoredRunViewLayoutSizes()).toEqual([35, 65]);
    });

    it('dobó localStorage esetén elnyeli a hibát', () => {
      withThrowingLocalStorage(() => {
        expect(() => {
          storeRunViewLayoutSizes([35, 65]);
        }).not.toThrow();
      });
    });
  });
});
