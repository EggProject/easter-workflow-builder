import { describe, expect, it } from 'vitest';
import { measurePanelGeometry } from './measure-panel-geometry.ts';

/**
 * Egy panel valódi DOM elemként, rögzített befoglaló dobozzal (a happy-dom
 * `getBoundingClientRect()` mindig nulla téglalapot ad) és inline minimummal,
 * amit a `getComputedStyle` kiszámított értékként ad vissza.
 */
function panelWith(
  width: number,
  height: number,
  minimums: Readonly<{ minWidth?: string; minHeight?: string }> = {},
): Element {
  const element = document.createElement('div');
  element.getBoundingClientRect = () => new DOMRect(0, 0, width, height);
  element.style.minWidth = minimums.minWidth ?? '';
  element.style.minHeight = minimums.minHeight ?? '';
  document.body.append(element);
  return element;
}

describe('measurePanelGeometry', () => {
  it('függőleges csoportban a magasságok összegét és a min-height minimumot méri, százalékban', () => {
    const geometry = measurePanelGeometry(
      [panelWith(300, 100, { minHeight: '60px' }), panelWith(300, 300, { minHeight: '60px' })],
      true,
    );
    expect(geometry).toEqual({ availableSizePixels: 400, minSizePercents: [15, 15] });
  });

  it('vízszintes csoportban a szélességek összegét és a min-width minimumot méri', () => {
    const geometry = measurePanelGeometry(
      [panelWith(600, 50, { minWidth: '80px', minHeight: '60px' }), panelWith(200, 50, { minWidth: '80px' })],
      false,
    );
    expect(geometry).toEqual({ availableSizePixels: 800, minSizePercents: [10, 10] });
  });

  it('nem pixeles (üres vagy auto) minimum nullának számít', () => {
    const geometry = measurePanelGeometry([panelWith(100, 100), panelWith(100, 100, { minHeight: 'auto' })], true);
    expect(geometry).toEqual({ availableSizePixels: 200, minSizePercents: [0, 0] });
  });

  it('ha egy panel nincs kirajzolva, nincs mérés', () => {
    expect(measurePanelGeometry([undefined, panelWith(100, 100)], true)).toBeUndefined();
  });

  it('nulla együttes méretre (rejtett panel) nincs mérés', () => {
    expect(measurePanelGeometry([panelWith(0, 0), panelWith(0, 0)], true)).toBeUndefined();
  });
});
