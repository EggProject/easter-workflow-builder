/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { PendingApproval } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DisplayedApproval } from './select-displayed-approvals.ts';
import { useApprovalSelection, type ApprovalSelection } from './use-approval-selection.ts';

function displayedApproval(id: string, requestedAtMs: number): DisplayedApproval {
  const approval: PendingApproval = {
    id,
    runId: 'r-1',
    stepRunId: `s-${id}`,
    title: 'Azonos cím',
    body: 'Kérlek erősítsd meg',
    payload: { id },
    decision: null,
    requestedAtMs,
    decidedAtMs: null,
  };
  return { approval, progress: undefined };
}

const A = displayedApproval('a', 1000);
const B = displayedApproval('b', 2000);
const C = displayedApproval('c', 3000);

describe('useApprovalSelection', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: ApprovalSelection | undefined;
  let renderCount = 0;

  function HookHarness(properties: { readonly displayed: readonly DisplayedApproval[] }): null {
    renderCount += 1;
    latest = useApprovalSelection(properties.displayed);
    return null;
  }

  function render(displayed: readonly DisplayedApproval[]): void {
    act(() => {
      root.render(<HookHarness displayed={displayed} />);
    });
  }

  function selectPage(page: number): void {
    act(() => {
      latest?.selectPage(page);
    });
  }

  function shownId(): string | undefined {
    return latest?.shown?.approval.id;
  }

  beforeEach(() => {
    latest = undefined;
    renderCount = 0;
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

  it('üres listára nincs látott jóváhagyás', () => {
    render([]);
    expect(latest?.shown).toBeUndefined();
  });

  it('alapból a legrégebbi látszik, és a lapozó oldala szerint választ', () => {
    render([A, B, C]);
    expect(latest?.shown?.index).toBe(0);
    expect(shownId()).toBe('a');

    selectPage(3);
    expect(latest?.shown?.index).toBe(2);
    expect(shownId()).toBe('c');
  });

  it('a lapozás nélkül látott legrégebbi is rögzül: egy később listázott, korábbi időpontú jóváhagyás nem veszi át a helyét', () => {
    render([B, C]);
    expect(shownId()).toBe('b');

    render([A, B, C]);
    expect(shownId()).toBe('b');
    expect(latest?.shown?.index).toBe(1);
  });

  it('élő frissítéskor a kiválasztás nem ugrik el: új jóváhagyás előtte és a előtte álló kikerülése után is ugyanaz látszik', () => {
    render([A, C]);
    selectPage(2);
    expect(shownId()).toBe('c');

    render([A, B, C]);
    expect(shownId()).toBe('c');
    expect(latest?.shown?.index).toBe(2);

    render([B, C]);
    expect(shownId()).toBe('c');
    expect(latest?.shown?.index).toBe(1);
  });

  it('ha a látott jóváhagyás kikerül, a legrégebbi látszik, és az rögzül', () => {
    render([A, B, C]);
    selectPage(2);

    render([A, C]);
    expect(shownId()).toBe('a');

    render([displayedApproval('0', 500), A, C]);
    expect(shownId()).toBe('a');
  });

  it('tartományon kívüli oldalra a legrégebbi látszik', () => {
    render([A, B, C]);
    selectPage(2);
    selectPage(9);
    expect(shownId()).toBe('a');
  });

  it('a lista kiürülése után az új lista legrégebbije látszik', () => {
    render([A, B]);
    selectPage(2);
    render([]);
    expect(latest?.shown).toBeUndefined();

    render([C]);
    expect(shownId()).toBe('c');
  });

  it('a rögzítés egyetlen további renderrel jár, nem ismétlődik', () => {
    render([A, B]);
    const rendersAfterFirstList = renderCount;
    render([A, B]);
    expect(renderCount).toBe(rendersAfterFirstList + 1);
  });
});
