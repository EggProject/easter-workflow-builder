import { describe, expect, it } from 'vitest';
import { GRAPH_NODE_CATALOG } from '../graph-node-catalog/graph-node-catalog.ts';
import { ADDABLE_NODE_MENU_ITEMS } from './addable-node-menu-items.ts';

describe('ADDABLE_NODE_MENU_ITEMS', () => {
  it('pontosan kilenc menüpont, a katalógus sorrendjében, a start nélkül (SPEC-008 5.8, AC74)', () => {
    const catalogTypesWithoutStart = Object.keys(GRAPH_NODE_CATALOG).filter((type) => type !== 'start');
    expect(ADDABLE_NODE_MENU_ITEMS).toHaveLength(9);
    expect(ADDABLE_NODE_MENU_ITEMS.map((item) => item.value)).toEqual(catalogTypesWithoutStart);
  });

  it('a felirat a katalógus magyar címkéje', () => {
    expect(ADDABLE_NODE_MENU_ITEMS.map((item) => item.label)).toEqual([
      'Agent lépés',
      'Elágazás',
      'Szétosztás',
      'Összefésülés',
      'Ciklus',
      'Emberi jóváhagyás',
      'Hibakezelő',
      'Al-workflow',
      'Szkript',
    ]);
  });
});
