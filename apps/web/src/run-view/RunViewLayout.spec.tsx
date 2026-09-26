import { act, useContext, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunViewLayout } from './RunViewLayout.tsx';
import type { RunViewLayoutBand } from './run-view-layout-band.ts';
import { RunViewTranscriptVisibility } from './run-view-transcript-visibility.ts';

/**
 * A transcript oldal láthatóságának kiírója (`RunViewTranscriptVisibility`).
 */
function VisibilityProbe(): ReactElement {
  return <span className="visibility-probe">{String(useContext(RunViewTranscriptVisibility))}</span>;
}

const GRAPH_TEXT = 'gráf helye';
const TRANSCRIPT_TEXT = 'transcript helye';

describe('RunViewLayout', () => {
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

  function renderLayout(band: RunViewLayoutBand): void {
    act(() => {
      root.render(
        <RunViewLayout
          band={band}
          graph={<span>{GRAPH_TEXT}</span>}
          transcript={<span>{TRANSCRIPT_TEXT}</span>}
          defaultSizes={[70, 30]}
          onSizesChange={onSizesChange}
          adjustsForReveal
        />,
      );
    });
  }

  function separator(): HTMLElement | null {
    return container.querySelector('[role="separator"]');
  }

  it('a vízszintes sávban a gráf és a transcript egymás mellett áll, FÜGGŐLEGES húzható elválasztóval', () => {
    renderLayout('horizontal');

    const group = container.querySelector('.resizable-group');
    expect(group).not.toBeNull();
    // A `--vertical` módosító ITT NEM állhat: az adja az egymás alatti
    // elrendezést (`resizable.css`: `flex-direction: column`).
    expect(group?.classList.contains('resizable-group--vertical')).toBe(false);
    expect(container.querySelectorAll('.resizable-panel')).toHaveLength(2);

    const handle = separator();
    expect(handle?.getAttribute('aria-orientation')).toBe('vertical');
    expect(handle?.getAttribute('aria-label')).toBe('A Gráf és a Transcript aránya');
    // Húzható: az elválasztó fókuszálható és a kezdő arányt jelenti.
    expect(handle?.getAttribute('tabindex')).toBe('0');
    expect(handle?.getAttribute('aria-valuenow')).toBe('70');

    expect(container.textContent).toContain(GRAPH_TEXT);
    expect(container.textContent).toContain(TRANSCRIPT_TEXT);
    // Fül nincs ebben a sávban.
    expect(container.querySelector('[role="tablist"]')).toBeNull();
    // A kezdő méret nem kerül a tárolóba (2026-09-25): csak a felhasználó
    // változtatása, a billentyűé is.
    expect(onSizesChange).not.toHaveBeenCalled();
    act(() => {
      handle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    });
    expect(onSizesChange).toHaveBeenCalledWith([65, 35]);
  });

  it('a függőleges sávban egymás alatt állnak, VÍZSZINTES húzható elválasztóval', () => {
    renderLayout('vertical');

    const group = container.querySelector('.resizable-group');
    expect(group?.classList.contains('resizable-group--vertical')).toBe(true);
    expect(container.querySelectorAll('.resizable-panel')).toHaveLength(2);

    const handle = separator();
    expect(handle?.getAttribute('aria-orientation')).toBe('horizontal');
    expect(handle?.getAttribute('tabindex')).toBe('0');

    expect(container.textContent).toContain(GRAPH_TEXT);
    expect(container.textContent).toContain(TRANSCRIPT_TEXT);
    expect(container.querySelector('[role="tablist"]')).toBeNull();
  });

  it('a fül sávban két fül van, egyszerre EGY látható nézettel, és elválasztó nincs', () => {
    renderLayout('tabs');

    const tabs = [...container.querySelectorAll('[role="tab"]')];
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Gráf', 'Transcript']);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false']);

    const panels = [...container.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
    expect(panels).toHaveLength(2);
    // Mindkét panel FELCSATOLVA marad (a vászon állapota nem veszik el
    // fülváltáskor), de csak az aktív látszik: a rejtést a natív `hidden`
    // attribútum adja.
    expect(panels.map((panel) => panel.hidden)).toEqual([false, true]);

    expect(separator()).toBeNull();
    expect(container.querySelector('.resizable-group')).toBeNull();
    expect(onSizesChange).not.toHaveBeenCalled();
  });

  it('fülváltás után a transcript panel látszik, a gráf panel felcsatolva marad', () => {
    renderLayout('tabs');

    const transcriptTab = container.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1];
    act(() => {
      transcriptTab?.click();
    });

    const panels = [...container.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
    expect(panels.map((panel) => panel.hidden)).toEqual([true, false]);
    expect(container.textContent).toContain(GRAPH_TEXT);
  });

  it('a transcript oldal láthatósága: az osztott sávban mindig, a fül sávban csak a Transcript fülön, és sávváltás után a Gráf fülről indul', () => {
    const renderWithProbe = (band: RunViewLayoutBand): void => {
      act(() => {
        root.render(
          <RunViewLayout
            band={band}
            graph={<span>{GRAPH_TEXT}</span>}
            transcript={<VisibilityProbe />}
            defaultSizes={[70, 30]}
            onSizesChange={onSizesChange}
            adjustsForReveal
          />,
        );
      });
    };
    const probe = (): string | null | undefined => container.querySelector('.visibility-probe')?.textContent;

    renderWithProbe('vertical');
    expect(probe()).toBe('true');
    renderWithProbe('tabs');
    expect(probe()).toBe('false');
    act(() => {
      container.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1]?.click();
    });
    expect(probe()).toBe('true');
    renderWithProbe('horizontal');
    expect(probe()).toBe('true');
    renderWithProbe('tabs');
    expect([...container.querySelectorAll('[role="tab"]')].map((tab) => tab.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
    ]);
    expect(probe()).toBe('false');
  });
});
