import { afterEach, describe, expect, it } from 'vitest';
import { measureGroupAvailable } from './measure-group-available.ts';

/**
 * Egy csoport rögzített befoglaló dobozzal, szegéllyel és gyerekekkel (a
 * happy-dom nem végez layoutot).
 */
function groupWith(rect: DOMRect, border: string, children: readonly [string, DOMRect][]): Element {
  const group = document.createElement('div');
  group.getBoundingClientRect = () => rect;
  group.style.border = border;
  for (const [className, childRect] of children) {
    const child = document.createElement('div');
    child.className = className;
    child.getBoundingClientRect = () => childRect;
    group.append(child);
  }
  document.body.append(group);
  return group;
}

describe('measureGroupAvailable', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('függőleges csoportban a tört pixeles magasság a két szegély és az elválasztók nélkül, a panelek méretétől függetlenül', () => {
    const group = groupWith(new DOMRect(0, 0, 300, 41.5), '1px solid', [
      ['resizable-panel', new DOMRect(0, 0, 300, 60)],
      ['resizable-handle', new DOMRect(0, 60, 300, 5)],
      ['resizable-panel', new DOMRect(0, 65, 300, 60)],
    ]);
    expect(measureGroupAvailable(group, true)).toBe(34.5);
  });

  it('vízszintes csoportban a szélesség a két szegély és az elválasztók nélkül', () => {
    const group = groupWith(new DOMRect(0, 0, 807, 100), '1px solid', [
      ['resizable-panel', new DOMRect(0, 0, 400, 100)],
      ['resizable-handle', new DOMRect(400, 0, 5, 100)],
      ['resizable-panel', new DOMRect(405, 0, 400, 100)],
    ]);
    expect(measureGroupAvailable(group, false)).toBe(800);
  });

  it('szegély nélkül a teljes befoglaló doboz számít', () => {
    const group = groupWith(new DOMRect(0, 0, 200, 125.25), '', [['resizable-handle', new DOMRect(0, 0, 200, 5)]]);
    expect(measureGroupAvailable(group, true)).toBe(120.25);
  });
});
