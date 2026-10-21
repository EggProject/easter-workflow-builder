import type { Edge } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { isNodeDeselected, mergeEdgeSelection } from './graph-selection.ts';

const FLOW_EDGES: readonly Edge[] = [
  { id: 'e1', source: 'n1', target: 'n2' },
  { id: 'e2', source: 'n2', target: 'n3' },
  { id: 'e3', source: 'n3', target: 'n1' },
];

describe('mergeEdgeSelection', () => {
  it('a kiválasztott él azonosítója bekerül a halmazba', () => {
    const merged = mergeEdgeSelection(new Set(), [{ id: 'e1', type: 'select', selected: true }], FLOW_EDGES);
    expect([...merged]).toEqual(['e1']);
  });

  it('a kiválasztás megszűnése kiveszi az azonosítót a halmazból', () => {
    const merged = mergeEdgeSelection(
      new Set(['e1', 'e2']),
      [{ id: 'e1', type: 'select', selected: false }],
      FLOW_EDGES,
    );
    expect([...merged]).toEqual(['e2']);
  });

  it('több változást egy lépésben olvaszt be, a korábbi halmaz megtartásával', () => {
    const merged = mergeEdgeSelection(
      new Set(['e1']),
      [
        { id: 'e1', type: 'select', selected: false },
        { id: 'e2', type: 'select', selected: true },
        { id: 'e3', type: 'select', selected: true },
      ],
      FLOW_EDGES,
    );
    expect(merged).toEqual(new Set(['e2', 'e3']));
  });

  it('a kapott halmazt nem módosítja, újat ad vissza', () => {
    const previous: ReadonlySet<string> = new Set(['e1']);
    const merged = mergeEdgeSelection(previous, [{ id: 'e2', type: 'select', selected: true }], FLOW_EDGES);
    expect(merged).not.toBe(previous);
    expect([...previous]).toEqual(['e1']);
  });

  // A változást az `applyEdgeChanges` alkalmazza (SPEC-008 5.5, 9. kritérium):
  // az nem ismer olyan élt, ami nincs a megadott élek között, tehát a törölt
  // él kiválasztása nem marad a halmazban, és új változás sem vehet fel
  // nemlétező azonosítót.
  it('a megadott élek között nem szereplő azonosítót kiveszi a halmazból, és nem veszi fel', () => {
    const merged = mergeEdgeSelection(
      new Set(['gone']),
      [{ id: 'unknown', type: 'select', selected: true }],
      FLOW_EDGES,
    );
    expect(merged.size).toBe(0);
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
