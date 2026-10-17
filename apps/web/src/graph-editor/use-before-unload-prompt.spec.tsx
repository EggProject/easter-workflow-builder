import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useBeforeUnloadPrompt } from './use-before-unload-prompt.ts';

function BeforeUnloadProbe({ isEnabled }: { readonly isEnabled: boolean }): ReactElement {
  useBeforeUnloadPrompt(isEnabled);
  return <p>szerkesztő</p>;
}

/**
 * Egy `beforeunload` esemény a böngésző útján: megszakítható, a `globalThis`
 * objektumon kiváltva. Az eredmény az, hogy kérte-e figyelő a párbeszédet.
 */
function isBeforeUnloadPrevented(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  globalThis.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('useBeforeUnloadPrompt', () => {
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

  it('bekapcsolva a beforeunload eseményen preventDefault fut', () => {
    act(() => {
      root.render(<BeforeUnloadProbe isEnabled />);
    });
    expect(isBeforeUnloadPrevented()).toBe(true);
  });

  it('kikapcsolva nincs figyelő, a beforeunload érintetlen', () => {
    act(() => {
      root.render(<BeforeUnloadProbe isEnabled={false} />);
    });
    expect(isBeforeUnloadPrevented()).toBe(false);
  });

  it('a kikapcsolás a figyelőt leveszi, az újabb bekapcsolás visszateszi', () => {
    act(() => {
      root.render(<BeforeUnloadProbe isEnabled />);
    });
    act(() => {
      root.render(<BeforeUnloadProbe isEnabled={false} />);
    });
    expect(isBeforeUnloadPrevented()).toBe(false);

    act(() => {
      root.render(<BeforeUnloadProbe isEnabled />);
    });
    expect(isBeforeUnloadPrevented()).toBe(true);
  });

  it('leszereléskor a figyelő lekerül', () => {
    act(() => {
      root.render(<BeforeUnloadProbe isEnabled />);
    });
    act(() => {
      root.render(<p>másik képernyő</p>);
    });
    expect(isBeforeUnloadPrevented()).toBe(false);
  });
});
