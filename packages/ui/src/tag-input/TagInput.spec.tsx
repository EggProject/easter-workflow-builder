import { act, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TagInput, type TagInputLabels, type TagInputTone } from './TagInput.tsx';

/**
 * A React a `value` elemet saját beállítójával követi, ezért a gépelést a
 * natív beállítón át kell szimulálni, különben az `onChange` nem fut.
 */
function typeInto(input: HTMLInputElement, text: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  act(() => {
    descriptor?.set?.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function pressKey(input: HTMLInputElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  act(() => {
    input.dispatchEvent(event);
  });
  return event;
}

function Controlled(properties: {
  readonly initial: readonly string[];
  readonly spy: (value: readonly string[]) => void;
}): ReactElement {
  const [value, setValue] = useState(properties.initial);
  return (
    <TagInput
      value={value}
      onChange={(next) => {
        properties.spy(next);
        setValue(next);
      }}
    />
  );
}

describe('TagInput', () => {
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

  function renderedInput(): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>('input.tagi__input');
    if (input === null) {
      throw new Error('a beviteli mező nem található a kirajzolt fán');
    }
    return input;
  }

  function tagTexts(): readonly string[] {
    return [...container.querySelectorAll('.tagi__tag-text')].map((tag) => tag.textContent);
  }

  function announcement(): string {
    return container.querySelector('.tagi__status')?.textContent ?? '';
  }

  describe('kirajzolás', () => {
    it('címke nélkül a forrás helykitöltőjével, "Tags" névvel, kék tónushoz tartozó osztály nélküli burkolóval', () => {
      act(() => {
        root.render(<TagInput />);
      });
      expect(container.firstElementChild?.className).toBe('tagi');
      expect(renderedInput().placeholder).toBe('Add a tag…');
      expect(renderedInput().getAttribute('aria-label')).toBe('Tags');
      expect(container.querySelector('.tagi__tag')).toBeNull();
      const status = container.querySelector('.tagi__status');
      expect(status?.getAttribute('role')).toBe('status');
      expect(status?.getAttribute('aria-live')).toBe('polite');
    });

    it('a hívó osztálya a burkolóra kerül', () => {
      act(() => {
        root.render(<TagInput className="extra" />);
      });
      expect(container.firstElementChild?.className).toBe('tagi extra');
    });

    it('a placeholder és az ariaLabel felülírható, az üres ariaLabel "Tags"-ra esik vissza', () => {
      act(() => {
        root.render(<TagInput placeholder="Új argumentum" ariaLabel="Argumentumok" />);
      });
      expect(renderedInput().placeholder).toBe('Új argumentum');
      expect(renderedInput().getAttribute('aria-label')).toBe('Argumentumok');
      act(() => {
        root.render(<TagInput ariaLabel="" />);
      });
      expect(renderedInput().getAttribute('aria-label')).toBe('Tags');
    });

    it('címkékkel a helykitöltő üres, minden címke tónus osztályt és eltávolító gombot kap', () => {
      act(() => {
        root.render(<TagInput value={['a', 'b']} />);
      });
      expect(renderedInput().placeholder).toBe('');
      expect(tagTexts()).toEqual(['a', 'b']);
      const buttons = [...container.querySelectorAll<HTMLButtonElement>('button.tagi__tag-x')];
      expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['Remove a', 'Remove b']);
      expect(buttons[0]?.type).toBe('button');
    });

    const tones: readonly TagInputTone[] = ['blue', 'ink', 'yolk', 'paper'];
    it.each(tones)('a tone="%s" a hozzá tartozó címke osztályt adja', (tone) => {
      act(() => {
        root.render(<TagInput value={['a']} tone={tone} />);
      });
      expect(container.querySelector('.tagi__tag')?.className).toBe(`tagi__tag tagi__tag--${tone}`);
    });

    it('a burkolóra kattintás a beviteli mezőre fókuszál', () => {
      act(() => {
        root.render(<TagInput value={['a']} />);
      });
      act(() => {
        container.querySelector<HTMLElement>('.tagi__tag-text')?.click();
      });
      expect(document.activeElement).toBe(renderedInput());
    });
  });

  describe('hozzáadás', () => {
    it('az Enter lezárja a címkét, törli a vázlatot és bejelenti a hozzáadást', () => {
      const spy = vi.fn();
      act(() => {
        root.render(<Controlled initial={['a']} spy={spy} />);
      });
      typeInto(renderedInput(), '  b  ');
      const event = pressKey(renderedInput(), 'Enter');
      expect(event.defaultPrevented).toBe(true);
      expect(spy).toHaveBeenCalledExactlyOnceWith(['a', 'b']);
      expect(tagTexts()).toEqual(['a', 'b']);
      expect(renderedInput().value).toBe('');
      expect(announcement()).toBe('Added b');
    });

    it('a vessző is lezár, a záró vesszőt a címke nem tartalmazza', () => {
      const spy = vi.fn();
      act(() => {
        root.render(<Controlled initial={[]} spy={spy} />);
      });
      typeInto(renderedInput(), 'x,');
      pressKey(renderedInput(), ',');
      expect(spy).toHaveBeenCalledExactlyOnceWith(['x']);
    });

    it('a saját separators lista dönt: ami nincs rajta, nem zár le', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(<TagInput onChange={onChange} separators={[';']} />);
      });
      typeInto(renderedInput(), 'x');
      expect(pressKey(renderedInput(), 'Enter').defaultPrevented).toBe(false);
      expect(pressKey(renderedInput(), ',').defaultPrevented).toBe(false);
      expect(onChange).not.toHaveBeenCalled();
      expect(pressKey(renderedInput(), ';').defaultPrevented).toBe(true);
      expect(onChange).toHaveBeenCalledExactlyOnceWith(['x']);
    });

    it('a fókusz elvesztése is lezárja a vázlatot', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(<TagInput onChange={onChange} />);
      });
      typeInto(renderedInput(), 'y');
      act(() => {
        renderedInput().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
      });
      expect(onChange).toHaveBeenCalledExactlyOnceWith(['y']);
    });

    it('az üres vagy csak szóközös vázlat nem ad címkét és nem jelent be semmit', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(<TagInput onChange={onChange} />);
      });
      pressKey(renderedInput(), 'Enter');
      typeInto(renderedInput(), ' '.repeat(3));
      pressKey(renderedInput(), 'Enter');
      expect(onChange).not.toHaveBeenCalled();
      expect(announcement()).toBe('');
    });

    it('a már meglévő címke nem kerül be újra, a vázlat viszont törlődik, bejelentés nélkül', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(<TagInput value={['a']} onChange={onChange} />);
      });
      typeInto(renderedInput(), 'a');
      pressKey(renderedInput(), 'Enter');
      expect(onChange).not.toHaveBeenCalled();
      expect(renderedInput().value).toBe('');
      expect(announcement()).toBe('');
    });

    it('onChange nélkül a hozzáadás és az eltávolítás nem dob hibát', () => {
      act(() => {
        root.render(<TagInput value={['a']} />);
      });
      typeInto(renderedInput(), 'b');
      pressKey(renderedInput(), 'Enter');
      act(() => {
        container.querySelector<HTMLButtonElement>('button.tagi__tag-x')?.click();
      });
      expect(announcement()).toBe('Removed a');
    });
  });

  describe('eltávolítás', () => {
    it('az x gomb a saját címkét távolítja el és bejelenti, a burkoló fókusza nem változik', () => {
      const spy = vi.fn();
      act(() => {
        root.render(<Controlled initial={['a', 'b', 'c']} spy={spy} />);
      });
      act(() => {
        container.querySelectorAll<HTMLButtonElement>('button.tagi__tag-x')[1]?.click();
      });
      expect(spy).toHaveBeenCalledExactlyOnceWith(['a', 'c']);
      expect(tagTexts()).toEqual(['a', 'c']);
      expect(announcement()).toBe('Removed b');
      expect(document.activeElement).not.toBe(renderedInput());
    });

    it('üres vázlatnál a Backspace az utolsó címkét távolítja el', () => {
      const spy = vi.fn();
      act(() => {
        root.render(<Controlled initial={['a', 'b']} spy={spy} />);
      });
      pressKey(renderedInput(), 'Backspace');
      expect(spy).toHaveBeenCalledExactlyOnceWith(['a']);
      expect(announcement()).toBe('Removed b');
    });

    it('nem üres vázlatnál a Backspace nem töröl címkét', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(<TagInput value={['a']} onChange={onChange} />);
      });
      typeInto(renderedInput(), 'x');
      pressKey(renderedInput(), 'Backspace');
      expect(onChange).not.toHaveBeenCalled();
    });

    it('címke nélkül a Backspace nem csinál semmit', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(<TagInput onChange={onChange} />);
      });
      pressKey(renderedInput(), 'Backspace');
      expect(onChange).not.toHaveBeenCalled();
    });

    it('más billentyű nem csinál semmit', () => {
      const onChange = vi.fn();
      act(() => {
        root.render(<TagInput value={['a']} onChange={onChange} />);
      });
      expect(pressKey(renderedInput(), 'a').defaultPrevented).toBe(false);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  it('az aria-describedby és az aria-invalid a beágyazott mezőre kerül, megadás nélkül egyik sincs', () => {
    act(() => {
      root.render(<TagInput />);
    });
    expect(renderedInput().hasAttribute('aria-describedby')).toBe(false);
    expect(renderedInput().hasAttribute('aria-invalid')).toBe(false);

    act(() => {
      root.render(<TagInput aria-describedby="cimke-hiba" aria-invalid />);
    });
    expect(renderedInput().getAttribute('aria-describedby')).toBe('cimke-hiba');
    expect(renderedInput().getAttribute('aria-invalid')).toBe('true');
  });

  it('a labels a saját mondatokat adja', () => {
    const labels: TagInputLabels = {
      added: (tag) => `Hozzáadva: ${tag}`,
      removed: (tag) => `Eltávolítva: ${tag}`,
      remove: (tag) => `Eltávolítás: ${tag}`,
    };
    act(() => {
      root.render(<TagInput value={['a']} labels={labels} />);
    });
    expect(container.querySelector('button.tagi__tag-x')?.getAttribute('aria-label')).toBe('Eltávolítás: a');
    act(() => {
      container.querySelector<HTMLButtonElement>('button.tagi__tag-x')?.click();
    });
    expect(announcement()).toBe('Eltávolítva: a');
    typeInto(renderedInput(), 'b');
    pressKey(renderedInput(), 'Enter');
    expect(announcement()).toBe('Hozzáadva: b');
  });
});
