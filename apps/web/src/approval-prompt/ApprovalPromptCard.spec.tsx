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

  it('a title, a body és a formázott payload megjelenik, a kártya neve a cím', () => {
    act(() => {
      root.render(<ApprovalPromptCard approval={APPROVAL} />);
    });

    const article = container.querySelector('article.approval-prompt-card');
    const heading = container.querySelector('h3');
    expect(heading?.textContent).toBe('Engedélyezed a fizetést?');
    expect(article?.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect(container.textContent).toContain('Kérlek erősítsd meg a tranzakciót');
    const payload = container.querySelector('pre');
    expect(payload?.textContent).toBe(JSON.stringify({ amount: 100, currency: 'EUR' }, undefined, 2));
  });

  it('a kártyán nincs gomb: a döntés a panel alján álló döntési sávban van', () => {
    act(() => {
      root.render(<ApprovalPromptCard approval={APPROVAL} />);
    });

    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});
