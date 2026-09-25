import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApprovalDecisionActions } from './ApprovalDecisionActions.tsx';
import type { ApprovalDecisionProgress } from './reduce-approval-decisions.ts';

describe('ApprovalDecisionActions', () => {
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

  function renderActions(progress: ApprovalDecisionProgress | undefined): void {
    act(() => {
      root.render(<ApprovalDecisionActions progress={progress} onDecide={onDecide} />);
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

  it('a design system drawer láblécét rajzolja: a sáv közvetlen gyerekei a két gomb, és ha van, előttük az eredmény', () => {
    renderActions(undefined);
    const footer = (): Element | undefined => [...container.children][0];
    expect(container.children).toHaveLength(1);
    expect(footer()?.className).toBe('drawer__footer');
    expect([...(footer()?.children ?? [])].map((child) => child.textContent)).toEqual(['Jóváhagyás', 'Elutasítás']);

    renderActions({ status: 'decided', decision: 'approved' });
    expect([...(footer()?.children ?? [])].map((child) => child.tagName)).toEqual(['P', 'BUTTON', 'BUTTON']);
  });

  it('döntés előtt mindkét gomb engedélyezett és sm méretű, eredmény és nyugtázó gomb nincs; a gombok a döntést adják tovább', () => {
    renderActions(undefined);
    const { approve, reject } = decisionButtons();

    expect(approve.disabled).toBe(false);
    expect(reject.disabled).toBe(false);
    expect(approve.className).toContain('btn--sm');
    expect(reject.className).toContain('btn--sm');
    expect(container.querySelectorAll('button')).toHaveLength(2);
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
    renderActions({ status: 'sending', decision });

    expect(button(pressed)?.disabled).toBe(true);
    expect(button(other)?.disabled).toBe(true);
    expect(button(pressed)?.classList.contains('is-loading')).toBe(true);
    expect(button(other)?.classList.contains('is-loading')).toBe(false);
  });

  it.each([
    ['approved', 'Döntés rögzítve: jóváhagyva.'],
    ['rejected', 'Döntés rögzítve: elutasítva.'],
  ] as const)(
    'elfogadott döntés (%s) után a gombok letiltva maradnak, az eredmény látszik, nyugtázó gomb nélkül',
    (decision, result) => {
      renderActions({ status: 'decided', decision });
      const { approve, reject } = decisionButtons();

      expect(approve.disabled).toBe(true);
      expect(reject.disabled).toBe(true);
      expect(approve.classList.contains('is-loading')).toBe(false);
      expect(container.querySelector('[role="status"]')?.textContent).toBe(result);
      expect(container.querySelectorAll('button')).toHaveLength(2);
    },
  );

  it('végleges hiba (conflict) után a gombok letiltva maradnak, a hibaüzenet látszik, nyugtázó gomb nélkül', () => {
    renderActions({ status: 'failed', message: 'a jóváhagyás már el lett döntve', isFinal: true });
    const { approve, reject } = decisionButtons();

    expect(approve.disabled).toBe(true);
    expect(reject.disabled).toBe(true);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('a jóváhagyás már el lett döntve');
    expect(container.querySelectorAll('button')).toHaveLength(2);
  });

  it('átmeneti hiba után a gombok újra engedélyezettek (újrapróbálás), a hibaüzenet látszik', () => {
    renderActions({ status: 'failed', message: 'A szerver nem érhető el.', isFinal: false });
    const { approve, reject } = decisionButtons();

    expect(approve.disabled).toBe(false);
    expect(reject.disabled).toBe(false);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('A szerver nem érhető el.');
  });
});
