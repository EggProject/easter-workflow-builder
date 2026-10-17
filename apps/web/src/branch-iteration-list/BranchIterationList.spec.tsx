import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BranchIterationList, type BranchIterationListProperties } from './BranchIterationList.tsx';
import type { BranchIterationItem } from './branch-iteration-item.ts';

const ITEMS: readonly BranchIterationItem[] = [
  { stepRunId: 's-a', label: '1. Elemzés', status: 'succeeded' },
  { stepRunId: 's-b', label: '2. Elemzés', status: 'failed' },
];

/**
 * A `detail: 1` kötelező: a `SelectField` a `detail === 0` kattintást
 * billentyűzetből származónak tekinti, és szándékosan nem nyit rá.
 */
function clickOn(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  });
}

describe('BranchIterationList', () => {
  let container: HTMLDivElement;
  let root: Root;
  let toggledStepRunIds: string[];
  let selectedStepRunIds: (string | undefined)[];
  let closeCount: number;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    toggledStepRunIds = [];
    selectedStepRunIds = [];
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
          onSelectItem={(stepRunId) => {
            selectedStepRunIds.push(stepRunId);
          }}
          onClose={() => {
            closeCount += 1;
          }}
          isCompact={false}
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

  function selectTrigger(): HTMLButtonElement {
    const trigger = container.querySelector<HTMLButtonElement>('button[role="combobox"]');
    if (trigger === null) {
      throw new Error('a teszt nem talált legördülőt');
    }
    return trigger;
  }

  /**
   * A panel `createPortal`-lal a `document.body`-ba kerül; a triggerhez az
   * `aria-controls` köti.
   */
  function optionElements(): readonly HTMLElement[] {
    const panelId = selectTrigger().getAttribute('aria-controls');
    const panel = [...document.body.querySelectorAll<HTMLElement>('[role="listbox"]')].find(
      (candidate) => candidate.id === panelId,
    );
    return [...(panel?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
  }

  function chooseOption(optionLabel: string): void {
    clickOn(selectTrigger());
    const option = optionElements().find((candidate) => candidate.textContent === optionLabel);
    if (option === undefined) {
      throw new Error(`a teszt nem talált "${optionLabel}" opciót`);
    }
    clickOn(option);
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

  describe('legördülő alak, függő jóváhagyás alatt (user döntés 2026-10-17)', () => {
    it('egyetlen sor: a régió neve a cím, se cím elem, se tábla, se mondat; a legördülő sm méretű, a cím a neve', () => {
      renderList({ isCompact: true });
      const region = container.querySelector('section');
      expect(region?.getAttribute('aria-label')).toBe('Ágak: Elemek szétosztása');
      expect(region?.classList.contains('branch-iteration-list--compact')).toBe(true);
      expect(container.querySelector('h3')).toBeNull();
      expect(container.querySelector('[role="table"]')).toBeNull();
      expect(container.querySelector('.branch-iteration-list__note')).toBeNull();
      expect(selectTrigger().getAttribute('aria-label')).toBe('Ágak: Elemek szétosztása');
      expect(selectTrigger().classList.contains('select--sm')).toBe(true);
    });

    it('az első opció a csomópont minden ága, utána tételenként a felirat és az állapot jelvény felirata', () => {
      renderList({ isCompact: true });
      expect(selectTrigger().textContent).toBe('Összes ág');
      clickOn(selectTrigger());
      expect(optionElements().map((option) => option.textContent)).toEqual([
        'Összes ág',
        '1. Elemzés, sikeres',
        '2. Elemzés, sikertelen',
      ]);
    });

    it('a loop első opciója a csomópont minden iterációja', () => {
      renderList({ isCompact: true, kind: 'loop', nodeLabel: 'Ismétlés' });
      expect(container.querySelector('section')?.getAttribute('aria-label')).toBe('Iterációk: Ismétlés');
      expect(selectTrigger().textContent).toBe('Összes iteráció');
    });

    it('a kiválasztott tétel a legördülő értéke', () => {
      renderList({ isCompact: true, selectedStepRunId: 's-b' });
      expect(selectTrigger().textContent).toBe('2. Elemzés, sikertelen');
    });

    it('egy tétel választása a lépés futásával, a minden tétel opció undefined értékkel hívja a választót', () => {
      renderList({ isCompact: true, selectedStepRunId: 's-a' });
      chooseOption('2. Elemzés, sikertelen');
      chooseOption('Összes ág');
      expect(selectedStepRunIds).toEqual(['s-b', undefined]);
      expect(toggledStepRunIds).toEqual([]);
    });

    it('a bezárás gombja a legördülő mellett is ott áll, és a bezárást hívja', () => {
      renderList({ isCompact: true });
      expect(closeButton().classList.contains('btn--icon')).toBe(true);
      act(() => {
        closeButton().click();
      });
      expect(closeCount).toBe(1);
    });
  });
});
