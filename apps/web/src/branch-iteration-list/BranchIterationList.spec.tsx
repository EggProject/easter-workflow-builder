import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BranchIterationList, type BranchIterationListProperties } from './BranchIterationList.tsx';
import type { BranchIterationItem } from './branch-iteration-item.ts';

const ITEMS: readonly BranchIterationItem[] = [
  { stepRunId: 's-a', label: '1. Elemzés', status: 'succeeded' },
  { stepRunId: 's-b', label: '2. Elemzés', status: 'failed' },
];

describe('BranchIterationList', () => {
  let container: HTMLDivElement;
  let root: Root;
  let toggledStepRunIds: string[];
  let closeCount: number;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    toggledStepRunIds = [];
    closeCount = 0;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function renderList(overrides: Partial<BranchIterationListProperties> = {}): void {
    act(() => {
      root.render(
        <BranchIterationList
          kind="fan_out"
          nodeLabel="Elemek szétosztása"
          items={ITEMS}
          selectedStepRunId={undefined}
          onToggleItem={(stepRunId) => {
            toggledStepRunIds.push(stepRunId);
          }}
          onClose={() => {
            closeCount += 1;
          }}
          {...overrides}
        />,
      );
    });
  }

  function itemButton(name: string): HTMLButtonElement {
    const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent === name,
    );
    if (button === undefined) {
      throw new Error(`a teszt nem talált "${name}" gombot`);
    }
    return button;
  }

  function closeButton(): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>('button[aria-label="A lista bezárása"]');
    if (button === null) {
      throw new Error('a teszt nem talált bezárás gombot');
    }
    return button;
  }

  it('a fan_out listája a csomópont nevével címzett, megnevezett régió', () => {
    renderList();
    const region = container.querySelector('section');
    const heading = container.querySelector('h3');
    expect(heading?.textContent).toBe('Ágak: Elemek szétosztása');
    expect(region?.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect(container.querySelector('[role="table"]')?.getAttribute('aria-label')).toBe('Ágak: Elemek szétosztása');
  });

  it('a loop listája az iterációkat nevezi meg', () => {
    renderList({ kind: 'loop', nodeLabel: 'Ismétlés' });
    expect(container.querySelector('h3')?.textContent).toBe('Iterációk: Ismétlés');
  });

  it('soronként a tétel gombját és az állapot jelvényét mutatja, a csomópont kártya feliratával', () => {
    renderList();
    const rows = [...container.querySelectorAll(':scope .data-table__body [role="row"]')];
    expect(rows.map((row) => row.textContent)).toEqual(['1. Elemzéssikeres', '2. Elemzéssikertelen']);
    expect(container.querySelectorAll('.badge')).toHaveLength(2);
  });

  it('tétel nélkül egyik gomb sincs lenyomva, és a mondat a csomópont minden tételéről szól', () => {
    renderList();
    expect(itemButton('1. Elemzés').getAttribute('aria-pressed')).toBe('false');
    expect(itemButton('2. Elemzés').getAttribute('aria-pressed')).toBe('false');
    expect(container.textContent).toContain('A transcript a csomópont minden tételének eseményeit mutatja.');
  });

  it('a kiválasztott tétel gombja lenyomott és secondary változatú, a mondat a kiválasztott tételről szól', () => {
    renderList({ selectedStepRunId: 's-b' });
    expect(itemButton('2. Elemzés').getAttribute('aria-pressed')).toBe('true');
    expect(itemButton('2. Elemzés').classList.contains('btn--secondary')).toBe(true);
    expect(itemButton('1. Elemzés').classList.contains('btn--ghost')).toBe(true);
    expect(container.textContent).toContain('A transcript csak a kiválasztott tétel eseményeit mutatja.');
  });

  it('a tétel gombja a tétel lépés futásával hívja a váltót, sm méretben', () => {
    renderList();
    act(() => {
      itemButton('2. Elemzés').click();
    });
    expect(toggledStepRunIds).toEqual(['s-b']);
    expect(itemButton('2. Elemzés').classList.contains('btn--sm')).toBe(true);
  });

  it('a bezárás sm méretű ikon gomb, hozzáférhető névvel, és a bezárást hívja', () => {
    renderList();
    expect(closeButton().classList.contains('btn--icon')).toBe(true);
    expect(closeButton().classList.contains('btn--sm')).toBe(true);
    act(() => {
      closeButton().click();
    });
    expect(closeCount).toBe(1);
  });

  it('az oszlopok nem rendezhetők: a fejlécre kattintva a létrehozási sorrend marad, aria-sort nélkül', () => {
    renderList({ items: [...ITEMS].toReversed() });
    const headers = [...container.querySelectorAll<HTMLElement>(':scope [role="columnheader"]')];
    expect(headers.map((header) => header.textContent)).toEqual(['Tétel', 'Állapot']);

    for (const header of headers) {
      act(() => {
        header.click();
      });
      expect(header.hasAttribute('aria-sort')).toBe(false);
      const rows = [...container.querySelectorAll(':scope .data-table__body [role="row"]')];
      expect(rows.map((row) => row.textContent)).toEqual(['2. Elemzéssikertelen', '1. Elemzéssikeres']);
    }
  });

  it('tétel nélkül fajtánként kimondja, hogy még nincs ág, illetve iteráció', () => {
    renderList({ items: [] });
    expect(container.querySelector('.data-table__empty')?.textContent).toBe('A csomópontnak még nincs ága.');
    renderList({ kind: 'loop', items: [] });
    expect(container.querySelector('.data-table__empty')?.textContent).toBe('A csomópontnak még nincs iterációja.');
  });
});
