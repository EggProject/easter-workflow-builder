import { useEffect, useState } from 'react';
import { buildStreamUrl, decodeStreamFrame, type StreamFrame } from '@easter-workflow-builder/protocol';
import type { EventSourceFactory } from './event-source-like.ts';
import type { StreamIdGenerator } from './stream-id-generator.ts';

/**
 * A topnav státusz kijelzőjének négy állapota (SPEC-007 11. szekció 14 ...
 * 16. async pontja). A `live` állapothoz nincs önálló szöveg (11. szekció),
 * ezért a hívó ezt az egy ágat nem jelzi ki.
 */
export type StreamConnectionPhase = 'connecting' | 'reconnecting' | 'replaying' | 'live';

export interface StreamConnectionState {
  readonly streamId: string;
  readonly phase: StreamConnectionPhase;
  readonly lastFrame: StreamFrame | undefined;
  readonly serverInstanceId: string | undefined;
}

export interface UseStreamConnectionInput {
  readonly apiOrigin: string;
  readonly eventSourceFactory: EventSourceFactory;
  readonly streamIdGenerator: StreamIdGenerator;
}

const OPEN_READY_STATE = 1;

/**
 * A natív `EventSource` öt keretén kívüli, kapcsolat szintű eseménynevek,
 * amik a `readyState` változását jelzik (SPEC-007 9.4 2. pont).
 */
const READY_STATE_EVENT_NAMES = ['open', 'error'] as const;
const FRAME_EVENT_NAMES = [
  'stream_ready',
  'run_event',
  'run_event_transient',
  'replay_complete',
  'protocol_error',
] as const;

/**
 * A négy állapot kiszámítása (SPEC-007 9.4, 11. szekció 14 ... 16. pont):
 * amíg a kapcsolat `CONNECTING` (nem `OPEN`), az első csatlakozás
 * "kapcsolódás", minden utána következő "újracsatlakozás"; `OPEN` állapotban
 * a folyamatban lévő pótlás "előzmények betöltése", különben "élő" (jelzés
 * nélkül).
 */
function computePhase(
  readyState: number,
  hasConnectedOnce: boolean,
  pendingReplayRunIdCount: number,
): StreamConnectionPhase {
  if (readyState !== OPEN_READY_STATE) {
    return hasConnectedOnce ? 'reconnecting' : 'connecting';
  }
  return pendingReplayRunIdCount > 0 ? 'replaying' : 'live';
}

/**
 * Az egyetlen, fülenkénti SSE kapcsolat (SPEC-007 9.1 ... 9.4). A `streamId`
 * a befecskendezett generátorból egyszer épül, és a komponens élettartama
 * alatt nem változik. A kapcsolat leszereléskor záródik, hiba után nem
 * (9.4 1. és 3. pont).
 */
export function useStreamConnection(input: Readonly<UseStreamConnectionInput>): StreamConnectionState {
  const { apiOrigin, eventSourceFactory, streamIdGenerator } = input;
  const [streamId] = useState<string>(streamIdGenerator);
  const [readyState, setReadyState] = useState<number>(0);
  const [hasConnectedOnce, setHasConnectedOnce] = useState<boolean>(false);
  const [serverInstanceId, setServerInstanceId] = useState<string | undefined>(undefined);
  const [pendingReplayRunIds, setPendingReplayRunIds] = useState<ReadonlySet<string>>(new Set());
  const [lastFrame, setLastFrame] = useState<StreamFrame | undefined>(undefined);

  useEffect(() => {
    const source = eventSourceFactory(`${apiOrigin}${buildStreamUrl(streamId)}`);

    function handleReadyStateChange(): void {
      setReadyState(source.readyState);
      if (source.readyState === OPEN_READY_STATE) {
        setHasConnectedOnce(true);
      }
    }

    function handleFrame(event: MessageEvent): void {
      let parsedData: unknown;
      try {
        parsedData = JSON.parse(String(event.data));
      } catch {
        return;
      }
      const decoded = decodeStreamFrame(parsedData);
      if (decoded.kind === 'error') {
        return;
      }

      const frame = decoded.value;
      setReadyState(source.readyState);
      setLastFrame(frame);

      if (frame.event === 'stream_ready') {
        setServerInstanceId(frame.serverInstanceId);
        setPendingReplayRunIds((previous) => {
          const next = new Set(previous);
          for (const entry of frame.subscriptions) {
            next.add(entry.runId);
          }
          return next;
        });
        return;
      }

      if (frame.event === 'replay_complete') {
        setPendingReplayRunIds((previous) => {
          if (!previous.has(frame.runId)) {
            return previous;
          }
          const next = new Set(previous);
          next.delete(frame.runId);
          return next;
        });
      }
    }

    for (const eventName of READY_STATE_EVENT_NAMES) {
      source.addEventListener(eventName, handleReadyStateChange);
    }
    for (const eventName of FRAME_EVENT_NAMES) {
      source.addEventListener(eventName, handleFrame);
    }

    return () => {
      source.close();
    };
  }, [apiOrigin, streamId, eventSourceFactory]);

  return {
    streamId,
    phase: computePhase(readyState, hasConnectedOnce, pendingReplayRunIds.size),
    lastFrame,
    serverInstanceId,
  };
}
