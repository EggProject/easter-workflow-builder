import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DrawerBody } from './DrawerBody.tsx';

describe('DrawerBody', () => {
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

  it('a gyerekeket a forrás .drawer__body elemébe rajzolja, további burkoló nélkül', () => {
    act(() => {
      root.render(
        <DrawerBody>
          <p>Tartalom</p>
        </DrawerBody>,
      );
    });
    expect(container.getHTML()).toBe('<div class="drawer__body"><p>Tartalom</p></div>');
  });
});
