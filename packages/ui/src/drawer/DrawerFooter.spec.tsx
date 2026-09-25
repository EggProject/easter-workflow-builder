import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DrawerFooter } from './DrawerFooter.tsx';

describe('DrawerFooter', () => {
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

  it('a gyerekeket a forrás .drawer__footer elemébe rajzolja, további burkoló nélkül', () => {
    act(() => {
      root.render(
        <DrawerFooter>
          <button type="button">Mentés</button>
        </DrawerFooter>,
      );
    });
    expect(container.getHTML()).toBe('<div class="drawer__footer"><button type="button">Mentés</button></div>');
  });
});
