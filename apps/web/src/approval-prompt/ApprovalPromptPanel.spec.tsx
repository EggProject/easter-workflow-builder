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
  const onDecide = vi.fn();
  const onSelectPage = vi.fn();

  beforeEach(() => {
    onDecide.mockClear();
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
          onDecide={onDecide}
        />,
      );
    });
  }

  function buttonNamed(name: string): HTMLButtonElement | undefined {
    return [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent === name || candidate.getAttribute('aria-label') === name,
    );
  }

  it('az első betöltés alatt ProgressBar jelzést mutat', () => {
    renderPanel(undefined, { isFirstLoadPending: true });

    expect(container.querySelector('.progress-bar')).not.toBeNull();
    expect(container.querySelector('.approval-prompt-panel__approval')).toBeNull();
  });

  it('látott jóváhagyás nélkül nem rajzol semmit: a panel üres elem', () => {
    renderPanel(undefined);

    expect(container.querySelector('.approval-prompt-panel')?.childElementCount).toBe(0);
  });

  it('a hibaüzenetet role=alert szerepkörrel mutatja', () => {
    renderPanel(undefined, { failureMessage: 'A szerver nem érhető el.' });

    expect(container.querySelector('[role="alert"]')?.textContent).toBe('A szerver nem érhető el.');
  });

  it('a szakasz sorrendje: a lapozó, a görgethető drawer törzs, a tapadó drawer lábléc', () => {
    renderPanel({ approval: APPROVAL, progress: undefined, index: 0 });

    const section = container.querySelector('section.approval-prompt-panel__approval');
    expect(section?.getAttribute('aria-label')).toBe('Függő jóváhagyások');
    expect([...(section?.children ?? [])].map((child) => child.className)).toEqual([
      'pagination',
      'drawer__body',
      'drawer__footer',
    ]);
  });

  it('a törzsben elöl kimondja a design system Alert blokkjával, hogy a döntés visszavonhatatlan, utána a látott jóváhagyás teljes tartalma', () => {
    renderPanel({ approval: APPROVAL, progress: undefined, index: 0 });

    const body = container.querySelector('.drawer__body');
    const [alert, card] = body?.children ?? [];
    expect(alert?.className).toBe('alert alert--warning');
    expect(alert?.querySelector(':scope .alert__title')?.textContent).toBe('A döntés visszavonhatatlan');
    expect(alert?.querySelector(':scope .alert__message')?.textContent).toBe(
      'Elküldés után sem a jóváhagyás, sem az elutasítás nem módosítható.',
    );
    expect(card?.tagName).toBe('ARTICLE');
    expect(card?.querySelector(':scope h3')?.textContent).toBe('Engedélyezed?');
    expect(card?.querySelector(':scope pre')?.textContent).toBe(JSON.stringify(APPROVAL.payload, undefined, 2));
    expect(body?.querySelectorAll(':scope button')).toHaveLength(0);
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

  it('a lábléc sávban csak a látott jóváhagyás két gombja és az eredménye áll, és a döntést a LÁTOTT jóváhagyással adja tovább', () => {
    renderPanel(
      { approval: SECOND, progress: { status: 'decided', decision: 'rejected' }, index: 1 },
      {
        approvalCount: 2,
      },
    );

    const footer = container.querySelector('.drawer__footer');
    expect([...(footer?.children ?? [])].map((child) => child.textContent)).toEqual([
      'Döntés rögzítve: elutasítva.',
      'Jóváhagyás',
      'Elutasítás',
    ]);

    renderPanel({ approval: SECOND, progress: undefined, index: 1 }, { approvalCount: 2 });
    act(() => {
      buttonNamed('Jóváhagyás')?.click();
    });
    expect(onDecide).toHaveBeenCalledWith(SECOND, 'approved');
  });

  it('lapozáskor a törzs új elem, tehát a görgetési helye a tetejéről indul', () => {
    renderPanel({ approval: APPROVAL, progress: undefined, index: 0 }, { approvalCount: 2 });
    const firstBody = container.querySelector('.drawer__body');

    renderPanel({ approval: APPROVAL, progress: undefined, index: 0 }, { approvalCount: 3 });
    expect(container.querySelector('.drawer__body')).toBe(firstBody);

    renderPanel({ approval: SECOND, progress: undefined, index: 1 }, { approvalCount: 3 });
    expect(container.querySelector('.drawer__body')).not.toBe(firstBody);
  });
});
