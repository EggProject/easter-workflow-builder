import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Menu, type MenuTriggerProperties } from './Menu.tsx';
import { MenuItem } from './MenuItem.tsx';

function renderTrigger(triggerProperties: MenuTriggerProperties): ReactElement {
  return (
    <button type="button" {...triggerProperties}>
      Műveletek
    </button>
  );
}

function pressKeyOn(target: Element, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function pressGlobalKey(key: string): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

function mouseDownOn(target: EventTarget): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  });
}

describe('Menu', () => {
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

  function trigger(): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>('button');
    if (button === null) {
      throw new Error('a trigger gomb nem található');
    }
    return button;
  }

  // A panel 2026-09-04 óta `createPortal`-lal a `document.body`-ba kerül
  // (lásd Menu.tsx fejléc), tehát NEM a `container` leszármazottja.
  function panel(): HTMLDivElement {
    const element = document.body.querySelector<HTMLDivElement>('[role="menu"]');
    if (element === null) {
      throw new Error('a menü panel nem található');
    }
    return element;
  }

  function items(): readonly HTMLButtonElement[] {
    return [...panel().querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
  }

  function renderThreeItemMenu(): void {
    act(() => {
      root.render(
        <Menu trigger={renderTrigger}>
          <MenuItem>Átnevezés</MenuItem>
          <MenuItem>Törlés</MenuItem>
          <MenuItem>Indítás</MenuItem>
        </Menu>,
      );
    });
  }

  it('zárt állapotban a panel hidden, a trigger aria-expanded="false"', () => {
    renderThreeItemMenu();
    expect(panel().hidden).toBe(true);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
    expect(container.querySelector('.menu-anchor')?.className).toBe('menu-anchor');
  });

  // Az `align="right"` kontra `align="left"` tényleges eltérése (hova
  // kerül a `left`) a `compute-panel-position.spec.ts`-ben van közvetlenül,
  // valós számokkal tesztelve: a happy-dom `getBoundingClientRect()` mindig
  // nulla téglalapot ad, ezért itt a két igazítás azonos (a bal margóra
  // szorított) eredményre futna, nem tudná megkülönböztetni őket. Ez a
  // teszt csak azt igazolja, hogy a `Menu` ténylegesen alkalmazza a
  // számított `top`/`left` inline stílust a nyitott panelen.
  it('nyitáskor a panel px mértékegységű top/left inline stílust kap', () => {
    renderThreeItemMenu();
    act(() => {
      trigger().click();
    });
    expect(panel().style.top).toMatch(/^-?\d+(\.\d+)?px$/);
    expect(panel().style.left).toMatch(/^-?\d+(\.\d+)?px$/);
  });

  it('trigger kattintásra megnyílik, az első elemre kerül a fókusz, és az is-open osztályt is felveszi', () => {
    renderThreeItemMenu();
    act(() => {
      trigger().click();
    });
    expect(panel().hidden).toBe(false);
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.menu-anchor')?.className).toBe('menu-anchor is-open');
    expect(document.activeElement).toBe(items()[0]);
    expect(items()[0]?.tabIndex).toBe(0);
    expect(items()[1]?.tabIndex).toBe(-1);
  });

  it('nyitott menüre a trigger ismételt kattintása bezárja', () => {
    renderThreeItemMenu();
    act(() => {
      trigger().click();
    });
    act(() => {
      trigger().click();
    });
    expect(panel().hidden).toBe(true);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('ArrowDown a zárt triggeren megnyit és az első elemre fókuszál', () => {
    renderThreeItemMenu();
    const event = pressKeyOn(trigger(), 'ArrowDown');
    expect(event.defaultPrevented).toBe(true);
    expect(panel().hidden).toBe(false);
    expect(document.activeElement).toBe(items()[0]);
  });

  it('ArrowUp a zárt triggeren megnyit és az utolsó elemre fókuszál', () => {
    renderThreeItemMenu();
    pressKeyOn(trigger(), 'ArrowUp');
    expect(panel().hidden).toBe(false);
    expect(document.activeElement).toBe(items().at(-1));
  });

  it('ArrowDown a nyitott triggeren az első elemre fókuszál', () => {
    renderThreeItemMenu();
    act(() => {
      trigger().click();
    });
    act(() => {
      items()[2]?.focus();
    });
    pressKeyOn(trigger(), 'ArrowDown');
    expect(document.activeElement).toBe(items()[0]);
  });

  it('ArrowUp a nyitott triggeren az utolsó elemre fókuszál', () => {
    renderThreeItemMenu();
    act(() => {
      trigger().click();
    });
    pressKeyOn(trigger(), 'ArrowUp');
    expect(document.activeElement).toBe(items().at(-1));
  });

  it('egyéb billentyű a triggeren nem nyit meg és nem előzi meg az alapértelmezettet', () => {
    renderThreeItemMenu();
    const event = pressKeyOn(trigger(), 'Enter');
    expect(event.defaultPrevented).toBe(false);
    expect(panel().hidden).toBe(true);
  });

  it('elemek nélküli menü nyitáskor a panelre magára fókuszál', () => {
    act(() => {
      root.render(<Menu trigger={renderTrigger}>{undefined}</Menu>);
    });
    act(() => {
      trigger().click();
    });
    expect(document.activeElement).toBe(panel());
  });

  it('elemek nélküli menü panelén az ArrowDown/Home nem dob hibát és nem mozdít fókuszt', () => {
    act(() => {
      root.render(<Menu trigger={renderTrigger}>{undefined}</Menu>);
    });
    act(() => {
      trigger().click();
    });
    pressKeyOn(panel(), 'ArrowDown');
    expect(document.activeElement).toBe(panel());
    pressKeyOn(panel(), 'Home');
    expect(document.activeElement).toBe(panel());
  });

  it('a panelen ArrowDown a következő, körbeérve az elsőre', () => {
    renderThreeItemMenu();
    act(() => {
      trigger().click();
    });
    pressKeyOn(panel(), 'ArrowDown');
    expect(document.activeElement).toBe(items()[1]);
    pressKeyOn(panel(), 'ArrowDown');
    expect(document.activeElement).toBe(items()[2]);
    pressKeyOn(panel(), 'ArrowDown');
    expect(document.activeElement).toBe(items()[0]);
  });

  it('a panelen ArrowDown a panel közvetlen fókuszakor (egyik elem sincs fókuszban) az elsőre lép', () => {
    renderThreeItemMenu();
    act(() => {
      trigger().click();
    });
    act(() => {
      panel().focus();
    });
    pressKeyOn(panel(), 'ArrowDown');
    expect(document.activeElement).toBe(items()[0]);
  });

  it('a panelen ArrowUp az előző, körbeérve az utolsóra', () => {
    renderThreeItemMenu();
    act(() => {
      trigger().click();
    });
    pressKeyOn(panel(), 'ArrowUp');
    expect(document.activeElement).toBe(items()[2]);
  });

  it('a panelen Home/End az első/utolsó elemre ugrik', () => {
    renderThreeItemMenu();
    act(() => {
      trigger().click();
    });
    pressKeyOn(panel(), 'End');
    expect(document.activeElement).toBe(items()[2]);
    pressKeyOn(panel(), 'Home');
    expect(document.activeElement).toBe(items()[0]);
  });

  it('a panelen egyéb billentyű nem mozdít fókuszt', () => {
    renderThreeItemMenu();
    act(() => {
      trigger().click();
    });
    act(() => {
      items()[0]?.focus();
    });
    pressKeyOn(panel(), 'a');
    expect(document.activeElement).toBe(items()[0]);
  });

  it('letiltott elem kimarad a roving navigációból', () => {
    act(() => {
      root.render(
        <Menu trigger={renderTrigger}>
          <MenuItem>Átnevezés</MenuItem>
          <MenuItem disabled>Törlés</MenuItem>
          <MenuItem>Indítás</MenuItem>
        </Menu>,
      );
    });
    act(() => {
      trigger().click();
    });
    pressKeyOn(panel(), 'ArrowDown');
    expect(document.activeElement).toBe(items()[2]);
  });

  it('Escape nyitott menün zár, és a fókusz visszatér a triggerre', () => {
    renderThreeItemMenu();
    act(() => {
      trigger().click();
    });
    pressGlobalKey('Escape');
    expect(panel().hidden).toBe(true);
    expect(document.activeElement).toBe(trigger());
  });

  it('Escape zárt menün nem dob hibát', () => {
    renderThreeItemMenu();
    expect(() => {
      pressGlobalKey('Escape');
    }).not.toThrow();
    expect(panel().hidden).toBe(true);
  });

  it('kattintás a menün kívülre zár, fókusz-visszaállítás nélkül', () => {
    renderThreeItemMenu();
    const outsideButton = document.createElement('button');
    document.body.append(outsideButton);
    act(() => {
      trigger().click();
    });

    mouseDownOn(outsideButton);

    expect(panel().hidden).toBe(true);
    expect(document.activeElement).not.toBe(trigger());
    outsideButton.remove();
  });

  it('kattintás a triggerre magára (mousedown) nem zár a kívülre-kattintás ágon', () => {
    renderThreeItemMenu();
    act(() => {
      trigger().click();
    });
    mouseDownOn(trigger());
    expect(panel().hidden).toBe(false);
  });

  it('elem kiválasztására a menü zár, és a fókusz visszatér a triggerre', () => {
    let selected: string | undefined;
    act(() => {
      root.render(
        <Menu trigger={renderTrigger}>
          <MenuItem
            onSelect={() => {
              selected = 'Átnevezés';
            }}
          >
            Átnevezés
          </MenuItem>
        </Menu>,
      );
    });
    act(() => {
      trigger().click();
    });
    act(() => {
      items()[0]?.click();
    });
    expect(selected).toBe('Átnevezés');
    expect(panel().hidden).toBe(true);
    expect(document.activeElement).toBe(trigger());
  });

  it('a fókusz kilépése az anchorból (pl. Tab) zár, fókusz-visszaállítás nélkül', () => {
    renderThreeItemMenu();
    const outsideButton = document.createElement('button');
    document.body.append(outsideButton);
    act(() => {
      trigger().click();
    });

    act(() => {
      const anchor = container.querySelector('.menu-anchor');
      anchor?.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outsideButton }));
    });

    expect(panel().hidden).toBe(true);
    outsideButton.remove();
  });

  it('a fókusz mozgása a triggerről egy (portált) menü elemre nem zár', () => {
    renderThreeItemMenu();
    act(() => {
      trigger().click();
    });

    act(() => {
      const anchor = container.querySelector('.menu-anchor');
      const firstItem = items()[0];
      if (firstItem !== undefined) {
        anchor?.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: firstItem }));
      }
    });

    expect(panel().hidden).toBe(false);
  });

  // A panel 2026-09-04 óta portálon (`createPortal`) át, a triggerétől
  // KÜLÖN DOM ágon renderelődik, ezért saját `onBlur` figyelőre van
  // szüksége: a fenti teszt csak az anchor oldalát fedi (trigger -> elem
  // nem zár), az alábbi kettő a panel oldalát.
  it('a panel onBlur-ja NEM zár, ha a relatedTarget a trigger (pl. Shift+Tab vissza rá)', () => {
    renderThreeItemMenu();
    act(() => {
      trigger().click();
    });

    act(() => {
      panel().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: trigger() }));
    });

    expect(panel().hidden).toBe(false);
  });

  it('a panel onBlur-ja zár, ha a relatedTarget a menün kívülre esik', () => {
    renderThreeItemMenu();
    const outsideButton = document.createElement('button');
    document.body.append(outsideButton);
    act(() => {
      trigger().click();
    });

    act(() => {
      panel().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outsideButton }));
    });

    expect(panel().hidden).toBe(true);
    outsideButton.remove();
  });

  it('relatedTarget nélküli blur (fókusz elhagyja a dokumentumot) zár', () => {
    renderThreeItemMenu();
    act(() => {
      trigger().click();
    });

    act(() => {
      const anchor = container.querySelector('.menu-anchor');
      anchor?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });

    expect(panel().hidden).toBe(true);
  });
});
