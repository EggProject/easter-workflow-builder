import { describe, expect, it } from 'vitest';
import { computePanelPosition } from './compute-panel-position.ts';

describe('computePanelPosition', () => {
  it('align="left" esetén a trigger bal széléhez igazít, és lefelé nyílik, ha alatta több hely van', () => {
    const position = computePanelPosition({ left: 40, right: 68, top: 80, bottom: 100 }, 'left', 320, 900);
    expect(position).toEqual({ top: 106, bottom: undefined, left: 40 });
  });

  it('align="right" esetén a trigger jobb széléhez igazít, ha belefér a viewportba', () => {
    const position = computePanelPosition({ left: 500, right: 528, top: 80, bottom: 100 }, 'right', 768, 900);
    expect(position).toEqual({ top: 106, bottom: undefined, left: 308 });
  });

  // A mért, valódi hiba reprodukciója: az apps/web/e2e/responsive.spec.ts
  // 320px szélességen ezt a triggert mérte (trigger.right=198), ahol a
  // nyers jobb-igazítás -22-re adta volna a `left`-et, ami a panelt a
  // viewport bal szélén túlra tolta.
  it('align="right" esetén a bal margóra szorít, ha a jobbra igazítás a bal szélen túlra esne', () => {
    const position = computePanelPosition({ left: 170, right: 198, top: 280, bottom: 309 }, 'right', 320, 900);
    expect(position.left).toBe(8);
  });

  it('a bal margóra szorítás sosem megy a margó alá, ha a panel szélesebb, mint a teljes viewport', () => {
    const position = computePanelPosition({ left: 10, right: 30, top: 0, bottom: 20 }, 'left', 100, 900);
    expect(position.left).toBe(8);
  });

  // A mért, valódi hiba reprodukciója: apps/web/e2e/graph-editor-layout.spec.ts
  // "a lábléc ragadós ... split button gombcsoporttal" - a szerkesztő
  // láblécének triggere a viewport aljához tapad, a régi, mindig lefelé
  // nyíló logika a panelt a viewporton kívülre helyezte ("element is
  // outside of the viewport").
  it('felfelé nyílik, ha a trigger a viewport aljához közel ül, és alatta kevesebb hely van, mint fölötte', () => {
    const position = computePanelPosition({ left: 700, right: 736, top: 860, bottom: 892 }, 'left', 1440, 900);
    expect(position.top).toBeUndefined();
    expect(position.bottom).toBe(900 - 860 + 6);
    expect(position.left).toBe(700);
  });

  it('lefelé nyílik, ha a trigger fent van, még akkor is, ha a tér alatta és fölötte pontosan egyenlő', () => {
    const position = computePanelPosition({ left: 0, right: 20, top: 450, bottom: 450 }, 'left', 320, 900);
    expect(position.top).toBe(456);
    expect(position.bottom).toBeUndefined();
  });
});
