import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DataTable, type DataTableColumn } from './DataTable.tsx';

interface DemoRow {
  readonly id: string;
  readonly name: string;
  readonly created: string;
}

const ROWS: readonly DemoRow[] = [
  { id: 'wf-2', name: 'Béta', created: '2026-02-01' },
  { id: 'wf-1', name: 'Alfa', created: '2026-01-01' },
  { id: 'wf-3', name: 'Céda', created: '2026-03-01' },
];

const COLUMNS: readonly DataTableColumn<DemoRow>[] = [
  { id: 'id', header: 'Azonosító', value: (row) => row.id, mono: true, width: 120 },
  { id: 'name', header: 'Név', value: (row) => row.name },
  { id: 'created', header: 'Létrehozva', value: (row) => row.created, align: 'right', secondary: true },
];

function pressKeyOn(element: HTMLElement, key: string): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

describe('DataTable', () => {
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

  function renderDemoTable(
    columns: readonly DataTableColumn<DemoRow>[] = COLUMNS,
    rows: readonly DemoRow[] = ROWS,
  ): void {
    act(() => {
      root.render(
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          label="Workflow-k"
          emptyLabel="Nincs egyetlen workflow sem"
        />,
      );
    });
  }

  function headerCells(): readonly HTMLDivElement[] {
    return [...container.querySelectorAll<HTMLDivElement>('[role="columnheader"]')];
  }

  function bodyRowTexts(): readonly string[] {
    return [...container.querySelectorAll<HTMLDivElement>('.data-table__row')].map(
      (row) => row.querySelectorAll('[role="cell"]')[1]?.textContent ?? '',
    );
  }

  it('a tábla váz a design system osztályaival és table szereppel rajzolódik ki', () => {
    renderDemoTable();
    const table = container.querySelector('[role="table"]');
    expect(table?.className).toBe('data-table');
    expect(table?.getAttribute('aria-label')).toBe('Workflow-k');
    expect(container.querySelector('.data-table-scroll')).not.toBeNull();
    expect(container.querySelector('.data-table__header-group')).not.toBeNull();
    expect(container.querySelectorAll('[role="rowgroup"]')).toHaveLength(2);
  });

  it('minden oszlopból fejléc cella lesz, a felirattal', () => {
    renderDemoTable();
    expect(headerCells().map((cell) => cell.textContent)).toEqual(['Azonosító', 'Név', 'Létrehozva']);
    expect(headerCells()[0]?.querySelector('.data-table__label')?.textContent).toBe('Azonosító');
  });

  it('minden sorból egy sor elem lesz, cellánként az oszlop értékével', () => {
    renderDemoTable();
    const rows = [...container.querySelectorAll('.data-table__row')];
    expect(rows).toHaveLength(3);
    expect([...(rows[0]?.querySelectorAll('[role="cell"]') ?? [])].map((cell) => cell.textContent)).toEqual([
      'wf-2',
      'Béta',
      '2026-02-01',
    ]);
  });

  it('az igazítás, a monospace és a másodlagos jelölés osztálya kikerül', () => {
    renderDemoTable();
    const firstRowCells = [...(container.querySelector('.data-table__row')?.querySelectorAll('[role="cell"]') ?? [])];
    expect(firstRowCells[0]?.className).toBe('data-table__cell data-table__cell--mono');
    expect(firstRowCells[1]?.className).toBe('data-table__cell');
    expect(firstRowCells[2]?.className).toBe('data-table__cell data-table__cell--right data-table__cell--secondary');
  });

  it('a másodlagos jelölés a fejléc cellára is kikerül, hogy a CSS a teljes oszlopot rejtse', () => {
    renderDemoTable();
    expect(headerCells()[2]?.className).toContain('data-table__cell--secondary');
  });

  it('a harmadlagos jelölés a fejléc és a törzs cellájára is kikerül', () => {
    renderDemoTable([{ id: 'name', header: 'Név', value: (row) => row.name, tertiary: true }]);
    expect(headerCells()[0]?.className).toContain('data-table__cell--tertiary');
    const cell = container.querySelector(':scope .data-table__row [role="cell"]');
    expect(cell?.className).toBe('data-table__cell data-table__cell--tertiary');
  });

  it('a középre igazított oszlop a saját osztályát kapja', () => {
    renderDemoTable([{ id: 'name', header: 'Név', value: (row) => row.name, align: 'center' }]);
    const cell = container.querySelector(':scope .data-table__row [role="cell"]');
    expect(cell?.className).toBe('data-table__cell data-table__cell--center');
  });

  it('szélesség megadásakor fix, egyébként rugalmas cella stílus', () => {
    renderDemoTable();
    const firstRowCells = [
      ...(container.querySelector('.data-table__row')?.querySelectorAll<HTMLDivElement>('[role="cell"]') ?? []),
    ];
    // A happy-dom a `flex` rovidites helyett a kifejtett tulajdonsagokat adja
    // vissza, ezert azokra allitunk.
    expect(firstRowCells[0]?.style.width).toBe('120px');
    expect(firstRowCells[0]?.style.flexGrow).toBe('0');
    expect(firstRowCells[1]?.style.width).toBe('');
    expect(firstRowCells[1]?.style.flexGrow).toBe('1');
    expect(firstRowCells[1]?.style.flexBasis).toBe('0px');
  });

  it('fitContent esetén a cella a tartalmához igazodik, sem fixen, sem egyenlő elosztásban', () => {
    renderDemoTable([
      { id: 'name', header: 'Név', value: (row) => row.name },
      { id: 'actions', header: 'Műveletek', value: () => '', fitContent: true },
    ]);
    const [, actionsHeader] = headerCells();
    const actionsBodyCell = container.querySelector<HTMLDivElement>(':scope .data-table__row [role="cell"]:last-child');
    for (const cell of [actionsHeader, actionsBodyCell]) {
      expect(cell?.style.flexGrow).toBe('0');
      expect(cell?.style.flexShrink).toBe('0');
      expect(cell?.style.width).toBe('');
    }
  });

  it('hiddenHeader esetén a felirat vizuálisan rejtett osztályt kap, de a szövege megmarad', () => {
    renderDemoTable([
      { id: 'name', header: 'Név', value: (row) => row.name },
      { id: 'actions', header: 'Műveletek', value: () => '', hiddenHeader: true },
    ]);
    const [nameHeader, actionsHeader] = headerCells();
    const nameLabel = nameHeader?.querySelector('.data-table__label');
    const actionsLabel = actionsHeader?.querySelector('.data-table__label');

    // A nem rejtett fejléc felirata nem kapja meg a rejtő osztályt.
    expect(nameLabel?.className).toBe('data-table__label');
    // A rejtett fejléc felirata megkapja, DE a szövege és a columnheader
    // accessible name-je (a role szerinti keresés) ettől függetlenül elérhető
    // marad - a rejtés vizuális, nem a hozzáférhetőségi fából való eltávolítás.
    expect(actionsLabel?.className).toBe('data-table__label data-table__label--visually-hidden');
    expect(actionsHeader?.textContent).toBe('Műveletek');
    // A columnheader role accessible name-je a szöveges tartalomból származik,
    // tehát a `getByRole`-lal kereső e2e tesztek a rejtés után is megtalálják.
    expect(actionsHeader?.getAttribute('role')).toBe('columnheader');
  });

  it('hiddenHeader esetén a fejléc cella align-self: stretch stílust kap, hogy ne nullázódjon a magassága', () => {
    renderDemoTable([
      { id: 'name', header: 'Név', value: (row) => row.name },
      { id: 'actions', header: 'Műveletek', value: () => '', hiddenHeader: true },
    ]);
    const [nameHeader, actionsHeader] = headerCells();

    // A nem rejtett fejléc cellája nem kapja meg a nyújtó stílust: a felirata
    // a normál elrendezésben marad, tehát a cellának amúgy is van magassága.
    expect(nameHeader?.style.alignSelf).toBe('');
    // A rejtett fejléc felirata `position: absolute`-ra kerül (lásd a CSS
    // `data-table__label--visually-hidden` szabályát), a cellának emiatt
    // saját tartalom nélkül nulla lenne a magassága - ez adja vissza a sor
    // teljes, fix magasságát (`.data-table__header { height: 40px }`).
    expect(actionsHeader?.style.alignSelf).toBe('stretch');
    // A törzs cellára ez nem vonatkozik: annak mindig van valódi tartalma
    // (szöveg vagy egyedi kirajzolás), tehát sosem nullázódna a magassága.
    const actionsBodyCell = container.querySelector<HTMLDivElement>(':scope .data-table__row [role="cell"]:last-child');
    expect(actionsBodyCell?.style.alignSelf).toBe('');
  });

  it('egyedi cella kirajzolás felülírja a szöveges értéket', () => {
    renderDemoTable([
      {
        id: 'name',
        header: 'Név',
        value: (row) => row.name,
        cell: (row) => <strong>{row.name.toUpperCase()}</strong>,
      },
    ]);
    expect(container.querySelector(':scope .data-table__row strong')?.textContent).toBe('BÉTA');
  });

  it('üres lista esetén az üres állapot szövege jelenik meg', () => {
    renderDemoTable(COLUMNS, []);
    expect(container.querySelector('.data-table__empty')?.textContent).toBe('Nincs egyetlen workflow sem');
    expect(container.querySelectorAll('.data-table__row')).toHaveLength(0);
  });

  it('alapból minden oszlop rendezhető, és egyik sincs rendezve', () => {
    renderDemoTable();
    for (const cell of headerCells()) {
      expect(cell.className).toContain('is-sortable');
      expect(cell.getAttribute('aria-sort')).toBe('none');
      expect(cell.tabIndex).toBe(0);
    }
    expect(bodyRowTexts()).toEqual(['Béta', 'Alfa', 'Céda']);
  });

  it('fejléc kattintásra növekvő, majd csökkenő rendezés, aztán rendezetlen', () => {
    renderDemoTable();
    const nameHeader = headerCells()[1];
    if (nameHeader === undefined) {
      throw new Error('nincs kirajzolt fejléc');
    }

    act(() => {
      nameHeader.click();
    });
    expect(bodyRowTexts()).toEqual(['Alfa', 'Béta', 'Céda']);
    expect(headerCells()[1]?.getAttribute('aria-sort')).toBe('ascending');
    expect(headerCells()[1]?.className).toContain('is-sorted');

    act(() => {
      headerCells()[1]?.click();
    });
    expect(bodyRowTexts()).toEqual(['Céda', 'Béta', 'Alfa']);
    expect(headerCells()[1]?.getAttribute('aria-sort')).toBe('descending');

    act(() => {
      headerCells()[1]?.click();
    });
    expect(bodyRowTexts()).toEqual(['Béta', 'Alfa', 'Céda']);
    expect(headerCells()[1]?.getAttribute('aria-sort')).toBe('none');
  });

  it('Enter és szóköz billentyűre is rendez, más billentyűre nem', () => {
    renderDemoTable();
    const nameHeader = headerCells()[1];
    if (nameHeader === undefined) {
      throw new Error('nincs kirajzolt fejléc');
    }

    pressKeyOn(nameHeader, 'a');
    expect(bodyRowTexts()).toEqual(['Béta', 'Alfa', 'Céda']);

    pressKeyOn(nameHeader, 'Enter');
    expect(bodyRowTexts()).toEqual(['Alfa', 'Béta', 'Céda']);

    const sortedHeader = headerCells()[1];
    if (sortedHeader === undefined) {
      throw new Error('nincs kirajzolt fejléc');
    }
    pressKeyOn(sortedHeader, ' ');
    expect(bodyRowTexts()).toEqual(['Céda', 'Béta', 'Alfa']);
  });

  it('sortable=false esetén a fejléc nem rendezhető, és kattintásra sem rendez', () => {
    renderDemoTable([
      { id: 'name', header: 'Név', value: (row) => row.name, sortable: false },
      { id: 'created', header: 'Létrehozva', value: (row) => row.created },
    ]);
    const nameHeader = headerCells()[0];
    expect(nameHeader?.className).not.toContain('is-sortable');
    expect(nameHeader?.getAttribute('aria-sort')).toBeNull();
    expect(nameHeader?.hasAttribute('tabindex')).toBe(false);

    act(() => {
      nameHeader?.click();
    });
    const firstCellTexts = [...container.querySelectorAll('.data-table__row')].map(
      (row) => row.querySelector('[role="cell"]')?.textContent ?? '',
    );
    expect(firstCellTexts).toEqual(['Béta', 'Alfa', 'Céda']);
  });

  it('a sorok a getRowId szerinti azonosítón maradnak rendezés után is', () => {
    renderDemoTable();
    act(() => {
      headerCells()[0]?.click();
    });
    const idTexts = [...container.querySelectorAll('.data-table__row')].map(
      (row) => row.querySelector('[role="cell"]')?.textContent ?? '',
    );
    expect(idTexts).toEqual(['wf-1', 'wf-2', 'wf-3']);
  });
});
