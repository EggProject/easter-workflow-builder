import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FeedIndicator, type FeedIndicatorState } from './FeedIndicator.tsx';

describe('FeedIndicator', () => {
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

  function renderedFeed(): HTMLSpanElement {
    const feed = container.querySelector<HTMLSpanElement>('span.ep-feed');
    if (feed === null) {
      throw new Error('a jelző nem található a kirajzolt fán');
    }
    return feed;
  }

  function renderedDot(): HTMLSpanElement {
    const dot = renderedFeed().querySelector<HTMLSpanElement>(':scope > span.ep-dot');
    if (dot === null) {
      throw new Error('a belső pötty nem található a jelzőben');
    }
    return dot;
  }

  it('alapértelmezésben idle, md, plain, paper: status élő régió "Idle feed" névvel, dekoratív pöttyel', () => {
    act(() => {
      root.render(<FeedIndicator />);
    });
    expect(renderedFeed().className).toBe('ep-feed ep-feed--idle ep-feed--md');
    expect(renderedFeed().getAttribute('role')).toBe('status');
    expect(renderedFeed().getAttribute('aria-label')).toBe('Idle feed');
    expect(renderedFeed().hasAttribute('title')).toBe(false);
    expect(renderedFeed().querySelector(':scope > .ep-feed__label')?.textContent).toBe('Idle');
    expect(renderedFeed().querySelector('.ep-feed__meta')).toBeNull();
    expect(renderedDot().className).toBe('ep-dot ep-dot--muted ep-dot--md ep-dot--hollow');
    expect(renderedDot().getAttribute('aria-hidden')).toBe('true');
  });

  const stateCases: readonly (readonly [FeedIndicatorState, string, string])[] = [
    ['connecting', 'Connecting', 'ep-dot ep-dot--info ep-dot--md ep-dot--halo ep-dot--pulse'],
    ['streaming', 'Live', 'ep-dot ep-dot--success ep-dot--md ep-dot--halo ep-dot--pulse'],
    ['stale', 'Stale', 'ep-dot ep-dot--warning ep-dot--md ep-dot--halo ep-dot--blink'],
    ['disconnected', 'Offline', 'ep-dot ep-dot--danger ep-dot--md ep-dot--hollow'],
    ['idle', 'Idle', 'ep-dot ep-dot--muted ep-dot--md ep-dot--hollow'],
  ];
  it.each(stateCases)(
    'a state="%s" a forrás felirataival (%s) és pötty módosítóival rajzol',
    (state, label, dotClassName) => {
      act(() => {
        root.render(<FeedIndicator state={state} />);
      });
      expect(renderedFeed().className).toBe(`ep-feed ep-feed--${state} ep-feed--md`);
      expect(renderedFeed().getAttribute('aria-label')).toBe(`${label} feed`);
      expect(renderedFeed().querySelector(':scope > .ep-feed__label')?.textContent).toBe(label);
      expect(renderedDot().className).toBe(dotClassName);
    },
  );

  it('a label felülírja a feliratot és a hozzáférhető nevet, a meta a felirat után áll', () => {
    act(() => {
      root.render(<FeedIndicator state="streaming" label="élő" meta="12 ms" />);
    });
    expect(renderedFeed().getAttribute('aria-label')).toBe('élő feed');
    const children = [...renderedFeed().children].map((child) => child.className);
    expect(children).toEqual([
      'ep-dot ep-dot--success ep-dot--md ep-dot--halo ep-dot--pulse',
      'ep-feed__label',
      'ep-feed__meta',
    ]);
    expect(renderedFeed().querySelector('.ep-feed__meta')?.textContent).toBe('12 ms');
  });

  it('az üres meta nem rajzol meta elemet', () => {
    act(() => {
      root.render(<FeedIndicator state="stale" meta="" />);
    });
    expect(renderedFeed().querySelector('.ep-feed__meta')).toBeNull();
  });

  it('a soft és az outline variáns, az ink felület és a stack módosító a forrás osztályait adja', () => {
    act(() => {
      root.render(<FeedIndicator state="disconnected" variant="soft" surface="ink" stack className="extra" />);
    });
    expect(renderedFeed().className).toBe(
      'ep-feed ep-feed--disconnected ep-feed--md ep-feed--soft ep-feed--ink ep-feed--stack extra',
    );
    act(() => {
      root.render(<FeedIndicator state="stale" variant="outline" />);
    });
    expect(renderedFeed().className).toBe('ep-feed ep-feed--stale ep-feed--md ep-feed--outline');
  });

  it('az lg méret lg pöttyöt ad, az sm méret md pöttyöt, ahogy a forrás', () => {
    act(() => {
      root.render(<FeedIndicator state="connecting" size="lg" />);
    });
    expect(renderedFeed().className).toBe('ep-feed ep-feed--connecting ep-feed--lg');
    expect(renderedDot().className).toBe('ep-dot ep-dot--info ep-dot--lg ep-dot--halo ep-dot--pulse');
    act(() => {
      root.render(<FeedIndicator state="connecting" size="sm" />);
    });
    expect(renderedFeed().className).toBe('ep-feed ep-feed--connecting ep-feed--sm');
    expect(renderedDot().className).toBe('ep-dot ep-dot--info ep-dot--md ep-dot--halo ep-dot--pulse');
  });

  it('kompakt alakban csak a pötty áll: a gyökér title-t kap, a nevet a pötty viseli', () => {
    act(() => {
      root.render(<FeedIndicator state="streaming" compact meta="12 ms" />);
    });
    expect(renderedFeed().className).toBe('ep-feed ep-feed--streaming ep-feed--md ep-feed--compact');
    expect(renderedFeed().getAttribute('title')).toBe('Live · 12 ms');
    expect(renderedFeed().hasAttribute('role')).toBe(false);
    expect(renderedFeed().hasAttribute('aria-label')).toBe(false);
    expect(renderedFeed().querySelector('.ep-feed__label')).toBeNull();
    expect(renderedFeed().querySelector('.ep-feed__meta')).toBeNull();
    expect(renderedDot().getAttribute('role')).toBe('img');
    expect(renderedDot().getAttribute('aria-label')).toBe('Live');
  });

  it('kompakt alakban meta nélkül a title a puszta felirat', () => {
    act(() => {
      root.render(<FeedIndicator state="disconnected" compact />);
    });
    expect(renderedFeed().getAttribute('title')).toBe('Offline');
  });

  it('a dotProps az állapotból számolt értékek után terül szét, tehát felülírja azokat', () => {
    act(() => {
      root.render(<FeedIndicator state="streaming" dotProps={{ ring: true, pulse: false }} />);
    });
    expect(renderedDot().className).toBe('ep-dot ep-dot--success ep-dot--md ep-dot--halo ep-dot--ring');
  });

  it('a hívó aria-label értéke felülírja a forrás "<felirat> feed" nevét, a többi attribútum a gyökérre kerül', () => {
    act(() => {
      root.render(
        <FeedIndicator state="streaming" label="élő" aria-label="Stream kapcsolat: élő" data-testid="jelző" />,
      );
    });
    expect(renderedFeed().getAttribute('aria-label')).toBe('Stream kapcsolat: élő');
    expect(renderedFeed().getAttribute('role')).toBe('status');
    expect(renderedFeed().dataset['testid']).toBe('jelző');
  });

  it('a STATES statikus mező a forrás taxonómiáját adja', () => {
    expect(Object.keys(FeedIndicator.STATES)).toEqual(['connecting', 'streaming', 'stale', 'disconnected', 'idle']);
    expect(FeedIndicator.STATES.disconnected).toEqual({
      tone: 'danger',
      pulse: false,
      blink: false,
      hollow: true,
      halo: false,
      label: 'Offline',
    });
  });
});
