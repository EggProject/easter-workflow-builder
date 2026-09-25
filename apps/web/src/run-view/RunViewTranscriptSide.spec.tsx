import { act, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunViewTranscriptSide } from './RunViewTranscriptSide.tsx';
import { RunViewTranscriptVisibility } from './run-view-transcript-visibility.ts';

const APPROVAL_TEXT = 'jóváhagyás törzse';

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

  function renderSide(isApprovalShown: boolean, isAdjustable = false): void {
    act(() => {
      root.render(
        <div className="side-root">
          <RunViewTranscriptSide
            transcriptPanel={<StatefulTranscript />}
            approvalBody={<div className="body-placeholder">{APPROVAL_TEXT}</div>}
            approvalPanel={<section className="panel-placeholder">lapozó és gombok</section>}
            approvalReveal={isApprovalShown ? { elementId: 'approval-text' } : undefined}
            adjustsForReveal={isAdjustable}
            defaultSizes={[40, 60]}
            onSizesChange={onSizesChange}
          />
        </div>,
      );
    });
  }

  function separator(): Element | null {
    return container.querySelector('[role="separator"]');
  }

  function transcript(): HTMLButtonElement | null {
    return container.querySelector('.stateful-transcript');
  }

  function sideChildren(): readonly string[] {
    return [...(container.querySelector('.side-root')?.children ?? [])].map((child) => child.className);
  }

  it('látott jóváhagyás mellett felül a transcript, a húzható elválasztó alatt a jóváhagyás szövege, közvetlenül alatta, a Resizable elemen kívül a lapozó és a gombok régiója', () => {
    renderSide(true);

    expect(sideChildren()).toEqual(['resizable-group resizable-group--vertical', 'panel-placeholder']);

    const group = container.querySelector('.resizable-group');
    expect(group?.classList.contains('resizable-group--vertical')).toBe(true);
    expect([...(group?.children ?? [])].map((child) => child.className)).toEqual([
      'resizable-panel',
      'resizable-handle',
      'resizable-panel',
    ]);
    expect(group?.firstElementChild?.querySelector(':scope > .run-view-screen__transcript-content')).not.toBeNull();
    expect(group?.lastElementChild?.textContent).toBe(APPROVAL_TEXT);

    // Az elsődleges (az elválasztó előtti) panel a transcript: a név és az
    // érték az övé (W3C APG Window Splitter).
    expect(separator()?.getAttribute('aria-label')).toBe('A transcript és a jóváhagyás aránya');
    expect(separator()?.getAttribute('aria-orientation')).toBe('horizontal');
    expect(separator()?.getAttribute('aria-valuenow')).toBe('40');
    // A kezdő arány a felhasználó döntése nélkül nem kerül a tárolóba.
    expect(onSizesChange).not.toHaveBeenCalled();
  });

  it('látott jóváhagyás nélkül nincs elválasztó és törzs, a transcript az egyetlen panel, alatta a régió', () => {
    renderSide(false);

    expect(separator()).toBeNull();
    expect(sideChildren()).toEqual(['resizable-group resizable-group--vertical', 'panel-placeholder']);
    const group = container.querySelector('.resizable-group');
    expect(group?.children).toHaveLength(1);
    const content = group?.querySelector(':scope > .resizable-panel > .run-view-screen__transcript-content');
    expect([...(content?.children ?? [])].map((child) => child.className)).toEqual(['stateful-transcript']);
  });

  it('rejtett transcript oldalon (a fül sáv Gráf fülén) is ugyanaz a szerkezet áll, csak a felfedés vár a fül megnyitására', () => {
    act(() => {
      root.render(
        <RunViewTranscriptVisibility value={false}>
          <div className="side-root">
            <RunViewTranscriptSide
              transcriptPanel={<StatefulTranscript />}
              approvalBody={<div className="body-placeholder">{APPROVAL_TEXT}</div>}
              approvalPanel={<section className="panel-placeholder">lapozó és gombok</section>}
              approvalReveal={{ elementId: 'approval-text' }}
              adjustsForReveal
              defaultSizes={[40, 60]}
              onSizesChange={onSizesChange}
            />
          </div>
        </RunViewTranscriptVisibility>,
      );
    });
    expect(sideChildren()).toEqual(['resizable-group resizable-group--vertical', 'panel-placeholder']);
    expect(separator()?.getAttribute('aria-valuenow')).toBe('40');
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
