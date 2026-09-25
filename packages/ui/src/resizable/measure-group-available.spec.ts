import { afterEach, describe, expect, it } from 'vitest';
import { measureGroupAvailable } from './measure-group-available.ts';

/**
 * Egy csoport rögzített kliens mérettel és gyerekekkel (a happy-dom nem
 * végez layoutot).
 */
function groupWith(clientWidth: number, clientHeight: number, children: readonly [string, DOMRect][]): Element {
  const group = document.createElement('div');
  Object.defineProperties(group, { clientWidth: { value: clientWidth }, clientHeight: { value: clientHeight } });
  for (const [className, rect] of children) {
    const child = document.createElement('div');
    child.className = className;
    child.getBoundingClientRect = () => rect;
    group.append(child);
  }
  document.body.append(group);
  return group;
}

describe('measureGroupAvailable', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('függőleges csoportban a kliens magasság mínusz az elválasztók magassága, a panelek méretétől függetlenül', () => {
    const group = groupWith(300, 39.5, [
      ['resizable-panel', new DOMRect(0, 0, 300, 60)],
      ['resizable-handle', new DOMRect(0, 60, 300, 5)],
      ['resizable-panel', new DOMRect(0, 65, 300, 60)],
    ]);
    expect(measureGroupAvailable(group, true)).toBe(34.5);
  });

  it('vízszintes csoportban a kliens szélesség mínusz az elválasztók szélessége', () => {
    const group = groupWith(805, 100, [
      ['resizable-panel', new DOMRect(0, 0, 400, 100)],
      ['resizable-handle', new DOMRect(400, 0, 5, 100)],
      ['resizable-panel', new DOMRect(405, 0, 400, 100)],
    ]);
    expect(measureGroupAvailable(group, false)).toBe(800);
  });
});
