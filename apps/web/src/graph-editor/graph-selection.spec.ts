import { describe, expect, it } from 'vitest';
import { isNodeDeselected, mergeEdgeSelection } from './graph-selection.ts';

describe('mergeEdgeSelection', () => {
  it('a kiválasztott él azonosítója bekerül a halmazba', () => {
    const merged = mergeEdgeSelection(new Set(), [{ id: 'e1', type: 'select', selected: true }]);
    expect([...merged]).toEqual(['e1']);
  });

  it('a kiválasztás megszűnése kiveszi az azonosítót a halmazból', () => {
    const merged = mergeEdgeSelection(new Set(['e1', 'e2']), [{ id: 'e1', type: 'select', selected: false }]);
    expect([...merged]).toEqual(['e2']);
  });

  it('több változást egy lépésben olvaszt be, a korábbi halmaz megtartásával', () => {
    const merged = mergeEdgeSelection(new Set(['e1']), [
      { id: 'e1', type: 'select', selected: false },
      { id: 'e2', type: 'select', selected: true },
      { id: 'e3', type: 'select', selected: true },
    ]);
    expect(merged).toEqual(new Set(['e2', 'e3']));
  });

  it('a kapott halmazt nem módosítja, újat ad vissza', () => {
    const previous: ReadonlySet<string> = new Set(['e1']);
    const merged = mergeEdgeSelection(previous, [{ id: 'e2', type: 'select', selected: true }]);
    expect(merged).not.toBe(previous);
    expect([...previous]).toEqual(['e1']);
  });
});

describe('isNodeDeselected', () => {
  it('igaz, ha a megadott csomópont kiválasztása szűnt meg', () => {
    expect(isNodeDeselected([{ id: 'n1', type: 'select', selected: false }], 'n1')).toBe(true);
  });

  it('hamis, ha a kiválasztás megszűnése MÁSIK csomópontra vonatkozik', () => {
    expect(isNodeDeselected([{ id: 'n2', type: 'select', selected: false }], 'n1')).toBe(false);
  });

  it('hamis, ha a változás kiválasztás, nem annak megszűnése', () => {
    expect(isNodeDeselected([{ id: 'n1', type: 'select', selected: true }], 'n1')).toBe(false);
  });

  it('hamis, ha nincs kiválasztott csomópont', () => {
    expect(isNodeDeselected([{ id: 'n1', type: 'select', selected: false }], undefined)).toBe(false);
  });

  it('igaz akkor is, ha a listában több változás van, és csak az egyik érinti a csomópontot', () => {
    expect(
      isNodeDeselected(
        [
          { id: 'n2', type: 'select', selected: true },
          { id: 'n1', type: 'select', selected: false },
        ],
        'n1',
      ),
    ).toBe(true);
  });
});
