/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { PendingApproval } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApprovalPromptCard } from './ApprovalPromptCard.tsx';

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

  it('a title, a body és a formázott payload megjelenik, a kártya neve a cím, a cím és a szöveg a hívó azonosítóját viseli', () => {
    act(() => {
      root.render(<ApprovalPromptCard approval={APPROVAL} titleId="cim-1" textId="szoveg-1" />);
    });

    const article = container.querySelector('article.approval-prompt-card');
    const heading = container.querySelector('h3');
    expect(heading?.textContent).toBe('Engedélyezed a fizetést?');
    expect(heading?.id).toBe('cim-1');
    expect(article?.getAttribute('aria-labelledby')).toBe('cim-1');
    expect(container.querySelector('#szoveg-1')?.textContent).toBe('Kérlek erősítsd meg a tranzakciót');
    const payload = container.querySelector('pre');
    expect(payload?.textContent).toBe(JSON.stringify({ amount: 100, currency: 'EUR' }, undefined, 2));
  });

  it('a kártyán nincs gomb: a döntés a törzs alatti akciósávban van', () => {
    act(() => {
      root.render(<ApprovalPromptCard approval={APPROVAL} titleId="cim-1" textId="szoveg-1" />);
    });

    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});
