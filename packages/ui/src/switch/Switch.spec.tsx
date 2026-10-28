import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Switch } from './Switch.tsx';

const ignoreChange = (): void => undefined;

describe('Switch', () => {
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
      throw new Error('a kapcsoló nem található a kirajzolt fán');
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

  function renderedTrack(): HTMLSpanElement {
    const track = container.querySelector<HTMLSpanElement>('span.ctrl__switch');
    if (track === null) {
      throw new Error('a kapcsoló sávja nem található a kirajzolt fán');
    }
    return track;
  }

  it('alapértelmezésben role="switch", kikapcsolt, md méretű, szöveg nélküli kapcsoló', () => {
    act(() => {
      root.render(<Switch onChange={ignoreChange} />);
    });
    expect(renderedLabel().className).toBe('ctrl');
    expect(renderedInput().className).toBe('ctrl__input');
    expect(renderedInput().getAttribute('type')).toBe('checkbox');
    expect(renderedInput().getAttribute('role')).toBe('switch');
    expect(renderedInput().checked).toBe(false);
    expect(renderedTrack().className).toBe('ctrl__switch');
    expect(container.querySelector('.ctrl__text')).toBeNull();
    expect(renderedInput().hasAttribute('aria-labelledby')).toBe(false);
    expect(renderedInput().hasAttribute('aria-describedby')).toBe(false);
  });

  it('a checked={true} bekapcsolt állapotot ad', () => {
    act(() => {
      root.render(<Switch checked onChange={vi.fn()} />);
    });
    expect(renderedInput().checked).toBe(true);
  });

  it('az onChange a kattintásra lefut', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<Switch checked={false} onChange={onChange} />);
    });
    act(() => {
      renderedInput().click();
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('a size="sm" a kis sáv osztályt adja', () => {
    act(() => {
      root.render(<Switch onChange={ignoreChange} size="sm" />);
    });
    expect(renderedTrack().className).toBe('ctrl__switch ctrl__switch--sm');
  });

  it('a disabled az is-disabled osztályt és a natív disabled attribútumot adja, a hívó osztálya a végére kerül', () => {
    act(() => {
      root.render(<Switch onChange={ignoreChange} disabled className="extra" />);
    });
    expect(renderedLabel().className).toBe('ctrl is-disabled extra');
    expect(renderedInput().disabled).toBe(true);
  });

  it('a hozzáférhető nevet a címke span adja, a hint nem kerül a névbe, hanem leírás', () => {
    act(() => {
      root.render(<Switch onChange={ignoreChange} label="Delta mentés" hint="Csak az új futásokra hat" />);
    });
    const labelSpan = container.querySelector('.ctrl__label');
    const hintSpan = container.querySelector('.ctrl__hint');
    expect(labelSpan?.textContent).toBe('Delta mentés');
    expect(hintSpan?.textContent).toBe('Csak az új futásokra hat');
    expect(renderedInput().getAttribute('aria-labelledby')).toBe(labelSpan?.id);
    expect(renderedInput().getAttribute('aria-describedby')).toBe(hintSpan?.id);
    expect(labelSpan?.id).not.toBe(hintSpan?.id);
  });

  it('csak címkénél nincs hint elem és nincs aria-describedby', () => {
    act(() => {
      root.render(<Switch onChange={ignoreChange} label="Delta mentés" />);
    });
    expect(container.querySelector('.ctrl__label')).not.toBeNull();
    expect(container.querySelector('.ctrl__hint')).toBeNull();
    expect(renderedInput().hasAttribute('aria-describedby')).toBe(false);
  });

  it('csak hintnél nincs címke elem és nincs aria-labelledby, de a szöveg doboz megvan', () => {
    act(() => {
      root.render(<Switch onChange={ignoreChange} hint="Csak az új futásokra hat" />);
    });
    expect(container.querySelector('.ctrl__text')).not.toBeNull();
    expect(container.querySelector('.ctrl__label')).toBeNull();
    expect(renderedInput().hasAttribute('aria-labelledby')).toBe(false);
  });

  it('az üres címke és az üres hint nem rajzol szöveg dobozt', () => {
    act(() => {
      root.render(<Switch onChange={ignoreChange} label="" hint="" />);
    });
    expect(container.querySelector('.ctrl__text')).toBeNull();
  });

  it('a hívó aria-labelledby és aria-describedby értéke megmarad, az utóbbihoz a hint azonosító fűződik', () => {
    act(() => {
      root.render(
        <Switch onChange={ignoreChange} label="Delta" hint="Súgó" aria-labelledby="kulso" aria-describedby="masik" />,
      );
    });
    expect(renderedInput().getAttribute('aria-labelledby')).toBe('kulso');
    const hintId = container.querySelector('.ctrl__hint')?.id ?? '';
    expect(renderedInput().getAttribute('aria-describedby')).toBe(`masik ${hintId}`);
  });

  it('az aria-label és a többi natív attribútum a bemenetre kerül', () => {
    act(() => {
      root.render(<Switch onChange={ignoreChange} aria-label="Delta mentés" name="deltas" />);
    });
    expect(renderedInput().getAttribute('aria-label')).toBe('Delta mentés');
    expect(renderedInput().getAttribute('name')).toBe('deltas');
  });
});
