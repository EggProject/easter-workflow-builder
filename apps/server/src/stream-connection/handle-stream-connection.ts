import {
  encodeStreamFrame,
  resolveReplayCursor,
  type RunEventOrigin,
  type RunEventRecord,
  type RunSubscriptionEntry,
} from '@easter-workflow-builder/protocol';
import type { DatabaseContext, RunEventRecord as DatabaseRunEventRecord } from '@easter-workflow-builder/db';
import type { ClockPort } from '@easter-workflow-builder/engine';
import type { StreamRegistry } from '../stream-registry/create-stream-registry.ts';
import type { RunSignal } from '../stream-registry/run-signal.ts';
import type { StreamSink } from './stream-sink.ts';

/**
Életben tartó megjegyzés sor: nincs `event:` és nincs `id:` mezője, tehát a kliens last event ID értékét nem mozdítja el (SPEC-005 F-3, F-4, SPEC-006 6.6).
*/
const KEEP_ALIVE_COMMENT = ': keep-alive\n\n';

export interface StreamConnectionDependencies {
  readonly database: DatabaseContext;
  readonly registry: StreamRegistry;
  readonly clock: ClockPort;
  readonly keepAliveIntervalMs: number;
}

export interface StreamConnectionHandle {
  /**
  A kliens eltűnése (a nyelő `close` eseménye, SPEC-006 6.6).
  */
  readonly handleClientClosed: () => void;
}

/**
 * A `db` réteg `run_event.origin` oszlopa nyers `string` (a
 * `run-event-repository.ts` dokumentációja szerint szándékosan nincs hozzá
 * guard), a drótszintű `RunEventOrigin` viszont zárt, két értékű felsorolás.
 * A beszúró réteg (`insertSdkEventRow`/`insertEngineEventRow`) mindig szó
 * szerint `'sdk'`/`'engine'` literált ír, tehát ez a leképezés teljes: az
 * egyetlen elágazás mindkét ága valós, tesztelt adaton fut (a `'sdk'` az
 * `appendSdkEvent`, a nem-`'sdk'` az `appendEngineEvent` sorain), nem egy
 * típusilag vagy logikailag holt "korrupt adat" ágat vezet be
 * (`.claude/CLAUDE.md` 5. szekció, 100 százalékos lefedettség).
 */
function toWireOrigin(origin: string): RunEventOrigin {
  return origin === 'sdk' ? 'sdk' : 'engine';
}

/**
A `db` `RunEventRecord`-ot a drótszintű alakra képezi: a `Date` mező egész milliszekundum lesz.
*/
function toWireRunEvent(record: DatabaseRunEventRecord): RunEventRecord {
  return {
    id: record.id,
    runId: record.runId,
    stepRunId: record.stepRunId,
    origin: toWireOrigin(record.origin),
    kind: record.kind,
    occurredAtMs: record.occurredAtMs.getTime(),
    sdkMessageType: record.sdkMessageType,
    sdkMessageSubtype: record.sdkMessageSubtype,
    sdkSessionId: record.sdkSessionId,
    sdkUuid: record.sdkUuid,
    parentToolUseId: record.parentToolUseId,
    toolName: record.toolName,
    toolUseId: record.toolUseId,
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    cacheReadInputTokens: record.cacheReadInputTokens,
    cacheCreationInputTokens: record.cacheCreationInputTokens,
    numTurns: record.numTurns,
    payload: record.payload,
  };
}

/**
 * A `GET /events` kapcsolat teljes életciklusa (SPEC-006 6. szekció). A
 * `sink`-en kívül minden hívás szinkron, mert a `better-sqlite3` szinkron;
 * kizárólag az életben tartás időzítése async, a `clock` porton át.
 *
 * A `lastEventIdHeader` a kliens `Last-Event-ID` fejléce, ha érkezett
 * (SPEC-006 6.3). Nem egész értékre a kapcsolat NEM zár le: egy
 * `protocol_error` keret megy ki `runId: null` mezővel, és a pótlás a
 * feliratkozás padlójától indul (SPEC-006 6.3 2. pont, 27. kritérium).
 */
export function handleStreamConnection(
  streamId: string,
  lastEventIdHeader: string | undefined,
  sink: StreamSink,
  dependencies: StreamConnectionDependencies,
): StreamConnectionHandle {
  const { database, registry, clock, keepAliveIntervalMs } = dependencies;

  // 1. Az első keret mindig stream_ready (SPEC-006 24. kritérium).
  sink.write(
    encodeStreamFrame({
      event: 'stream_ready',
      streamId,
      serverInstanceId: registry.serverInstanceId,
      subscriptions: registry.getSubscriptions(streamId),
    }),
  );

  // 2. A Last-Event-ID fejléc feldolgozása.
  let headerCursor: number | null;
  if (lastEventIdHeader === undefined) {
    // eslint-disable-next-line unicorn/no-null -- nincs fejléc, a pótlás a padlótól indul
    headerCursor = null;
  } else {
    const parsed = Number(lastEventIdHeader);
    if (Number.isSafeInteger(parsed) && parsed >= 0) {
      headerCursor = parsed;
    } else {
      // eslint-disable-next-line unicorn/no-null -- lásd a fejléc dokumentációját
      headerCursor = null;
      sink.write(
        encodeStreamFrame({
          event: 'protocol_error',
          code: 'invalid_request',
          message:
            'A Last-Event-ID fejléc értéke nem egész szám, a pótlás a feliratkozás padlójától indul (invalid_request).',
          // eslint-disable-next-line unicorn/no-null -- a hiba kapcsolat szintű, nem egyetlen futáshoz köthető
          runId: null,
        }),
      );
    }
  }

  const tracked = new Map<string, { lastSentId: number; replayLimit: number }>();

  /**
  Egyetlen futás pótlása, lapozva, amíg a lap tele jön vissza (SPEC-006 6.4, 25. kritérium).
  */
  function replayRun(entry: RunSubscriptionEntry): number {
    const startCursor = resolveReplayCursor(entry.fromEventId, headerCursor);
    let cursor = startCursor;
    // eslint-disable-next-line unicorn/no-null -- a replay_complete throughEventId mezője valódi number | null
    let lastId: number | null = null;
    for (;;) {
      const page = database.events.readEventsSince(entry.runId, cursor, entry.replayLimit);
      if (page.kind === 'error') {
        break;
      }
      for (const record of page.value) {
        sink.write(encodeStreamFrame({ event: 'run_event', delivery: 'replayed', runEvent: toWireRunEvent(record) }));
        cursor = record.id;
        lastId = record.id;
      }
      if (page.value.length < entry.replayLimit) {
        break;
      }
    }
    sink.write(encodeStreamFrame({ event: 'replay_complete', runId: entry.runId, throughEventId: lastId }));
    return lastId ?? startCursor;
  }

  /**
  A feliratkozás cseréje: az újonnan felvettekre pótol, az elhagyottakra leáll (SPEC-006 6.2 3. pont).
  */
  function handleReplaced(entries: readonly RunSubscriptionEntry[]): void {
    const nextRunIds = new Set(entries.map((entry) => entry.runId));
    for (const runId of tracked.keys()) {
      if (!nextRunIds.has(runId)) {
        tracked.delete(runId);
      }
    }
    for (const entry of entries) {
      if (tracked.has(entry.runId)) {
        continue;
      }
      tracked.set(entry.runId, { lastSentId: replayRun(entry), replayLimit: entry.replayLimit });
    }
  }

  /**
  A motor jelzésének lecsapolása: minden talált sor `delivery: live`, üres lecsapolásra a transiens keret (SPEC-006 6.5).
  */
  function handleSignal(signal: RunSignal): void {
    const state = tracked.get(signal.runId);
    if (state === undefined) {
      return;
    }
    let cursor = state.lastSentId;
    let isSentAny = false;
    for (;;) {
      const page = database.events.readEventsSince(signal.runId, cursor, state.replayLimit);
      if (page.kind === 'error') {
        break;
      }
      for (const record of page.value) {
        sink.write(encodeStreamFrame({ event: 'run_event', delivery: 'live', runEvent: toWireRunEvent(record) }));
        cursor = record.id;
        isSentAny = true;
      }
      if (page.value.length < state.replayLimit) {
        break;
      }
    }
    if (isSentAny) {
      tracked.set(signal.runId, { lastSentId: cursor, replayLimit: state.replayLimit });
    } else if (signal.transientFrame !== undefined) {
      sink.write(encodeStreamFrame(signal.transientFrame));
    }
  }

  const keepAliveController = new AbortController();

  function handleClientClosed(): void {
    keepAliveController.abort();
    unregister();
  }

  const unregister = registry.openConnection(streamId, {
    onReplaced: handleReplaced,
    onSignal: handleSignal,
    forceClose: () => {
      keepAliveController.abort();
      sink.close();
    },
  });

  // 3. A kapcsolat felépülésekor már beállított feliratkozások pótlása (SPEC-006 6.2 "Ha a PUT ... a feliratkozás akkor is rögzül").
  handleReplaced(registry.getSubscriptions(streamId));

  // 4. Az életben tartás időzítése, kizárólag a clock porton (SPEC-006 6.6, 28. kritérium).
  async function runKeepAlive(): Promise<void> {
    for (;;) {
      try {
        await clock.sleep(keepAliveIntervalMs, keepAliveController.signal);
      } catch {
        return;
      }
      sink.write(KEEP_ALIVE_COMMENT);
    }
  }
  void runKeepAlive();

  return { handleClientClosed };
}
