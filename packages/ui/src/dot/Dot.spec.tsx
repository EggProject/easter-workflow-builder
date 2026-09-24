import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Dot, type DotSize, type DotTone } from './Dot.tsx';

describe('Dot', () => {
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

  function renderedDot(): HTMLSpanElement {
    const dot = container.querySelector<HTMLSpanElement>('span.ep-dot');
    if (dot === null) {
      throw new Error('a pötty nem található a kirajzolt fán');
    }
    return dot;
  }

  it('alapértelmezésben info tónusú, md méretű, módosító nélküli, dekoratív pötty', () => {
    act(() => {
      root.render(<Dot />);
    });
    expect(renderedDot().className).toBe('ep-dot ep-dot--info ep-dot--md');
    expect(renderedDot().getAttribute('aria-hidden')).toBe('true');
    expect(renderedDot().hasAttribute('role')).toBe(false);
    expect(renderedDot().hasAttribute('aria-label')).toBe(false);
  });

  const tones: readonly DotTone[] = ['neutral', 'info', 'success', 'warning', 'danger', 'yolk', 'ink', 'muted'];
  it.each(tones)('a tone="%s" a hozzá tartozó tónus osztályt adja', (tone) => {
    act(() => {
      root.render(<Dot tone={tone} />);
    });
    expect(renderedDot().className).toBe(`ep-dot ep-dot--${tone} ep-dot--md`);
  });

  const sizes: readonly DotSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];
  it.each(sizes)('a size="%s" a hozzá tartozó méret osztályt adja', (size) => {
    act(() => {
      root.render(<Dot size={size} />);
    });
    expect(renderedDot().className).toBe(`ep-dot ep-dot--info ep-dot--${size}`);
  });

  it('az öt módosító a forrás sorrendjében kerül az osztálylistára, a hívó osztálya a végére', () => {
    act(() => {
      root.render(<Dot tone="success" halo ring pulse blink hollow className="extra" />);
    });
    expect(renderedDot().className).toBe(
      'ep-dot ep-dot--success ep-dot--md ep-dot--halo ep-dot--ring ep-dot--pulse ep-dot--blink ep-dot--hollow extra',
    );
  });

  it('a title img szerepet és aria-label nevet ad, title attribútumot nem', () => {
    act(() => {
      root.render(<Dot title="Élő" />);
    });
    expect(renderedDot().getAttribute('role')).toBe('img');
    expect(renderedDot().getAttribute('aria-label')).toBe('Élő');
    expect(renderedDot().hasAttribute('title')).toBe(false);
    expect(renderedDot().hasAttribute('aria-hidden')).toBe(false);
  });

  it('az üres title a forrás igazságérték vizsgálata szerint dekoratív marad', () => {
    act(() => {
      root.render(<Dot title="" />);
    });
    expect(renderedDot().getAttribute('aria-hidden')).toBe('true');
    expect(renderedDot().hasAttribute('role')).toBe(false);
  });

  it('a többi attribútum a gyökér span elemre kerül', () => {
    act(() => {
      root.render(<Dot data-testid="pötty" id="p1" />);
    });
    expect(renderedDot().dataset['testid']).toBe('pötty');
    expect(renderedDot().id).toBe('p1');
  });
});
