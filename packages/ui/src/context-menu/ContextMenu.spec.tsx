import { act, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextMenuPosition } from './compute-context-menu-position.ts';
import { ContextMenu, type ContextMenuItem } from './ContextMenu.tsx';

type NodeKind = 'agent_step' | 'branch' | 'loop';

const ITEMS: readonly ContextMenuItem<NodeKind>[] = [
  { value: 'agent_step', label: 'Agent lépés' },
  { value: 'branch', label: 'Elágazás' },
  { value: 'loop', label: 'Ciklus' },
];

function pressKeyOn(target: Element, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function mouseDownOn(target: EventTarget): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  });
}

function queryPanel(): HTMLDivElement | null {
  return document.body.querySelector<HTMLDivElement>('[role="menu"]');
}

// A panel `createPortal`-lal a `document.body`-ba kerül, tehát nem a
// `container` leszármazottja.
function panel(): HTMLDivElement {
  const element = queryPanel();
  if (element === null) {
    throw new Error('a menü panel nem található');
  }
  return element;
}

function items(): readonly HTMLButtonElement[] {
  return [...panel().querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
}

function item(index: number): HTMLButtonElement {
  const element = items()[index];
  if (element === undefined) {
    throw new Error(`a(z) ${String(index)}. menüpont nem található`);
  }
  return element;
}

/**
 * Vezérelt hívó: a választást és a zárást rögzíti, a zárásra a menüt
 * bezárja, ahogy a T-009-43 szerkesztője fogja.
 */
function ControlledHarness(properties: {
  readonly initialPosition: ContextMenuPosition;
  readonly onSelect: (value: NodeKind) => void;
  readonly onClose: () => void;
}): ReactElement {
  const [position, setPosition] = useState<ContextMenuPosition | undefined>(properties.initialPosition);
  return (
    <ContextMenu
      position={position}
      label="Csomópont felvétele"
      items={ITEMS}
      onSelect={properties.onSelect}
      onClose={() => {
        properties.onClose();
        setPosition(undefined);
      }}
    />
  );
}

describe('ContextMenu', () => {
  let container: HTMLDivElement;
  let root: Root;
  let opener: HTMLButtonElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    opener = document.createElement('button');
    opener.textContent = 'Megnyitó';
    document.body.append(opener);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    opener.remove();
    vi.restoreAllMocks();
  });

  function renderMenu(
    position: ContextMenuPosition | undefined,
    handlers: { readonly onSelect?: (value: NodeKind) => void; readonly onClose?: () => void } = {},
    menuItems: readonly ContextMenuItem<NodeKind>[] = ITEMS,
  ): void {
    act(() => {
      root.render(
        <ContextMenu
          position={position}
          label="Csomópont felvétele"
          items={menuItems}
          onSelect={handlers.onSelect ?? vi.fn()}
          onClose={handlers.onClose ?? vi.fn()}
        />,
      );
    });
  }

  function openFromOpener(
    handlers: { readonly onSelect?: (value: NodeKind) => void; readonly onClose?: () => void } = {},
    menuItems: readonly ContextMenuItem<NodeKind>[] = ITEMS,
  ): void {
    opener.focus();
    renderMenu({ x: 120, y: 80 }, handlers, menuItems);
  }

  describe('szerkezet', () => {
    it('zárva (position: undefined) nem rajzol panelt', () => {
      renderMenu(undefined);
      expect(queryPanel()).toBeNull();
      expect(container.childElementCount).toBe(0);
    });

    it('nyitva a document.body-ba rajzolja a role="menu" panelt a forrás osztályával és a kapott névvel', () => {
      renderMenu({ x: 120, y: 80 });
      const menu = panel();
      expect(menu.parentElement).toBe(document.body);
      expect(menu.className).toBe('context-menu');
      expect(menu.getAttribute('aria-label')).toBe('Csomópont felvétele');
      expect(menu.tabIndex).toBe(-1);
    });

    it('a menüpontok role="menuitem" gombok, a megadott sorrendben, mind tabIndex=-1', () => {
      renderMenu({ x: 120, y: 80 });
      expect(items().map((element) => element.textContent)).toEqual(['Agent lépés', 'Elágazás', 'Ciklus']);
      for (const element of items()) {
        expect(element.tagName).toBe('BUTTON');
        expect(element.type).toBe('button');
        expect(element.className).toBe('context-menu__item');
        expect(element.tabIndex).toBe(-1);
      }
    });

    it('a zárás eltávolítja a panelt', () => {
      renderMenu({ x: 120, y: 80 });
      renderMenu(undefined);
      expect(queryPanel()).toBeNull();
    });
  });

  describe('pozíció', () => {
    it('a nyitási pontra kerül, ha a panel belefér a nézetablakba (happy-dom alatt a mért méret nulla)', () => {
      renderMenu({ x: 120, y: 80 });
      expect(panel().style.left).toBe('120px');
      expect(panel().style.top).toBe('80px');
    });

    it('a közeli élen a margóra szorít', () => {
      renderMenu({ x: 2, y: -10 });
      expect(panel().style.left).toBe('8px');
      expect(panel().style.top).toBe('8px');
    });

    it('a kirajzolt panel méretével a távoli élen a nézetablakon belülre szorít', () => {
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(200);
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(120);
      renderMenu({ x: globalThis.innerWidth - 10, y: globalThis.innerHeight - 10 });
      expect(panel().style.left).toBe(`${String(globalThis.innerWidth - 200 - 8)}px`);
      expect(panel().style.top).toBe(`${String(globalThis.innerHeight - 120 - 8)}px`);
    });

    it('a menüpontok változásakor újramér', () => {
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
        return this.querySelectorAll('[role="menuitem"]').length * 100;
      });
      const position = { x: 40, y: globalThis.innerHeight - 250 };
      renderMenu(position, {}, ITEMS.slice(0, 1));
      expect(panel().style.top).toBe(`${String(globalThis.innerHeight - 250)}px`);
      renderMenu(position, {}, ITEMS);
      expect(panel().style.top).toBe(`${String(globalThis.innerHeight - 300 - 8)}px`);
    });

    it('ablak átméretezéskor újraszorít', () => {
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(200);
      renderMenu({ x: 700, y: 80 });
      expect(panel().style.left).toBe('700px');
      vi.spyOn(globalThis, 'innerWidth', 'get').mockReturnValue(600);
      act(() => {
        globalThis.dispatchEvent(new Event('resize'));
      });
      expect(panel().style.left).toBe(`${String(600 - 200 - 8)}px`);
    });

    it('új pontra adva (áthelyezés) az új pontra kerül', () => {
      renderMenu({ x: 120, y: 80 });
      renderMenu({ x: 300, y: 260 });
      expect(panel().style.left).toBe('300px');
      expect(panel().style.top).toBe('260px');
    });
  });

  describe('fókusz és billentyűk', () => {
    it('nyitáskor az első menüpontra kerül a fókusz', () => {
      openFromOpener();
      expect(document.activeElement).toBe(item(0));
    });

    it('üres listánál a panelre kerül a fókusz, és a nyilak, a Home és az End nem mozdítja', () => {
      openFromOpener({}, []);
      expect(document.activeElement).toBe(panel());
      for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End']) {
        pressKeyOn(panel(), key);
        expect(document.activeElement).toBe(panel());
      }
    });

    it('ArrowDown a következőre lép és az utolsóról az elsőre ér körbe, zárás nélkül', () => {
      const onClose = vi.fn();
      openFromOpener({ onClose });
      const event = pressKeyOn(item(0), 'ArrowDown');
      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(item(1));
      pressKeyOn(item(1), 'ArrowDown');
      pressKeyOn(item(2), 'ArrowDown');
      expect(document.activeElement).toBe(item(0));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('ArrowUp az előzőre lép és az elsőről az utolsóra ér körbe', () => {
      openFromOpener();
      const event = pressKeyOn(item(0), 'ArrowUp');
      expect(event.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(item(2));
      pressKeyOn(item(2), 'ArrowUp');
      expect(document.activeElement).toBe(item(1));
    });

    it('a panelen magán álló fókuszból ArrowDown az elsőre, ArrowUp az utolsóra lép', () => {
      openFromOpener();
      panel().focus();
      pressKeyOn(panel(), 'ArrowDown');
      expect(document.activeElement).toBe(item(0));
      panel().focus();
      pressKeyOn(panel(), 'ArrowUp');
      expect(document.activeElement).toBe(item(2));
    });

    it('Home az elsőre, End az utolsóra ugrik', () => {
      openFromOpener();
      const endEvent = pressKeyOn(item(0), 'End');
      expect(endEvent.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(item(2));
      const homeEvent = pressKeyOn(item(2), 'Home');
      expect(homeEvent.defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(item(0));
    });

    it('más billentyűt nem kezel és nem tilt le', () => {
      const onClose = vi.fn();
      openFromOpener({ onClose });
      const event = pressKeyOn(item(0), 'a');
      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(item(0));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('Escape zárást kér és a fókuszt a nyitáskor fókuszban álló elemre adja vissza', () => {
      const onClose = vi.fn();
      openFromOpener({ onClose });
      const event = pressKeyOn(item(1), 'Escape');
      expect(event.defaultPrevented).toBe(true);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(opener);
    });

    it('vezérelt hívóval az Escape bezárja a menüt, és a fókusz a megnyitón marad', () => {
      const onClose = vi.fn();
      opener.focus();
      act(() => {
        root.render(<ControlledHarness initialPosition={{ x: 10, y: 10 }} onSelect={vi.fn()} onClose={onClose} />);
      });
      pressKeyOn(item(0), 'Escape');
      expect(queryPanel()).toBeNull();
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(opener);
    });

    it('nem HTMLElement nyitáskori fókusz esetén az Escape nem dob, és nem fókuszál vissza', () => {
      const onClose = vi.fn();
      const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      Object.defineProperty(document, 'activeElement', { value: svgElement, configurable: true });
      try {
        renderMenu({ x: 10, y: 10 }, { onClose });
      } finally {
        // Csak a példányon felvett saját tulajdonságot veszi el, utána a
        // happy-dom eredeti accessora érvényes (a `Modal.spec.tsx` mintája).
        Reflect.deleteProperty(document, 'activeElement');
      }
      expect(() => {
        pressKeyOn(item(0), 'Escape');
      }).not.toThrow();
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(item(0));
    });

    it('áthelyezéskor a fókusz az első menüpontra kerül, de a visszaadás célja a megnyitó marad', () => {
      const onClose = vi.fn();
      opener.focus();
      renderMenu({ x: 10, y: 10 }, { onClose });
      item(2).focus();
      renderMenu({ x: 50, y: 50 }, { onClose });
      expect(document.activeElement).toBe(item(0));
      pressKeyOn(item(0), 'Escape');
      expect(document.activeElement).toBe(opener);
    });
  });

  describe('választás', () => {
    it('kattintásra előbb az onSelect fut a menüpont értékével, utána az onClose, és a fókusz a megnyitóra kerül', () => {
      const calls: string[] = [];
      openFromOpener({
        onSelect: (value) => {
          calls.push(`select:${value}`);
        },
        onClose: () => {
          calls.push('close');
        },
      });
      act(() => {
        item(1).click();
      });
      expect(calls).toEqual(['select:branch', 'close']);
      expect(document.activeElement).toBe(opener);
    });

    it('ha az onSelect a fókuszt a panelen kívülre vitte, a fókusz ott marad', () => {
      const onClose = vi.fn();
      const target = document.createElement('input');
      document.body.append(target);
      try {
        openFromOpener({
          onSelect: () => {
            target.focus();
          },
          onClose,
        });
        act(() => {
          item(2).click();
        });
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(target);
      } finally {
        target.remove();
      }
    });
  });

  describe('zárás', () => {
    it('a panelen kívüli mousedown zárást kér, fókusz visszaadás nélkül', () => {
      const onClose = vi.fn();
      openFromOpener({ onClose });
      mouseDownOn(document.body);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(item(0));
    });

    it('a célelem saját mousedown figyelőjének stopImmediatePropagation hívása (d3-zoom minta) ellenére is zár, pontosan egyszer', () => {
      const onClose = vi.fn();
      const target = document.createElement('div');
      const stopHandler = vi.fn((event: MouseEvent): void => {
        event.stopImmediatePropagation();
      });
      target.addEventListener('mousedown', stopHandler);
      document.body.append(target);
      try {
        openFromOpener({ onClose });
        mouseDownOn(target);
        expect(stopHandler).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
      } finally {
        target.remove();
      }
    });

    it('a mousedown figyelőt elfogó fázisban köti fel és ugyanazzal a capture értékkel köti le (a happy-dom a leiratkozásnál a capture értéket nem veti össze)', () => {
      const addSpy = vi.spyOn(globalThis, 'addEventListener');
      const removeSpy = vi.spyOn(globalThis, 'removeEventListener');
      openFromOpener();
      renderMenu(undefined);
      const added = addSpy.mock.calls.filter(([type]) => type === 'mousedown');
      const removed = removeSpy.mock.calls.filter(([type]) => type === 'mousedown');
      expect(added).toEqual([['mousedown', expect.any(Function), { capture: true }]]);
      expect(removed).toEqual(added);
    });

    it('a panelen belüli mousedown nem zár', () => {
      const onClose = vi.fn();
      openFromOpener({ onClose });
      mouseDownOn(item(1));
      mouseDownOn(panel());
      expect(onClose).not.toHaveBeenCalled();
    });

    it('a fókusz kilépése a panelből (Tab) zárást kér, fókusz visszaadás nélkül', () => {
      const onClose = vi.fn();
      const outside = document.createElement('button');
      document.body.append(outside);
      try {
        openFromOpener({ onClose });
        act(() => {
          item(0).dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
        });
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(item(0));
      } finally {
        outside.remove();
      }
    });

    it('relatedTarget nélküli fókusz kilépés (a fókusz elhagyja a dokumentumot) is zár', () => {
      const onClose = vi.fn();
      openFromOpener({ onClose });
      act(() => {
        item(0).dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('a menüpontok közötti fókusz mozgás nem zár', () => {
      const onClose = vi.fn();
      openFromOpener({ onClose });
      act(() => {
        item(0).dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: item(1) }));
      });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('görgetés zárást kér, és a panelen álló fókuszt a megnyitóra adja vissza', () => {
      const onClose = vi.fn();
      const scroller = document.createElement('div');
      document.body.append(scroller);
      try {
        openFromOpener({ onClose });
        act(() => {
          scroller.dispatchEvent(new Event('scroll'));
        });
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(opener);
      } finally {
        scroller.remove();
      }
    });

    it('egy nyitási ciklusban legfeljebb egyszer kér zárást, új pontnál újra', () => {
      const onClose = vi.fn();
      openFromOpener({ onClose });
      pressKeyOn(item(0), 'Escape');
      mouseDownOn(document.body);
      act(() => {
        globalThis.dispatchEvent(new Event('scroll'));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
      renderMenu({ x: 30, y: 30 }, { onClose });
      pressKeyOn(item(0), 'Escape');
      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('zárás után a globális figyelők leválnak', () => {
      const onClose = vi.fn();
      openFromOpener({ onClose });
      renderMenu(undefined, { onClose });
      mouseDownOn(document.body);
      act(() => {
        globalThis.dispatchEvent(new Event('resize'));
        globalThis.dispatchEvent(new Event('scroll'));
      });
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
