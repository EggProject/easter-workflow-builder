import { describe, expect, it } from 'vitest';
import { computePanelPosition } from './compute-panel-position.ts';

describe('computePanelPosition', () => {
  it('align="left" esetén a trigger bal széléhez igazít', () => {
    const position = computePanelPosition({ left: 40, right: 68, bottom: 100 }, 'left', 320);
    expect(position).toEqual({ top: 106, left: 40 });
  });

  it('align="right" esetén a trigger jobb széléhez igazít, ha belefér a viewportba', () => {
    const position = computePanelPosition({ left: 500, right: 528, bottom: 100 }, 'right', 768);
    expect(position).toEqual({ top: 106, left: 308 });
  });

  // A mért, valódi hiba reprodukciója: az apps/web/e2e/responsive.spec.ts
  // 320px szélességen ezt a triggert mérte (trigger.right=198), ahol a
  // nyers jobb-igazítás -22-re adta volna a `left`-et, ami a panelt a
  // viewport bal szélén túlra tolta.
  it('align="right" esetén a bal margóra szorít, ha a jobbra igazítás a bal szélen túlra esne', () => {
    const position = computePanelPosition({ left: 170, right: 198, bottom: 309 }, 'right', 320);
    expect(position.left).toBe(8);
  });

  it('a bal margóra szorítás sosem megy a margó alá, ha a panel szélesebb, mint a teljes viewport', () => {
    const position = computePanelPosition({ left: 10, right: 30, bottom: 0 }, 'left', 100);
    expect(position.left).toBe(8);
  });
});
