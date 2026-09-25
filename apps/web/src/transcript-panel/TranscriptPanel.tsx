import type { RunStatus, StepRunRecord } from '@easter-workflow-builder/protocol';
import { Button } from '@easter-workflow-builder/ui';
import type { ReactElement } from 'react';
import { List, useDynamicRowHeight, type RowComponentProps } from 'react-window';
import { RunEventRow } from '../run-event-row/RunEventRow.tsx';
import { isRunInterruptible } from '../run-control/run-control-availability.ts';
import { ThemedSkeleton } from '../themed-skeleton/ThemedSkeleton.tsx';
import { COLLAPSED_TRANSCRIPT_ROW_HEIGHT } from './collapsed-transcript-row-height.ts';
import { resolveStepProviderId } from './resolve-step-provider-id.ts';
import type { RunTranscriptState } from './run-transcript-state.ts';
import type { TranscriptRow as TranscriptRowData } from './transcript-row.ts';
import { transcriptRowKey } from './transcript-row-key.ts';
import { useTranscriptAutoScroll } from './use-transcript-auto-scroll.ts';
import './transcript-panel.css';

export interface TranscriptPanelProperties {
  readonly transcript: RunTranscriptState;
  /**
   * A futás betöltött lépés futásai: ezekből oldódik fel soronként a lépés
   * providere, amitől a költség megjelenítése függ (SPEC-008 7.1).
   */
  readonly stepRuns: readonly StepRunRecord[];
  /**
   * A futás állapota: ettől függ, hogy a lezárult pótlás utáni üres lista
   * várakozás (a futás még tart) vagy végleges (a futás lezárult).
   */
  readonly runStatus: RunStatus;
  /**
   * A futás indításakor befagyasztott delta kapcsoló
   * (`RunDetail.persistedStreamDeltas`, SPEC-003 6.6). A futás saját
   * mezőjéből jön, nem a globális beállításból, mert a kapcsoló futásonként
   * befagy (SPEC-008 7.5 2. szabály).
   */
  readonly persistedStreamDeltas: boolean;
}

interface TranscriptRowProperties {
  readonly rows: readonly TranscriptRowData[];
  readonly stepRuns: readonly StepRunRecord[];
}

/**
 * A panel tetején álló mondat, ha a futás a streamelt részleges szöveget nem tárolja
 * (SPEC-008 7.5 2. szabály, AC43): megmondja, miért tűnik el a
 * karakterenkénti szöveg újratöltés után.
 */
const TRANSIENT_DELTA_NOTE =
  'Ennél a futásnál a streamelt részleges szöveg csak élőben látszik, nem kerül tárolásra: újratöltés vagy ' +
  'későbbi megnyitás után csak az összeállt üzenetek maradnak meg.';

/**
 * A lista egy sora: a `react-window` pozícionáló burkolója (`style`, és a
 * `role="listitem"` a sorszámmal), benne a `RunEventRow`.
 *
 * A sor a `slice` plusz `map` párossal kerül elő, nem indexeléssel: az
 * `index` a lista szerződése szerint mindig a `rowCount` alatt van, tehát
 * egy `rows[index] === undefined` ág garantáltan sosem futna, ami tiltott
 * halott ág lenne (`.claude/CLAUDE.md` 5. szekció). A szelet mindig
 * pontosan egy elemű.
 *
 * A lista elem React kulcsát a lista `rowKey` propja adja
 * (`transcript-row-key.ts`): a sor saját `key` mezője, nem a sorszáma, így a
 * lista elem (és benne a kinyitott állapot) a sorral együtt mozog. Az
 * egyelemű `map` gyerekén álló `key` a `RunEventRow` kulcsa a lista elemen
 * belül: ha a sorszámon másik sor áll, a `RunEventRow` újracsatolódik, tehát
 * egy sor állapota sosem kerülhet át egy másikra.
 */
function TranscriptRow(properties: RowComponentProps<TranscriptRowProperties>): ReactElement {
  const { index, style, ariaAttributes, rows, stepRuns } = properties;
  return (
    <div style={style} {...ariaAttributes} className="transcript-panel__row">
      {rows.slice(index, index + 1).map((row) => (
        <RunEventRow
          key={row.key}
          record={row.record}
          providerId={resolveStepProviderId(stepRuns, row.record.stepRunId)}
          isTransient={row.source === 'transient'}
        />
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
 * lista az összecsukott sor magasságával becsüli, ami minden sorra (a
 * tárolt és az átmeneti sorra is) pontos. A sor React kulcsa a `rowKey`
 * prop, a sor saját `key` mezőjéből (`transcript-row-key.ts`).
 *
 * **Automatikus görgetés.** A `useTranscriptAutoScroll` hook: pixel küszöb
 * nélkül, a `visibleRows.stopIndex === rowCount - 1` predikátummal dönt, és
 * felgörgetett állapotban az "ugrás az aljára" gomb megnevezi az új
 * események számát. A hook a `rowHeight` gyorsítótárat is megkapja: egy sor
 * kinyitása után ennek új identitása jelzi, hogy a lista már a mért
 * magassággal számol.
 *
 * **A gomb helye előre fenntartva** (user döntés 2026-09-25, SPEC-008 7.4):
 * a lista fölötti sáv mindig a helyén áll, benne a gomb akkor is, ha nincs új
 * esemény, csak ilyenkor láthatatlan (`transcript-panel__jump--idle`,
 * `visibility: hidden`: nem fókuszálható, és kimarad a hozzáférhetőségi
 * fából). A gomb megjelenése így nem tolja lejjebb a listát, és nem takar ki
 * sort. A sáv magasságát maga a design system gombja adja, szám nélkül.
 *
 * **Várakozás jelzése** (SPEC-008 9. szekció 9., 11. és 16. pontja): amíg a
 * pótlás le nem zárult, a fejlécben "Előzmények betöltése" áll, és ha még
 * egyetlen sor sincs, a lista helyén csontváz. A lezárult pótlás utáni üres
 * lista két különböző állapot: ha a futás még tart, az agent első eseményére
 * várunk, és ezt `role="status"` szöveg mondja ki; ha a futás lezárult, a
 * lista véglegesen üres, és ezt egy nem státusz mondat mondja ki.
 *
 * **A delta kapcsoló következménye** (SPEC-008 7.5, AC42, AC43, T-009-26):
 * az élő, átmeneti (`run_event_transient`) sorok a `RunEventRow` jelölését
 * kapják, és ha a futás a streamelt részleges szöveget nem tárolja
 * (`persistedStreamDeltas` hamis), a panel tetején, a lista és a várakozás
 * jelzése fölött egy mondat mondja ki, hogy az csak élőben látszik. A mondat
 * a meglévő, halvány kis szöveg mintája (`transcript-panel__status`), doboz
 * nélkül, és a futás teljes nézése alatt a helyén marad.
 */
export function TranscriptPanel(properties: Readonly<TranscriptPanelProperties>): ReactElement {
  const { transcript, stepRuns, runStatus, persistedStreamDeltas } = properties;
  const { rows, isReplayComplete } = transcript;
  const rowCount = rows.length;
  // A futás pontosan akkor tart még, ha megszakítható: a hat állapot nem
  // terminális csoportja a `pending` és a `running`
  // (`run-control-availability.ts`, SPEC-004 9. és 10. szekció).
  const isRunInProgress = isRunInterruptible(runStatus);
  const rowHeight = useDynamicRowHeight({ defaultRowHeight: COLLAPSED_TRANSCRIPT_ROW_HEIGHT });
  const { setList, onRowsRendered, onResize, unseenCount, jumpToBottom } = useTranscriptAutoScroll(rowCount, rowHeight);

  return (
    <div className="transcript-panel">
      {persistedStreamDeltas ? undefined : <p className="transcript-panel__delta-note">{TRANSIENT_DELTA_NOTE}</p>}
      <div className="transcript-panel__header">
        {isReplayComplete ? undefined : (
          <p className="transcript-panel__status" role="status">
            Előzmények betöltése
          </p>
        )}
        <Button
          variant="secondary"
          size="sm"
          className={unseenCount > 0 ? undefined : 'transcript-panel__jump--idle'}
          onClick={jumpToBottom}
        >
          {`Ugrás az aljára (${String(unseenCount)} új esemény)`}
        </Button>
      </div>
      {rowCount === 0 && !isReplayComplete ? (
        // A várakozás csontváza ugyanazzal a sorszámmal, mint a képernyő
        // saját betöltés jelzése (`RunViewScreen`), hogy a két egymást
        // követő csontváz ne ugorjon.
        <div className="transcript-panel__loading">
          <ThemedSkeleton shape="text" lines={4} />
        </div>
      ) : (
        <>
          {rowCount === 0 &&
            (isRunInProgress ? (
              <p className="transcript-panel__status" role="status">
                Várakozás az első eseményre
              </p>
            ) : (
              <p className="transcript-panel__empty">A futásnak nincs eseménye.</p>
            ))}
          <List
            aria-label="Futás eseményei"
            className="transcript-panel__list"
            listRef={setList}
            onResize={onResize}
            onRowsRendered={onRowsRendered}
            rowComponent={TranscriptRow}
            rowCount={rowCount}
            rowHeight={rowHeight}
            rowKey={transcriptRowKey}
            rowProps={{ rows, stepRuns }}
          />
        </>
      )}
    </div>
  );
}
