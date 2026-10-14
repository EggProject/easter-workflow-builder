import { ContextMenu, type ContextMenuPosition } from '@easter-workflow-builder/ui';
import type { XYPosition } from '@xyflow/react';
import type { ReactElement } from 'react';
import type { AddableNodeType } from './addable-node-type.ts';
import { ADDABLE_NODE_MENU_ITEMS } from './addable-node-menu-items.ts';

export interface AddNodeContextMenuProperties {
  /**
   * A jobb klikk kliens koordinátája (`event.clientX`/`event.clientY`): a
   * menü itt nyílik, és az új kártya bal felső sarka is ide kerül.
   */
  readonly point: ContextMenuPosition;
  /**
   * A kliens koordinátát flow koordinátára váltó függvény, a vásznon a React
   * Flow `screenToFlowPosition` hívása (M-98); a teszt saját átváltót ad.
   */
  readonly screenToFlowPosition: (clientPosition: XYPosition) => XYPosition;
  /**
   * A választott típus és a kártya bal felső sarka flow koordinátában.
   */
  readonly onAddNode: (type: AddableNodeType, position: Readonly<XYPosition>) => void;
  readonly onClose: () => void;
}

/**
 * A vászon jobb klikk menüje (SPEC-008 5.8, 75. és 76. kritérium): a
 * `packages/ui` `ContextMenu` a kattintás pontján, a kilenc felvehető típussal,
 * "Hozzáadás" hozzáférhető névvel (user döntés 2026-10-14). A választáskor a
 * kattintás pontja a `screenToFlowPosition` átváltáson át lesz az új kártya
 * helye, a `nodeOrigin` alapértéke szerint a bal felső sarka.
 */
export function AddNodeContextMenu(properties: Readonly<AddNodeContextMenuProperties>): ReactElement {
  const { point, screenToFlowPosition, onAddNode, onClose } = properties;
  return (
    <ContextMenu
      position={point}
      label="Hozzáadás"
      items={ADDABLE_NODE_MENU_ITEMS}
      onSelect={(type) => {
        onAddNode(type, screenToFlowPosition({ x: point.x, y: point.y }));
      }}
      onClose={onClose}
    />
  );
}
