import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TextField } from './TextField.tsx';

describe('TextField', () => {
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
      throw new Error('a beviteli mező nem található a kirajzolt fán');
    }
    return input;
  }

  function renderedLabel(): HTMLLabelElement {
    const label = container.querySelector<HTMLLabelElement>('label.field');
    if (label === null) {
      throw new Error('a mező burkoló címkéje nem található a kirajzolt fán');
    }
    return label;
  }

  it('alapértelmezésben a "field" és az "input" osztálylistát rajzolja ki', () => {
    act(() => {
      root.render(<TextField />);
    });
    expect(renderedLabel().className).toBe('field');
    expect(renderedInput().className).toBe('input');
    expect(container.querySelector('.field__label')).toBeNull();
    expect(container.querySelector('.field__error')).toBeNull();
    expect(container.querySelector('.input-with-icon')).toBeNull();
  });

  it('a label a .field__label elembe kerül, és a címke körbeveszi a mezőt', () => {
    act(() => {
      root.render(<TextField label="Név" />);
    });
    expect(container.querySelector('.field__label')?.textContent).toBe('Név');
    expect(renderedLabel().contains(renderedInput())).toBe(true);
  });

  it('címke azonosító nélkül a mező useId generálta, nem üres azonosítót kap', () => {
    act(() => {
      root.render(<TextField label="Név" />);
    });
    expect(renderedInput().id.length).toBeGreaterThan(0);
  });

  it('a hívó saját id értéke felülírja a generáltat', () => {
    act(() => {
      root.render(<TextField id="workflow-nev" />);
    });
    expect(renderedInput().id).toBe('workflow-nev');
  });

  it('error esetén hibás állapot: input--error, aria-invalid és a hibaüzenet eleme', () => {
    act(() => {
      root.render(<TextField id="nev" error="Kötelező mező" />);
    });
    expect(renderedInput().className).toBe('input input--error');
    expect(renderedInput().getAttribute('aria-invalid')).toBe('true');
    expect(renderedInput().getAttribute('aria-describedby')).toBe('nev-error');
    const errorElement = container.querySelector('.field__error');
    expect(errorElement?.textContent).toBe('Kötelező mező');
    expect(errorElement?.id).toBe('nev-error');
  });

  it('hiba nélkül a hívó aria-invalid értéke változatlanul megy át', () => {
    act(() => {
      root.render(<TextField aria-invalid="true" />);
    });
    expect(renderedInput().getAttribute('aria-invalid')).toBe('true');
  });

  it('hiba és hívói aria-invalid együtt: a komponens hibája erősebb', () => {
    act(() => {
      root.render(<TextField aria-invalid={false} error="Hibás" />);
    });
    expect(renderedInput().getAttribute('aria-invalid')).toBe('true');
  });

  it('aria-describedby nélkül, hiba nélkül nem kerül ki attribútum', () => {
    act(() => {
      root.render(<TextField />);
    });
    expect(renderedInput().getAttribute('aria-describedby')).toBeNull();
  });

  it('a hívó aria-describedby értéke hiba nélkül változatlanul megy át', () => {
    act(() => {
      root.render(<TextField aria-describedby="sugo" />);
    });
    expect(renderedInput().getAttribute('aria-describedby')).toBe('sugo');
  });

  it('a hívó aria-describedby értéke és a hibaüzenet azonosítója összefűződik', () => {
    act(() => {
      root.render(<TextField id="nev" aria-describedby="sugo" error="Hibás" />);
    });
    expect(renderedInput().getAttribute('aria-describedby')).toBe('sugo nev-error');
  });

  it('a hibaüzenet azonosítója nem duplázódik, ha a hívó már hivatkozott rá', () => {
    act(() => {
      root.render(<TextField id="nev" aria-describedby="nev-error sugo" error="Hibás" />);
    });
    expect(renderedInput().getAttribute('aria-describedby')).toBe('nev-error sugo');
  });

  it('icon jelenlétében a mező .input-with-icon burkolót kap', () => {
    act(() => {
      root.render(<TextField icon={<span className="ikon" />} />);
    });
    const wrapper = container.querySelector('.input-with-icon');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.querySelector('input')).not.toBeNull();
    expect(wrapper?.querySelector('.ikon')).not.toBeNull();
  });

  it('a className a burkoló címkére, az inputClassName az input elemre kerül', () => {
    act(() => {
      root.render(<TextField className="sajat-mezo" inputClassName="sajat-input" />);
    });
    expect(renderedLabel().className).toBe('field sajat-mezo');
    expect(renderedInput().className).toBe('input sajat-input');
  });

  it('a natív input attribútumok (type, placeholder, disabled) áttovábbítódnak', () => {
    act(() => {
      root.render(<TextField type="email" placeholder="valaki@example.com" disabled />);
    });
    expect(renderedInput().getAttribute('type')).toBe('email');
    expect(renderedInput().getAttribute('placeholder')).toBe('valaki@example.com');
    expect(renderedInput().disabled).toBe(true);
  });
});
