import type { StreamFrame } from '@easter-workflow-builder/protocol';
import type { RunTranscriptState } from './run-transcript-state.ts';
import { toTransientRowRecord } from './to-transient-row-record.ts';

/**
 * Egy beérkező stream keret hatása a nézett futás transcriptjére
 * (SPEC-008 7., 7.5, T-009-25, T-009-26). Tiszta függvény: ugyanarra a
 * bemenetre ugyanazt adja, és ha a keret nem változtat semmin, a KAPOTT
 * állapotot adja vissza, hogy a React ne rendereljen feleslegesen.
 *
 * Kimerítő `switch` a keret `event` mezőjén: egy hatodik keret típus a
 * `protocol` csomagban itt fordítási hibát ad.
 */
export function reduceRunTranscriptFrame(
  state: RunTranscriptState,
  frame: StreamFrame,
  runId: string,
): RunTranscriptState {
  switch (frame.event) {
    case 'run_event': {
      const record = frame.runEvent;
      if (record.runId !== runId || record.id <= state.afterEventId) {
        return state;
      }
      return {
        ...state,
        rows: [...state.rows, { source: 'persisted', key: `event-${String(record.id)}`, record }],
        afterEventId: record.id,
      };
    }
    case 'run_event_transient': {
      if (frame.runId !== runId) {
        return state;
      }
      // A kulcs a kliens oldali számlálóból jön, és az `afterEventId`
      // kurzor SZÁNDÉKOSAN változatlan: az átmeneti sornak nincs
      // azonosítója, tehát a pótlás szempontjából nem létezik (SPEC-008 7.5
      // 3. szabály).
      const transientSequence = state.transientSequence + 1;
      return {
        ...state,
        rows: [
          ...state.rows,
          { source: 'transient', key: `transient-${String(transientSequence)}`, record: toTransientRowRecord(frame) },
        ],
        transientSequence,
      };
    }
    case 'replay_complete': {
      if (frame.runId !== runId || state.isReplayComplete) {
        return state;
      }
      return { ...state, isReplayComplete: true };
    }
    case 'stream_ready':
    case 'protocol_error': {
      // A két keret a transcript tartalmát nem érinti.
      return state;
    }
  }
}
