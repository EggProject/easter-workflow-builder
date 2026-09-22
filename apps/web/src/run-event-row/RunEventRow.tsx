import type { ReactElement } from 'react';
import type { RunEventRecord } from '@easter-workflow-builder/protocol';
import { AccordionItem, joinClassNames } from '@easter-workflow-builder/ui';
import { summarizeRunEventRow } from './run-event-row-summary.ts';
import './run-event-row.css';

export interface RunEventRowProperties {
  readonly record: RunEventRecord;
}

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
 * Egy transcript sor (SPEC-008 7.1, 7.2, PLAN-009 T-009-24). A fejléc a
 * `packages/ui` `AccordionItem` panelje, tehát a kinyitás billentyűzetről
 * is működik, `aria-expanded`/`aria-controls` párral - nincs saját, új
 * összecsukható komponens.
 *
 * **A tervezett "jelölő oszlop" (SPEC-008 7.2 4. pont) az `AccordionItem`
 * API-jával nem valósítható meg pontosan úgy, ahogy a spec elképzeli**: a
 * `title` prop kizárólag `string`, nem fogad díszített, több részből álló
 * fejlécet. Az eredet (`sdk`/`engine`) ezért két úton jelenik meg: szövegként
 * a fejléc szövegében, és egy kiegészítő, a design system tokenjeire épülő
 * bal szegély színnel (`run-event-row.css`), nem pedig önálló DOM oszlopként.
 * Ez a design system hiánya, nem saját komponens gyártása.
 */
export function RunEventRow(properties: Readonly<RunEventRowProperties>): ReactElement {
  const { record } = properties;
  const summary = summarizeRunEventRow(record);
  const title = `${formatOccurredAt(record.occurredAtMs)} · ${summary.originLabel} · ${summary.kindLabel} — ${summary.bodyText}`;

  return (
    <div className={joinClassNames('run-event-row', `run-event-row--origin-${record.origin}`)}>
      <AccordionItem title={title}>
        <pre className="run-event-row__payload">{JSON.stringify(record.payload, undefined, 2)}</pre>
      </AccordionItem>
    </div>
  );
}
