import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestState } from '../request-state/request-state.ts';
import { ServerEnvironmentNameSelect } from './ServerEnvironmentNameSelect.tsx';

function clickOn(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  });
}

function trigger(container: HTMLElement): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>('button[role="combobox"]');
  if (found === null) {
    throw new Error('a teszt nem talált select triggert');
  }
  return found;
}

function optionLabels(select: HTMLButtonElement): readonly string[] {
  const panel = document.querySelector(`[id="${CSS.escape(select.getAttribute('aria-controls') ?? '')}"]`);
  return [...(panel?.querySelectorAll(':scope [role="option"] .menu__text') ?? [])].map((option) => option.textContent);
}

function success(names: readonly string[]): RequestState<readonly string[]> {
  return { status: 'success', value: names };
}

describe('ServerEnvironmentNameSelect', () => {
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

  function render(
    value: string,
    environmentNames: RequestState<readonly string[]>,
    onChange: (next: string) => void = vi.fn(),
  ): void {
    act(() => {
      root.render(
        <ServerEnvironmentNameSelect
          size="sm"
          label="Szerver oldali változó"
          noneLabel="azonos név"
          value={value}
          environmentNames={environmentNames}
          onChange={onChange}
        />,
      );
    });
  }

  it('az üres értékű opció a noneLabel, utána a lista nevei a kapott sorrendben', () => {
    render('', success(['A_CEG', 'B_SAJAT']));

    expect(container.querySelector('.field__label')?.textContent).toBe('Szerver oldali változó');
    expect(trigger(container).textContent).toBe('azonos név');
    expect(optionLabels(trigger(container))).toEqual(['azonos név', 'A_CEG', 'B_SAJAT']);
  });

  it('a választás a kiválasztott nevet adja vissza, a noneLabel opció az üres szöveget', () => {
    const onChange = vi.fn();
    render('A_CEG', success(['A_CEG', 'B_SAJAT']), onChange);
    expect(trigger(container).textContent).toBe('A_CEG');

    clickOn(trigger(container));
    const options = [...document.querySelectorAll<HTMLElement>('[role="option"]')];
    clickOn(options[2] ?? container);
    expect(onChange).toHaveBeenLastCalledWith('B_SAJAT');

    clickOn(trigger(container));
    clickOn([...document.querySelectorAll<HTMLElement>('[role="option"]')][0] ?? container);
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('a már nincs a listában szereplő tárolt név megmarad opcióként, jelzéssel', () => {
    render('ELTUNT', success(['A_CEG']));

    expect(trigger(container).textContent).toBe('ELTUNT (nincs a szerver környezetében)');
    expect(optionLabels(trigger(container))).toEqual(['azonos név', 'ELTUNT (nincs a szerver környezetében)', 'A_CEG']);
  });

  it('a betöltés alatt a választó letiltva áll, betöltés felirattal', () => {
    render('', { status: 'pending' });
    expect(trigger(container).disabled).toBe(true);
    expect(trigger(container).textContent).toBe('Betöltés…');

    render('', { status: 'idle' });
    expect(trigger(container).disabled).toBe(true);
  });

  it('a betöltés hibájánál a tárolt név jelzés nélkül megmarad, a lista nélkül is választható a noneLabel', () => {
    render('MENTETT', { status: 'failure', message: 'A szerver nem érhető el.' });

    expect(trigger(container).disabled).toBe(false);
    expect(trigger(container).textContent).toBe('MENTETT');
    expect(optionLabels(trigger(container))).toEqual(['azonos név', 'MENTETT']);
  });
});
