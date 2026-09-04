import type { RefObject } from 'react';
import { describe, expect, it } from 'vitest';
import { readPanelElement } from './read-panel-element.ts';

describe('readPanelElement', () => {
  it('visszaadja a csatolt DOM elemet', () => {
    const element = document.createElement('div');
    const reference: RefObject<HTMLDivElement | null> = { current: element };

    expect(readPanelElement(reference)).toBe(element);
  });

  it('dob, ha a ref még nincs csatolva (null)', () => {
    // eslint-disable-next-line unicorn/no-null -- a React `RefObject.current` szerződése ténylegesen `null`, ezt a pontos esetet teszteli a teszt.
    const reference: RefObject<HTMLDivElement | null> = { current: null };

    expect(() => {
      readPanelElement(reference);
    }).toThrow('a menü panel nincs csatolva a DOM-hoz');
  });
});
