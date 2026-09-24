import { Fragment, type ReactElement } from 'react';
import type { ProviderId, RunEventOrigin, RunEventRecord } from '@easter-workflow-builder/protocol';
import { AccordionItem, Badge, joinClassNames } from '@easter-workflow-builder/ui';
import { summarizeRunEventRow } from './run-event-row-summary.ts';
import type { RunEventRowTextSegment } from './run-event-row-text-segment.ts';
import './run-event-row.css';

export interface RunEventRowProperties {
  /**
   * A sor rekordja. Az `id` mező nem kell hozzá, mert az átmeneti
   * (`run_event_transient`) sornak nincs azonosítója (SPEC-008 7.5, T-009-26).
   */
  readonly record: Omit<RunEventRecord, 'id'>;
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
  /**
   * Átmeneti (`run_event_transient`) sor-e: élő keretből épült, aminek nincs
   * perzisztált sora, tehát újratöltés után eltűnik (SPEC-008 7.5 1.
   * szabály). Kötelező, alapérték nélkül: a hívó (a transcript panel) minden
   * sorra tudja.
   */
  readonly isTransient: boolean;
}

/**
 * Az átmeneti sor jelölésének látható szövege: a design system `Badge`
 * komponense a jelentést a valódi DOM szövegben hordozza, nem színben
 * (`eggproject-design` DESIGN.md "Badges & Chips"), ezért már a látható szöveg
 * kimondja, hogy a sor nem kerül tárolásra (PLAN-009 T-009-26).
 */
const TRANSIENT_MARK_TEXT = 'Nem tárolt';

/**
 * Az átmeneti sor jelölésének `title` szövege (SPEC-008 7.5 1. szabály): a
 * teljes magyarázat, hogy a sor ennél a futásnál nem kerül tárolásra.
 */
const TRANSIENT_MARK_TITLE =
  'Átmeneti sor: ennél a futásnál nem kerül tárolásra, ezért oldal újratöltés vagy a futás későbbi megnyitása után nem jelenik meg.';

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
 * Egy meta darab (időbélyeg, eszköznév, azonosító, szám) a design system
 * Code szerepével (`run-event-row.css`, `--ep-text-code`).
 */
function CodeText(properties: Readonly<{ text: string }>): ReactElement {
  return <span className="run-event-row__code">{properties.text}</span>;
}

/**
 * A törzs darabjai sorrendben: a `code` darab meta szövegként, a `text` darab
 * puszta szövegként, a törzs betűjével. A darablista minden rendernél
 * ugyanabból a rekordból, ugyanabban a sorrendben képződik, tehát a sorszám
 * stabil React kulcs.
 */
function SegmentedText(properties: Readonly<{ segments: readonly RunEventRowTextSegment[] }>): ReactElement {
  return (
    <>
      {properties.segments.map((segment, index) =>
        segment.kind === 'code' ? (
          <CodeText key={index} text={segment.text} />
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
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
 *
 * **Az átmeneti sor jelölése** (SPEC-008 7.5 1. szabály, T-009-26) a design
 * system `Badge` komponense, `outline` változatban, a `meta` szlotban: az
 * `outline` az egyetlen változat, aminek a színe téma tokenből jön
 * (`--ep-fg-muted`, `--ep-border`), tehát mindkét témában a felülethez
 * illeszkedik. Átmeneti sornál a `meta` szlot a jelölésé; a költség mező (ha
 * a sor egyáltalán hordozna ilyet, ami ma nem fordul elő, mert a szerver
 * átmeneti keretként kizárólag `sdk_stream_event` sort küld) a kinyitott
 * nézetben változatlanul megjelenik.
 *
 * **Tipográfia** (user döntés 2026-09-24, SPEC-008 7.2 1. pont): a meta
 * (időbélyeg, eszköznév, azonosító, szám) a design system Code szerepével, a
 * sor szövege (eredet, címke, összefoglaló) a törzs betűjével
 * (`run-event-row.css`). A meta darabok külön elemek, a szövegük sorrendben
 * összefűzve adja a gomb hozzáférhető nevét, ugyanazt, mint korábban.
 */
export function RunEventRow(properties: Readonly<RunEventRowProperties>): ReactElement {
  const { record, providerId, isTransient } = properties;
  const summary = summarizeRunEventRow(record, providerId);
  const title = (
    <>
      <CodeText text={formatOccurredAt(record.occurredAtMs)} />
      {` · ${summary.originLabel} · ${summary.kindLabel}: `}
      <SegmentedText segments={summary.bodySegments} />
    </>
  );
  const { costEstimateText } = summary;
  const costMeta =
    costEstimateText === undefined ? undefined : (
      <>
        {`${COST_FIELD_LABEL}: `}
        <CodeText text={costEstimateText} />
      </>
    );
  const meta = isTransient ? (
    <Badge variant="outline" title={TRANSIENT_MARK_TITLE}>
      {TRANSIENT_MARK_TEXT}
    </Badge>
  ) : (
    costMeta
  );

  return (
    <div className={joinClassNames('run-event-row', `run-event-row--origin-${record.origin}`)}>
      <AccordionItem title={title} icon={<OriginMarkerIcon origin={record.origin} />} meta={meta}>
        {costEstimateText === undefined ? undefined : (
          <div className="run-event-row__cost">
            <p>
              <strong>{COST_FIELD_LABEL}:</strong> <CodeText text={costEstimateText} />
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
