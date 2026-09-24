/* eslint-disable unicorn/no-null -- a RunSummary és a WorkflowSummary nullázható mezői a dróton ténylegesen `null` értéket hordoznak, nem helyőrző `undefined`-et (packages/protocol/src). */
import type { FetchFunction } from '@easter-workflow-builder/core';
import type { StreamFrame } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SubscribeToStreamFrames } from '../stream-client/subscribe-to-stream-frames.ts';
import { RunHistoryScreen } from './run-history-screen.tsx';

/**
 * A veszteségmentes keret feliratkozás teszt duplikátuma: a feliratkozókat
 * egy halmazban tartja, az `emitFrame` pedig mindegyiknek átadja a keretet,
 * ugyanúgy, mint a `useStreamConnection` kezelője.
 */
const frameListeners = new Set<(frame: StreamFrame) => void>();

const subscribeToFrames: SubscribeToStreamFrames = (listener) => {
  frameListeners.add(listener);
  return () => {
    frameListeners.delete(listener);
  };
};

/**
 * A keretek EGYETLEN szinkron sorozatban, egy `act` blokkban (egy React
 * render kötegben), majd a kiváltott kérések lefutása.
 */
async function emitFramesAndFlush(frames: readonly StreamFrame[]): Promise<void> {
  act(() => {
    for (const frame of frames) {
      for (const listener of frameListeners) {
        listener(frame);
      }
    }
  });
  await act(async () => {
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }
  });
}

/**
 * Egy élő `run_event` keret a `run-1` futásra.
 */
function runEventFrame(id: number): StreamFrame {
  return {
    event: 'run_event',
    delivery: 'live',
    runEvent: {
      id,
      runId: 'run-1',
      stepRunId: null,
      origin: 'engine',
      kind: 'run_started',
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

const API_ORIGIN = 'https://api.example.test';

const RUN_PENDING = {
  id: 'run-1',
  workflowId: 'workflow-1',
  status: 'pending',
  providerId: 'claude-subscription',
  createdAtMs: 0,
  startedAtMs: null,
  finishedAtMs: null,
  errorKind: null,
  errorMessage: null,
} as const;

const RUN_SUCCEEDED = {
  id: 'run-2',
  workflowId: 'workflow-1',
  status: 'succeeded',
  providerId: 'claude-subscription',
  createdAtMs: 0,
  startedAtMs: 1000,
  finishedAtMs: 2000,
  errorKind: null,
  errorMessage: null,
} as const;

const WORKFLOW = {
  id: 'workflow-1',
  name: 'Alfa',
  description: null,
  providerId: null,
  createdAtMs: 0,
  updatedAtMs: 0,
};

function jsonResponse(body: unknown): Response {
  return Response.json(body);
}

const failingFetchFunction: FetchFunction = () => Promise.reject(new Error('kapcsolat megszakadt'));

function findButtonByText(scope: ParentNode, text: string): HTMLButtonElement {
  const button = [...scope.querySelectorAll('button')].find((candidate) => candidate.textContent === text);
  if (button === undefined) {
    throw new Error(`a teszt nem talált "${text}" feliratú gombot`);
  }
  return button;
}

function findButtonByLabel(scope: ParentNode, label: string): HTMLButtonElement {
  const button = [...scope.querySelectorAll('button')].find(
    (candidate) => candidate.getAttribute('aria-label') === label,
  );
  if (button === undefined) {
    throw new Error(`a teszt nem talált "${label}" aria-label gombot`);
  }
  return button;
}

interface RouteCallLog {
  runsCallCount: number;
  subscriptionBodies: string[];
}

function createFetchFunction(
  runsToReturn: readonly (typeof RUN_PENDING | typeof RUN_SUCCEEDED)[],
  log: RouteCallLog,
): FetchFunction {
  return (input, init) => {
    if (init.method === 'PUT' && input.includes('/subscriptions')) {
      log.subscriptionBodies.push(typeof init.body === 'string' ? init.body : '');
      return Promise.resolve(jsonResponse({ streamId: 'stream-1', subscriptions: [] }));
    }
    if (init.method === 'POST' && input.includes('/interrupt')) {
      return Promise.resolve(jsonResponse({ rootRunId: 'run-1', cancelledRunIds: [] }));
    }
    if (init.method === 'POST' && input.includes('/restart')) {
      return Promise.resolve(jsonResponse({ runId: 'run-3', status: 'pending' }));
    }
    if (input.includes('/workflows')) {
      return Promise.resolve(jsonResponse([WORKFLOW]));
    }
    log.runsCallCount += 1;
    return Promise.resolve(jsonResponse(runsToReturn));
  };
}

describe('RunHistoryScreen', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    frameListeners.clear();
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

  function render(fetchFunction: FetchFunction, search = '', serverRestartCount = 0): void {
    act(() => {
      root.render(
        <RunHistoryScreen
          apiOrigin={API_ORIGIN}
          listLimit={25}
          streamReplayLimit={50}
          fetchFunction={fetchFunction}
          search={search}
          streamId="stream-1"
          subscribeToFrames={subscribeToFrames}
          serverRestartCount={serverRestartCount}
        />,
      );
    });
  }

  it('első betöltéskor Skeleton jelzést mutat, majd a sorokat rajzolja workflow névvel', async () => {
    const log: RouteCallLog = { runsCallCount: 0, subscriptionBodies: [] };
    render(createFetchFunction([RUN_PENDING], log));
    expect(container.querySelector('.skel-stack, .skel')).not.toBeNull();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('run-1');
    expect(container.textContent).toContain('Alfa');
    expect(container.textContent).toContain('várakozik');
  });

  it('betöltési hiba esetén hibaüzenetet jelenít meg', async () => {
    render(failingFetchFunction);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toBe('A szerver nem érhető el.');
  });

  it('üres listára az emptyLabel szöveget mutatja', async () => {
    const log: RouteCallLog = { runsCallCount: 0, subscriptionBodies: [] };
    render(createFetchFunction([], log));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Még nincs futás.');
  });

  it('workflowId nélkül csak a "Minden futás" fület mutatja', async () => {
    const log: RouteCallLog = { runsCallCount: 0, subscriptionBodies: [] };
    render(createFetchFunction([], log));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(1);
  });

  it('workflowId jelenlétében mindkét fület mutatja, és a fülváltás workflowId szűrővel tölt újra', async () => {
    const log: RouteCallLog = { runsCallCount: 0, subscriptionBodies: [] };
    let lastRunsUrl = '';
    const fetchFunction: FetchFunction = (input, init) => {
      if (input.includes('/runs') && !input.includes('/interrupt') && !input.includes('/restart')) {
        lastRunsUrl = input;
      }
      return createFetchFunction([RUN_SUCCEEDED], log)(input, init);
    };

    render(fetchFunction, '?workflowId=workflow-1');

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelectorAll('[role="tab"]')).toHaveLength(2);
    expect(lastRunsUrl).toContain('workflowId=workflow-1');

    act(() => {
      findButtonByText(container, 'Minden futás').click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(lastRunsUrl).not.toContain('workflowId');
  });

  it('a művelet gomb ikon gomb: nincs látható szövege, de van hozzáférhető neve, és a folyamatban lévő állapotban letiltott és aria-busy', async () => {
    const log: RouteCallLog = { runsCallCount: 0, subscriptionBodies: [] };
    render(createFetchFunction([RUN_PENDING], log));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const interruptButton = findButtonByLabel(container, 'Megszakítás – run-1');
    expect(interruptButton.textContent).toBe('');
    expect(interruptButton.querySelector('svg')).not.toBeNull();
    expect(interruptButton.disabled).toBe(false);

    act(() => {
      interruptButton.click();
    });
    // Kattintás után, a válasz megérkezéséig a gomb letiltott és aria-busy -
    // ez adja a várakozás jelzését, mert a gombnak nincs szöveges tartalma.
    expect(interruptButton.disabled).toBe(true);
    expect(interruptButton.getAttribute('aria-busy')).toBe('true');
  });

  it('a "Megszakítás" gomb pending/running futásra jelenik meg, sikeres kattintásra Toast-ot ad', async () => {
    const log: RouteCallLog = { runsCallCount: 0, subscriptionBodies: [] };
    render(createFetchFunction([RUN_PENDING], log));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      findButtonByLabel(container, 'Megszakítás – run-1').click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Futás megszakítva');
  });

  it('sikertelen "Megszakítás"-ra hiba Toast-ot ad', async () => {
    const log: RouteCallLog = { runsCallCount: 0, subscriptionBodies: [] };
    const fetchFunction: FetchFunction = (input, init) => {
      if (init.method === 'POST' && input.includes('/interrupt')) {
        return Promise.reject(new Error('kapcsolat megszakadt'));
      }
      return createFetchFunction([RUN_PENDING], log)(input, init);
    };
    render(fetchFunction);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      findButtonByLabel(container, 'Megszakítás – run-1').click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('A megszakítás sikertelen');
  });

  it('az "Újraindítás" gomb lezárt futásra jelenik meg, sikeres kattintásra Toast-ot ad', async () => {
    const log: RouteCallLog = { runsCallCount: 0, subscriptionBodies: [] };
    render(createFetchFunction([RUN_SUCCEEDED], log));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      findButtonByLabel(container, 'Újraindítás – run-2').click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Futás újraindítva');
  });

  it('sikertelen "Újraindítás"-ra hiba Toast-ot ad', async () => {
    const log: RouteCallLog = { runsCallCount: 0, subscriptionBodies: [] };
    const fetchFunction: FetchFunction = (input, init) => {
      if (init.method === 'POST' && input.includes('/restart')) {
        return Promise.reject(new Error('kapcsolat megszakadt'));
      }
      return createFetchFunction([RUN_SUCCEEDED], log)(input, init);
    };
    render(fetchFunction);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      findButtonByLabel(container, 'Újraindítás – run-2').click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Az újraindítás sikertelen');
  });

  it('a nem talált workflow nevet a nyers workflowId-vel helyettesíti', async () => {
    const log: RouteCallLog = { runsCallCount: 0, subscriptionBodies: [] };
    const fetchFunction: FetchFunction = (input, init) => {
      if (input.includes('/workflows')) {
        return Promise.resolve(jsonResponse([]));
      }
      return createFetchFunction([RUN_PENDING], log)(input, init);
    };
    render(fetchFunction);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('workflow-1');
  });

  it('a nem lezárt futásokra PUT feliratkozást küld, a padló nulla és a config replayLimit', async () => {
    const log: RouteCallLog = { runsCallCount: 0, subscriptionBodies: [] };
    render(createFetchFunction([RUN_PENDING], log));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(log.subscriptionBodies.at(-1)).toBe(
      JSON.stringify({ runs: [{ runId: 'run-1', fromEventId: 0, replayLimit: 50 }] }),
    );
  });

  it('lezárt futásra üres feliratkozási listát küld', async () => {
    const log: RouteCallLog = { runsCallCount: 0, subscriptionBodies: [] };
    render(createFetchFunction([RUN_SUCCEEDED], log));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(log.subscriptionBodies.at(-1)).toBe(JSON.stringify({ runs: [] }));
  });

  it('replay_complete keretre újratölti a listát', async () => {
    const log: RouteCallLog = { runsCallCount: 0, subscriptionBodies: [] };
    render(createFetchFunction([RUN_PENDING], log));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const callCountBeforeFrame = log.runsCallCount;

    await emitFramesAndFlush([{ event: 'replay_complete', runId: 'run-1', throughEventId: null }]);

    expect(log.runsCallCount).toBe(callCountBeforeFrame + 1);
  });

  it('stream_ready keretre nem tölt újra', async () => {
    const log: RouteCallLog = { runsCallCount: 0, subscriptionBodies: [] };
    render(createFetchFunction([RUN_PENDING], log));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const callCountBeforeFrame = log.runsCallCount;

    await emitFramesAndFlush([
      { event: 'stream_ready', streamId: 'stream-1', serverInstanceId: 'server-1', subscriptions: [] },
    ]);

    expect(log.runsCallCount).toBe(callCountBeforeFrame);
  });

  it('run_event keretre akkor is újratölt, ha UGYANABBAN a löketben protocol_error követi (T-009-25a)', async () => {
    const log: RouteCallLog = { runsCallCount: 0, subscriptionBodies: [] };
    render(createFetchFunction([RUN_PENDING], log));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const callCountBeforeFrame = log.runsCallCount;

    await emitFramesAndFlush([
      runEventFrame(1),
      { event: 'protocol_error', code: 'invalid_request', message: 'hibás fejléc', runId: null },
    ]);

    expect(log.runsCallCount).toBe(callCountBeforeFrame + 1);
  });

  it('egy löketben érkező ezer run_event keret összevont újratöltést ad, nem ezer kérést', async () => {
    const log: RouteCallLog = { runsCallCount: 0, subscriptionBodies: [] };
    render(createFetchFunction([RUN_PENDING], log));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const callCountBeforeFrame = log.runsCallCount;

    await emitFramesAndFlush(Array.from({ length: 1000 }, (_, index) => runEventFrame(index + 1)));

    // Egy futó és egy utólagos betöltés (`createCoalescedReload`).
    expect(log.runsCallCount).toBe(callCountBeforeFrame + 2);
  });

  it('leszereléskor leiratkozik a keretekről', () => {
    const log: RouteCallLog = { runsCallCount: 0, subscriptionBodies: [] };
    render(createFetchFunction([RUN_PENDING], log));
    expect(frameListeners.size).toBe(1);
    act(() => {
      root.unmount();
    });
    expect(frameListeners.size).toBe(0);
    // Az `afterEach` újra leszerelné a gyökeret: egy friss, üres gyökér
    // kerül a helyére, hogy a második `unmount` ne dobjon.
    root = createRoot(container);
  });

  it('a serverRestartCount növekedésére újratölti a listát (szerver újraindulás)', async () => {
    const log: RouteCallLog = { runsCallCount: 0, subscriptionBodies: [] };
    const fetchFunction = createFetchFunction([RUN_PENDING], log);
    render(fetchFunction);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const callCountBeforeRestart = log.runsCallCount;

    render(fetchFunction, '', 1);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(log.runsCallCount).toBeGreaterThan(callCountBeforeRestart);
  });

  it('az "Állapot" fejlécre kattintás felirat szerint rendez', async () => {
    const log: RouteCallLog = { runsCallCount: 0, subscriptionBodies: [] };
    render(createFetchFunction([RUN_PENDING, RUN_SUCCEEDED], log));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const header = [...container.querySelectorAll('[role="columnheader"]')].find(
      (candidate) => candidate.textContent === 'Állapot',
    );
    if (header === undefined) {
      throw new Error('a teszt nem talált "Állapot" fejlécet');
    }
    act(() => {
      if (header instanceof HTMLElement) {
        header.click();
      }
    });

    expect(container.textContent).toContain('sikeres');
  });

  it('a nem rendezhető "Műveletek" fejlécre kattintás nem változtatja meg a sorrendet', async () => {
    const log: RouteCallLog = { runsCallCount: 0, subscriptionBodies: [] };
    render(createFetchFunction([RUN_PENDING], log));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const header = [...container.querySelectorAll('[role="columnheader"]')].find(
      (candidate) => candidate.textContent === 'Műveletek',
    );
    if (header === undefined) {
      throw new Error('a teszt nem talált "Műveletek" fejlécet');
    }
    act(() => {
      if (header instanceof HTMLElement) {
        header.click();
      }
    });

    expect(container.textContent).toContain('run-1');
  });
});
