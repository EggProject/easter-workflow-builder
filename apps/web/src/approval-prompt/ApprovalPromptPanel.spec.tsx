/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { PendingApproval } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApprovalPromptPanel } from './ApprovalPromptPanel.tsx';
import type { DisplayedApproval } from './select-displayed-approvals.ts';

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

describe('ApprovalPromptPanel', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onDecide = vi.fn();

  beforeEach(() => {
    onDecide.mockClear();
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
    displayed: readonly DisplayedApproval[],
    options: { readonly isFirstLoadPending?: boolean; readonly failureMessage?: string } = {},
  ): void {
    act(() => {
      root.render(
        <ApprovalPromptPanel
          isFirstLoadPending={options.isFirstLoadPending ?? false}
          failureMessage={options.failureMessage}
          displayed={displayed}
          onDecide={onDecide}
        />,
      );
    });
  }

  it('az első betöltés alatt ProgressBar jelzést mutat', () => {
    renderPanel([], { isFirstLoadPending: true });

    expect(container.querySelector('.progress-bar')).not.toBeNull();
    expect(container.querySelector('.approval-prompt-panel__list')).toBeNull();
  });

  it('nulla kártyára nem rajzol semmit: a panel üres elem', () => {
    renderPanel([]);

    expect(container.querySelector('.approval-prompt-panel')?.childElementCount).toBe(0);
  });

  it('a hibaüzenetet role=alert szerepkörrel mutatja', () => {
    renderPanel([], { failureMessage: 'A szerver nem érhető el.' });

    expect(container.querySelector('[role="alert"]')?.textContent).toBe('A szerver nem érhető el.');
  });

  it('kártyák fölött, a görgethető tartalomban kimondja, hogy a döntés visszavonhatatlan, a design system Alert blokkjával', () => {
    renderPanel([{ approval: APPROVAL, progress: undefined }]);

    const alert = container.querySelector(':scope .approval-prompt-panel__content > .alert.alert--warning:first-child');
    expect(alert?.querySelector('.alert__title')?.textContent).toBe('A döntés visszavonhatatlan');
    expect(alert?.querySelector('.alert__message')?.textContent).toBe(
      'Elküldés után sem a jóváhagyás, sem az elutasítás nem módosítható.',
    );
  });

  it('minden megjelenített jóváhagyáshoz egy kártya a tartalomban és egy döntési sor a tartalom ALATT, azonos sorrendben; a sor a döntést a jóváhagyással adja tovább', () => {
    const second: PendingApproval = { ...APPROVAL, id: 'a-2', stepRunId: 's-2', title: 'Második?' };
    renderPanel([
      { approval: APPROVAL, progress: undefined },
      { approval: second, progress: { status: 'decided', decision: 'rejected' } },
    ]);

    const list = container.querySelector('.approval-prompt-panel__list');
    expect([...(list?.children ?? [])].map((child) => child.className)).toEqual([
      'approval-prompt-panel__content',
      'approval-prompt-panel__decisions',
    ]);
    const cards = container.querySelectorAll(':scope .approval-prompt-panel__content > .approval-prompt-card');
    expect([...cards].map((card) => card.querySelector('h3')?.textContent)).toEqual(['Engedélyezed?', 'Második?']);
    const rows = container.querySelectorAll(':scope .approval-prompt-panel__decisions > .approval-decision-row');
    expect([...rows].map((row) => row.querySelector('.approval-decision-row__label')?.textContent)).toEqual([
      'Engedélyezed?',
      'Második?',
    ]);
    expect(rows[1]?.querySelector('[role="status"]')?.textContent).toBe('Döntés rögzítve: elutasítva.');

    const [firstApprove] = rows[0]?.querySelectorAll<HTMLButtonElement>('button.btn') ?? [];
    act(() => {
      firstApprove?.click();
    });

    expect(onDecide).toHaveBeenCalledWith(APPROVAL, 'approved');
  });
});
