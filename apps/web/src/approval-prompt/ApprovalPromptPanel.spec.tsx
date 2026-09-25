/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { PendingApproval } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApprovalPromptPanel } from './ApprovalPromptPanel.tsx';
import type { ShownApproval } from './select-shown-approval.ts';

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

const SECOND: PendingApproval = { ...APPROVAL, id: 'a-2', stepRunId: 's-2', title: 'Második?' };

describe('ApprovalPromptPanel', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onSelectPage = vi.fn();

  beforeEach(() => {
    onSelectPage.mockClear();
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

  function renderPanel(
    shown: ShownApproval | undefined,
    options: {
      readonly isFirstLoadPending?: boolean;
      readonly failureMessage?: string;
      readonly approvalCount?: number;
    } = {},
  ): void {
    act(() => {
      root.render(
        <ApprovalPromptPanel
          isFirstLoadPending={options.isFirstLoadPending ?? false}
          failureMessage={options.failureMessage}
          approvalCount={options.approvalCount ?? (shown === undefined ? 0 : 1)}
          shown={shown}
          onSelectPage={onSelectPage}
          decisionActions={<div className="actions-placeholder">gombok</div>}
        />,
      );
    });
  }

  function buttonNamed(name: string): HTMLButtonElement | undefined {
    return [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent === name || candidate.getAttribute('aria-label') === name,
    );
  }

  function regionName(): string | null | undefined {
    return container.querySelector('section.approval-prompt-panel')?.getAttribute('aria-label');
  }

  it('az első betöltés alatt ProgressBar jelzést mutat, a "Függő jóváhagyások" régióban', () => {
    renderPanel(undefined, { isFirstLoadPending: true });

    expect(container.querySelector('.progress-bar')).not.toBeNull();
    expect(container.querySelector('nav.pagination')).toBeNull();
    expect(container.querySelector('.actions-placeholder')).toBeNull();
    expect(regionName()).toBe('Függő jóváhagyások');
  });

  it('látott jóváhagyás, betöltés és hiba nélkül nem rajzol semmit: üres, név nélküli szakasz, tehát nem régió', () => {
    renderPanel(undefined);

    expect(container.querySelector('section.approval-prompt-panel')?.childElementCount).toBe(0);
    expect(regionName()).toBeNull();
  });

  it('a hibaüzenetet role=alert szerepkörrel mutatja, a "Függő jóváhagyások" régióban', () => {
    renderPanel(undefined, { failureMessage: 'A szerver nem érhető el.' });

    expect(container.querySelector('[role="alert"]')?.textContent).toBe('A szerver nem érhető el.');
    expect(regionName()).toBe('Függő jóváhagyások');
  });

  it('látott jóváhagyásnál a "Függő jóváhagyások" régióban a lapozó, alatta a döntés akciósávja áll; a jóváhagyás szövege nem a régió része', () => {
    renderPanel({ approval: APPROVAL, progress: undefined, index: 0 });

    const panel = container.querySelector('section.approval-prompt-panel');
    expect(regionName()).toBe('Függő jóváhagyások');
    expect([...(panel?.children ?? [])].map((child) => child.className)).toEqual(['pagination', 'actions-placeholder']);
    expect(panel?.querySelector('.drawer__body')).toBeNull();
  });

  it('a lapozó "k / n" alakban mutatja a helyet, magyar nevekkel, és az 1-től számozott oldalt adja tovább', () => {
    renderPanel({ approval: SECOND, progress: undefined, index: 1 }, { approvalCount: 4 });

    const navigation = container.querySelector('nav.pagination');
    expect(navigation?.getAttribute('aria-label')).toBe('Jóváhagyások lapozása');
    expect(navigation?.querySelector(':scope .pagination__meta')?.textContent).toBe('2 / 4');
    expect(buttonNamed('2')?.getAttribute('aria-current')).toBe('page');

    act(() => {
      buttonNamed('Következő')?.click();
      buttonNamed('Előző')?.click();
    });
    expect(onSelectPage.mock.calls).toEqual([[3], [1]]);
  });

  it('a lapozó a szomszéd oldalszámok nélkül rajzol, hogy keskeny panelben is elférjen', () => {
    renderPanel({ approval: SECOND, progress: undefined, index: 4 }, { approvalCount: 10 });

    const slots = [...container.querySelectorAll(':scope .pagination__pages > :not([aria-label])')].map(
      (element) => element.textContent,
    );
    expect(slots).toEqual(['1', '…', '5', '…', '10']);
  });
});
