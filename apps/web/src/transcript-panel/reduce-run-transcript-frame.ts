import type { StreamFrame } from '@easter-workflow-builder/protocol';
import type { RunTranscriptState } from './run-transcript-state.ts';

/**
 * Egy beérkező stream keret hatása a nézett futás transcriptjére
 * (SPEC-008 7., T-009-25). Tiszta függvény: ugyanarra a bemenetre ugyanazt
 * adja, és ha a keret nem változtat semmin, a KAPOTT állapotot adja vissza,
 * hogy a React ne rendereljen feleslegesen.
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
      return { ...state, records: [...state.records, record], afterEventId: record.id };
    }
    case 'replay_complete': {
      if (frame.runId !== runId || state.isReplayComplete) {
        return state;
      }
      return { ...state, isReplayComplete: true };
    }
    case 'run_event_transient':
    case 'stream_ready':
    case 'protocol_error': {
      // Az átmeneti (delta) sorok megjelenítése a PLAN-009 T-009-26 hatóköre
      // (SPEC-008 7.5); a másik két keret a transcript tartalmát nem érinti.
      return state;
    }
  }
}
