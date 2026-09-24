/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { PendingApproval } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApprovalPromptPanel } from './ApprovalPromptPanel.tsx';

const API_ORIGIN = 'https://api.example.test';

const APPROVAL: PendingApproval = {
  id: 'a-1',
  runId: 'r-1',
  stepRunId: 's-1',
  title: 'Engedélyezed?',
  body: 'Kérlek erősítsd meg',
  payload: { amount: 100 },
  decision: null,
  requestedAtMs: 1000,
  decidedAtMs: null,
};

const unreachableFetchFunction = () => Promise.reject(new Error('ebben a tesztben nincs REST hívás'));

describe('ApprovalPromptPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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

  it('betöltés alatt ProgressBar jelzést mutat', () => {
    act(() => {
      root.render(
        <ApprovalPromptPanel
          approvals={[]}
          isLoading={true}
          failureMessage={undefined}
          apiOrigin={API_ORIGIN}
          fetchFunction={unreachableFetchFunction}
          onDecided={vi.fn()}
        />,
      );
    });

    expect(container.querySelector('.progress-bar')).not.toBeNull();
    expect(container.querySelector('.approval-prompt-panel__list')).toBeNull();
  });

  it('nulla függő jóváhagyásra nem rajzol listát', () => {
    act(() => {
      root.render(
        <ApprovalPromptPanel
          approvals={[]}
          isLoading={false}
          failureMessage={undefined}
          apiOrigin={API_ORIGIN}
          fetchFunction={unreachableFetchFunction}
          onDecided={vi.fn()}
        />,
      );
    });

    expect(container.querySelector('.progress-bar')).toBeNull();
    expect(container.querySelector('.approval-prompt-panel__list')).toBeNull();
  });

  it('a hibaüzenetet role=alert szerepkörrel mutatja', () => {
    act(() => {
      root.render(
        <ApprovalPromptPanel
          approvals={[]}
          isLoading={false}
          failureMessage="A szerver nem érhető el."
          apiOrigin={API_ORIGIN}
          fetchFunction={unreachableFetchFunction}
          onDecided={vi.fn()}
        />,
      );
    });

    expect(container.querySelector('[role="alert"]')?.textContent).toBe('A szerver nem érhető el.');
  });

  it('minden függő jóváhagyáshoz egy ApprovalPromptCard tartozik', () => {
    act(() => {
      root.render(
        <ApprovalPromptPanel
          approvals={[APPROVAL, { ...APPROVAL, id: 'a-2', stepRunId: 's-2' }]}
          isLoading={false}
          failureMessage={undefined}
          apiOrigin={API_ORIGIN}
          fetchFunction={unreachableFetchFunction}
          onDecided={vi.fn()}
        />,
      );
    });

    expect(container.querySelectorAll('.approval-prompt-card')).toHaveLength(2);
    expect(container.querySelector('[aria-label="Függő jóváhagyások"]')).not.toBeNull();
  });
});
