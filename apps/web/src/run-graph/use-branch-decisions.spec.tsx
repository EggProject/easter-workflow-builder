/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { StreamFrame } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SubscribeToStreamFrames } from '../stream-client/subscribe-to-stream-frames.ts';
import type { BranchDecision } from './branch-decision.ts';
import { useBranchDecisions } from './use-branch-decisions.ts';

/**
 * A veszteségmentes keret feliratkozás teszt duplikátuma, ugyanaz a minta,
 * mint a `use-live-step-runs.spec.tsx`-ben.
 */
const frameListeners = new Set<(frame: StreamFrame) => void>();

const subscribeToFrames: SubscribeToStreamFrames = (listener) => {
  frameListeners.add(listener);
  return () => {
    frameListeners.delete(listener);
  };
};

function emitFrame(frame: StreamFrame): void {
  for (const listener of frameListeners) {
    listener(frame);
  }
}

function branchTakenFrame(
  id: number,
  options: { readonly runId?: string; readonly delivery?: 'live' | 'replayed'; readonly payload?: unknown } = {},
): StreamFrame {
  return {
    event: 'run_event',
    delivery: options.delivery ?? 'replayed',
    runEvent: {
      id,
      runId: options.runId ?? 'r-1',
      stepRunId: `s-${String(id)}`,
      origin: 'engine',
      kind: 'branch_taken',
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
      payload: options.payload ?? { branchKey: `k-${String(id)}`, usedDefault: false },
    },
  };
}

describe('useBranchDecisions', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: ReadonlyMap<number, BranchDecision> | undefined;

  function HookHarness(properties: { readonly runId: string | undefined }): null {
    latest = useBranchDecisions(properties.runId, subscribeToFrames);
    return null;
  }

  function render(runId: string | undefined): void {
    act(() => {
      root.render(<HookHarness runId={runId} />);
    });
  }

  beforeEach(() => {
    frameListeners.clear();
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

  it('runId nélkül nem iratkozik fel, és üres térképet ad', () => {
    render(undefined);

    expect(frameListeners.size).toBe(0);
    expect(latest?.size).toBe(0);
  });

  it('a nézett futás döntését az esemény id mezője szerint kulcsolja', () => {
    render('r-1');

    act(() => {
      emitFrame(branchTakenFrame(5, { delivery: 'live' }));
    });

    expect([...(latest?.entries() ?? [])]).toEqual([
      [5, { eventId: 5, stepRunId: 's-5', branchKey: 'k-5', usedDefault: false }],
    ]);
  });

  it('egy render kötegen belül érkező ezer keretes sorozatból egy keret sem vész el', () => {
    render('r-1');

    // Egyetlen `act` blokk: a keretek egyetlen szinkron sorozatban érkeznek,
    // tehát a React egyetlen renderbe vonja össze a frissítéseket (a
    // `use-live-step-runs.spec.tsx` löket mintája).
    act(() => {
      for (let id = 1; id <= 1000; id += 1) {
        emitFrame(branchTakenFrame(id));
      }
    });

    expect(latest?.size).toBe(1000);
    expect([...(latest?.keys() ?? [])]).toEqual(Array.from({ length: 1000 }, (_, index) => index + 1));
  });

  it('a kétszer érkező id egyszer számít, és a korábbi térkép marad', () => {
    render('r-1');
    act(() => {
      emitFrame(branchTakenFrame(5));
      emitFrame(branchTakenFrame(6));
    });
    const before = latest;

    // A szerver újraindulása utáni pótlás ugyanazokat a kereteket újra küldi.
    act(() => {
      emitFrame(branchTakenFrame(5));
      emitFrame(branchTakenFrame(6, { payload: { branchKey: 'mas', usedDefault: true } }));
    });

    expect(latest).toBe(before);
    expect(latest?.get(6)?.branchKey).toBe('k-6');
  });

  it('a pótolt és az élő döntés egyaránt bekerül, egy kötegen belül is', () => {
    render('r-1');

    act(() => {
      emitFrame(branchTakenFrame(3, { delivery: 'replayed' }));
      emitFrame({ event: 'replay_complete', runId: 'r-1', throughEventId: 3 });
      emitFrame(branchTakenFrame(4, { delivery: 'live' }));
    });

    expect([...(latest?.keys() ?? [])]).toEqual([3, 4]);
  });

  it('a másik futás kerete és a hibás alakú payload kimarad', () => {
    render('r-1');

    act(() => {
      emitFrame(branchTakenFrame(5, { runId: 'r-masik' }));
      emitFrame(branchTakenFrame(6, { payload: { branchKey: 3, usedDefault: false } }));
      emitFrame(branchTakenFrame(7));
    });

    expect([...(latest?.keys() ?? [])]).toEqual([7]);
  });

  it('másik futásra váltáskor a korábbi döntések törlődnek, és csak az új futás keretei számítanak', () => {
    render('r-1');
    act(() => {
      emitFrame(branchTakenFrame(5));
    });
    expect(latest?.size).toBe(1);

    render('r-2');
    expect(latest?.size).toBe(0);
    expect(frameListeners.size).toBe(1);

    act(() => {
      emitFrame(branchTakenFrame(6));
      emitFrame(branchTakenFrame(7, { runId: 'r-2' }));
    });
    expect([...(latest?.keys() ?? [])]).toEqual([7]);
  });

  it('leszereléskor leiratkozik a keretekről', () => {
    render('r-1');
    expect(frameListeners.size).toBe(1);

    act(() => {
      root.unmount();
    });
    expect(frameListeners.size).toBe(0);
    // Az `afterEach` újra leszerelné a gyökeret: egy friss, üres gyökér
    // kerül a helyére, hogy a második `unmount` ne dobjon.
    root = createRoot(container);
  });
});
