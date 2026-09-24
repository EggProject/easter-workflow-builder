import { useEffect, useState } from 'react';
import type { SubscribeToStreamFrames } from '../stream-client/subscribe-to-stream-frames.ts';
import { reduceRunTranscriptFrame } from './reduce-run-transcript-frame.ts';
import type { RunTranscriptState } from './run-transcript-state.ts';

const EMPTY_RUN_TRANSCRIPT: RunTranscriptState = {
  rows: [],
  afterEventId: 0,
  transientSequence: 0,
  isReplayComplete: false,
};

/**
 * A nézett futás transcriptje, a stream kereteiből gyűjtve (T-009-25).
 *
 * A keretek a veszteségmentes `subscribeToFrames` úton jönnek, nem a
 * `lastFrame` állapotból, mert az egy löketből csak az utolsót adja át. Az
 * állapot frissítése függvény alakú, tehát a React egy renderbe vont
 * frissítései közül sem vész el egy sem.
 *
 * A hookot a futás nézet képernyője a legelején hívja, a betöltési ágak
 * ELŐTT: a feliratkozás így már azelőtt él, hogy a képernyő a saját futására
 * feliratkozna a szervernél, tehát a pótlás első kerete sem érkezhet
 * feliratkozó nélkül.
 */
export function useRunTranscript(
  runId: string | undefined,
  subscribeToFrames: SubscribeToStreamFrames,
): RunTranscriptState {
  const [state, setState] = useState<RunTranscriptState>(EMPTY_RUN_TRANSCRIPT);

  useEffect(() => {
    setState(EMPTY_RUN_TRANSCRIPT);
    if (runId === undefined) {
      return;
    }
    return subscribeToFrames((frame) => {
      setState((previous) => reduceRunTranscriptFrame(previous, frame, runId));
    });
  }, [runId, subscribeToFrames]);

  return state;
}
