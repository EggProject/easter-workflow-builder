import { isRecord, isString } from '@easter-workflow-builder/typeguards';
import type { RunSignal } from '../stream-registry/run-signal.ts';

/**
 * A motor `eventPublisher.publish(event: unknown)` hívásának kiadott
 * értékét a `stream-registry` `RunSignal` alakjára osztályozza (SPEC-004
 * M-31, SPEC-006 6.5). Két alak lehetséges:
 *
 * - **`EngineEvent`** (`kind`, `runId`, `stepRunId`, `payload` mező): a
 *   motor a `publish` hívást szigorúan az `appendEngineEvent` sikeres írása
 *   UTÁN teszi (M-32), tehát a lecsapolás mindig talál sort - a jelzés
 *   `transientFrame` mezője `undefined`.
 * - **`AgentStreamMessage`** (`runId`, `stepRunId`, `message` mező, nincs
 *   `payload`): ha a lecsapolás nem talál új sort (mert az üzenet nem
 *   perzisztálódott, a delta kapcsoló kikapcsolva, SPEC-005 6.1 táblázat),
 *   a `transientFrame` a `run_event_transient` keret jelöltje, `sdk_stream_event`
 *   kinddel (O-6 elfogadott megoldása).
 *
 * Ismeretlen alakra `undefined`: a motor szerződése szerint ez ma nem
 * fordul elő (M-31), de a port bemenete `unknown`, tehát a szerver nem
 * feltételezi a formát bizonyíték nélkül.
 */
export function classifyPublishedEvent(event: unknown, nowMs: number): RunSignal | undefined {
  if (!isRecord(event)) {
    return undefined;
  }

  const runId = event['runId'];
  if (!isString(runId)) {
    return undefined;
  }

  if ('payload' in event) {
    return { runId, transientFrame: undefined };
  }

  const stepRunId = event['stepRunId'];
  const message = event['message'];
  if ('message' in event && isString(stepRunId)) {
    return {
      runId,
      transientFrame: {
        event: 'run_event_transient',
        runId,
        stepRunId,
        kind: 'sdk_stream_event',
        occurredAtMs: nowMs,
        payload: message,
      },
    };
  }

  return undefined;
}
