import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DrawerSections } from './DrawerSections.tsx';

describe('DrawerSections', () => {
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

  it('a gyerekeket a törzsbe, a footer tartalmát a lábléc sávba rajzolja, ebben a sorrendben, burkoló nélkül', () => {
    act(() => {
      root.render(
        <DrawerSections footer={<button type="button">Mentés</button>}>
          <p>Tartalom</p>
        </DrawerSections>,
      );
    });
    const [body, footer] = container.children;
    expect(container.children).toHaveLength(2);
    expect(body?.className).toBe('drawer__body');
    expect(body?.getHTML()).toBe('<p>Tartalom</p>');
    expect(footer?.className).toBe('drawer__footer');
    expect(footer?.getHTML()).toBe('<button type="button">Mentés</button>');
  });

  it('footer nélkül csak a törzs rajzolódik ki', () => {
    act(() => {
      root.render(<DrawerSections>Tartalom</DrawerSections>);
    });
    expect(container.getHTML()).toBe('<div class="drawer__body">Tartalom</div>');
  });
});
