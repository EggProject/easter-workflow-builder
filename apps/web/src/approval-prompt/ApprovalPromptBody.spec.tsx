/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { PendingApproval } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApprovalPromptBody } from './ApprovalPromptBody.tsx';

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

describe('ApprovalPromptBody', () => {
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

  function renderBody(approval: PendingApproval): void {
    act(() => {
      root.render(<ApprovalPromptBody key={approval.id} approval={approval} />);
    });
  }

  it('a "Függő jóváhagyások" szakasz egyetlen gyereke a design system drawer törzse, gomb nélkül', () => {
    renderBody(APPROVAL);

    const section = container.querySelector('section.approval-prompt-body');
    expect(section?.getAttribute('aria-label')).toBe('Függő jóváhagyások');
    expect([...(section?.children ?? [])].map((child) => child.className)).toEqual(['drawer__body']);
    expect(section?.querySelectorAll('button')).toHaveLength(0);
  });

  it('a törzsben elöl kimondja a design system Alert blokkjával, hogy a döntés visszavonhatatlan, utána a látott jóváhagyás teljes tartalma', () => {
    renderBody(APPROVAL);

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
  });

  it('a jóváhagyás azonosítója kulcsként: lapozáskor a törzs új elem, tehát a görgetési helye a tetejéről indul', () => {
    renderBody(APPROVAL);
    const firstBody = container.querySelector('.drawer__body');

    renderBody(APPROVAL);
    expect(container.querySelector('.drawer__body')).toBe(firstBody);

    renderBody(SECOND);
    expect(container.querySelector('.drawer__body')).not.toBe(firstBody);
  });
});
