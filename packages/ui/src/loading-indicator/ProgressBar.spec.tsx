import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProgressBar, type ProgressBarSize } from './ProgressBar.tsx';

describe('ProgressBar', () => {
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

  function renderedBar(): HTMLElement {
    const bar = container.querySelector<HTMLElement>('[role="progressbar"]');
    if (bar === null) {
      throw new Error('a progressbar nem található a kirajzolt fán');
    }
    return bar;
  }

  it('role="progressbar" es aria-valuemin/aria-valuemax rögzített', () => {
    act(() => {
      root.render(<ProgressBar value={42} />);
    });
    expect(renderedBar().getAttribute('role')).toBe('progressbar');
    expect(renderedBar().getAttribute('aria-valuemin')).toBe('0');
    expect(renderedBar().getAttribute('aria-valuemax')).toBe('100');
  });

  it('az aria-valuenow a value erteket tukrozi', () => {
    act(() => {
      root.render(<ProgressBar value={42} />);
    });
    expect(renderedBar().getAttribute('aria-valuenow')).toBe('42');
    expect(renderedBar().querySelector('.progress-bar__value')?.textContent).toBe('42%');
  });

  it('0-100 koze szoritja az erteket', () => {
    act(() => {
      root.render(<ProgressBar value={150} />);
    });
    expect(renderedBar().getAttribute('aria-valuenow')).toBe('100');

    act(() => {
      root.render(<ProgressBar value={-20} />);
    });
    expect(renderedBar().getAttribute('aria-valuenow')).toBe('0');
  });

  it('nem veges erteket (NaN) 0-ra allit', () => {
    act(() => {
      root.render(<ProgressBar value={NaN} />);
    });
    expect(renderedBar().getAttribute('aria-valuenow')).toBe('0');
  });

  const sizes: readonly ProgressBarSize[] = ['sm', 'md', 'lg'];
  it.each(sizes)('a size="%s" a "progress-bar progress-bar--%s" osztálylistát adja', (size) => {
    act(() => {
      root.render(<ProgressBar size={size} />);
    });
    expect(renderedBar().className).toBe(`progress-bar progress-bar--${size}`);
  });

  it('alapertelmezesben aria-labelledby mutat a lathato cimkere', () => {
    act(() => {
      root.render(<ProgressBar label="Feltöltés" />);
    });
    const labelledBy = renderedBar().getAttribute('aria-labelledby');
    expect(labelledBy).not.toBeNull();
    expect(container.querySelector(`#${labelledBy ?? ''}`)?.textContent).toBe('Feltöltés');
    expect(renderedBar().hasAttribute('aria-label')).toBe(false);
  });

  it('isLabelVisible=false eseten a szoveges cimke aria-label-kent all, fejlec nelkul', () => {
    act(() => {
      root.render(<ProgressBar label="Feltöltés" isLabelVisible={false} />);
    });
    expect(renderedBar().getAttribute('aria-label')).toBe('Feltöltés');
    expect(renderedBar().querySelector('.progress-bar__header')).toBeNull();
  });

  it('label hianyaban a "Uploading" alapertelmezett szoveg az aria-label isLabelVisible=false mellett', () => {
    act(() => {
      root.render(<ProgressBar isLabelVisible={false} />);
    });
    expect(renderedBar().getAttribute('aria-label')).toBe('Uploading');
  });

  it('az explicit ariaLabel mindig felulir', () => {
    act(() => {
      root.render(<ProgressBar label="Feltöltés" ariaLabel="Egyedi név" />);
    });
    expect(renderedBar().getAttribute('aria-label')).toBe('Egyedi név');
    expect(renderedBar().hasAttribute('aria-labelledby')).toBe(false);
  });

  it('a fill szelessege es a shimmer elem kirajzolodik', () => {
    act(() => {
      root.render(<ProgressBar value={30} />);
    });
    const fill = renderedBar().querySelector<HTMLElement>('.progress-bar__fill');
    expect(fill?.style.width).toBe('30%');
    expect(fill?.querySelector('.progress-bar__shimmer')).not.toBeNull();
  });
});
