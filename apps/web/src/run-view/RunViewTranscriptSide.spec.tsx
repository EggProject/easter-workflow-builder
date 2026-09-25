import { act, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunViewTranscriptSide } from './RunViewTranscriptSide.tsx';

const APPROVAL_TEXT = 'jóváhagyás helye';

/**
 * Saját állapotot tartó transcript helyettesítő: ha a komponens leszerel, a
 * számlálója nullára esik vissza. Ezen mérhető, hogy a transcript panel a
 * jóváhagyás megjelenésekor és eltűnésekor megtartja az állapotát.
 */
function StatefulTranscript(): ReactElement {
  const [clicks, setClicks] = useState(0);
  return (
    <button
      type="button"
      className="stateful-transcript"
      onClick={() => {
        setClicks((previous) => previous + 1);
      }}
    >
      {String(clicks)}
    </button>
  );
}

describe('RunViewTranscriptSide', () => {
  let container: HTMLDivElement;
  let root: Root;
  const onSizesChange = vi.fn();

  beforeEach(() => {
    onSizesChange.mockClear();
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

  function renderSide(isApprovalShown: boolean): void {
    act(() => {
      root.render(
        <RunViewTranscriptSide
          approvalPanel={<div className="approval-placeholder">{APPROVAL_TEXT}</div>}
          isApprovalShown={isApprovalShown}
          transcriptPanel={<StatefulTranscript />}
          defaultSizes={[40, 60]}
          onSizesChange={onSizesChange}
        />,
      );
    });
  }

  function separator(): Element | null {
    return container.querySelector('[role="separator"]');
  }

  function transcript(): HTMLButtonElement | null {
    return container.querySelector('.stateful-transcript');
  }

  it('látott jóváhagyás mellett a panel felül, a transcript alul, közöttük vízszintes húzható elválasztó', () => {
    renderSide(true);

    const group = container.querySelector('.resizable-group');
    expect(group?.classList.contains('resizable-group--vertical')).toBe(true);
    expect([...(group?.children ?? [])].map((child) => child.className)).toEqual([
      'resizable-panel',
      'resizable-handle',
      'resizable-panel',
    ]);
    expect(group?.firstElementChild?.textContent).toBe(APPROVAL_TEXT);
    expect(group?.lastElementChild?.querySelector(':scope > .run-view-screen__transcript-content')).not.toBeNull();

    expect(separator()?.getAttribute('aria-label')).toBe('A jóváhagyás és a transcript aránya');
    expect(separator()?.getAttribute('aria-orientation')).toBe('horizontal');
    expect(separator()?.getAttribute('aria-valuenow')).toBe('40');
    expect(onSizesChange).toHaveBeenLastCalledWith([40, 60]);
  });

  it('látott jóváhagyás nélkül nincs elválasztó, a jóváhagyás panel a transcript fölött, ugyanabban a burkolóban áll', () => {
    renderSide(false);

    expect(separator()).toBeNull();
    const group = container.querySelector('.resizable-group');
    expect(group?.children).toHaveLength(1);
    const content = group?.querySelector(':scope > .resizable-panel > .run-view-screen__transcript-content');
    expect([...(content?.children ?? [])].map((child) => child.className)).toEqual([
      'approval-placeholder',
      'stateful-transcript',
    ]);
  });

  it('a jóváhagyás megjelenése és eltűnése nem szereli le a transcript panelt', () => {
    renderSide(false);
    const before = transcript();
    act(() => {
      before?.click();
    });
    expect(before?.textContent).toBe('1');

    renderSide(true);
    expect(transcript()).toBe(before);
    expect(transcript()?.textContent).toBe('1');

    renderSide(false);
    expect(transcript()).toBe(before);
    expect(transcript()?.textContent).toBe('1');
  });
});
