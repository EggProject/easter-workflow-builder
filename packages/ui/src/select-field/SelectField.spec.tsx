import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FieldErrorVisibilityContext } from '../field-error-visibility/field-error-visibility-context.ts';
import { SelectField, type SelectFieldOption } from './SelectField.tsx';

const PROVIDER_OPTIONS: readonly SelectFieldOption[] = [
  { value: 'claude-subscription', label: 'Claude előfizetés' },
  { value: 'minimax', label: 'MiniMax' },
];

const WITH_DISABLED_OPTIONS: readonly SelectFieldOption[] = [
  { value: 'draft', label: 'Piszkozat' },
  { value: 'archived', label: 'Archivált', disabled: true },
  { value: 'shipped', label: 'Kiadott' },
];

function noop(): void {
  // A vezérelt mező kötelező visszahívása ott, ahol a teszt nem vizsgálja.
}

function pressKeyOn(target: Element, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function clickOn(target: Element, detail = 1): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail }));
  });
}

function mouseMoveOn(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
  });
}

function mouseDownOn(target: EventTarget): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  });
}

describe('SelectField', () => {
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
    const button = container.querySelector<HTMLButtonElement>('button.select');
    if (button === null) {
      throw new Error('a select trigger nem található a kirajzolt fán');
    }
    return button;
  }

  // A panel `createPortal`-lal a `document.body`-ba kerül (lásd
  // SelectField.tsx fejléc), tehát NEM a `container` leszármazottja.
  function panel(): HTMLDivElement {
    const element = document.body.querySelector<HTMLDivElement>('[role="listbox"]');
    if (element === null) {
      throw new Error('a select panel nem található');
    }
    return element;
  }

  function optionElements(): readonly HTMLElement[] {
    return [...panel().querySelectorAll<HTMLElement>('[role="option"]')];
  }

  function optionLabels(): readonly string[] {
    return optionElements().map((option) => option.querySelector(':scope .menu__text')?.textContent ?? '');
  }

  function optionAt(index: number): HTMLElement {
    const option = optionElements().at(index);
    if (option === undefined) {
      throw new Error(`nincs opció a(z) ${String(index)} sorszámon`);
    }
    return option;
  }

  function triggerLabel(): string {
    return trigger().querySelector(':scope .select__value')?.textContent ?? '';
  }

  function renderSelect(node: React.ReactElement): void {
    act(() => {
      root.render(node);
    });
  }

  function openPanel(): void {
    clickOn(trigger());
  }

  /**
   * Letiltott opciót is tartalmazó lista, már nyitott panellel.
   */
  function renderOpen(value = 'draft'): void {
    renderSelect(<SelectField label="Állapot" options={WITH_DISABLED_OPTIONS} value={value} onChange={noop} />);
    openPanel();
  }

  it('zárva a panel hidden, a trigger a kiválasztott opció feliratát mutatja', () => {
    renderSelect(<SelectField label="Provider" options={PROVIDER_OPTIONS} value="minimax" onChange={noop} />);

    expect(trigger().className).toBe('select');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger().getAttribute('aria-activedescendant')).toBeNull();
    expect(trigger().disabled).toBe(false);
    expect(panel().hidden).toBe(true);
    expect(triggerLabel()).toBe('MiniMax');
    expect(trigger().querySelector(':scope .select__value')?.className).toBe('select__value');
  });

  it('a trigger a design system chevron SVG-jét viseli', () => {
    renderSelect(<SelectField label="Provider" options={PROVIDER_OPTIONS} value="minimax" onChange={noop} />);

    const caret = trigger().querySelector(':scope svg.select__caret');
    expect(caret).not.toBeNull();
    expect(caret?.querySelector(':scope path')?.getAttribute('d')).toBe('m4 6 4 4 4-4');
  });

  it('a címke `aria-labelledby` hivatkozással adja a trigger hozzáférhető nevét', () => {
    renderSelect(<SelectField label="Provider" options={PROVIDER_OPTIONS} value="minimax" onChange={noop} />);

    const labelId = trigger().getAttribute('aria-labelledby');
    expect(labelId).not.toBeNull();
    expect(container.querySelector(`#${String(labelId)}`)?.textContent).toBe('Provider');
    expect(container.querySelector('.field__label')?.textContent).toBe('Provider');
  });

  it('címke nélkül nincs `aria-labelledby`, és `aria-label` adható helyette', () => {
    renderSelect(<SelectField aria-label="Provider" options={PROVIDER_OPTIONS} value="minimax" onChange={noop} />);

    expect(trigger().getAttribute('aria-labelledby')).toBeNull();
    expect(trigger().getAttribute('aria-label')).toBe('Provider');
    expect(panel().getAttribute('aria-labelledby')).toBeNull();
    expect(container.querySelector('.field__label')).toBeNull();
  });

  it('kattintásra nyílik, és minden opciót kirajzol', () => {
    renderSelect(<SelectField label="Provider" options={PROVIDER_OPTIONS} value="minimax" onChange={noop} />);
    openPanel();

    expect(panel().hidden).toBe(false);
    expect(trigger().className).toBe('select select--open');
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(optionLabels()).toEqual(['Claude előfizetés', 'MiniMax']);
    expect(optionAt(1).getAttribute('aria-selected')).toBe('true');
    expect(optionAt(0).getAttribute('aria-selected')).toBe('false');
    // Nyitáskor a kiválasztott opció az aktív.
    expect(trigger().getAttribute('aria-activedescendant')).toBe(optionAt(1).id);
    expect(optionAt(1).className).toBe('menu__item is-active');
  });

  it('a kiválasztott opció pipát kap, a többi nem', () => {
    renderSelect(<SelectField label="Provider" options={PROVIDER_OPTIONS} value="minimax" onChange={noop} />);
    openPanel();

    expect(optionAt(0).querySelector(':scope .menu__check svg')).toBeNull();
    expect(optionAt(1).querySelector(':scope .menu__check svg path')?.getAttribute('d')).toBe('m3.5 8 3 3 6-6.5');
  });

  it('újabb kattintásra zár', () => {
    renderSelect(<SelectField label="Provider" options={PROVIDER_OPTIONS} value="minimax" onChange={noop} />);
    openPanel();
    clickOn(trigger());

    expect(panel().hidden).toBe(true);
  });

  it('a billentyűzetből származó kattintás (detail 0) nem nyit', () => {
    renderSelect(<SelectField label="Provider" options={PROVIDER_OPTIONS} value="minimax" onChange={noop} />);
    clickOn(trigger(), 0);

    expect(panel().hidden).toBe(true);
  });

  it('opcióra kattintva az értéke jön vissza, és a panel zár', () => {
    const onChange = vi.fn();
    renderSelect(<SelectField label="Provider" options={PROVIDER_OPTIONS} value="minimax" onChange={onChange} />);
    openPanel();
    clickOn(optionAt(0));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('claude-subscription');
    expect(panel().hidden).toBe(true);
  });

  it('letiltott opcióra kattintva nincs visszajelzés, és a panel nyitva marad', () => {
    const onChange = vi.fn();
    renderSelect(<SelectField label="Állapot" options={WITH_DISABLED_OPTIONS} value="draft" onChange={onChange} />);
    openPanel();

    expect(optionAt(1).className).toBe('menu__item is-disabled');
    expect(optionAt(1).getAttribute('aria-disabled')).toBe('true');
    expect(optionAt(0).getAttribute('aria-disabled')).toBeNull();

    clickOn(optionAt(1));

    expect(onChange).not.toHaveBeenCalled();
    expect(panel().hidden).toBe(false);
  });

  it('egérmozgásra az engedélyezett opció lesz az aktív, a letiltott nem', () => {
    renderSelect(<SelectField label="Állapot" options={WITH_DISABLED_OPTIONS} value="draft" onChange={noop} />);
    openPanel();

    mouseMoveOn(optionAt(2));
    expect(optionAt(2).className).toBe('menu__item is-active');

    mouseMoveOn(optionAt(1));
    expect(optionAt(2).className).toBe('menu__item is-active');

    // Ugyanazon az aktív opción belüli mozgás nem vált állapotot.
    mouseMoveOn(optionAt(2));
    expect(optionAt(2).className).toBe('menu__item is-active');
  });

  it('a panelen kívülre kattintva zár, a panelen belül nem', () => {
    renderSelect(<SelectField label="Provider" options={PROVIDER_OPTIONS} value="minimax" onChange={noop} />);
    openPanel();

    mouseDownOn(panel());
    expect(panel().hidden).toBe(false);

    mouseDownOn(document.body);
    expect(panel().hidden).toBe(true);
  });

  describe('billentyűzet, zárt panelen', () => {
    it.each([['ArrowDown'], ['Enter'], [' ']])('a(z) "%s" nyit és az első engedélyezett opcióra áll', (key) => {
      renderSelect(<SelectField label="Állapot" options={WITH_DISABLED_OPTIONS} value="" onChange={noop} />);
      const event = pressKeyOn(trigger(), key);

      expect(event.defaultPrevented).toBe(true);
      expect(panel().hidden).toBe(false);
      expect(optionAt(0).className).toBe('menu__item is-active');
    });

    it('az "ArrowUp" nyit és az utolsó engedélyezett opcióra áll', () => {
      renderSelect(<SelectField label="Állapot" options={WITH_DISABLED_OPTIONS} value="" onChange={noop} />);
      const event = pressKeyOn(trigger(), 'ArrowUp');

      expect(event.defaultPrevented).toBe(true);
      expect(optionAt(2).className).toBe('menu__item is-active');
    });

    it('az "ArrowUp" a kiválasztott opcióra áll, ha az engedélyezett', () => {
      renderSelect(<SelectField label="Állapot" options={WITH_DISABLED_OPTIONS} value="draft" onChange={noop} />);
      pressKeyOn(trigger(), 'ArrowUp');

      expect(optionAt(0).className).toBe('menu__item is-active');
    });

    it('letiltott kiválasztott opció esetén a szélső engedélyezettre áll', () => {
      renderSelect(<SelectField label="Állapot" options={WITH_DISABLED_OPTIONS} value="archived" onChange={noop} />);
      pressKeyOn(trigger(), 'ArrowDown');

      expect(optionAt(0).className).toBe('menu__item is-active');
    });

    it('más billentyű nem nyit', () => {
      renderSelect(<SelectField label="Provider" options={PROVIDER_OPTIONS} value="minimax" onChange={noop} />);
      const event = pressKeyOn(trigger(), 'a');

      expect(event.defaultPrevented).toBe(false);
      expect(panel().hidden).toBe(true);
    });
  });

  describe('billentyűzet, nyitott panelen', () => {
    it('az "ArrowDown" a következő engedélyezett opcióra lép, átugorva a letiltottat', () => {
      renderOpen();
      const event = pressKeyOn(trigger(), 'ArrowDown');

      expect(event.defaultPrevented).toBe(true);
      expect(optionAt(2).className).toBe('menu__item is-active');
    });

    it('az "ArrowUp" visszafelé lép, körbeérve', () => {
      renderOpen();
      const event = pressKeyOn(trigger(), 'ArrowUp');

      expect(event.defaultPrevented).toBe(true);
      expect(optionAt(2).className).toBe('menu__item is-active');
    });

    it('a "Home" az elsőre, az "End" az utolsó engedélyezett opcióra ugrik', () => {
      renderOpen();
      pressKeyOn(trigger(), 'End');
      expect(optionAt(2).className).toBe('menu__item is-active');

      pressKeyOn(trigger(), 'Home');
      expect(optionAt(0).className).toBe('menu__item is-active');
    });

    it.each([['Enter'], [' ']])('a(z) "%s" kiválasztja az aktív opciót és zár', (key) => {
      const onChange = vi.fn();
      renderSelect(<SelectField label="Állapot" options={WITH_DISABLED_OPTIONS} value="draft" onChange={onChange} />);
      openPanel();
      pressKeyOn(trigger(), 'ArrowDown');
      const event = pressKeyOn(trigger(), key);

      expect(event.defaultPrevented).toBe(true);
      expect(onChange).toHaveBeenCalledExactlyOnceWith('shipped');
      expect(panel().hidden).toBe(true);
      expect(document.activeElement).toBe(trigger());
    });

    it('az "Escape" zár, és a fókuszt a triggerre állítja vissza', () => {
      renderOpen();
      const event = pressKeyOn(trigger(), 'Escape');

      expect(event.defaultPrevented).toBe(true);
      expect(panel().hidden).toBe(true);
      expect(document.activeElement).toBe(trigger());
    });

    it('a "Tab" zár, de nem nyeli el az eseményt', () => {
      renderOpen();
      const event = pressKeyOn(trigger(), 'Tab');

      expect(event.defaultPrevented).toBe(false);
      expect(panel().hidden).toBe(true);
    });

    it('más billentyű nyitva hagyja a panelt', () => {
      renderOpen();
      const event = pressKeyOn(trigger(), 'a');

      expect(event.defaultPrevented).toBe(false);
      expect(panel().hidden).toBe(false);
    });
  });

  describe('csupa letiltott és üres lista', () => {
    it('csupa letiltott listán nincs aktív opció, és a lépés sem állít be egyet', () => {
      renderSelect(
        <SelectField label="Állapot" options={[{ value: 'a', label: 'A', disabled: true }]} value="" onChange={noop} />,
      );
      openPanel();

      expect(panel().hidden).toBe(false);
      expect(trigger().getAttribute('aria-activedescendant')).toBeNull();

      pressKeyOn(trigger(), 'ArrowDown');
      expect(trigger().getAttribute('aria-activedescendant')).toBeNull();
    });

    it('üres listán az "Enter" nem hív vissza', () => {
      const onChange = vi.fn();
      renderSelect(<SelectField label="Állapot" options={[]} value="" onChange={onChange} />);
      openPanel();
      pressKeyOn(trigger(), 'Enter');

      expect(onChange).not.toHaveBeenCalled();
      expect(optionElements()).toHaveLength(0);
    });
  });

  describe('placeholder és betöltés', () => {
    it('a placeholder a trigger feliratát adja, de nem hoz létre opciót', () => {
      renderSelect(
        <SelectField
          label="Provider"
          options={PROVIDER_OPTIONS}
          placeholder="Nincs megadva"
          value=""
          onChange={noop}
        />,
      );

      expect(triggerLabel()).toBe('Nincs megadva');
      expect(trigger().querySelector(':scope .select__value')?.className).toBe(
        'select__value select__value--placeholder',
      );

      openPanel();
      expect(optionLabels()).toEqual(['Claude előfizetés', 'MiniMax']);
    });

    it('a hívó által megadott üres értékű opció üríthetővé teszi a mezőt', () => {
      const onChange = vi.fn();
      renderSelect(
        <SelectField
          label="Provider"
          options={[{ value: '', label: 'nincs megadva' }, ...PROVIDER_OPTIONS]}
          value="minimax"
          onChange={onChange}
        />,
      );
      openPanel();
      clickOn(optionAt(0));

      expect(onChange).toHaveBeenCalledExactlyOnceWith('');
    });

    it('ismeretlen érték esetén a placeholder felirat áll a triggerben', () => {
      renderSelect(
        <SelectField
          label="Provider"
          options={PROVIDER_OPTIONS}
          placeholder="Nincs megadva"
          value="ismeretlen"
          onChange={noop}
        />,
      );

      expect(triggerLabel()).toBe('Nincs megadva');
    });

    it('placeholder nélküli, nem egyező érték esetén a trigger felirata üres', () => {
      renderSelect(<SelectField label="Provider" options={PROVIDER_OPTIONS} value="ismeretlen" onChange={noop} />);

      expect(triggerLabel()).toBe('');
    });

    it('a betöltő állapot letiltja a mezőt, üríti a listát, és a `loadingLabel` áll a triggerben', () => {
      renderSelect(
        <SelectField
          label="Provider"
          options={PROVIDER_OPTIONS}
          placeholder="Nincs megadva"
          loading
          loadingLabel="betöltés"
          value=""
          onChange={noop}
        />,
      );

      expect(trigger().disabled).toBe(true);
      expect(triggerLabel()).toBe('betöltés');
      expect(optionLabels()).toEqual([]);
    });

    it('a `disabled` prop önmagában is letiltja a triggert', () => {
      renderSelect(
        <SelectField label="Provider" options={PROVIDER_OPTIONS} value="minimax" disabled onChange={noop} />,
      );

      expect(trigger().disabled).toBe(true);
    });
  });

  describe('méret, saját osztály és azonosító', () => {
    it('a `size="sm"` a `.select--sm` módosítót teszi ki, a saját osztály mellé', () => {
      renderSelect(
        <SelectField
          label="Provider"
          size="sm"
          className="sajat"
          options={PROVIDER_OPTIONS}
          value="minimax"
          onChange={noop}
        />,
      );

      expect(trigger().className).toBe('select select--sm sajat');
    });

    it('a megadott `id` a triggerre kerül, és abból származik a panel azonosítója', () => {
      renderSelect(
        <SelectField id="provider" label="Provider" options={PROVIDER_OPTIONS} value="minimax" onChange={noop} />,
      );

      expect(trigger().id).toBe('provider');
      expect(trigger().getAttribute('aria-controls')).toBe('provider-listbox');
      expect(panel().id).toBe('provider-listbox');
      expect(optionElements().map((option) => option.id)).toEqual(['provider-option-0', 'provider-option-1']);
    });
  });

  describe('hibaüzenet', () => {
    it('érintetlen mezőn nincs hibaüzenet és nincs `aria-invalid`', () => {
      renderSelect(
        <SelectField label="Provider" options={PROVIDER_OPTIONS} value="" error="Kötelező mező" onChange={noop} />,
      );

      expect(container.querySelector('.field__error')).toBeNull();
      expect(trigger().getAttribute('aria-invalid')).toBeNull();
      expect(trigger().getAttribute('aria-describedby')).toBeNull();
    });

    it('a mező elhagyása után megjelenik a hibaüzenet, `aria-invalid` és `aria-describedby` kísérettel', () => {
      renderSelect(
        <SelectField
          id="provider"
          label="Provider"
          options={PROVIDER_OPTIONS}
          value=""
          error="Kötelező mező"
          aria-describedby="sugo"
          onChange={noop}
        />,
      );
      act(() => {
        trigger().focus();
        trigger().blur();
      });

      const message = container.querySelector('.field__error');
      expect(message?.textContent).toBe('Kötelező mező');
      expect(message?.getAttribute('role')).toBe('alert');
      expect(message?.id).toBe('provider-error');
      expect(trigger().className).toBe('select select--error');
      expect(trigger().getAttribute('aria-invalid')).toBe('true');
      expect(trigger().getAttribute('aria-describedby')).toBe('sugo provider-error');
    });

    it('megkísérelt beküldés után érintetlenül is látszik a hibaüzenet', () => {
      renderSelect(
        <FieldErrorVisibilityContext value>
          <SelectField label="Provider" options={PROVIDER_OPTIONS} value="" error="Kötelező mező" onChange={noop} />
        </FieldErrorVisibilityContext>,
      );

      expect(container.querySelector('.field__error')?.textContent).toBe('Kötelező mező');
    });
  });
});
