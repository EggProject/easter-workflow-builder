import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MenuItem } from './MenuItem.tsx';

describe('MenuItem', () => {
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

  function renderedItem(): HTMLButtonElement {
    const item = container.querySelector<HTMLButtonElement>('[role="menuitem"]');
    if (item === null) {
      throw new Error('a menüelem nem található a kirajzolt fán');
    }
    return item;
  }

  it('alapértelmezésben "menu__item" osztállyal, -1 tabIndex-szel és menuitem szereppel rajzolódik', () => {
    act(() => {
      root.render(<MenuItem>Átnevezés</MenuItem>);
    });
    const item = renderedItem();
    expect(item.className).toBe('menu__item');
    expect(item.tabIndex).toBe(-1);
    expect(item.textContent).toBe('Átnevezés');
  });

  it('danger esetén a "menu__item--danger" osztályt is felveszi', () => {
    act(() => {
      root.render(<MenuItem danger>Törlés</MenuItem>);
    });
    expect(renderedItem().className).toBe('menu__item menu__item--danger');
  });

  it('disabled esetén a natív disabled attribútumot kapja', () => {
    act(() => {
      root.render(<MenuItem disabled>Indítás</MenuItem>);
    });
    expect(renderedItem().disabled).toBe(true);
  });

  it('kattintásra az onSelect lefut', () => {
    let selectCount = 0;
    act(() => {
      root.render(
        <MenuItem
          onSelect={() => {
            selectCount += 1;
          }}
        >
          Indítás
        </MenuItem>,
      );
    });
    act(() => {
      renderedItem().click();
    });
    expect(selectCount).toBe(1);
  });

  it('onSelect nélkül, önálló (Menu kontextus nélküli) renderelésben sem dob hibát kattintásra', () => {
    act(() => {
      root.render(<MenuItem>Indítás</MenuItem>);
    });
    expect(() => {
      act(() => {
        renderedItem().click();
      });
    }).not.toThrow();
  });
});
