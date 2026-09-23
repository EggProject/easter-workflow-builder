import type { ReactElement } from 'react';
import type { ProviderId, RunEventOrigin, RunEventRecord } from '@easter-workflow-builder/protocol';
import { AccordionItem, joinClassNames } from '@easter-workflow-builder/ui';
import { summarizeRunEventRow } from './run-event-row-summary.ts';
import './run-event-row.css';

export interface RunEventRowProperties {
  readonly record: RunEventRecord;
  /**
   * A lépés ténylegesen feloldott providere. A forrás a `StepRunRecord.providerId`
   * mező (`record.stepRunId` alapján kikeresve), amit az engine a háromszintű
   * feloldás eredményeként ír a lépés futás sorába - NEM a modell név szövege,
   * mert az törékeny és felülírható (user döntés 2026-09-23, SPEC-008 7.1,
   * `docs/research/2026-09-23-sdk-koltseg-becsles.md`). A feloldást maga a
   * hívó (a transcript panel, T-009-25) végzi. `undefined`, ha a feloldás
   * nem sikerült: ilyenkor a sor egyik providerre sem tesz állítást.
   */
  readonly providerId: ProviderId | undefined;
}

/**
 * A költség mező megnevezése. Az `sdk_result` `total_cost_usd` értéke az
 * Agent SDK becslése, nem valós költség, ezért a felirat ezt mondja ki. A
 * mező kizárólag `claude-subscription` provider mellett jelenik meg (user
 * döntés 2026-09-23, pontosítva: "MiniMaxnál ne látszódjon",
 * `docs/research/2026-09-23-sdk-koltseg-becsles.md`).
 */
const COST_FIELD_LABEL = 'Költség (SDK becslés)';

/**
 * A kinyitott sorban a költség mező mellett álló magyarázat, `claude-subscription`
 * provider mellett.
 */
const COST_FIELD_EXPLANATION =
  'Az Agent SDK a saját, beépített ártáblájából számolja, tehát becslés, nem számla. Claude előfizetésnél a ' +
  'számlázás szempontjából nem releváns.';

/**
 * A kinyitott sorban megjelenő magyarázat `minimax` provider mellett, a
 * költség mező helyén (a mező maga sehol nem jelenik meg).
 */
const COST_HIDDEN_FOR_MINIMAX_EXPLANATION =
  'A MiniMax-M3 modellre az Agent SDK nem ismer valós árat, ezért a költség becslése ennél a providernél nem jelenik meg.';

/**
 * A kinyitott sorban megjelenő magyarázat, ha a lépés providere nem oldható
 * fel (T-009-25): a költség mező ilyenkor sem jelenik meg, mert csak
 * `claude-subscription` provider mellett járna.
 */
const COST_HIDDEN_FOR_UNKNOWN_PROVIDER_EXPLANATION =
  'A lépés providere ebben a nézetben nem ismert, ezért a költség becslése nem jelenik meg.';

/**
 * Egy `run_event` sor időbélyege, óra:perc:másodperc alakban, magyar
 * területi beállítással (a `run-history`/`workflow-list` téma
 * `formatTimestamp` mintájára, de csak az időrészre szűkítve, mert a
 * transcript egyetlen futáson belül kronologikus, a dátum nem
 * megkülönböztető).
 */
function formatOccurredAt(occurredAtMs: number): string {
  return new Date(occurredAtMs).toLocaleTimeString('hu-HU');
}

/**
 * Az eredet jelölője a jelölő oszlopban (SPEC-008 7.2 4. pont): `Bot` az
 * `sdk`, `Workflow` az `engine` eredetű sorhoz. A geometria a projekt által
 * vendorolt lucide 0.525.0 készlet valódi útvonal-adata (24x24 viewBox), a
 * repóban már meglévő, kézzel beágyazott ikon-konvenció szerint
 * (`run-history-screen.tsx`). Az eredet szövegként a címben is ott áll,
 * ezért az ikon a hozzáférhetőségi fából ki van zárva.
 */
function OriginMarkerIcon(properties: Readonly<{ origin: RunEventOrigin }>): ReactElement {
  const svgAttributes = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.75',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    focusable: 'false',
  } as const;
  switch (properties.origin) {
    case 'sdk': {
      return (
        <svg {...svgAttributes} data-origin-marker="sdk">
          <path d="M12 8V4H8" />
          <rect width="16" height="12" x="4" y="8" rx="2" />
          <path d="M2 14h2" />
          <path d="M20 14h2" />
          <path d="M15 13v2" />
          <path d="M9 13v2" />
        </svg>
      );
    }
    case 'engine': {
      return (
        <svg {...svgAttributes} data-origin-marker="engine">
          <rect width="8" height="8" x="3" y="3" rx="2" />
          <path d="M7 11v4a2 2 0 0 0 2 2h4" />
          <rect width="8" height="8" x="13" y="13" rx="2" />
        </svg>
      );
    }
  }
}

/**
 * Egy transcript sor (SPEC-008 7.1, 7.2, PLAN-009 T-009-24). A fejléc a
 * `packages/ui` `AccordionItem` panelje, tehát a kinyitás billentyűzetről
 * is működik, `aria-expanded`/`aria-controls` párral; nincs saját, új
 * összecsukható komponens.
 *
 * **A jelölő oszlop** (SPEC-008 7.2 1. és 4. pont) az `AccordionItem`
 * `icon` szlotja: a design system `.accordion__icon` doboza 18x18-as és
 * `flex-shrink: 0`, tehát minden sorban azonos szélességű bal oldali
 * oszlopot ad, és az eredetet ikon alakkal, nem csak színnel jelöli. Az
 * `sdk_result` sor költség mezője `claude-subscription` provider mellett a
 * `meta` szlotba kerül, a kinyitott nézetben pedig külön, megnevezett
 * mezőként is megjelenik; `minimax` provider mellett a mező sehol nem
 * jelenik meg, csak a kinyitott nézetben egy magyarázó mondat áll a helyén.
 */
export function RunEventRow(properties: Readonly<RunEventRowProperties>): ReactElement {
  const { record, providerId } = properties;
  const summary = summarizeRunEventRow(record, providerId);
  const title = `${formatOccurredAt(record.occurredAtMs)} · ${summary.originLabel} · ${summary.kindLabel}: ${summary.bodyText}`;
  const costMeta =
    summary.costEstimateText === undefined ? undefined : `${COST_FIELD_LABEL}: ${summary.costEstimateText}`;

  return (
    <div className={joinClassNames('run-event-row', `run-event-row--origin-${record.origin}`)}>
      <AccordionItem title={title} icon={<OriginMarkerIcon origin={record.origin} />} meta={costMeta}>
        {costMeta === undefined ? undefined : (
          <div className="run-event-row__cost">
            <p>
              <strong>{COST_FIELD_LABEL}:</strong> {summary.costEstimateText}
            </p>
            <p>{COST_FIELD_EXPLANATION}</p>
          </div>
        )}
        {summary.costHiddenForMinimax ? (
          <div className="run-event-row__cost">
            <p>{COST_HIDDEN_FOR_MINIMAX_EXPLANATION}</p>
          </div>
        ) : undefined}
        {summary.costHiddenForUnknownProvider ? (
          <div className="run-event-row__cost">
            <p>{COST_HIDDEN_FOR_UNKNOWN_PROVIDER_EXPLANATION}</p>
          </div>
        ) : undefined}
        <pre className="run-event-row__payload">{JSON.stringify(record.payload, undefined, 2)}</pre>
      </AccordionItem>
    </div>
  );
}
