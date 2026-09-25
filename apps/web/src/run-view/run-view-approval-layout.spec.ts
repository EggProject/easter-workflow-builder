import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_RUN_VIEW_APPROVAL_LAYOUT_SIZES,
  RUN_VIEW_APPROVAL_LAYOUT_STORAGE_KEY,
  readStoredRunViewApprovalLayoutSizes,
  storeRunViewApprovalLayoutSizes,
} from './run-view-approval-layout.ts';
import { RUN_VIEW_LAYOUT_STORAGE_KEY } from './run-view-layout.ts';

/**
 * A dobó `localStorage` (privát ablak, letiltott tárolás, tele kvóta)
 * szimulálása, a `run-view-layout.spec.ts` azonos segédfüggvényének mintájára:
 * a `try`/`catch` ágat kizárólag így lehet ténylegesen futtatni.
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

describe('run-view-approval-layout', () => {
  afterEach(() => {
    globalThis.localStorage.clear();
  });

  it('a kulcs eltér a gráf és a transcript arányáétól, az alapértelmezés fele-fele', () => {
    expect(RUN_VIEW_APPROVAL_LAYOUT_STORAGE_KEY).toBe('eggRunViewTranscriptApprovalLayout');
    expect(RUN_VIEW_APPROVAL_LAYOUT_STORAGE_KEY).not.toBe(RUN_VIEW_LAYOUT_STORAGE_KEY);
    expect(DEFAULT_RUN_VIEW_APPROVAL_LAYOUT_SIZES).toEqual([50, 50]);
  });

  it('a régi, sorrendjében eldönthetetlen kulcson tárolt arány figyelmen kívül marad: az alapértelmezés jön, nem egy fordított arány', () => {
    // A CLI sorrend (2743b6b) előtt ezen a kulcson a pár (jóváhagyás,
    // transcript) sorrendben állt: a [30, 70] egy 70 százalékos transcriptet
    // jelentett, a mostani sorrendben olvasva 30 százalékosat adna.
    globalThis.localStorage.setItem('eggRunViewApprovalLayout', JSON.stringify([30, 70]));
    expect(readStoredRunViewApprovalLayoutSizes()).toEqual(DEFAULT_RUN_VIEW_APPROVAL_LAYOUT_SIZES);
  });

  describe('readStoredRunViewApprovalLayoutSizes', () => {
    it('tárolt érték nélkül az alapértelmezést adja', () => {
      expect(readStoredRunViewApprovalLayoutSizes()).toEqual(DEFAULT_RUN_VIEW_APPROVAL_LAYOUT_SIZES);
    });

    it('érvényes tárolt értéket ad vissza', () => {
      globalThis.localStorage.setItem(RUN_VIEW_APPROVAL_LAYOUT_STORAGE_KEY, JSON.stringify([35, 65]));
      expect(readStoredRunViewApprovalLayoutSizes()).toEqual([35, 65]);
    });

    it('hibás JSON esetén az alapértelmezésre esik vissza', () => {
      globalThis.localStorage.setItem(RUN_VIEW_APPROVAL_LAYOUT_STORAGE_KEY, 'nem JSON');
      expect(readStoredRunViewApprovalLayoutSizes()).toEqual(DEFAULT_RUN_VIEW_APPROVAL_LAYOUT_SIZES);
    });

    it('érvényes JSON, de rossz alak esetén az alapértelmezésre esik vissza', () => {
      globalThis.localStorage.setItem(RUN_VIEW_APPROVAL_LAYOUT_STORAGE_KEY, JSON.stringify({ approval: 35 }));
      expect(readStoredRunViewApprovalLayoutSizes()).toEqual(DEFAULT_RUN_VIEW_APPROVAL_LAYOUT_SIZES);
    });

    it('dobó localStorage esetén az alapértelmezésre esik vissza, nem tör el', () => {
      withThrowingLocalStorage(() => {
        expect(readStoredRunViewApprovalLayoutSizes()).toEqual(DEFAULT_RUN_VIEW_APPROVAL_LAYOUT_SIZES);
      });
    });

    it('a gráf és a transcript kulcsára írt érték nem szivárog át', () => {
      globalThis.localStorage.setItem(RUN_VIEW_LAYOUT_STORAGE_KEY, JSON.stringify([20, 80]));
      expect(readStoredRunViewApprovalLayoutSizes()).toEqual(DEFAULT_RUN_VIEW_APPROVAL_LAYOUT_SIZES);
    });
  });

  describe('storeRunViewApprovalLayoutSizes', () => {
    it('a kulcsra írja a JSON alakot, és a visszaolvasás ugyanazt adja', () => {
      storeRunViewApprovalLayoutSizes([30, 70]);
      expect(globalThis.localStorage.getItem(RUN_VIEW_APPROVAL_LAYOUT_STORAGE_KEY)).toBe('[30,70]');
      expect(readStoredRunViewApprovalLayoutSizes()).toEqual([30, 70]);
    });

    it('dobó localStorage esetén elnyeli a hibát', () => {
      withThrowingLocalStorage(() => {
        expect(() => {
          storeRunViewApprovalLayoutSizes([30, 70]);
        }).not.toThrow();
      });
    });
  });
});
