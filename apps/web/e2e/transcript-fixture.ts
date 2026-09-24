// A transcript panel e2e fixtúrái (T-009-25): `run_event` rekordok és a
// belőlük épülő, egyetlen lezárt SSE válaszba fűzhető keretsorozat. Két spec
// fájl használja (`transcript-panel.spec.ts` és `responsive.spec.ts`), ezért
// áll külön modulban; ugyanaz a minta, mint a `showcase-graph.ts`.
import type { RunEventRecord, StreamFrame } from '@easter-workflow-builder/protocol';

/* eslint-disable unicorn/no-null -- a RunEventRecord nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-003 6.2, SPEC-005 5.4) */

/**
 * Egy 400 karakteres, szóköz nélküli URL: a független ellenőrzés ezzel mérte
 * a cím tördelésének hiányát (3400 pixel széles cím, vízszintes görgetés
 * 1440 és 375 pixelen is). Szóköz nélkül a böngésző sehol nem törheti.
 */
export const LONG_URL = `https://example.test/${'a'.repeat(400 - 'https://example.test/'.length)}`;

/**
 * Egy motor eredetű, lépés nélküli sor alapértékekkel; a hívó a kívánt
 * mezőket felülírja.
 */
export function makeRunEventRecord(id: number, runId: string, overrides: Partial<RunEventRecord> = {}): RunEventRecord {
  return {
    id,
    runId,
    stepRunId: null,
    origin: 'engine',
    kind: 'step_started',
    occurredAtMs: id,
    sdkMessageType: null,
    sdkMessageSubtype: null,
    sdkSessionId: null,
    sdkUuid: null,
    parentToolUseId: null,
    toolName: null,
    toolUseId: null,
    inputTokens: null,
    outputTokens: null,
    cacheReadInputTokens: null,
    cacheCreationInputTokens: null,
    numTurns: null,
    payload: {},
    ...overrides,
  };
}

/**
 * Egy eszköz eredmény (`sdk_user`) sor, aminek a címe a `LONG_URL` értéket
 * hordozza (a `run-event-row-summary.ts` `describeUser` ágának `tool_result`
 * blokkja szerint).
 */
export function longUrlToolResultRecord(id: number, runId: string, stepRunId: string): RunEventRecord {
  return makeRunEventRecord(id, runId, {
    stepRunId,
    origin: 'sdk',
    kind: 'sdk_user',
    sdkMessageType: 'user',
    parentToolUseId: 'toolu_e2e',
    payload: {
      type: 'user',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_e2e', content: LONG_URL }] },
    },
  });
}

/**
 * Egy `sdk_result` sor a megadott lépés futáshoz: a költség megjelenítése a
 * lépés providerétől függ (SPEC-008 7.1).
 */
export function sdkResultRecord(id: number, runId: string, stepRunId: string): RunEventRecord {
  return makeRunEventRecord(id, runId, {
    stepRunId,
    origin: 'sdk',
    kind: 'sdk_result',
    sdkMessageType: 'result',
    inputTokens: 1200,
    outputTokens: 340,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
    numTurns: 3,
    payload: { type: 'result', total_cost_usd: 0.213108 },
  });
}

/**
 * A futás teljes pótlása egyetlen lezárt SSE válaszban: `stream_ready`, a
 * rekordok `run_event` keretként, végül a futás `replay_complete` kerete.
 */
export function replayFrames(runId: string, records: readonly RunEventRecord[]): readonly StreamFrame[] {
  return [
    { event: 'stream_ready', streamId: 'e2e-stream', serverInstanceId: 'e2e-server', subscriptions: [] },
    ...records.map((record): StreamFrame => ({ event: 'run_event', delivery: 'replayed', runEvent: record })),
    { event: 'replay_complete', runId, throughEventId: records.at(-1)?.id ?? null },
  ];
}
