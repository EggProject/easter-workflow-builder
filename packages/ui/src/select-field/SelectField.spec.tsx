import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SelectField, type SelectFieldOption } from './SelectField.tsx';

const PROVIDER_OPTIONS: readonly SelectFieldOption[] = [
  { value: 'claude-subscription', label: 'Claude előfizetés' },
  { value: 'minimax', label: 'MiniMax' },
];

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

  function renderedSelect(): HTMLSelectElement {
    const select = container.querySelector<HTMLSelectElement>('select');
    if (select === null) {
      throw new Error('a választó nem található a kirajzolt fán');
    }
    return select;
  }

  function renderedOptionLabels(): readonly string[] {
    return [...container.querySelectorAll('option')].map((option) => option.textContent);
  }

  it('alapértelmezésben a "select" osztályt viseli, és minden opciót kirajzol', () => {
    act(() => {
      root.render(<SelectField options={PROVIDER_OPTIONS} />);
    });
    expect(renderedSelect().className).toBe('select');
    expect(renderedOptionLabels()).toEqual(['Claude előfizetés', 'MiniMax']);
    expect(renderedSelect().disabled).toBe(false);
  });

  it('md méretre nem tesz hozzá méret módosítót, sm méretre igen', () => {
    act(() => {
      root.render(<SelectField options={PROVIDER_OPTIONS} size="md" />);
    });
    expect(renderedSelect().className).toBe('select');

    act(() => {
      root.render(<SelectField options={PROVIDER_OPTIONS} size="sm" />);
    });
    expect(renderedSelect().className).toBe('select select--sm');
  });

  it('a placeholder üres értékű első opcióként jelenik meg', () => {
    act(() => {
      root.render(<SelectField options={PROVIDER_OPTIONS} placeholder="Válassz providert" />);
    });
    expect(renderedOptionLabels()).toEqual(['Válassz providert', 'Claude előfizetés', 'MiniMax']);
    expect(container.querySelector('option')?.getAttribute('value')).toBe('');
  });

  it('letiltott állapot: a natív disabled attribútum áttovábbítódik', () => {
    act(() => {
      root.render(<SelectField options={PROVIDER_OPTIONS} disabled />);
    });
    expect(renderedSelect().disabled).toBe(true);
  });

  it('betöltő állapot: letiltva, üres listával, a loadingLabel felirattal', () => {
    act(() => {
      root.render(<SelectField options={PROVIDER_OPTIONS} loading loadingLabel="betöltés" />);
    });
    expect(renderedSelect().disabled).toBe(true);
    expect(renderedOptionLabels()).toEqual(['betöltés']);
  });

  it('betöltő állapotban a placeholder helyére a loadingLabel lép', () => {
    act(() => {
      root.render(
        <SelectField options={PROVIDER_OPTIONS} placeholder="Válassz providert" loading loadingLabel="betöltés" />,
      );
    });
    expect(renderedOptionLabels()).toEqual(['betöltés']);
  });

  it('betöltő állapot loadingLabel nélkül üres listát ad, letiltva', () => {
    act(() => {
      root.render(<SelectField options={PROVIDER_OPTIONS} loading />);
    });
    expect(renderedSelect().disabled).toBe(true);
    expect(renderedOptionLabels()).toEqual([]);
  });

  it('a loading=false állapot nem tiltja le a mezőt', () => {
    act(() => {
      root.render(<SelectField options={PROVIDER_OPTIONS} loading={false} />);
    });
    expect(renderedSelect().disabled).toBe(false);
    expect(renderedOptionLabels()).toEqual(['Claude előfizetés', 'MiniMax']);
  });

  it('az opció saját disabled jelzése kikerül az option elemre', () => {
    act(() => {
      root.render(
        <SelectField
          options={[
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B', disabled: true },
          ]}
        />,
      );
    });
    const options = [...container.querySelectorAll('option')];
    expect(options.map((option) => option.disabled)).toEqual([false, true]);
  });

  it('a11y: a külső címke a for attribútummal kötődik, és az aria attribútumok átmennek', () => {
    act(() => {
      root.render(
        <>
          <label htmlFor="provider">Provider</label>
          <SelectField id="provider" options={PROVIDER_OPTIONS} aria-describedby="provider-sugo" aria-invalid="true" />
        </>,
      );
    });
    expect(renderedSelect().id).toBe('provider');
    expect(container.querySelector('label')?.getAttribute('for')).toBe('provider');
    expect(renderedSelect().getAttribute('aria-describedby')).toBe('provider-sugo');
    expect(renderedSelect().getAttribute('aria-invalid')).toBe('true');
  });

  it('a saját className a design system osztály után kerül ki', () => {
    act(() => {
      root.render(<SelectField options={PROVIDER_OPTIONS} className="sajat" />);
    });
    expect(renderedSelect().className).toBe('select sajat');
  });

  it('label nélkül és hiba nélkül csupasz select elemet ad, .field burkoló nélkül', () => {
    act(() => {
      root.render(<SelectField options={PROVIDER_OPTIONS} />);
    });
    expect(container.querySelector('.field')).toBeNull();
    expect(container.firstElementChild?.tagName).toBe('SELECT');
  });

  it('label megadásakor a .field burkolóba kerül, a címkével implicit összekötve', () => {
    act(() => {
      root.render(<SelectField options={PROVIDER_OPTIONS} label="Provider" />);
    });
    const field = container.querySelector('label.field');
    expect(field).not.toBeNull();
    expect(field?.querySelector('.field__label')?.textContent).toBe('Provider');
    expect(field?.querySelector('select')).not.toBeNull();
    expect(container.querySelector('.field__error')).toBeNull();
    expect(renderedSelect().getAttribute('aria-invalid')).toBeNull();
  });

  it('hiba esetén a mező alatt jelenik meg az üzenet, aria-describedby és aria-invalid kötéssel', () => {
    act(() => {
      root.render(<SelectField options={PROVIDER_OPTIONS} label="Provider" error="Kötelező mező" />);
    });
    const errorElement = container.querySelector('.field__error');
    expect(errorElement?.textContent).toBe('Kötelező mező');
    expect(renderedSelect().className).toBe('select select--error');
    expect(renderedSelect().getAttribute('aria-invalid')).toBe('true');
    expect(renderedSelect().getAttribute('aria-describedby')).toBe(errorElement?.id);
  });

  it('hiba önmagában, label nélkül is a .field burkolót hozza', () => {
    act(() => {
      root.render(<SelectField options={PROVIDER_OPTIONS} error="Érvénytelen" />);
    });
    expect(container.querySelector('label.field')).not.toBeNull();
    expect(container.querySelector('.field__label')).toBeNull();
    expect(container.querySelector('.field__error')?.textContent).toBe('Érvénytelen');
  });

  it('hiba esetén a hívó saját aria-describedby értéke megmarad a hiba azonosítója mellett', () => {
    act(() => {
      root.render(
        <SelectField id="provider" options={PROVIDER_OPTIONS} aria-describedby="provider-sugo" error="Érvénytelen" />,
      );
    });
    expect(renderedSelect().getAttribute('aria-describedby')).toBe('provider-sugo provider-error');
  });

  it('a kiválasztott érték és a változás kezelő működik', () => {
    const seen: string[] = [];
    act(() => {
      root.render(
        <SelectField
          options={PROVIDER_OPTIONS}
          value="minimax"
          onChange={(event) => {
            seen.push(event.target.value);
          }}
        />,
      );
    });
    expect(renderedSelect().value).toBe('minimax');

    act(() => {
      renderedSelect().value = 'claude-subscription';
      renderedSelect().dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(seen).toEqual(['claude-subscription']);
  });
});
