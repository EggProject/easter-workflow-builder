import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type RowData,
} from '@tanstack/react-table';
import { useMemo, type CSSProperties, type KeyboardEvent, type ReactElement, type ReactNode } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import './data-table.css';

export type DataTableAlign = 'left' | 'center' | 'right';

export interface DataTableColumn<TRow> {
  readonly id: string;
  readonly header: string;
  /**
   * A cella szöveges értéke. Ez adja a rendezés alapját is, tehát a
   * rendezés a megjelenített szöveg szerint megy, nem külön kulcs szerint.
   */
  readonly value: (row: TRow) => string;
  /**
   * Egyedi kirajzolás; hiányában a `value` szövege jelenik meg.
   */
  readonly cell?: (row: TRow) => ReactNode;
  readonly align?: DataTableAlign;
  /**
   * Fix oszlopszélesség pixelben. Hiányában az oszlop a maradék helyen
   * egyenlően osztozik a többi rugalmas oszloppal.
   */
  readonly width?: number;
  /**
   * Monospace cella (azonosító, időbélyeg).
   */
  readonly mono?: boolean;
  /**
   * Másodlagos oszlop: a `--ep-screen-lg` (1024px) töréspont alatt
   * elrejtőzik. A rejtés **kizárólag CSS-ben** történik, nem
   * JavaScriptben (SPEC-007 5.3, 16. szekció 18. kritérium).
   */
  readonly secondary?: boolean;
  /**
   * Harmadlagos oszlop: a `--ep-screen-md` (768px) töréspont alatt is
   * elrejtőzik, tehát a másodlagosnál szűkebb tartományban látszik. A
   * mobil szélességen a maradék oszlopok így elférnek anélkül, hogy a
   * tartalom kifutna a viewportból (SPEC-007 5.3).
   */
  readonly tertiary?: boolean;
  /**
   * Rendezhető-e az oszlop. Alapértelmezésben igen; a művelet oszlopon
   * érdemes kikapcsolni.
   */
  readonly sortable?: boolean;
}

export interface DataTableProperties<TRow> {
  readonly rows: readonly TRow[];
  readonly columns: readonly DataTableColumn<TRow>[];
  readonly getRowId: (row: TRow) => string;
  /**
   * A tábla hozzáférhető neve; a szöveg a hívóé.
   */
  readonly label: string;
  /**
   * Üres lista esetén megjelenő szöveg; a szöveg a hívóé.
   */
  readonly emptyLabel: string;
}

/**
 * A táblamotor a `@tanstack/react-table` natív, v9 API-ja (`tableFeatures`
 * plusz `useTable`), az O-2 nyitott kérdés lezárása szerint; a mérés és az
 * indoklás a `docs/research/2026-09-01-spec007-f0-meresek.md` 2.
 * szekciójában áll. Kizárólag a rendezés funkció van bekapcsolva: szűrés,
 * lapozás, kijelölés, csoportosítás és oszlop rögzítés nincs, mert a jelen
 * spec két képernyője nem használja őket (SPEC-007 6.3).
 */
const TABLE_FEATURES = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

const ALIGN_CLASS_NAME: Readonly<Record<DataTableAlign, string | undefined>> = {
  left: undefined,
  center: 'data-table__cell--center',
  right: 'data-table__cell--right',
};

function headerClassName<TRow>(column: DataTableColumn<TRow>, canSort: boolean, isSorted: boolean): string {
  return joinClassNames(
    'data-table__cell',
    'data-table__cell--header',
    ALIGN_CLASS_NAME[column.align ?? 'left'],
    column.secondary === true && 'data-table__cell--secondary',
    column.tertiary === true && 'data-table__cell--tertiary',
    canSort && 'is-sortable',
    isSorted && 'is-sorted',
  );
}

function bodyCellClassName<TRow>(column: DataTableColumn<TRow>): string {
  return joinClassNames(
    'data-table__cell',
    ALIGN_CLASS_NAME[column.align ?? 'left'],
    column.mono === true && 'data-table__cell--mono',
    column.secondary === true && 'data-table__cell--secondary',
    column.tertiary === true && 'data-table__cell--tertiary',
  );
}

function cellStyle<TRow>(column: DataTableColumn<TRow>): CSSProperties {
  return column.width === undefined ? { flex: '1 1 0' } : { flex: '0 0 auto', width: column.width };
}

function ariaSortValue(sortDirection: 'asc' | 'desc' | false | undefined): 'ascending' | 'descending' | 'none' {
  if (sortDirection === 'asc') {
    return 'ascending';
  }
  if (sortDirection === 'desc') {
    return 'descending';
  }
  return 'none';
}

/**
 * A design-token `.data-table` tábla (SPEC-007 6.2, T-008-15). Domain
 * mentes: az oszlopokat és a sorokat a hívó adja, a komponens egyetlen
 * workflow, futás vagy esemény fogalmat sem ismer.
 *
 * A forrás `DataTable.jsx` nem újrahasznosítható komponens, hanem egy
 * beégetett adatokkal dolgozó demó oldal (eszköztár, keresés, szűrők,
 * oszlop menü, tömeges műveletek, lapozó, oszlop és sor rögzítés, oszlop
 * átrendezés és átméretezés). Ebből a tábla váz és a rendezés kerül át; a
 * többi nincs a hatókörben, ezért sem a markup, sem a CSS nem hozza őket
 * (a kihagyás tételes listája a `data-table.css` fejlécében áll).
 *
 * A kirajzolás a hívó `columns` tömbjét járja be, nem a motor fejléc
 * objektumait: így a megjelenítési adat (igazítás, szélesség, másodlagos
 * jelölés) egyetlen visszakeresés nélkül elérhető, a motor pedig azt adja,
 * amiért bekerült, a rendezett sormodellt és a rendezés vezérlőit.
 */
export function DataTable<TRow extends RowData>(properties: Readonly<DataTableProperties<TRow>>): ReactElement {
  const { rows, columns, getRowId, label, emptyLabel } = properties;

  const tableColumns = useMemo(() => {
    const helper = createColumnHelper<typeof TABLE_FEATURES, TRow>();
    return helper.columns(
      columns.map((column) =>
        helper.accessor((row: TRow) => column.value(row), {
          id: column.id,
          header: column.header,
          enableSorting: column.sortable ?? true,
        }),
      ),
    );
  }, [columns]);

  const table = useTable<typeof TABLE_FEATURES, TRow>({
    features: TABLE_FEATURES,
    columns: tableColumns,
    data: rows,
    getRowId,
  });

  return (
    <div className="data-table-scroll">
      <div className="data-table" role="table" aria-label={label}>
        <div className="data-table__header-group" role="rowgroup">
          <div className="data-table__header" role="row">
            {columns.map((column) => {
              const tableColumn = table.getColumn(column.id);
              const canSort = tableColumn?.getCanSort() === true;
              const sortDirection = tableColumn?.getIsSorted();
              return (
                <div
                  key={column.id}
                  role="columnheader"
                  aria-sort={canSort ? ariaSortValue(sortDirection) : undefined}
                  tabIndex={canSort ? 0 : undefined}
                  className={headerClassName(column, canSort, sortDirection === 'asc' || sortDirection === 'desc')}
                  style={cellStyle(column)}
                  onClick={() => {
                    tableColumn?.toggleSorting();
                  }}
                  onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                    if (event.key !== 'Enter' && event.key !== ' ') {
                      return;
                    }
                    event.preventDefault();
                    tableColumn?.toggleSorting();
                  }}
                >
                  <span className="data-table__label">{column.header}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="data-table__body" role="rowgroup">
          {rows.length === 0 && <div className="data-table__empty">{emptyLabel}</div>}
          {table.getRowModel().rows.map((row) => (
            <div key={row.id} className="data-table__row" role="row">
              {columns.map((column) => (
                <div key={column.id} role="cell" className={bodyCellClassName(column)} style={cellStyle(column)}>
                  {column.cell === undefined ? column.value(row.original) : column.cell(row.original)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
