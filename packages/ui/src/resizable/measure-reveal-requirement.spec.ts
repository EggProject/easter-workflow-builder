import { afterEach, describe, expect, it } from 'vitest';
import { measureRevealRequirement } from './measure-reveal-requirement.ts';

/**
 * Egy elem rögzített befoglaló dobozzal (a happy-dom `getBoundingClientRect()`
 * mindig nulla téglalapot ad).
 */
function boxed(parent: Element, rect: DOMRect, overflow?: string): HTMLDivElement {
  const element = document.createElement('div');
  element.getBoundingClientRect = () => rect;
  // Hosszú alakban, mert a happy-dom az `overflow` rövidítést nem bontja
  // ki a kiszámított `overflow-x`/`overflow-y` értékre.
  if (overflow !== undefined) {
    element.style.overflowX = overflow;
    element.style.overflowY = overflow;
  }
  parent.append(element);
  return element;
}

describe('measureRevealRequirement', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('a panel mérete plusz az elem túlnyúlása a legközelebbi levágó ősén, felfelé egészre kerekítve', () => {
    const panel = boxed(document.body, new DOMRect(0, 100, 300, 100), 'auto');
    const section = boxed(panel, new DOMRect(0, 100, 300, 100));
    const scroller = boxed(section, new DOMRect(0, 100, 300, 100), 'auto');
    // A happy-dom a meg nem adott `overflow-y` értéket üresen számolja; a
    // böngésző alapértéke a `visible`, ezt kimondva adjuk meg.
    const card = boxed(scroller, new DOMRect(0, 100, 300, 300), 'visible');
    const text = boxed(card, new DOMRect(0, 180, 300, 70.2));
    // A szöveg alja 250,2, a görgető doboz alja 200: 100 + 50,2, felfelé 151.
    expect(measureRevealRequirement(panel, text, true)).toBe(151);
  });

  it('a levágó ős görgetése hozzáadódik, tehát az eredmény független a görgetéstől', () => {
    const panel = boxed(document.body, new DOMRect(0, 100, 300, 100), 'auto');
    const scroller = boxed(panel, new DOMRect(0, 100, 300, 100), 'auto');
    const text = boxed(scroller, new DOMRect(0, 150, 300, 50));
    scroller.scrollTop = 50;
    expect(measureRevealRequirement(panel, text, true)).toBe(150);
  });

  it('levágó ős nélkül maga a panel a levágás, és a látható elemre az igény kisebb is lehet a panelnél', () => {
    const panel = boxed(document.body, new DOMRect(0, 0, 300, 200), 'auto');
    const text = boxed(panel, new DOMRect(0, 20, 300, 60));
    expect(measureRevealRequirement(panel, text, true)).toBe(80);
  });

  it('vízszintes csoportban a szélességet és a jobb élet méri', () => {
    const panel = boxed(document.body, new DOMRect(100, 0, 200, 50), 'auto');
    const scroller = boxed(panel, new DOMRect(100, 0, 200, 50), 'auto');
    const text = boxed(scroller, new DOMRect(150, 0, 250, 20));
    scroller.scrollLeft = 10;
    expect(measureRevealRequirement(panel, text, false)).toBe(310);
  });
});
