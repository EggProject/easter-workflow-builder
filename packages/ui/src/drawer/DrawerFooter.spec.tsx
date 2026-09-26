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

  it('a megadott role, aria-labelledby és aria-describedby értéket a .drawer__footer elemre teszi', () => {
    act(() => {
      root.render(
        <DrawerFooter role="group" aria-labelledby="cim" aria-describedby="leiras">
          <button type="button">Mentés</button>
        </DrawerFooter>,
      );
    });
    const footer = container.querySelector('.drawer__footer');
    expect(footer?.getAttribute('role')).toBe('group');
    expect(footer?.getAttribute('aria-labelledby')).toBe('cim');
    expect(footer?.getAttribute('aria-describedby')).toBe('leiras');
  });
});
