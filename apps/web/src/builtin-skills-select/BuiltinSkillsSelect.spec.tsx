/* eslint-disable unicorn/no-null -- a választó `null` értéke az öröklés (SPEC-009 O-44) */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BuiltinSkillsSelect } from './BuiltinSkillsSelect.tsx';

// A `detail: 1` kötelező: a `SelectField` a `detail === 0` kattintást billentyűzetből
// származónak tekinti, és szándékosan nem nyit rá.
function clickOn(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  });
}

function render(
  root: Root,
  container: HTMLElement,
  value: boolean | null,
  onChange: (value: boolean | null) => void,
): HTMLButtonElement {
  act(() => {
    root.render(
      <BuiltinSkillsSelect
        size="sm"
        label="Beépített skillek"
        inheritedOptionLabel="Örökölt (globális beállítás)"
        value={value}
        onChange={onChange}
      />,
    );
  });
  const trigger = container.querySelector<HTMLButtonElement>('button.select');
  if (trigger === null) {
    throw new Error('a teszt nem találta a select triggert');
  }
  return trigger;
}

function optionLabels(trigger: HTMLButtonElement): readonly (string | undefined)[] {
  const panelId = trigger.getAttribute('aria-controls');
  const panel = [...document.body.querySelectorAll<HTMLElement>('[role="listbox"]')].find(
    (candidate) => candidate.id === panelId,
  );
  return [...(panel?.querySelectorAll('[role="option"]') ?? [])].map(
    (option) => option.querySelector('.menu__text')?.textContent,
  );
}

function choose(trigger: HTMLButtonElement, optionLabel: string): void {
  clickOn(trigger);
  const option = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (candidate) => candidate.querySelector('.menu__text')?.textContent === optionLabel,
  );
  if (option === undefined) {
    throw new Error(`a teszt nem talált "${optionLabel}" opciót`);
  }
  clickOn(option);
}

describe('BuiltinSkillsSelect', () => {
  let container: HTMLElement;
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
    document.body.replaceChildren();
  });

  it('a felirat és a három opció a megadott öröklés felirattal áll', () => {
    const trigger = render(root, container, null, vi.fn());
    expect(container.querySelector('.field__label')?.textContent).toBe('Beépített skillek');
    clickOn(trigger);
    expect(optionLabels(trigger)).toStrictEqual(['Örökölt (globális beállítás)', 'Elérhetők', 'Nem elérhetők']);
  });

  it.each([
    [null, 'Örökölt (globális beállítás)'],
    [true, 'Elérhetők'],
    [false, 'Nem elérhetők'],
  ])('a(z) %s érték a(z) "%s" opciót mutatja', (value, label) => {
    const trigger = render(root, container, value, vi.fn());
    expect(trigger.textContent).toContain(label);
  });

  it.each([
    ['Elérhetők', null, true],
    ['Nem elérhetők', true, false],
    ['Örökölt (globális beállítás)', false, null],
  ])('a(z) "%s" választás az értéket adja', (optionLabel, initial, expected) => {
    const onChange = vi.fn();
    choose(render(root, container, initial, onChange), optionLabel);
    expect(onChange).toHaveBeenLastCalledWith(expected);
  });
});
