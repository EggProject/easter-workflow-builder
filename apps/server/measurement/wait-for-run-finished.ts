import type { StreamFrame } from '@easter-workflow-builder/protocol';
import { isRecord, isString } from '@easter-workflow-builder/typeguards';

export interface RunFinishedObservation {
  /**
  Az utolsó `sdk_result` esemény `result` szövegének hossza; a szöveg maga nem kerül tovább.
  */
  readonly resultTextLength: number | undefined;
}

/**
 * Várakozás a futás `run_finished` keretére (SPEC-012 5.1 3. lépés). **Nincs
 * időkorlát** (O-15, user döntés): a megszakítás a user dolga. A `protocol_error`
 * keret hibaként áll meg, mert utána a `run_finished` nem biztos, hogy megjön.
 * A kimeneti szöveg hossza az `sdk_result` esemény payloadjából jön (a lépés
 * `output` mezője csak strukturált kimenetnél van kitöltve, a motor
 * `run-agent-step.ts` fájlja szerint).
 */
export async function waitForRunFinished(
  frames: AsyncGenerator<StreamFrame>,
  runId: string,
): Promise<RunFinishedObservation> {
  let resultTextLength: number | undefined;
  for await (const frame of frames) {
    if (frame.event === 'protocol_error') {
      throw new Error(`Protokoll hiba a streamen (${frame.code}).`);
    }
    if (frame.event !== 'run_event' || frame.runEvent.runId !== runId) {
      continue;
    }
    if (frame.runEvent.kind === 'sdk_result' && isRecord(frame.runEvent.payload)) {
      const resultText = frame.runEvent.payload['result'];
      resultTextLength = isString(resultText) ? resultText.length : undefined;
    }
    if (frame.runEvent.kind === 'run_finished') {
      return { resultTextLength };
    }
  }
  throw new Error('A stream a run_finished esemény előtt véget ért.');
}
