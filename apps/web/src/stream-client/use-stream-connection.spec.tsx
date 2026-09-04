/* eslint-disable unicorn/no-null -- a RunEventRecord és a keret sémák nullázható mezői (stepRunId, sdkMessageType stb., throughEventId, runId) a dróton ténylegesen `null` értéket hordoznak, nem helyőrző `undefined`-et (SPEC-003 6.2, SPEC-005 5.4 táblázat) */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EventSourceLike } from './event-source-like.ts';
import { useStreamConnection, type StreamConnectionState } from './use-stream-connection.ts';

const CONNECTING = 0;
const OPEN = 1;

/**
 * A `EventSourceLike` teszt duplikátuma: eltárolja a feliratkozott
 * kezelőket eseménynevenként, és a `dispatch` metódussal szimulál egy
 * beérkező keretet vagy kapcsolat szintű eseményt.
 */
class FakeEventSource implements EventSourceLike {
  readonly #listenersByType = new Map<string, ((event: MessageEvent) => void)[]>();
  readyState = CONNECTING;
  readonly capturedUrl: string;
  closeCallCount = 0;

  constructor(url: string) {
    this.capturedUrl = url;
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    const existing = this.#listenersByType.get(type) ?? [];
    existing.push(listener);
    this.#listenersByType.set(type, existing);
  }

  close(): void {
    this.closeCallCount += 1;
  }

  dispatch(type: string, data?: string): void {
    const listeners = this.#listenersByType.get(type) ?? [];
    const event = new MessageEvent(type, { data });
    for (const listener of listeners) {
      listener(event);
    }
  }
}

function frameData(value: unknown): string {
  return JSON.stringify(value);
}

function testStreamIdGenerator(): string {
  return 'stream-1';
}

describe('useStreamConnection', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: StreamConnectionState | undefined;
  let createdSource: FakeEventSource | undefined;

  /**
   * A gyár és a generátor a `describe` blokk szintjén, egyszer definiált,
   * stabil hivatkozás - ugyanaz a minta, mint a valódi
   * `browserEventSourceFactory`/`browserStreamIdGenerator` modul szintű
   * konstans. Ha a gyár minden renderkor új azonosítót kapna, a hook
   * `useEffect`-je feleslegesen zárná és nyitná újra a kapcsolatot minden
   * állapotváltáskor.
   */
  function testEventSourceFactory(url: string): FakeEventSource {
    const source = new FakeEventSource(url);
    createdSource = source;
    return source;
  }

  function HookHarness({ apiOrigin }: { readonly apiOrigin: string }): null {
    latest = useStreamConnection({
      apiOrigin,
      eventSourceFactory: testEventSourceFactory,
      streamIdGenerator: testStreamIdGenerator,
    });
    return null;
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    latest = undefined;
    createdSource = undefined;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function render(apiOrigin = 'https://api.example.test'): FakeEventSource {
    act(() => {
      root.render(<HookHarness apiOrigin={apiOrigin} />);
    });
    if (createdSource === undefined) {
      throw new Error('a teszt forrás nem jött létre');
    }
    return createdSource;
  }

  it('kezdetben connecting fázisban van, a generátor által adott streamId-vel', () => {
    render();
    expect(latest?.streamId).toBe('stream-1');
    expect(latest?.phase).toBe('connecting');
    expect(latest?.lastFrame).toBeUndefined();
    expect(latest?.serverInstanceId).toBeUndefined();
  });

  it('a streamId a buildStreamUrl-en át kerül az URL-be, az apiOrigin előtaggal', () => {
    const source = render('https://api.example.test');
    expect(source.capturedUrl).toBe('https://api.example.test/events?streamId=stream-1');
  });

  it('open eseményre live fázisba lép, ha nincs várakozó pótlás', () => {
    const source = render();
    act(() => {
      source.readyState = OPEN;
      source.dispatch('open');
    });
    expect(latest?.phase).toBe('live');
  });

  it('stream_ready keretre eltárolja a serverInstanceId-t, üres subscriptions esetén marad live', () => {
    const source = render();
    act(() => {
      source.readyState = OPEN;
      source.dispatch('open');
      source.dispatch(
        'stream_ready',
        frameData({ event: 'stream_ready', streamId: 'stream-1', serverInstanceId: 'srv-1', subscriptions: [] }),
      );
    });
    expect(latest?.serverInstanceId).toBe('srv-1');
    expect(latest?.phase).toBe('live');
    expect(latest?.lastFrame).toEqual({
      event: 'stream_ready',
      streamId: 'stream-1',
      serverInstanceId: 'srv-1',
      subscriptions: [],
    });
  });

  /**
   * A `serverRestartCount` három ága (SPEC-007 9.2, 16. szekció 44.
   * kritérium): az ELSŐ ismert azonosító nem újraindulás, az UGYANAZ
   * megismételve sem, és kizárólag egy MÁSIK azonosító növeli a számlálót.
   */
  function dispatchStreamReady(source: FakeEventSource, serverInstanceId: string): void {
    act(() => {
      source.dispatch(
        'stream_ready',
        frameData({ event: 'stream_ready', streamId: 'stream-1', serverInstanceId, subscriptions: [] }),
      );
    });
  }

  it('a serverRestartCount kezdetben nulla, és az első stream_ready keret nem növeli', () => {
    const source = render();
    expect(latest?.serverRestartCount).toBe(0);
    dispatchStreamReady(source, 'srv-1');
    expect(latest?.serverInstanceId).toBe('srv-1');
    expect(latest?.serverRestartCount).toBe(0);
  });

  it('ugyanazt a serverInstanceId-t ismételve a serverRestartCount nem változik', () => {
    const source = render();
    dispatchStreamReady(source, 'srv-1');
    dispatchStreamReady(source, 'srv-1');
    expect(latest?.serverRestartCount).toBe(0);
  });

  it('eltérő serverInstanceId esetén a serverRestartCount nő: a szerver újraindult', () => {
    const source = render();
    dispatchStreamReady(source, 'srv-1');
    dispatchStreamReady(source, 'srv-2');
    expect(latest?.serverInstanceId).toBe('srv-2');
    expect(latest?.serverRestartCount).toBe(1);
  });

  it('stream_ready keretre nem üres subscriptions esetén replaying fázisba lép', () => {
    const source = render();
    act(() => {
      source.readyState = OPEN;
      source.dispatch('open');
      source.dispatch(
        'stream_ready',
        frameData({
          event: 'stream_ready',
          streamId: 'stream-1',
          serverInstanceId: 'srv-1',
          subscriptions: [{ runId: 'run-1', fromEventId: 0, replayLimit: 25 }],
        }),
      );
    });
    expect(latest?.phase).toBe('replaying');
  });

  it('replay_complete keretre a jelzett futásra visszatér live fázisba', () => {
    const source = render();
    act(() => {
      source.readyState = OPEN;
      source.dispatch('open');
      source.dispatch(
        'stream_ready',
        frameData({
          event: 'stream_ready',
          streamId: 'stream-1',
          serverInstanceId: 'srv-1',
          subscriptions: [{ runId: 'run-1', fromEventId: 0, replayLimit: 25 }],
        }),
      );
    });
    expect(latest?.phase).toBe('replaying');

    act(() => {
      source.dispatch('replay_complete', frameData({ event: 'replay_complete', runId: 'run-1', throughEventId: 5 }));
    });
    expect(latest?.phase).toBe('live');
  });

  it('replay_complete keretre olyan futásra, ami nem várakozott pótlásra, nem változtat állapotot', () => {
    const source = render();
    act(() => {
      source.readyState = OPEN;
      source.dispatch('open');
    });
    expect(latest?.phase).toBe('live');

    act(() => {
      source.dispatch(
        'replay_complete',
        frameData({ event: 'replay_complete', runId: 'run-ismeretlen', throughEventId: null }),
      );
    });
    expect(latest?.phase).toBe('live');
  });

  it('run_event és run_event_transient keretre a lastFrame frissül', () => {
    const source = render();
    act(() => {
      source.dispatch(
        'run_event',
        frameData({
          event: 'run_event',
          delivery: 'live',
          runEvent: {
            id: 1,
            runId: 'run-1',
            stepRunId: null,
            origin: 'engine',
            kind: 'run_started',
            occurredAtMs: 0,
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
        }),
      );
    });
    expect(latest?.lastFrame?.event).toBe('run_event');

    act(() => {
      source.dispatch(
        'run_event_transient',
        frameData({
          event: 'run_event_transient',
          runId: 'run-1',
          stepRunId: null,
          kind: 'sdk_stream_event',
          occurredAtMs: 1,
          payload: {},
        }),
      );
    });
    expect(latest?.lastFrame?.event).toBe('run_event_transient');
  });

  it('protocol_error keretre a lastFrame frissül, a kapcsolat nyitva marad', () => {
    const source = render();
    act(() => {
      source.dispatch(
        'protocol_error',
        frameData({ event: 'protocol_error', code: 'internal', message: 'hiba', runId: null }),
      );
    });
    expect(latest?.lastFrame?.event).toBe('protocol_error');
    expect(source.closeCallCount).toBe(0);
  });

  it('hibás JSON keretet eldob, a lastFrame nem változik', () => {
    const source = render();
    act(() => {
      source.dispatch('run_event', '{nem json');
    });
    expect(latest?.lastFrame).toBeUndefined();
  });

  it('a sémának nem megfelelő keretet eldob, a lastFrame nem változik', () => {
    const source = render();
    act(() => {
      source.dispatch('run_event', frameData({ event: 'ismeretlen_esemeny' }));
    });
    expect(latest?.lastFrame).toBeUndefined();
  });

  it('error eseményre, ha korábban már csatlakozott, reconnecting fázisba lép', () => {
    const source = render();
    act(() => {
      source.readyState = OPEN;
      source.dispatch('open');
    });
    expect(latest?.phase).toBe('live');

    act(() => {
      source.readyState = CONNECTING;
      source.dispatch('error');
    });
    expect(latest?.phase).toBe('reconnecting');
  });

  it('leszereléskor lezárja a kapcsolatot', () => {
    const source = render();
    act(() => {
      root.unmount();
    });
    expect(source.closeCallCount).toBe(1);
  });
});
