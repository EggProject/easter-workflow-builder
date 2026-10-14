import type { XYPosition } from '@xyflow/react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddNodeContextMenu, type AddNodeContextMenuProperties } from './AddNodeContextMenu.tsx';

type OnAddNode = AddNodeContextMenuProperties['onAddNode'];

/**
 * Szándékosan nem azonos átváltó: ha a kezelő a kattintás pontját közvetlenül
 * adná tovább, vagy a pontot nem az átváltón át vinné, az eredmény eltérne.
 */
function fakeScreenToFlowPosition(clientPosition: XYPosition): XYPosition {
  return { x: clientPosition.x * 2 - 7, y: clientPosition.y / 4 + 3 };
}

function menuItems(): readonly HTMLButtonElement[] {
  return [...document.body.querySelectorAll<HTMLButtonElement>(':scope [role="menu"] [role="menuitem"]')];
}

describe('AddNodeContextMenu', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function renderMenu(
    onAddNode: OnAddNode,
    onClose: () => void,
    screenToFlowPosition: AddNodeContextMenuProperties['screenToFlowPosition'] = fakeScreenToFlowPosition,
  ): void {
    act(() => {
      root.render(
        <AddNodeContextMenu
          point={{ x: 120, y: 80 }}
          screenToFlowPosition={screenToFlowPosition}
          onAddNode={onAddNode}
          onClose={onClose}
        />,
      );
    });
  }

  it('a menü hozzáférhető neve "Hozzáadás", és a kilenc felvehető típust adja a katalógus sorrendjében (AC74, AC75)', () => {
    renderMenu(vi.fn<OnAddNode>(), vi.fn());
    expect(document.body.querySelector('[role="menu"]')?.getAttribute('aria-label')).toBe('Hozzáadás');
    expect(menuItems().map((item) => item.textContent)).toEqual([
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

  it('a választott típus helye pontosan az átváltó eredménye a kattintás kliens koordinátáján (AC76)', () => {
    const onAddNode = vi.fn<OnAddNode>();
    const screenToFlowPosition = vi.fn(fakeScreenToFlowPosition);
    const onClose = vi.fn();
    renderMenu(onAddNode, onClose, screenToFlowPosition);

    act(() => {
      menuItems()[4]?.click();
    });

    expect(screenToFlowPosition).toHaveBeenCalledWith({ x: 120, y: 80 });
    expect(onAddNode).toHaveBeenCalledTimes(1);
    expect(onAddNode).toHaveBeenCalledWith('loop', { x: 233, y: 23 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
