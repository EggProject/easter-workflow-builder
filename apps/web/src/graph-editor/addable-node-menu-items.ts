import { NodeTypeSchema } from '@easter-workflow-builder/protocol';
import type { ContextMenuItem } from '@easter-workflow-builder/ui';
import { GRAPH_NODE_CATALOG } from '../graph-node-catalog/graph-node-catalog.ts';
import type { AddableNodeType } from './addable-node-type.ts';

/**
 * A felvételi menü kilenc menüpontja (SPEC-008 5.8, 74. kritérium): a "Hozzáadás"
 * gomb menüje és a vászon jobb klikk menüje is ezt adja. A típusok a tíz
 * `NodeType` sorrendjében állnak, a `start` nélkül, a felirat a
 * `GRAPH_NODE_CATALOG` magyar címkéje; új felirat nem keletkezik.
 */
export const ADDABLE_NODE_MENU_ITEMS: readonly ContextMenuItem<AddableNodeType>[] = NodeTypeSchema.options
  .filter((type) => type !== 'start')
  .map((type) => ({ value: type, label: GRAPH_NODE_CATALOG[type].label }));
