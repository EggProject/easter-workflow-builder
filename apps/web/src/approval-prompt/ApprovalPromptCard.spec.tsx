/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { PendingApproval } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApprovalPromptCard } from './ApprovalPromptCard.tsx';
import type { ApprovalDecisionProgress } from './reduce-approval-decisions.ts';

const APPROVAL: PendingApproval = {
  id: 'a-1',
  runId: 'r-1',
  stepRunId: 's-1',
  title: 'Engedélyezed a fizetést?',
  body: 'Kérlek erősítsd meg a tranzakciót',
  payload: { amount: 100, currency: 'EUR' },
  decision: null,
  requestedAtMs: 1000,
  decidedAtMs: null,
};

describe('ApprovalPromptCard', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onDecide = vi.fn();
  const onDismiss = vi.fn();

  beforeEach(() => {
    onDecide.mockClear();
    onDismiss.mockClear();
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

  function renderCard(progress: ApprovalDecisionProgress | undefined): void {
    act(() => {
      root.render(
        <ApprovalPromptCard approval={APPROVAL} progress={progress} onDecide={onDecide} onDismiss={onDismiss} />,
      );
    });
  }

  function button(name: string): HTMLButtonElement | undefined {
    return [...container.querySelectorAll<HTMLButtonElement>('button.btn')].find(
      (candidate) => candidate.textContent === name,
    );
  }

  function decisionButtons(): { readonly approve: HTMLButtonElement; readonly reject: HTMLButtonElement } {
    const approve = button('Jóváhagyás');
    const reject = button('Elutasítás');
    if (approve === undefined || reject === undefined) {
      throw new Error('a teszt nem talált két döntés gombot');
    }
    return { approve, reject };
  }

  it('a title, a body és a formázott payload megjelenik', () => {
    renderCard(undefined);

    expect(container.querySelector('h3')?.textContent).toBe('Engedélyezed a fizetést?');
    expect(container.textContent).toContain('Kérlek erősítsd meg a tranzakciót');
    const payload = container.querySelector('pre');
    expect(payload?.textContent).toBe(JSON.stringify({ amount: 100, currency: 'EUR' }, undefined, 2));
  });

  it('döntés előtt mindkét gomb engedélyezett és sm méretű, nyugtázó gomb és eredmény nincs; a gombok a döntést adják tovább', () => {
    renderCard(undefined);
    const { approve, reject } = decisionButtons();

    expect(approve.disabled).toBe(false);
    expect(reject.disabled).toBe(false);
    expect(approve.className).toContain('btn--sm');
    expect(reject.className).toContain('btn--sm');
    expect(button('Rendben')).toBeUndefined();
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();

    act(() => {
      approve.click();
      reject.click();
    });
    expect(onDecide.mock.calls).toEqual([['approved'], ['rejected']]);
  });

  it.each([
    ['approved', 'Jóváhagyás', 'Elutasítás'],
    ['rejected', 'Elutasítás', 'Jóváhagyás'],
  ] as const)('küldés közben (%s) mindkét gomb letiltva, csak a megnyomotton spinner', (decision, pressed, other) => {
    renderCard({ status: 'sending', decision });

    expect(button(pressed)?.disabled).toBe(true);
    expect(button(other)?.disabled).toBe(true);
    expect(button(pressed)?.classList.contains('is-loading')).toBe(true);
    expect(button(other)?.classList.contains('is-loading')).toBe(false);
    expect(button('Rendben')).toBeUndefined();
  });

  it.each([
    ['approved', 'Döntés rögzítve: jóváhagyva.'],
    ['rejected', 'Döntés rögzítve: elutasítva.'],
  ] as const)(
    'elfogadott döntés (%s) után a gombok letiltva maradnak, az eredmény látszik, és a Rendben nyugtáz',
    (decision, result) => {
      renderCard({ status: 'decided', decision });
      const { approve, reject } = decisionButtons();

      expect(approve.disabled).toBe(true);
      expect(reject.disabled).toBe(true);
      expect(approve.classList.contains('is-loading')).toBe(false);
      expect(container.querySelector('[role="status"]')?.textContent).toBe(result);

      act(() => {
        button('Rendben')?.click();
      });
      expect(onDismiss).toHaveBeenCalledTimes(1);
    },
  );

  it('végleges hiba (conflict) után a gombok letiltva maradnak, a hibaüzenet és a Rendben látszik', () => {
    renderCard({ status: 'failed', message: 'a jóváhagyás már el lett döntve', isFinal: true });
    const { approve, reject } = decisionButtons();

    expect(approve.disabled).toBe(true);
    expect(reject.disabled).toBe(true);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('a jóváhagyás már el lett döntve');
    expect(button('Rendben')).toBeDefined();
  });

  it('átmeneti hiba után a gombok újra engedélyezettek (újrapróbálás), a hibaüzenet és a Rendben látszik', () => {
    renderCard({ status: 'failed', message: 'A szerver nem érhető el.', isFinal: false });
    const { approve, reject } = decisionButtons();

    expect(approve.disabled).toBe(false);
    expect(reject.disabled).toBe(false);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('A szerver nem érhető el.');
    expect(button('Rendben')).toBeDefined();
  });

  it.each([
    [{ status: 'decided', decision: 'approved' }, '[role="status"]'],
    [{ status: 'failed', message: 'a jóváhagyás már el lett döntve', isFinal: true }, '[role="alert"]'],
  ] as const)(
    'a megjelenő eredmény (%o) a legkisebb görgetéssel a látható területre kerül',
    (progress, resultSelector) => {
      const scrollIntoView = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
      try {
        renderCard({ status: 'sending', decision: 'approved' });
        expect(scrollIntoView).not.toHaveBeenCalled();

        renderCard(progress);
        expect(scrollIntoView.mock.contexts).toEqual([container.querySelector(resultSelector)]);
        expect(scrollIntoView.mock.calls).toEqual([[{ block: 'nearest' }]]);
      } finally {
        scrollIntoView.mockRestore();
      }
    },
  );
});
