/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { FetchFunction } from '@easter-workflow-builder/core';
import type { RunDetail, RunStatus } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunControlBar } from './RunControlBar.tsx';

const API_ORIGIN = 'https://api.example.test';

const RUNNING_RUN: RunDetail = {
  id: 'r-1',
  workflowId: 'wf-1',
  status: 'running',
  input: null,
  providerId: 'minimax',
  rootRunId: 'r-1',
  depth: 0,
  workflowAncestry: ['wf-1'],
  graphSnapshotHash: 'a'.repeat(64),
  persistedStreamDeltas: false,
  restartedFromRunId: null,
  createdAtMs: 1,
  startedAtMs: 2,
  finishedAtMs: null,
  errorKind: null,
  errorMessage: null,
};

function runWithStatus(status: RunStatus): RunDetail {
  return { ...RUNNING_RUN, status };
}

/**
 * A `pending` fázis megfigyeléséhez a kérés SOSEM oldódik fel: egy azonnal
 * teljesülő válasz a teszt törzse UTÁN frissítené az állapotot, amire a React
 * `act(...)` figyelmeztetést ad.
 */
const pendingFetchFunction: FetchFunction = () =>
  new Promise<Response>(() => {
    // szándékosan sosem oldódik fel
  });

const failingFetchFunction: FetchFunction = () => Promise.reject(new Error('kapcsolat megszakadt'));

/**
 * Megszakítás válasz, amiben KIZÁROLAG a gyökér futás szerepel: al-workflow
 * futás nem szakadt meg vele.
 */
const rootOnlyInterruptFetchFunction: FetchFunction = () =>
  Promise.resolve(Response.json({ rootRunId: 'r-1', cancelledRunIds: ['r-1'] }));

/**
 * Megszakítás válasz két al-workflow futással a gyökér mellett (M-89).
 */
const subRunsInterruptFetchFunction: FetchFunction = () =>
  Promise.resolve(Response.json({ rootRunId: 'r-1', cancelledRunIds: ['r-1', 'r-2', 'r-3'] }));

/**
 * Az újraindítás válasza: ÚJ futás azonosítója.
 */
const restartFetchFunction: FetchFunction = () => Promise.resolve(Response.json({ runId: 'r-9', status: 'pending' }));

describe('RunControlBar', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onRestarted = vi.fn();

  beforeEach(() => {
    onRestarted.mockClear();
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

  async function renderBar(
    runDetail: RunDetail,
    fetchFunction: FetchFunction,
    hasPendingApproval = false,
  ): Promise<void> {
    await act(async () => {
      root.render(
        <RunControlBar
          runDetail={runDetail}
          apiOrigin={API_ORIGIN}
          fetchFunction={fetchFunction}
          onRestarted={onRestarted}
          hasPendingApproval={hasPendingApproval}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function actionButton(): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>(':scope .run-control__actions button.btn');
    if (button === null) {
      throw new Error('a teszt nem talált művelet gombot');
    }
    return button;
  }

  function clickAction(): void {
    act(() => {
      actionButton().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    });
  }

  it('futó futáson a megszakítás gomb áll, terminálison az újraindítás', async () => {
    await renderBar(runWithStatus('running'), pendingFetchFunction);
    expect(actionButton().textContent).toBe('Megszakítás');

    await renderBar(runWithStatus('succeeded'), pendingFetchFunction);
    expect(actionButton().textContent).toBe('Újraindítás');
  });

  it('függő jóváhagyásra a "jóváhagyásra vár" jelvény az állapot jelvény mellett, ugyanabban a sorban áll', async () => {
    await renderBar(runWithStatus('running'), pendingFetchFunction, true);
    const badges = [...container.querySelectorAll(':scope .run-control__bar > .badge')].map(
      (badge) => badge.textContent,
    );
    expect(badges).toEqual(['fut', 'jóváhagyásra vár']);

    await renderBar(runWithStatus('running'), pendingFetchFunction, false);
    expect([...container.querySelectorAll(':scope .run-control__bar > .badge')]).toHaveLength(1);
  });

  it('a cancelled és az interrupted állapot ELTÉRŐ szóval jelenik meg', async () => {
    await renderBar(runWithStatus('cancelled'), pendingFetchFunction);
    const cancelledLabel = container.querySelector('.badge')?.textContent;

    await renderBar(runWithStatus('interrupted'), pendingFetchFunction);
    const interruptedLabel = container.querySelector('.badge')?.textContent;

    expect(cancelledLabel).toBe('megszakítva');
    expect(interruptedLabel).toBe('félbeszakítva');
    expect(cancelledLabel).not.toBe(interruptedLabel);
  });

  it('a megszakítás kérése alatt a gomb letiltva, spinnerrel, és a felirat kimondja a folyamatot', async () => {
    await renderBar(runWithStatus('running'), pendingFetchFunction);

    clickAction();

    expect(actionButton().disabled).toBe(true);
    expect(actionButton().classList.contains('is-loading')).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Megszakítás folyamatban');
  });

  it('a válasz megérkezése UTÁN is "megszakítás folyamatban" áll, amíg a futás nem terminális', async () => {
    await renderBar(runWithStatus('running'), rootOnlyInterruptFetchFunction);

    clickAction();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="status"]')?.textContent).toBe('Megszakítás folyamatban');
    expect(actionButton().disabled).toBe(true);

    // A `run_finished` esemény hatása: a `RunViewScreen` újratölti a futás
    // rekordját, tehát a komponens terminális állapottal renderelődik újra.
    // Ez zárja le a "megszakítás folyamatban" állapotot.
    await renderBar(runWithStatus('cancelled'), rootOnlyInterruptFetchFunction);

    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(actionButton().textContent).toBe('Újraindítás');
    expect(actionButton().disabled).toBe(false);
  });

  it('a cancelledRunIds lista megjelenik, ha nem csak a gyökér futás szerepel benne', async () => {
    await renderBar(runWithStatus('running'), subRunsInterruptFetchFunction);

    clickAction();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const section = container.querySelector('.run-control__cancelled-runs');
    expect(section?.querySelector('h2')?.textContent).toBe('Megszakított al-workflow futások');
    expect([...(section?.querySelectorAll('li') ?? [])].map((item) => item.textContent)).toEqual(['r-2', 'r-3']);
  });

  it('csak a gyökér futást tartalmazó cancelledRunIds listát nem írja ki', async () => {
    await renderBar(runWithStatus('running'), rootOnlyInterruptFetchFunction);

    clickAction();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('.run-control__cancelled-runs')).toBeNull();
  });

  it('a megszakítás hibáját riasztásként írja ki, és a gomb újra használható', async () => {
    await renderBar(runWithStatus('running'), failingFetchFunction);

    clickAction();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toBe('A szerver nem érhető el.');
    expect(actionButton().disabled).toBe(false);
  });

  it('az újraindítás alatt a gomb letiltva, spinnerrel', async () => {
    await renderBar(runWithStatus('failed'), pendingFetchFunction);

    clickAction();

    expect(actionButton().disabled).toBe(true);
    expect(actionButton().classList.contains('is-loading')).toBe(true);
  });

  it('az újraindítás az ÚJ futás azonosítójával hív vissza', async () => {
    await renderBar(runWithStatus('interrupted'), restartFetchFunction);

    clickAction();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onRestarted).toHaveBeenCalledWith('r-9');
  });

  it('az újraindítás hibáját riasztásként írja ki, navigáció nélkül', async () => {
    await renderBar(runWithStatus('failed'), failingFetchFunction);

    clickAction();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toBe('A szerver nem érhető el.');
    expect(onRestarted).not.toHaveBeenCalled();
  });

  it('a futás hibaosztályát és hibaüzenetét a sáv alatt írja ki', async () => {
    await renderBar(
      { ...runWithStatus('failed'), errorKind: 'agent_step_failed', errorMessage: 'a lépés elbukott' },
      pendingFetchFunction,
    );

    const error = container.querySelector('.run-control__run-error');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.querySelector('.run-control__run-error-kind')?.textContent).toBe('agent_step_failed');
    expect(error?.querySelector('.run-control__run-error-message')?.textContent).toBe('a lépés elbukott');
  });

  it('hibaüzenet nélküli hibaosztályt önmagában is kiír', async () => {
    await renderBar({ ...runWithStatus('failed'), errorKind: 'run_cancelled' }, pendingFetchFunction);

    expect(container.querySelector('.run-control__run-error-kind')?.textContent).toBe('run_cancelled');
    expect(container.querySelector('.run-control__run-error-message')).toBeNull();
  });

  it('hibaosztály nélküli hibaüzenetet önmagában is kiír', async () => {
    await renderBar({ ...runWithStatus('failed'), errorMessage: 'ismeretlen ok' }, pendingFetchFunction);

    expect(container.querySelector('.run-control__run-error-kind')).toBeNull();
    expect(container.querySelector('.run-control__run-error-message')?.textContent).toBe('ismeretlen ok');
  });

  it('hiba nélküli futáson nincs hibablokk', async () => {
    await renderBar(runWithStatus('succeeded'), pendingFetchFunction);

    expect(container.querySelector('.run-control__run-error')).toBeNull();
  });

  it('a megszakítás és az újraindítás gombja sm méretű, valódi felirattal', async () => {
    await renderBar(runWithStatus('running'), pendingFetchFunction);
    expect(actionButton().classList.contains('btn--sm')).toBe(true);
    expect(actionButton().classList.contains('btn--icon')).toBe(false);

    await renderBar(runWithStatus('failed'), pendingFetchFunction);
    expect(actionButton().classList.contains('btn--sm')).toBe(true);
    expect(actionButton().classList.contains('btn--icon')).toBe(false);
  });
});
