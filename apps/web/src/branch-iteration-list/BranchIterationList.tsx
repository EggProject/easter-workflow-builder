import { Badge, Button, DataTable, type DataTableColumn } from '@easter-workflow-builder/ui';
import { useId, type ReactElement } from 'react';
import { describeStepRunStatusBadge } from '../graph-node-card/step-run-status-badge.ts';
import type { BranchIterationItem } from './branch-iteration-item.ts';
import type { BranchIterationListKind } from './branch-iteration-list-kind.ts';
import './branch-iteration-list.css';

interface BranchIterationListText {
  readonly titlePrefix: string;
  readonly emptyLabel: string;
}

/**
 * A két listafajta szövegei; a `Record` kimerítő, tehát egy harmadik fajta
 * fordítási hibát ad.
 */
const LIST_TEXT: Readonly<Record<BranchIterationListKind, BranchIterationListText>> = {
  fan_out: { titlePrefix: 'Ágak', emptyLabel: 'A csomópontnak még nincs ága.' },
  loop: { titlePrefix: 'Iterációk', emptyLabel: 'A csomópontnak még nincs iterációja.' },
};

const ALL_ITEMS_NOTE = 'A transcript a csomópont minden tételének eseményeit mutatja.';
const ONE_ITEM_NOTE = 'A transcript csak a kiválasztott tétel eseményeit mutatja.';
const CLOSE_LABEL = 'A lista bezárása';

/**
 * A bezárás ikon: ugyanaz az útvonal, mint a design system modális és
 * drawer fejlécének bezárás gombján (`packages/ui` `Modal.tsx`, forrás
 * `eggproject-design-components/components/drawer/Drawer.jsx`). Az
 * `aria-hidden` miatt kimarad a hozzáférhetőségi fából: a gomb neve az
 * `aria-label`.
 */
function CloseIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export interface BranchIterationListProperties {
  readonly kind: BranchIterationListKind;
  /**
   * A csomópont neve a pillanatképből: a lista címe ebből és a fajtából áll.
   */
  readonly nodeLabel: string;
  readonly items: readonly BranchIterationItem[];
  /**
   * A transcriptet szűkítő tétel lépés futása; `undefined`, ha a transcript a
   * csomópont minden tételét mutatja.
   */
  readonly selectedStepRunId: string | undefined;
  readonly onToggleItem: (stepRunId: string) => void;
  readonly onClose: () => void;
}

/**
 * A `fan_out` ágainak és a `loop` iterációinak tételes listája a futás nézet
 * transcript sávjának tetején (SPEC-008 6.3, O-39, user döntés 2026-10-17).
 *
 * **Csak design system elem.** A tételek a `packages/ui` `DataTable`
 * táblájában állnak, ugyanúgy, mint a futás előzmények listájában
 * (`run-history-screen.tsx`): soronként a tétel gombja és az állapot `Badge`
 * jelvénye, ugyanazzal a nyolc állapot felirattal, mint a csomópont kártyán
 * (`describeStepRunStatusBadge`), tehát az állapotot szöveg is hordozza, nem
 * csak szín (SPEC-008 6.2). A tétel gombja a design system `Button`-ja `sm`
 * méretben; a lenyomott állapotot az `aria-pressed` mondja ki, és a látható
 * változata (`secondary` a `ghost` helyett) is jelzi. A bezárás a design
 * system ikon gombja (`.btn--icon`, `sm`), hozzáférhető névvel.
 *
 * **Doboz nélküli, megnevezett csoport** (tilos a card in card): a régió
 * neve a lista címe, se szegély, se saját háttér.
 *
 * Csak megjelenít: a kiválasztás állapota a `RunViewScreen` szintjén él, a
 * sorok a `buildBranchIterationItems` tiszta függvényből jönnek.
 */
export function BranchIterationList(properties: Readonly<BranchIterationListProperties>): ReactElement {
  const { kind, nodeLabel, items, selectedStepRunId, onToggleItem, onClose } = properties;
  const titleId = useId();
  const text = LIST_TEXT[kind];
  const title = `${text.titlePrefix}: ${nodeLabel}`;

  const columns: readonly DataTableColumn<BranchIterationItem>[] = [
    {
      id: 'item',
      header: 'Tétel',
      sortable: false,
      value: (item) => item.label,
      cell: (item) => {
        const isSelected = item.stepRunId === selectedStepRunId;
        return (
          <Button
            type="button"
            size="sm"
            variant={isSelected ? 'secondary' : 'ghost'}
            aria-pressed={isSelected}
            onClick={() => {
              onToggleItem(item.stepRunId);
            }}
          >
            {item.label}
          </Button>
        );
      },
    },
    {
      id: 'status',
      header: 'Állapot',
      sortable: false,
      fitContent: true,
      value: (item) => describeStepRunStatusBadge(item.status).label,
      cell: (item) => {
        const descriptor = describeStepRunStatusBadge(item.status);
        return <Badge variant={descriptor.variant}>{descriptor.label}</Badge>;
      },
    },
  ];

  return (
    <section className="branch-iteration-list" aria-labelledby={titleId}>
      <div className="branch-iteration-list__header">
        <h3 id={titleId} className="branch-iteration-list__title">
          {title}
        </h3>
        <Button type="button" size="sm" variant="ghost" icon aria-label={CLOSE_LABEL} onClick={onClose}>
          <CloseIcon />
        </Button>
      </div>
      <p className="branch-iteration-list__note">{selectedStepRunId === undefined ? ALL_ITEMS_NOTE : ONE_ITEM_NOTE}</p>
      <DataTable
        rows={items}
        columns={columns}
        getRowId={(item) => item.stepRunId}
        label={title}
        emptyLabel={text.emptyLabel}
      />
    </section>
  );
}
