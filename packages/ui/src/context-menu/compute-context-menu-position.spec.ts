import { describe, expect, it } from 'vitest';
import { computeContextMenuPosition } from './compute-context-menu-position.ts';

const VIEWPORT = { width: 1440, height: 900 };
const PANEL = { width: 200, height: 300 };

describe('computeContextMenuPosition', () => {
  it('a nyitási ponton hagyja a panelt, ha mindkét tengelyen belefér a nézetablakba', () => {
    expect(computeContextMenuPosition({ x: 400, y: 250 }, PANEL, VIEWPORT)).toEqual({ left: 400, top: 250 });
  });

  it('a közeli élen a margóra szorít, ha a pont a margón belül vagy a nézetablakon kívül esik', () => {
    expect(computeContextMenuPosition({ x: 3, y: -20 }, PANEL, VIEWPORT)).toEqual({ left: 8, top: 8 });
  });

  it('a távoli élen a nézetablak mérete mínusz a panel és a margó értékére szorít', () => {
    expect(computeContextMenuPosition({ x: 1400, y: 880 }, PANEL, VIEWPORT)).toEqual({
      left: 1440 - 200 - 8,
      top: 900 - 300 - 8,
    });
  });

  it('a távoli határon pontosan álló panelt nem mozdítja', () => {
    expect(computeContextMenuPosition({ x: 1232, y: 592 }, PANEL, VIEWPORT)).toEqual({ left: 1232, top: 592 });
  });

  it('a közeli margóra tapad, ha a panel nagyobb, mint a nézetablak a két margóval', () => {
    expect(
      computeContextMenuPosition({ x: 120, y: 90 }, { width: 400, height: 300 }, { width: 410, height: 310 }),
    ).toEqual({ left: 8, top: 8 });
  });

  it('nulla méretű panelnél csak a közeli élen szorít, a távolin nem', () => {
    expect(computeContextMenuPosition({ x: 5000, y: 2 }, { width: 0, height: 0 }, VIEWPORT)).toEqual({
      left: 5000,
      top: 8,
    });
  });

  it('egész pixelre kerekít, a szorítás nélküli és a szorított ágon is', () => {
    expect(computeContextMenuPosition({ x: 100.6, y: 200.4 }, PANEL, VIEWPORT)).toEqual({ left: 101, top: 200 });
    expect(computeContextMenuPosition({ x: 2.2, y: 3.7 }, { width: 0, height: 0 }, VIEWPORT)).toEqual({
      left: 8,
      top: 8,
    });
    expect(computeContextMenuPosition({ x: 1500, y: 10 }, { width: 200.4, height: 10 }, VIEWPORT)).toEqual({
      left: 1232,
      top: 10,
    });
  });

  it('a két tengelyt egymástól függetlenül szorítja', () => {
    expect(computeContextMenuPosition({ x: 1400, y: 4 }, PANEL, VIEWPORT)).toEqual({ left: 1232, top: 8 });
  });
});
