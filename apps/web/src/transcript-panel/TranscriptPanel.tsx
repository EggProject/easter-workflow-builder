import type { RunEventRecord, StepRunRecord } from '@easter-workflow-builder/protocol';
import { Button, Skeleton } from '@easter-workflow-builder/ui';
import type { ReactElement } from 'react';
import { List, useDynamicRowHeight, type RowComponentProps } from 'react-window';
import { RunEventRow } from '../run-event-row/RunEventRow.tsx';
import { COLLAPSED_TRANSCRIPT_ROW_HEIGHT } from './collapsed-transcript-row-height.ts';
import { resolveStepProviderId } from './resolve-step-provider-id.ts';
import type { RunTranscriptState } from './run-transcript-state.ts';
import { useTranscriptAutoScroll } from './use-transcript-auto-scroll.ts';
import './transcript-panel.css';

export interface TranscriptPanelProperties {
  readonly transcript: RunTranscriptState;
  /**
   * A futás betöltött lépés futásai: ezekből oldódik fel soronként a lépés
   * providere, amitől a költség megjelenítése függ (SPEC-008 7.1).
   */
  readonly stepRuns: readonly StepRunRecord[];
}

interface TranscriptRowProperties {
  readonly records: readonly RunEventRecord[];
  readonly stepRuns: readonly StepRunRecord[];
}

/**
 * A lista egy sora: a `react-window` pozícionáló burkolója (`style`, és a
 * `role="listitem"` a sorszámmal), benne a `RunEventRow`.
 *
 * A rekord a `slice` plusz `map` párossal kerül elő, nem indexeléssel: az
 * `index` a lista szerződése szerint mindig a `rowCount` alatt van, tehát
 * egy `records[index] === undefined` ág garantáltan sosem futna, ami tiltott
 * halott ág lenne (`.claude/CLAUDE.md` 5. szekció). A szelet mindig
 * pontosan egy elemű.
 */
function TranscriptRow(properties: RowComponentProps<TranscriptRowProperties>): ReactElement {
  const { index, style, ariaAttributes, records, stepRuns } = properties;
  return (
    <div style={style} {...ariaAttributes} className="transcript-panel__row">
      {records.slice(index, index + 1).map((record) => (
        <RunEventRow key={record.id} record={record} providerId={resolveStepProviderId(stepRuns, record.stepRunId)} />
      ))}
    </div>
  );
}

/**
 * A futás nézet transcript panelje (SPEC-008 7.2, 7.3, 7.4, AC39, AC40,
 * AC41, PLAN-009 T-009-25).
 *
 * **Virtualizáció.** A lista a `react-window@2.3.1` `List` komponense
 * (`rowComponent`, `rowCount`, `rowHeight`). A `rowHeight` a könyvtár
 * `useDynamicRowHeight` gyorsítótára: a sor magassága a kirajzolt
 * tartalomból számítódik, ami a SPEC-008 7.3 első kimenete, és a T-009-4
 * mérés (soronként eltérő magasság) szerint működik. Ez azért kell, mert a
 * sor kinyitható, és a kinyitott sor a teljes, tördelt payloadot mutatja,
 * aminek a magassága előre nem számítható. A még nem kirajzolt sorokat a
 * lista az összecsukott sor pontos magasságával becsüli.
 *
 * **Automatikus görgetés.** A `useTranscriptAutoScroll` hook: pixel küszöb
 * nélkül, a `visibleRows.stopIndex === rowCount - 1` predikátummal dönt, és
 * felgörgetett állapotban az "ugrás az aljára" gomb megnevezi az új
 * események számát.
 *
 * **Várakozás jelzése** (SPEC-008 9. szekció 9. és 11. pontja): amíg a
 * pótlás le nem zárult, a fejlécben "Előzmények betöltése" áll, és ha még
 * egyetlen sor sincs, a lista helyén csontváz.
 */
export function TranscriptPanel(properties: Readonly<TranscriptPanelProperties>): ReactElement {
  const { transcript, stepRuns } = properties;
  const { records, isReplayComplete } = transcript;
  const rowCount = records.length;
  const { setList, onRowsRendered, onResize, unseenCount, jumpToBottom } = useTranscriptAutoScroll(rowCount);
  const rowHeight = useDynamicRowHeight({ defaultRowHeight: COLLAPSED_TRANSCRIPT_ROW_HEIGHT });

  return (
    <div className="transcript-panel">
      {(!isReplayComplete || unseenCount > 0) && (
        <div className="transcript-panel__header">
          {isReplayComplete ? undefined : (
            <p className="transcript-panel__status" role="status">
              Előzmények betöltése
            </p>
          )}
          {unseenCount > 0 && (
            <Button variant="secondary" size="sm" onClick={jumpToBottom}>
              {`Ugrás az aljára (${String(unseenCount)} új esemény)`}
            </Button>
          )}
        </div>
      )}
      {rowCount === 0 && !isReplayComplete ? (
        // A várakozás csontváza ugyanazzal a sorszámmal, mint a képernyő
        // saját betöltés jelzése (`RunViewScreen`), hogy a két egymást
        // követő csontváz ne ugorjon.
        <div className="transcript-panel__loading">
          <Skeleton shape="text" lines={4} />
        </div>
      ) : (
        <>
          {rowCount === 0 && <p className="transcript-panel__empty">A futásnak még nincs eseménye.</p>}
          <List
            aria-label="Futás eseményei"
            className="transcript-panel__list"
            listRef={setList}
            onResize={onResize}
            onRowsRendered={onRowsRendered}
            rowComponent={TranscriptRow}
            rowCount={rowCount}
            rowHeight={rowHeight}
            rowProps={{ records, stepRuns }}
          />
        </>
      )}
    </div>
  );
}
