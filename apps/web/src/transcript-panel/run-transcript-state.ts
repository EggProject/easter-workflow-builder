import type { TranscriptRow } from './transcript-row.ts';

/**
 * Egy futás transcriptjének kliens oldali állapota (SPEC-008 7., T-009-25,
 * T-009-26), a stream kereteiből felépítve.
 */
export interface RunTranscriptState {
  /**
   * A futás sorai, érkezési sorrendben: a perzisztált események és az élő,
   * átmeneti (`run_event_transient`) keretek vegyesen. A pótlás futáson
   * belül szigorúan `id` szerint növekvő (SPEC-005 5.6, F-18), az élő
   * szakasz pedig a motor kiadási sorrendjében jön, tehát a perzisztált
   * sorok egymáshoz képest `id` szerinti sorrendben állnak.
   */
  readonly rows: readonly TranscriptRow[];
  /**
   * A kurzor: a legnagyobb, már felvett PERZISZTÁLT esemény azonosítója,
   * `0`, ha még egy sem érkezett. Az ennél nem nagyobb azonosítójú keret
   * ismétlés (például az `EventSource` újracsatlakozása utáni pótlás), és
   * eldobódik. Átmeneti sor NEM mozgatja, különben az utána érkező
   * perzisztált sorok csendben kimaradnának (SPEC-008 7.5 3. szabály).
   */
  readonly afterEventId: number;
  /**
   * Kliens oldali, monoton számláló: minden felvett átmeneti sor eggyel
   * növeli, és az átmeneti sor kulcsa ebből képződik (SPEC-008 7.5 3.
   * szabály), mert az átmeneti keretnek nincs azonosítója.
   */
  readonly transientSequence: number;
  /**
   * Megérkezett-e a futás `replay_complete` kerete (SPEC-005 5.6 4. pont):
   * amíg nem, a transcript az előzmények betöltését jelzi (SPEC-008 9.
   * szekció 9. és 11. async pontja).
   */
  readonly isReplayComplete: boolean;
}
