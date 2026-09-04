import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Checkbox } from './Checkbox.tsx';

describe('Checkbox', () => {
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
    const input = container.querySelector<HTMLInputElement>('input');
    if (input === null) {
      throw new Error('a jelölőnégyzet nem található a kirajzolt fán');
    }
    return input;
  }

  function renderedLabel(): HTMLLabelElement {
    const label = container.querySelector<HTMLLabelElement>('label.ctrl');
    if (label === null) {
      throw new Error('a burkoló címke nem található a kirajzolt fán');
    }
    return label;
  }

  it('alapértelmezésben a "ctrl" burkolót és a rejtett natív inputot rajzolja ki', () => {
    act(() => {
      root.render(<Checkbox />);
    });
    expect(renderedLabel().className).toBe('ctrl');
    expect(renderedInput().className).toBe('ctrl__input');
    expect(renderedInput().getAttribute('type')).toBe('checkbox');
    expect(container.querySelector(':scope .ctrl__box svg')).not.toBeNull();
    expect(container.querySelector('.ctrl__text')).toBeNull();
  });

  it('label esetén a .ctrl__text és a .ctrl__label elem kirajzolódik', () => {
    act(() => {
      root.render(<Checkbox label="Értem, hogy a törlés végleges" />);
    });
    expect(container.querySelector('.ctrl__label')?.textContent).toBe('Értem, hogy a törlés végleges');
    expect(renderedLabel().contains(renderedInput())).toBe(true);
  });

  it('a11y: a hozzáférhető nevet a címke span adja, aria-labelledby hivatkozással', () => {
    act(() => {
      root.render(<Checkbox label="Megerősítem" />);
    });
    const labelSpan = container.querySelector('.ctrl__label');
    const labelledBy = renderedInput().getAttribute('aria-labelledby');
    expect(labelledBy).not.toBeNull();
    expect(labelSpan?.id).toBe(labelledBy);
  });

  it('label nélkül nem kerül ki aria-labelledby attribútum', () => {
    act(() => {
      root.render(<Checkbox aria-label="Megerősítés" />);
    });
    expect(renderedInput().getAttribute('aria-labelledby')).toBeNull();
    expect(renderedInput().getAttribute('aria-label')).toBe('Megerősítés');
  });

  it('a hívó saját aria-labelledby értéke erősebb a generáltnál', () => {
    act(() => {
      root.render(<Checkbox label="Megerősítem" aria-labelledby="kulso-cimke" />);
    });
    expect(renderedInput().getAttribute('aria-labelledby')).toBe('kulso-cimke');
  });

  it('a hívó aria-describedby és aria-invalid értéke áttovábbítódik', () => {
    act(() => {
      root.render(<Checkbox label="Megerősítem" aria-describedby="magyarazat" aria-invalid="true" />);
    });
    expect(renderedInput().getAttribute('aria-describedby')).toBe('magyarazat');
    expect(renderedInput().getAttribute('aria-invalid')).toBe('true');
  });

  it('disabled esetén az is-disabled osztály és a natív disabled is megjelenik', () => {
    act(() => {
      root.render(<Checkbox label="Megerősítem" disabled />);
    });
    expect(renderedLabel().className).toBe('ctrl is-disabled');
    expect(renderedInput().disabled).toBe(true);
  });

  it('disabled=false esetén nincs is-disabled osztály', () => {
    act(() => {
      root.render(<Checkbox label="Megerősítem" disabled={false} />);
    });
    expect(renderedLabel().className).toBe('ctrl');
    expect(renderedInput().disabled).toBe(false);
  });

  it('a saját className a design system osztály után kerül ki', () => {
    act(() => {
      root.render(<Checkbox className="sajat" />);
    });
    expect(renderedLabel().className).toBe('ctrl sajat');
  });

  it('kontrollált állapot: a checked prop és az onChange kezelő működik', () => {
    const seen: boolean[] = [];
    act(() => {
      root.render(
        <Checkbox
          label="Megerősítem"
          checked={false}
          onChange={(event) => {
            seen.push(event.target.checked);
          }}
        />,
      );
    });
    expect(renderedInput().checked).toBe(false);

    act(() => {
      renderedInput().click();
    });
    expect(seen).toEqual([true]);

    act(() => {
      root.render(<Checkbox label="Megerősítem" checked readOnly />);
    });
    expect(renderedInput().checked).toBe(true);
  });
});
