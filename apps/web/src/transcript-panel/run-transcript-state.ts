import type { RunEventRecord } from '@easter-workflow-builder/protocol';

/**
 * Egy futás transcriptjének kliens oldali állapota (SPEC-008 7., T-009-25),
 * a stream kereteiből felépítve.
 */
export interface RunTranscriptState {
  /**
   * A futás perzisztált eseményei, érkezési sorrendben. A pótlás futáson
   * belül szigorúan `id` szerint növekvő (SPEC-005 5.6, F-18), az élő
   * szakasz pedig a motor kiadási sorrendjében jön, tehát ez a sorrend
   * egyben az `id` szerinti sorrend is.
   */
  readonly records: readonly RunEventRecord[];
  /**
   * A kurzor: a legnagyobb, már felvett perzisztált esemény azonosítója,
   * `0`, ha még egy sem érkezett. Az ennél nem nagyobb azonosítójú keret
   * ismétlés (például az `EventSource` újracsatlakozása utáni pótlás), és
   * eldobódik.
   */
  readonly afterEventId: number;
  /**
   * Megérkezett-e a futás `replay_complete` kerete (SPEC-005 5.6 4. pont):
   * amíg nem, a transcript az előzmények betöltését jelzi (SPEC-008 9.
   * szekció 9. és 11. async pontja).
   */
  readonly isReplayComplete: boolean;
}
