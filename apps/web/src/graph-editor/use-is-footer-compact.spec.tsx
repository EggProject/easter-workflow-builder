// A `matchMedia` mockolás módja a `use-run-view-layout-band.spec.tsx` fejlécében
// rögzített mérésen alapul: a happy-dom minden `matchMedia()` hívásra új,
// független `MediaQueryList` példányt ad, ezért a teszt egyetlen megosztott
// példányt ad vissza a query-re, hogy a dispatch-elt `change` eljusson a hookig.
import { act } from 'react';
import type { ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FOOTER_COMPACT_MEDIA_QUERY } from './footer-compact-media-query.ts';
import { useIsFooterCompact } from './use-is-footer-compact.ts';

function CompactProbe(): ReactElement {
  const isCompact = useIsFooterCompact();
  return <span data-compact={String(isCompact)} />;
}

function setMatches(media: MediaQueryList, isMatching: boolean): void {
  Object.defineProperty(media, 'matches', { value: isMatching, configurable: true });
}

describe('useIsFooterCompact', () => {
  let container: HTMLDivElement;
  let root: Root;
  let compactMedia: MediaQueryList;

  beforeEach(() => {
    compactMedia = globalThis.matchMedia(FOOTER_COMPACT_MEDIA_QUERY);
    vi.spyOn(globalThis, 'matchMedia').mockImplementation(() => compactMedia);
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
      root.render(<CompactProbe />);
    });
  }

  function renderedValue(): string | undefined {
    return container.querySelector<HTMLSpanElement>('span')?.dataset['compact'];
  }

  it.each([
    ['a query illeszkedésekor igaz', true, 'true'],
    ['a query nem illeszkedésekor hamis', false, 'false'],
  ])('%s', (_label, isMatching: boolean, expected: string) => {
    setMatches(compactMedia, isMatching);
    render();
    expect(renderedValue()).toBe(expected);
  });

  it('a change eseményre újraolvassa az állapotot', () => {
    setMatches(compactMedia, false);
    render();
    expect(renderedValue()).toBe('false');

    setMatches(compactMedia, true);
    act(() => {
      compactMedia.dispatchEvent(new Event('change'));
    });
    expect(renderedValue()).toBe('true');
  });

  it('leszereléskor a feliratkozás megszűnik', () => {
    setMatches(compactMedia, true);
    const removeListener = vi.spyOn(compactMedia, 'removeEventListener');
    render();

    act(() => {
      root.unmount();
    });
    // A közös `afterEach` ugyanezt a gyökeret újra leszerelné, ezért új gyökér.
    root = createRoot(container);

    expect(removeListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
