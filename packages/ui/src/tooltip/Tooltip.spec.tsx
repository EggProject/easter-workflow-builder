import { act, type ReactElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../button/Button.tsx';
import { Tooltip, type TooltipProperties } from './Tooltip.tsx';

const TRIGGER_TEXT = 'Visszavonás';
const TIP_TEXT = 'Visszavonás tipp';
const DEFAULT_DELAY_MS = 200;

function advance(milliseconds: number): void {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

describe('Tooltip', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  function render(element: ReactElement): void {
    act(() => {
      root.render(element);
    });
  }

  function renderTooltip(properties: Partial<TooltipProperties> = {}): void {
    render(
      <Tooltip content={TIP_TEXT} {...properties}>
        <button type="button">{TRIGGER_TEXT}</button>
      </Tooltip>,
    );
  }

  function trigger(): HTMLButtonElement {
    const element = container.querySelector('button');
    if (element === null) {
      throw new Error('a trigger nem található a kirajzolt fán');
    }
    return element;
  }

  function tip(): HTMLElement {
    const element = container.querySelector<HTMLElement>('[role="tooltip"]');
    if (element === null) {
      throw new Error('a tipp panel nem található a kirajzolt fán');
    }
    return element;
  }

  function hoverIn(): void {
    act(() => {
      trigger().dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    });
  }

  function hoverOut(): void {
    act(() => {
      trigger().dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    });
  }

  function focusIn(): void {
    act(() => {
      trigger().dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
  }

  function focusOut(): void {
    act(() => {
      trigger().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
  }

  function pressKey(key: string): void {
    act(() => {
      trigger().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    });
  }

  describe('zárt állapot', () => {
    it('a panel role="tooltip" és hidden, a trigger nem kap hivatkozást', () => {
      renderTooltip();

      expect(tip().hidden).toBe(true);
      expect(tip().classList.contains('is-open')).toBe(false);
      expect(trigger().hasAttribute('aria-describedby')).toBe(false);
    });

    it('az alapértékek: top elhelyezés, dark változat, szöveg burkoló, nincs billentyű jelölés', () => {
      renderTooltip();

      expect(tip().className).toBe('tooltip tooltip--top tooltip--dark');
      expect(tip().querySelector('.tooltip__text')?.textContent).toBe(TIP_TEXT);
      expect(tip().querySelector('.tooltip__shortcut')).toBeNull();
    });

    it('a nyíl rejtett a hozzáférhetőségi fa elől', () => {
      renderTooltip();

      expect(tip().querySelector('.tooltip__arrow')?.getAttribute('aria-hidden')).toBe('true');
    });

    it.each<readonly [string, ReactNode]>([
      // eslint-disable-next-line unicorn/no-null -- a ReactNode típus a null értéket is engedi, ezt az ágat teszteli a teszt
      ['null', null],
      ['undefined', undefined],
      ['üres szöveg', ''],
    ])('üres tartalomnál (%s) nincs panel és nincs hivatkozás, fókuszra sem', (_name, content) => {
      renderTooltip({ content });

      focusIn();

      expect(container.querySelector('[role="tooltip"]')).toBeNull();
      expect(trigger().hasAttribute('aria-describedby')).toBe(false);
    });
  });

  describe('fókusz', () => {
    it('fókuszra azonnal nyílik, és a trigger aria-describedby értéke a panel azonosítója', () => {
      renderTooltip();

      focusIn();

      expect(tip().hidden).toBe(false);
      expect(tip().classList.contains('is-open')).toBe(true);
      expect(tip().id).not.toBe('');
      expect(trigger().getAttribute('aria-describedby')).toBe(tip().id);
    });

    it('a fókusz elvesztése zár, és a hivatkozás kikerül', () => {
      renderTooltip();
      focusIn();

      focusOut();

      expect(tip().hidden).toBe(true);
      expect(trigger().hasAttribute('aria-describedby')).toBe(false);
    });
  });

  describe('egér', () => {
    it('az alapértelmezett 200 ms késleltetés után nyílik, előtte nem', () => {
      renderTooltip();

      hoverIn();
      advance(DEFAULT_DELAY_MS - 1);
      expect(tip().hidden).toBe(true);

      advance(1);
      expect(tip().hidden).toBe(false);
      expect(trigger().getAttribute('aria-describedby')).toBe(tip().id);
    });

    it('a megadott delay szerint nyílik', () => {
      renderTooltip({ delay: 600 });

      hoverIn();
      advance(599);
      expect(tip().hidden).toBe(true);

      advance(1);
      expect(tip().hidden).toBe(false);
    });

    it('a késleltetés letelte előtti elhagyás lemondja a nyitást', () => {
      renderTooltip();

      hoverIn();
      advance(DEFAULT_DELAY_MS - 1);
      hoverOut();
      advance(DEFAULT_DELAY_MS * 5);

      expect(tip().hidden).toBe(true);
    });

    it('az egér elhagyása azonnal zár', () => {
      renderTooltip();
      hoverIn();
      advance(DEFAULT_DELAY_MS);

      hoverOut();

      expect(tip().hidden).toBe(true);
      expect(trigger().hasAttribute('aria-describedby')).toBe(false);
    });

    it('az egér elhagyása nem zár, amíg a fókusz tartja', () => {
      renderTooltip();
      hoverIn();
      advance(DEFAULT_DELAY_MS);
      focusIn();

      hoverOut();

      expect(tip().hidden).toBe(false);
    });

    it('a fókusz elvesztése nem zár, amíg az egér tartja', () => {
      renderTooltip();
      focusIn();
      hoverIn();
      advance(DEFAULT_DELAY_MS);

      focusOut();

      expect(tip().hidden).toBe(false);
    });
  });

  describe('Escape', () => {
    it('az egérrel nyitott tippet zárja, és megállítja az esemény terjedését', () => {
      const onParentKeyDown = vi.fn();
      render(
        <div onKeyDown={onParentKeyDown}>
          <Tooltip content={TIP_TEXT}>
            <button type="button">{TRIGGER_TEXT}</button>
          </Tooltip>
        </div>,
      );
      hoverIn();
      advance(DEFAULT_DELAY_MS);

      pressKey('Escape');

      expect(tip().hidden).toBe(true);
      expect(onParentKeyDown).not.toHaveBeenCalled();
    });

    it('a fókusszal nyitott tippet zárja, újranyitáshoz új fókusz kell', () => {
      renderTooltip();
      focusIn();

      pressKey('Escape');
      expect(tip().hidden).toBe(true);
      expect(trigger().hasAttribute('aria-describedby')).toBe(false);

      focusOut();
      focusIn();
      expect(tip().hidden).toBe(false);
    });

    it('Escape után az egér új belépéssel nyit újra', () => {
      renderTooltip();
      hoverIn();
      advance(DEFAULT_DELAY_MS);
      pressKey('Escape');

      hoverOut();
      hoverIn();
      advance(DEFAULT_DELAY_MS);

      expect(tip().hidden).toBe(false);
    });

    it('zárt tippnél az Escape tovább terjed', () => {
      const onParentKeyDown = vi.fn();
      render(
        <div onKeyDown={onParentKeyDown}>
          <Tooltip content={TIP_TEXT}>
            <button type="button">{TRIGGER_TEXT}</button>
          </Tooltip>
        </div>,
      );

      pressKey('Escape');

      expect(onParentKeyDown).toHaveBeenCalledTimes(1);
    });

    it('más billentyű nem zár, és tovább terjed', () => {
      const onParentKeyDown = vi.fn();
      render(
        <div onKeyDown={onParentKeyDown}>
          <Tooltip content={TIP_TEXT}>
            <button type="button">{TRIGGER_TEXT}</button>
          </Tooltip>
        </div>,
      );
      focusIn();

      pressKey('Enter');

      expect(tip().hidden).toBe(false);
      expect(onParentKeyDown).toHaveBeenCalledTimes(1);
    });
  });

  describe('aria-describedby', () => {
    it('a hívó saját hivatkozása zárva megmarad, nyitva a tipp azonosítója kerül mellé', () => {
      render(
        <Tooltip content={TIP_TEXT}>
          <button type="button" aria-describedby="hivo-leiras">
            {TRIGGER_TEXT}
          </button>
        </Tooltip>,
      );
      expect(trigger().getAttribute('aria-describedby')).toBe('hivo-leiras');

      focusIn();
      expect(trigger().getAttribute('aria-describedby')).toBe(`hivo-leiras ${tip().id}`);

      focusOut();
      expect(trigger().getAttribute('aria-describedby')).toBe('hivo-leiras');
    });

    it('a propokat továbbadó komponens (Button) triggerre is kerül hivatkozás', () => {
      render(
        <Tooltip content={TIP_TEXT} shortcut="Ctrl+Z">
          <Button size="sm" icon aria-label={TRIGGER_TEXT}>
            ↶
          </Button>
        </Tooltip>,
      );

      focusIn();

      expect(trigger().getAttribute('aria-describedby')).toBe(tip().id);
      expect(trigger().getAttribute('aria-label')).toBe(TRIGGER_TEXT);
    });

    it('két példány azonosítója különbözik, és "-tooltip" végű', () => {
      render(
        <>
          <Tooltip content="egy">
            <button type="button">egy</button>
          </Tooltip>
          <Tooltip content="kettő">
            <button type="button">kettő</button>
          </Tooltip>
        </>,
      );

      const identifiers = [...container.querySelectorAll('[role="tooltip"]')].map((element) => element.id);

      expect(identifiers).toHaveLength(2);
      expect(identifiers[0]).not.toBe(identifiers[1]);
      for (const identifier of identifiers) {
        expect(identifier.endsWith('-tooltip')).toBe(true);
      }
    });
  });

  describe('megjelenés', () => {
    it.each<readonly [TooltipProperties['placement'] & string]>([['top'], ['bottom'], ['left'], ['right']])(
      'a(z) %s elhelyezés osztályt kap',
      (placement) => {
        renderTooltip({ placement });

        expect(tip().classList.contains(`tooltip--${placement}`)).toBe(true);
      },
    );

    it.each<readonly [TooltipProperties['variant'] & string]>([['dark'], ['light'], ['rich']])(
      'a(z) %s változat osztályt kap',
      (variant) => {
        renderTooltip({ variant });

        expect(tip().classList.contains(`tooltip--${variant}`)).toBe(true);
      },
    );

    it('a rich változat a tartalmat szöveg burkoló nélkül rajzolja', () => {
      renderTooltip({ variant: 'rich', content: <strong className="rich__title">Cím</strong> });

      expect(tip().querySelector('.tooltip__text')).toBeNull();
      expect(tip().querySelector(':scope > .tooltip__body > .rich__title')?.textContent).toBe('Cím');
    });

    it('a shortcut kbd elemben rajzolódik, a tartalom után', () => {
      renderTooltip({ shortcut: 'Ctrl+Shift+Z / Ctrl+Y' });

      const shortcut = tip().querySelector('kbd.tooltip__shortcut');
      expect(shortcut?.textContent).toBe('Ctrl+Shift+Z / Ctrl+Y');
      expect(shortcut?.previousElementSibling?.classList.contains('tooltip__text')).toBe(true);
    });

    it('üres shortcut esetén nincs kbd elem', () => {
      renderTooltip({ shortcut: '' });

      expect(tip().querySelector('kbd')).toBeNull();
    });
  });

  describe('lecsatolás', () => {
    it('a függő egeres nyitás időzítője lemondódik', () => {
      renderTooltip();
      hoverIn();
      expect(vi.getTimerCount()).toBe(1);

      render(<div />);

      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
