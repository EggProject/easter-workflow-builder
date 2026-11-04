import { FieldErrorVisibilityContext } from '@easter-workflow-builder/ui';
import { act, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LineListTextAreaField } from './LineListTextAreaField.tsx';
import { fromNumberListFieldValue, toNumberListFieldValue } from './number-list-field-value.ts';
import { fromStringListFieldValue, toStringListFieldValue } from './string-list-field-value.ts';
import { fromStringRecordFieldValue, toStringRecordFieldValue } from './string-record-field-value.ts';

function typeIntoTextArea(element: HTMLTextAreaElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

interface HostProperties<T> {
  readonly initial: T;
  readonly toText: (value: T) => string;
  readonly fromText: (text: string) => T;
  readonly onValue: (value: T) => void;
}

/**
 * A szerkesztő valódi szülőjét utánozza: a kapott `value` a szülő állapota,
 * amit a mező `onChange` hívása ír (a csomópont `config` állapota).
 */
function Host<T>(properties: Readonly<HostProperties<T>>): ReactElement {
  const [value, setValue] = useState<T>(properties.initial);
  return (
    <FieldErrorVisibilityContext.Provider value>
      <LineListTextAreaField
        label="Lista (soronként egy)"
        value={value}
        toText={properties.toText}
        fromText={properties.fromText}
        onChange={(next) => {
          properties.onValue(next);
          setValue(next);
        }}
      />
    </FieldErrorVisibilityContext.Provider>
  );
}

describe('LineListTextAreaField', () => {
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
      throw new Error('a teszt nem találta a lista mezőt');
    }
    return element;
  }

  function renderStringList(value: readonly string[]): void {
    act(() => {
      root.render(
        <FieldErrorVisibilityContext.Provider value>
          <LineListTextAreaField
            label="Opciók (soronként egy)"
            value={value}
            toText={toStringListFieldValue}
            fromText={fromStringListFieldValue}
            onChange={vi.fn()}
          />
        </FieldErrorVisibilityContext.Provider>,
      );
    });
  }

  /**
   * Részszövegenként gépel, és minden lépés után a mező a begépelt szöveget mutatja.
   */
  function expectTypingKept(partials: readonly string[]): void {
    for (const partial of partials) {
      act(() => {
        typeIntoTextArea(textArea(), partial);
      });
      expect(textArea().value).toBe(partial);
    }
  }

  it('a kapott értéket soronként mutatja a megadott címkével', () => {
    act(() => {
      root.render(
        <Host
          initial={['piros', 'zöld']}
          toText={toStringListFieldValue}
          fromText={fromStringListFieldValue}
          onValue={vi.fn()}
        />,
      );
    });
    expect(textArea().value).toBe('piros\nzöld');
    expect(container.querySelector('.field__label')?.textContent).toBe('Lista (soronként egy)');
  });

  it('szöveg lista: gépelés közben az Enter és a sor végi szóköz megmarad, a config felé bontott lista megy', () => {
    const onValue = vi.fn<(value: readonly string[]) => void>();
    act(() => {
      root.render(
        <Host initial={[]} toText={toStringListFieldValue} fromText={fromStringListFieldValue} onValue={onValue} />,
      );
    });

    expectTypingKept(['piros', 'piros\n', 'piros\nsötét ', 'piros\nsötét kék']);
    expect(onValue).toHaveBeenLastCalledWith(['piros', 'sötét kék']);
  });

  it('szám lista: az Enter megmarad, a config felé számok mennek', () => {
    const onValue = vi.fn<(value: readonly number[]) => void>();
    act(() => {
      root.render(
        <Host initial={[]} toText={toNumberListFieldValue} fromText={fromNumberListFieldValue} onValue={onValue} />,
      );
    });

    expectTypingKept(['1000', '1000\n', '1000\n2000']);
    expect(onValue).toHaveBeenLastCalledWith([1000, 2000]);
  });

  it('kulcs=érték leképezés: a befejezetlen sor és az Enter megmarad, a config felé a teljes sorok mennek', () => {
    const onValue = vi.fn<(value: Readonly<Record<string, string>>) => void>();
    act(() => {
      root.render(
        <Host initial={{}} toText={toStringRecordFieldValue} fromText={fromStringRecordFieldValue} onValue={onValue} />,
      );
    });

    expectTypingKept(['t', 'topic', 'topic=', 'topic=hír', 'topic=hír\n', 'topic=hír\nnyelv=hu']);
    expect(onValue).toHaveBeenLastCalledWith({ topic: 'hír', nyelv: 'hu' });
  });

  it('a hibaüzenet a mező alatt áll', () => {
    act(() => {
      root.render(
        <FieldErrorVisibilityContext.Provider value>
          <LineListTextAreaField
            label="Opciók (soronként egy)"
            value={[]}
            toText={toStringListFieldValue}
            fromText={fromStringListFieldValue}
            error="Legalább egy opció kell."
            onChange={vi.fn()}
          />
        </FieldErrorVisibilityContext.Provider>,
      );
    });
    expect(container.querySelector('.field__error')?.textContent).toContain('Legalább egy opció kell.');
  });

  describe('kívülről jövő változás', () => {
    it('a más tartalmú érték (visszavonás, másik csomópont) felülírja a helyi szöveget', () => {
      renderStringList(['piros']);
      act(() => {
        typeIntoTextArea(textArea(), 'piros\n');
      });
      expect(textArea().value).toBe('piros\n');

      renderStringList(['kék', 'zöld']);
      expect(textArea().value).toBe('kék\nzöld');
    });

    it('az ugyanazt jelentő érték nem írja felül a gépelés alatt álló szöveget', () => {
      renderStringList(['piros']);
      act(() => {
        typeIntoTextArea(textArea(), 'piros\n');
      });

      renderStringList(['piros']);
      expect(textArea().value).toBe('piros\n');
    });
  });
});
