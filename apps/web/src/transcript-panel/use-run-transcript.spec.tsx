/* eslint-disable unicorn/no-null -- a RunEventRecord nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-003 6.2, SPEC-005 5.4) */
import type { StreamFrame } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SubscribeToStreamFrames } from '../stream-client/subscribe-to-stream-frames.ts';
import type { RunTranscriptState } from './run-transcript-state.ts';
import { useRunTranscript } from './use-run-transcript.ts';

const listeners = new Set<(frame: StreamFrame) => void>();

const subscribeToFrames: SubscribeToStreamFrames = (listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

function emit(frame: StreamFrame): void {
  for (const listener of listeners) {
    listener(frame);
  }
}

function runEventFrame(id: number, runId: string): StreamFrame {
  return {
    event: 'run_event',
    delivery: 'live',
    runEvent: {
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
    },
  };
}

function transientFrame(text: string): StreamFrame {
  return {
    event: 'run_event_transient',
    runId: 'run-1',
    stepRunId: null,
    kind: 'sdk_stream_event',
    occurredAtMs: 1,
    payload: { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text } } },
  };
}

describe('useRunTranscript', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: RunTranscriptState | undefined;

  function Harness({ runId }: { readonly runId: string | undefined }): null {
    latest = useRunTranscript(runId, subscribeToFrames);
    return null;
  }

  beforeEach(() => {
    listeners.clear();
    latest = undefined;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('runId nélkül nem iratkozik fel, és üres transcriptet ad', () => {
    act(() => {
      root.render(<Harness runId={undefined} />);
    });
    expect(listeners.size).toBe(0);
    expect(latest).toEqual({ rows: [], afterEventId: 0, transientSequence: 0, isReplayComplete: false });
  });

  it('egyetlen render kötegen belül érkező keretek közül egyet sem veszít el', () => {
    act(() => {
      root.render(<Harness runId="run-1" />);
    });
    act(() => {
      for (let id = 1; id <= 50; id += 1) {
        emit(runEventFrame(id, 'run-1'));
      }
      emit({ event: 'replay_complete', runId: 'run-1', throughEventId: 50 });
    });

    expect(latest?.rows).toHaveLength(50);
    expect(latest?.afterEventId).toBe(50);
    expect(latest?.isReplayComplete).toBe(true);
  });

  it('másik futásra váltva tiszta lappal indul, és csak az új futás kereteit gyűjti', () => {
    act(() => {
      root.render(<Harness runId="run-1" />);
    });
    act(() => {
      emit(runEventFrame(1, 'run-1'));
    });
    expect(latest?.rows).toHaveLength(1);

    act(() => {
      root.render(<Harness runId="run-2" />);
    });
    expect(latest?.rows).toHaveLength(0);
    expect(listeners.size).toBe(1);

    act(() => {
      emit(runEventFrame(2, 'run-1'));
      emit(runEventFrame(3, 'run-2'));
    });
    expect(latest?.rows.map((row) => row.key)).toEqual(['event-3']);
  });

  it('KURZOR: élő átmeneti sorok után az újracsatlakozás pótlásának ismétlése eldobódik, az új tárolt sor megjelenik', () => {
    act(() => {
      root.render(<Harness runId="run-1" />);
    });
    act(() => {
      emit(runEventFrame(1, 'run-1'));
      emit(runEventFrame(2, 'run-1'));
      emit({ event: 'replay_complete', runId: 'run-1', throughEventId: 2 });
      for (const text of ['a', 'b', 'c']) {
        emit(transientFrame(text));
      }
    });
    expect(latest?.afterEventId).toBe(2);

    // Az `EventSource` újracsatlakozása utáni pótlás: a tárolt sorok
    // ismétlése, majd a következő tárolt sor.
    act(() => {
      emit(runEventFrame(1, 'run-1'));
      emit(runEventFrame(2, 'run-1'));
      emit(runEventFrame(3, 'run-1'));
    });

    expect(latest?.rows.map((row) => row.key)).toEqual([
      'event-1',
      'event-2',
      'transient-1',
      'transient-2',
      'transient-3',
      'event-3',
    ]);
    expect(latest?.afterEventId).toBe(3);
  });

  it('leszereléskor leiratkozik', () => {
    act(() => {
      root.render(<Harness runId="run-1" />);
    });
    expect(listeners.size).toBe(1);
    act(() => {
      root.render(<Harness runId={undefined} />);
    });
    expect(listeners.size).toBe(0);
  });
});
