import type { Outcome } from '@easter-workflow-builder/core';
import { StreamFrameSchema, type StreamFrame } from './stream-frame.ts';

/**
 * A bejövő SSE keret dekódolása (SPEC-005 7.4 szekció "kliens, bejövő SSE
 * keret" sora: "a keret szöveges folyamból dekódolt `unknown`"). A bemenet a
 * `data:` sor tartalmának `JSON.parse` eredménye - a szöveges SSE keretezést
 * (az `event:`/`id:`/`data:` sorok szétválasztását) a böngésző natív SSE
 * kliense végzi, ezt a csomag nem ismétli meg (10.1 szekció: a csomag nem
 * ismer böngésző API-t). Ami itt validálódik, az a `data:` sor már
 * feloldott JSON értéke a `StreamFrameSchema` ellen.
 *
 * Négy érvénytelen bemenet esetén ad hibaágat (SPEC-005 10.2 táblázat
 * "a keret dekódolása érvénytelen bemenetre" sora): hiányzó mező, rossz
 * típusú mező, ismeretlen `event` érték, ismeretlen kulcs - mindegyiket a
 * `.spec.ts` külön teszteset fedi.
 */
export function decodeStreamFrame(rawFrame: unknown): Outcome<StreamFrame> {
  const result = StreamFrameSchema.safeParse(rawFrame);
  if (!result.success) {
    const paths = result.error.issues.map((issue) => (issue.path.length === 0 ? '(gyökér)' : issue.path.join('.')));
    return {
      kind: 'error',
      message: `A bejövő SSE keret nem illeszkedik egyetlen ismert alakra sem, hibás mező(k): ${paths.join(', ')} (invalid_frame).`,
    };
  }
  return { kind: 'ok', value: result.data };
}
