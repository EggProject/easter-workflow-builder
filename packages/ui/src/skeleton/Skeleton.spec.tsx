import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Skeleton, type SkeletonShape } from './Skeleton.tsx';

describe('Skeleton', () => {
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

  function renderedSkeleton(): HTMLElement {
    const element = container.querySelector<HTMLElement>('.skel');
    if (element === null) {
      throw new Error('a skeleton elem nem található a kirajzolt fán');
    }
    return element;
  }

  it('alapértelmezésben (block) csak a "skel" osztályt viseli', () => {
    act(() => {
      root.render(<Skeleton />);
    });
    expect(renderedSkeleton().className).toBe('skel');
  });

  const nonBlockShapes: readonly SkeletonShape[] = ['text', 'title', 'circle', 'btn', 'card', 'avatar', 'avatar-lg'];
  it.each(nonBlockShapes)('a shape="%s" a "skel skel--%s" osztálylistát adja', (shape) => {
    act(() => {
      root.render(<Skeleton shape={shape} />);
    });
    expect(renderedSkeleton().className).toBe(`skel skel--${shape}`);
  });

  it('mind a nyolc alak lefedett (block plusz a hét nem-block)', () => {
    const allShapes: readonly SkeletonShape[] = ['block', ...nonBlockShapes];
    expect(allShapes).toHaveLength(8);
  });

  it('ink=true hozzáadja a "skel--ink" módosítót', () => {
    act(() => {
      root.render(<Skeleton ink />);
    });
    expect(renderedSkeleton().className).toBe('skel skel--ink');
  });

  it('alapból aria-hidden="true", ariaHidden=false eseten hianyzik az attributum', () => {
    act(() => {
      root.render(<Skeleton />);
    });
    expect(renderedSkeleton().getAttribute('aria-hidden')).toBe('true');

    act(() => {
      root.render(<Skeleton ariaHidden={false} />);
    });
    expect(renderedSkeleton().hasAttribute('aria-hidden')).toBe(false);
  });

  it('a w es h szamkent px-re alakul, stringkent valtozatlan marad', () => {
    act(() => {
      root.render(<Skeleton w={120} h="3rem" />);
    });
    expect(renderedSkeleton().style.width).toBe('120px');
    expect(renderedSkeleton().style.height).toBe('3rem');
  });

  it('shape="text" es lines eseten .skel-stack alatt annyi sor rajzolodik, ahany a lines', () => {
    act(() => {
      root.render(<Skeleton shape="text" lines={3} />);
    });
    const stack = container.querySelector('.skel-stack');
    expect(stack).not.toBeNull();
    const rows = container.querySelectorAll(':scope .skel-stack .skel--text');
    expect(rows).toHaveLength(3);
  });

  it('a lines utolso sora 60% szelessegu, a tobbi 100%', () => {
    act(() => {
      root.render(<Skeleton shape="text" lines={2} />);
    });
    const rows = container.querySelectorAll<HTMLElement>(':scope .skel-stack .skel--text');
    expect(rows[0]?.style.width).toBe('100%');
    expect(rows[1]?.style.width).toBe('60%');
  });

  it('a lines prop nem-text shape mellett figyelmen kivul marad (nincs stack)', () => {
    act(() => {
      root.render(<Skeleton shape="circle" lines={3} />);
    });
    expect(container.querySelector('.skel-stack')).toBeNull();
    expect(renderedSkeleton().className).toBe('skel skel--circle');
  });

  it('lines es ink egyutt: minden rekurziv sor is orzi a "skel--ink" modositot', () => {
    act(() => {
      root.render(<Skeleton shape="text" lines={2} ink />);
    });
    const rows = container.querySelectorAll<HTMLElement>(':scope .skel-stack .skel--text');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.className).toBe('skel skel--text skel--ink');
    expect(rows[1]?.className).toBe('skel skel--text skel--ink');
  });

  it('a sajat className hozzaadodik a listahoz', () => {
    act(() => {
      root.render(<Skeleton className="egyedi" />);
    });
    expect(renderedSkeleton().className).toBe('skel egyedi');
  });
});
