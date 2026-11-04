import { FieldErrorVisibilityContext } from '@easter-workflow-builder/ui';
import { act, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StartInputOptionsField } from './StartInputOptionsField.tsx';

function typeIntoTextArea(element: HTMLTextAreaElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

interface HostProperties {
  readonly initial: readonly string[];
  readonly onOptions: (options: readonly string[]) => void;
}

/**
 * A szerkesztő valódi szülőjét utánozza: a kapott `options` a szülő állapota,
 * amit a mező `onChange` hívása ír (a `StartNodeFields` `config` állapota).
 */
function Host(properties: Readonly<HostProperties>): ReactElement {
  const [options, setOptions] = useState<readonly string[]>(properties.initial);
  return (
    <FieldErrorVisibilityContext.Provider value>
      <StartInputOptionsField
        options={options}
        error={undefined}
        onChange={(next) => {
          properties.onOptions(next);
          setOptions(next);
        }}
      />
    </FieldErrorVisibilityContext.Provider>
  );
}

describe('StartInputOptionsField', () => {
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

  function textArea(): HTMLTextAreaElement {
    const element = container.querySelector('textarea');
    if (element === null) {
      throw new Error('a teszt nem találta az opciók mezőt');
    }
    return element;
  }

  function renderOptions(options: readonly string[]): void {
    act(() => {
      root.render(
        <FieldErrorVisibilityContext.Provider value>
          <StartInputOptionsField options={options} error={undefined} onChange={vi.fn()} />
        </FieldErrorVisibilityContext.Provider>,
      );
    });
  }

  it('a kapott opciókat soronként mutatja', () => {
    act(() => {
      root.render(<Host initial={['piros', 'zöld']} onOptions={vi.fn()} />);
    });
    expect(textArea().value).toBe('piros\nzöld');
    expect(container.querySelector('.field__label')?.textContent).toBe('Opciók (soronként egy)');
  });

  it('gépelés közben az Enter és a sor végi szóköz megmarad, a config felé bontott lista megy', () => {
    const onOptions = vi.fn<(options: readonly string[]) => void>();
    act(() => {
      root.render(<Host initial={[]} onOptions={onOptions} />);
    });

    for (const partial of ['piros', 'piros\n', 'piros\nsötét ', 'piros\nsötét kék']) {
      act(() => {
        typeIntoTextArea(textArea(), partial);
      });
      expect(textArea().value).toBe(partial);
    }
    expect(onOptions).toHaveBeenLastCalledWith(['piros', 'sötét kék']);
  });

  it('a hibaüzenet a mező alatt áll', () => {
    act(() => {
      root.render(
        <FieldErrorVisibilityContext.Provider value>
          <StartInputOptionsField options={[]} error="Legalább egy opció kell." onChange={vi.fn()} />
        </FieldErrorVisibilityContext.Provider>,
      );
    });
    expect(container.querySelector('.field__error')?.textContent).toContain('Legalább egy opció kell.');
  });

  describe('kívülről jövő változás', () => {
    it('a más tartalmú lista (visszavonás, másik csomópont) felülírja a helyi szöveget', () => {
      renderOptions(['piros']);
      act(() => {
        typeIntoTextArea(textArea(), 'piros\n');
      });
      expect(textArea().value).toBe('piros\n');

      renderOptions(['kék', 'zöld']);
      expect(textArea().value).toBe('kék\nzöld');
    });

    it('az ugyanazt jelentő lista nem írja felül a gépelés alatt álló szöveget', () => {
      renderOptions(['piros']);
      act(() => {
        typeIntoTextArea(textArea(), 'piros\n');
      });

      renderOptions(['piros']);
      expect(textArea().value).toBe('piros\n');
    });
  });
});
