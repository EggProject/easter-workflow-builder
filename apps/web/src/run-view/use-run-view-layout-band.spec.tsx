// A `matchMedia` mockolás módja SAJÁT MÉRÉSEN alapul, amit a `packages/ui`
// `use-theme-mode.spec.tsx` fejléce már rögzített: a pinelt happy-dom minden
// `matchMedia()` hívásra ÚJ, egymástól független `MediaQueryList` példányt ad
// ugyanarra a query stringre (nincs dokumentum szintű cache), tehát a hook
// belső hívása és a teszt saját hívása két külön objektumot kapna, és egy a
// tesztben dispatch-elt `change` esemény nem jutna el a hook
// feliratkozásához. A teszt ezért `vi.spyOn(globalThis, 'matchMedia')`-val
// query SZERINT ad vissza egyetlen, megosztott példányt - query szerint, mert
// a két töréspont állapotát egymástól függetlenül kell tudni állítani.
import { act } from 'react';
import type { ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RUN_VIEW_HORIZONTAL_MEDIA_QUERY,
  RUN_VIEW_VERTICAL_MEDIA_QUERY,
  type RunViewLayoutBand,
} from './run-view-layout-band.ts';
import { useRunViewLayoutBand } from './use-run-view-layout-band.ts';

function LayoutBandProbe(): ReactElement {
  const band: RunViewLayoutBand = useRunViewLayoutBand();
  return <span data-band={band}>{band}</span>;
}

function setMatches(media: MediaQueryList, isMatching: boolean): void {
  Object.defineProperty(media, 'matches', { value: isMatching, configurable: true });
}

describe('useRunViewLayoutBand', () => {
  let container: HTMLDivElement;
  let root: Root;
  let horizontalMedia: MediaQueryList;
  let verticalMedia: MediaQueryList;

  beforeEach(() => {
    horizontalMedia = globalThis.matchMedia(RUN_VIEW_HORIZONTAL_MEDIA_QUERY);
    verticalMedia = globalThis.matchMedia(RUN_VIEW_VERTICAL_MEDIA_QUERY);
    vi.spyOn(globalThis, 'matchMedia').mockImplementation((query: string) =>
      query === RUN_VIEW_HORIZONTAL_MEDIA_QUERY ? horizontalMedia : verticalMedia,
    );

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  function render(): void {
    act(() => {
      root.render(<LayoutBandProbe />);
    });
  }

  function renderedBand(): string | undefined {
    return container.querySelector<HTMLSpanElement>('span')?.dataset['band'];
  }

  it.each([
    ['mindkét töréspont fölött vízszintes osztás', true, true, 'horizontal'],
    ['kizárólag a szűkebb töréspont fölött függőleges osztás', false, true, 'vertical'],
    ['mindkét töréspont alatt fülek', false, false, 'tabs'],
  ])('%s', (_label, isAtLeastLarge: boolean, isAtLeastMedium: boolean, expectedBand: string) => {
    setMatches(horizontalMedia, isAtLeastLarge);
    setMatches(verticalMedia, isAtLeastMedium);
    render();
    expect(renderedBand()).toBe(expectedBand);
  });

  it('a change eseményre újraolvassa MINDKÉT töréspontot, nem csak az eseményt küldőt', () => {
    setMatches(horizontalMedia, true);
    setMatches(verticalMedia, true);
    render();
    expect(renderedBand()).toBe('horizontal');

    setMatches(horizontalMedia, false);
    setMatches(verticalMedia, false);
    act(() => {
      horizontalMedia.dispatchEvent(new Event('change'));
    });
    expect(renderedBand()).toBe('tabs');
  });

  it('a szűkebb töréspont change eseménye is frissít', () => {
    setMatches(horizontalMedia, false);
    setMatches(verticalMedia, false);
    render();
    expect(renderedBand()).toBe('tabs');

    setMatches(verticalMedia, true);
    act(() => {
      verticalMedia.dispatchEvent(new Event('change'));
    });
    expect(renderedBand()).toBe('vertical');
  });

  it('leszereléskor mindkét feliratkozás megszűnik', () => {
    setMatches(horizontalMedia, true);
    setMatches(verticalMedia, true);
    const removeHorizontal = vi.spyOn(horizontalMedia, 'removeEventListener');
    const removeVertical = vi.spyOn(verticalMedia, 'removeEventListener');

    // Saját gyökér, hogy a leszerelés ITT történjen, és a közös `afterEach`
    // ne ugyanazt a gyökeret szerelné le másodszor.
    const localContainer = document.createElement('div');
    document.body.append(localContainer);
    const localRoot = createRoot(localContainer);
    act(() => {
      localRoot.render(<LayoutBandProbe />);
    });
    act(() => {
      localRoot.unmount();
    });
    localContainer.remove();

    expect(removeHorizontal).toHaveBeenCalledWith('change', expect.any(Function));
    expect(removeVertical).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
