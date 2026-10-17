import type { RunTranscriptState } from '../transcript-panel/run-transcript-state.ts';

/**
 * A transcript azon sorai, amiknek a lépés futása a halmazban van (SPEC-008
 * 6.3, O-39). A lépéshez nem kötött sorok (`stepRunId: null`, például a
 * `run_started` és a `run_finished`) a szűkített nézetből kimaradnak.
 *
 * A szűrés a már összegyűjtött sorokon fut, tehát a perzisztált és az élő,
 * átmeneti sorokra egyaránt, és a később érkező sorokra is: a transcript a
 * stream teljes pótlásából épül (SPEC-008 M-107), így minden tárolt esemény a
 * kliensen van. A kurzor (`afterEventId`) és a pótlás állapota változatlanul
 * átmegy, mert azok a teljes folyamról szólnak, nem a szűrt nézetről.
 */
export function filterTranscriptByStepRuns(
  transcript: RunTranscriptState,
  stepRunIds: ReadonlySet<string>,
): RunTranscriptState {
  return {
    ...transcript,
    rows: transcript.rows.filter((row) => row.record.stepRunId !== null && stepRunIds.has(row.record.stepRunId)),
  };
}
