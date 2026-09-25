import type { ReactElement } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import './pagination.css';

export type PaginationVariant = 'plain' | 'outlined';

/**
 * A lapozó szövegei. A forrás `Pagination.jsx` ezeket angolul, beégetve
 * adja; a `labels` prop az egyetlen kiegészítés a forráshoz képest, hogy a
 * magyar felület a saját szövegét adhassa (a `Breadcrumb` `label` propjának
 * mintája). Az alapérték a forrás szövege, betűre (`PAGINATION_SOURCE_LABELS`).
 */
export interface PaginationLabels {
  /**
   * A `<nav>` hozzáférhető neve (forrás: `Pagination`).
   */
  readonly navigation: string;
  /**
   * Az előző oldal gombjának hozzáférhető neve (forrás: `Previous`).
   */
  readonly previous: string;
  /**
   * A következő oldal gombjának hozzáférhető neve (forrás: `Next`).
   */
  readonly next: string;
  /**
   * Az oldal szerinti meta (`page`/`pageCount`) szövege a kiemelt
   * oldalszám ELŐTT (forrás: `Page `).
   */
  readonly pageMetaPrefix: string;
  /**
   * Az oldal szerinti meta szövege a kiemelt oldalszám és az oldalak száma
   * KÖZÖTT (forrás: ` of `).
   */
  readonly pageMetaSeparator: string;
  /**
   * A tétel tartomány szerinti meta (`total`/`pageSize`) szövege a kiemelt
   * tartomány és az összes tétel KÖZÖTT (forrás: ` of `).
   */
  readonly rangeMetaSeparator: string;
}

export const PAGINATION_SOURCE_LABELS: PaginationLabels = {
  navigation: 'Pagination',
  previous: 'Previous',
  next: 'Next',
  pageMetaPrefix: 'Page ',
  pageMetaSeparator: ' of ',
  rangeMetaSeparator: ' of ',
};

/**
 * A forrás `Pagination.jsx` propjai, egy az egyben: `page`, `pageCount`,
 * `total`, `pageSize`, `siblings`, `onChange`, `variant` és `className`,
 * plusz a `labels` kiegészítés.
 */
export interface PaginationProperties {
  /**
   * Az aktuális oldal, 1-től számozva.
   */
  readonly page?: number;
  /**
   * Az oldalak száma; hiányában a `total` és a `pageSize` adja, azok
   * hiányában 1.
   */
  readonly pageCount?: number;
  /**
   * A tételek száma: a `pageSize`-zal együtt a meta a tétel tartományt
   * mutatja ("1–10 of 42"), nélküle az oldalt ("Page 1 of 4").
   */
  readonly total?: number;
  readonly pageSize?: number;
  /**
   * Az aktuális oldal két oldalán mutatott oldalszámok száma.
   */
  readonly siblings?: number;
  /**
   * A választott oldal, 1 és az oldalak száma közé szorítva.
   */
  readonly onChange?: (page: number) => void;
  readonly variant?: PaginationVariant;
  readonly className?: string;
  readonly labels?: PaginationLabels;
}

type PaginationSlot = number | 'ellipsis';

function range(start: number, end: number): number[] {
  const result: number[] = [];
  for (let index = start; index <= end; index += 1) {
    result.push(index);
  }
  return result;
}

/**
 * A kirajzolt oldalszámok és kihagyásjelek sora, a forrás `buildPages`
 * függvénye változatlan logikával: az első és az utolsó oldal, az aktuális
 * oldal a két oldalán `siblings` darabbal, és a hézagok helyén kihagyásjel.
 */
function buildPages(page: number, total: number, siblings: number): PaginationSlot[] {
  const totalNumbers = siblings * 2 + 5;
  if (total <= totalNumbers) {
    return range(1, total);
  }

  const leftSibling = Math.max(page - siblings, 1);
  const rightSibling = Math.min(page + siblings, total);
  const isLeftEllipsisShown = leftSibling > 2;
  const isRightEllipsisShown = rightSibling < total - 1;

  if (!isLeftEllipsisShown && isRightEllipsisShown) {
    return [...range(1, 3 + siblings * 2), 'ellipsis', total];
  }
  if (isLeftEllipsisShown && !isRightEllipsisShown) {
    return [1, 'ellipsis', ...range(total - (2 + siblings * 2), total)];
  }
  return [1, 'ellipsis', ...range(leftSibling, rightSibling), 'ellipsis', total];
}

interface ItemRange {
  readonly total: number;
  readonly pageSize: number;
}

/**
 * A forrás `total && pageSize` feltétele: a tétel tartomány csak akkor áll,
 * ha mindkettő megadott és nem nulla.
 */
function readItemRange(total: number | undefined, pageSize: number | undefined): ItemRange | undefined {
  if (total === undefined || total === 0 || pageSize === undefined || pageSize === 0) {
    return undefined;
  }
  return { total, pageSize };
}

/**
 * A design system `.pagination` lapozója
 * (`eggproject-design-components/components/pagination/Pagination.jsx`), a
 * forrás szerkezetével: `<nav>` a hozzáférhető névvel, balra a meta, jobbra
 * az előző gomb, az oldalszámok és a kihagyásjelek, a következő gomb. Az
 * aktuális oldal `aria-current="page"`, a két szélső gomb a tartomány szélén
 * letiltva.
 *
 * Két eltérés a forrástól: a `labels` prop (a forrás szövegei alapértelmezés
 * szerint), és a gombok `type="button"` attribútuma, ahogy a többi átemelt
 * gombnál (`Toast`, `Tabs`), hogy űrlapban se küldjenek. A CSS `--compact`
 * módosítója a forrás React változatában sincs propként kivezetve, tehát itt
 * sem.
 */
export function Pagination(properties: Readonly<PaginationProperties>): ReactElement {
  const {
    page = 1,
    pageCount,
    total,
    pageSize,
    siblings = 1,
    onChange,
    variant = 'plain',
    className,
    labels = PAGINATION_SOURCE_LABELS,
  } = properties;

  const itemRange = readItemRange(total, pageSize);
  const resolvedPageCount =
    pageCount ?? (itemRange === undefined ? 1 : Math.max(1, Math.ceil(itemRange.total / itemRange.pageSize)));
  const pages = buildPages(page, resolvedPageCount, siblings);
  const go = (targetPage: number): void => {
    onChange?.(Math.max(1, Math.min(resolvedPageCount, targetPage)));
  };

  const meta =
    itemRange === undefined ? (
      <span className="pagination__meta">
        {labels.pageMetaPrefix}
        <strong>{page}</strong>
        {labels.pageMetaSeparator}
        {resolvedPageCount}
      </span>
    ) : (
      <span className="pagination__meta">
        <strong>
          {(page - 1) * itemRange.pageSize + 1}–{Math.min(page * itemRange.pageSize, itemRange.total)}
        </strong>
        {labels.rangeMetaSeparator}
        {itemRange.total}
      </span>
    );

  return (
    <nav
      className={joinClassNames('pagination', variant === 'outlined' && 'pagination--outlined', className)}
      aria-label={labels.navigation}
    >
      {meta}
      <div className="pagination__pages">
        <button
          type="button"
          className="pagination__page"
          onClick={() => {
            go(page - 1);
          }}
          disabled={page <= 1}
          aria-label={labels.previous}
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 4 6 8l4 4" />
          </svg>
        </button>
        {pages.map((pageNumber, index) =>
          pageNumber === 'ellipsis' ? (
            <span key={`e${String(index)}`} className="pagination__ellipsis">
              …
            </span>
          ) : (
            <button
              type="button"
              key={pageNumber}
              className={joinClassNames('pagination__page', pageNumber === page && 'pagination__page--active')}
              onClick={() => {
                go(pageNumber);
              }}
              aria-current={pageNumber === page ? 'page' : undefined}
            >
              {pageNumber}
            </button>
          ),
        )}
        <button
          type="button"
          className="pagination__page"
          onClick={() => {
            go(page + 1);
          }}
          disabled={page >= resolvedPageCount}
          aria-label={labels.next}
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 4 4 4-4 4" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
