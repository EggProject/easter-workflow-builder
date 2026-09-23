import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { StreamConnectionPhase } from '../stream-client/use-stream-connection.ts';
import { StreamStatusIndicator } from './StreamStatusIndicator.tsx';

describe('StreamStatusIndicator', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    delete document.documentElement.dataset['theme'];
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    delete document.documentElement.dataset['theme'];
  });

  function renderedFeed(): HTMLSpanElement {
    const feed = container.querySelector<HTMLSpanElement>('span.ep-feed');
    if (feed === null) {
      throw new Error('a stream jelző nem található a kirajzolt fán');
    }
    return feed;
  }

  const phaseCases: readonly (readonly [StreamConnectionPhase, string, string, string])[] = [
    ['connecting', 'connecting', 'kapcsolódás', 'ep-dot ep-dot--info ep-dot--md ep-dot--halo ep-dot--pulse'],
    ['replaying', 'connecting', 'előzmények betöltése', 'ep-dot ep-dot--info ep-dot--md ep-dot--halo ep-dot--pulse'],
    ['reconnecting', 'disconnected', 'újracsatlakozás', 'ep-dot ep-dot--danger ep-dot--md ep-dot--hollow'],
    ['live', 'streaming', 'élő', 'ep-dot ep-dot--success ep-dot--md ep-dot--halo ep-dot--pulse'],
  ];

  it.each(phaseCases)(
    'a "%s" fázis a forrás "%s" állapota, "%s" felirattal, status élő régióként',
    (phase, state, label, dotClassName) => {
      act(() => {
        root.render(<StreamStatusIndicator phase={phase} />);
      });
      expect(renderedFeed().className).toBe(`ep-feed ep-feed--${state} ep-feed--md`);
      expect(renderedFeed().getAttribute('role')).toBe('status');
      expect(renderedFeed().getAttribute('aria-label')).toBe(`Stream kapcsolat: ${label}`);
      expect(renderedFeed().querySelector(':scope > .ep-feed__label')?.textContent).toBe(label);
      expect(renderedFeed().querySelector(':scope > .ep-dot')?.className).toBe(dotClassName);
    },
  );

  it('sötét témában (data-theme="dark") a forrás ink felületét kapja', () => {
    document.documentElement.dataset['theme'] = 'dark';
    act(() => {
      root.render(<StreamStatusIndicator phase="live" />);
    });
    expect(renderedFeed().className).toBe('ep-feed ep-feed--streaming ep-feed--md ep-feed--ink');
  });

  it('élő témaváltásra újratöltés nélkül vált a paper és az ink felület között', async () => {
    act(() => {
      root.render(<StreamStatusIndicator phase="reconnecting" />);
    });
    expect(renderedFeed().classList.contains('ep-feed--ink')).toBe(false);

    await act(async () => {
      document.documentElement.dataset['theme'] = 'dark';
      await Promise.resolve();
    });
    expect(renderedFeed().classList.contains('ep-feed--ink')).toBe(true);
  });
});
