import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UNDO_MODIFIER_STORAGE_KEY } from '../graph-editor/undo-modifier-storage.ts';
import { SettingsScreen } from './settings-screen.tsx';

const ROW_LABEL = 'Visszavonás/újra billentyű módosítója';
const AUTO_LABEL = 'Automatikus (macOS-en Cmd, máshol Ctrl)';

function clickOn(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  });
}

describe('SettingsScreen', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.localStorage.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    globalThis.localStorage.clear();
  });

  function render(): void {
    act(() => {
      root.render(<SettingsScreen />);
    });
  }

  /**
   * A sor felirata a `<label for>` kötéssel a választó triggeréhez tartozik:
   * a trigger a felirat `htmlFor` értékével azonos azonosítójú gomb.
   */
  function rowTrigger(): HTMLButtonElement {
    const label = [...container.querySelectorAll('label')].find((candidate) => candidate.textContent === ROW_LABEL);
    if (label === undefined) {
      throw new Error('a teszt nem találta a sor feliratát');
    }
    const trigger = [...container.querySelectorAll('button')].find((candidate) => candidate.id === label.htmlFor);
    if (trigger === undefined) {
      throw new Error('a felirat nem a választó triggerére mutat');
    }
    return trigger;
  }

  function chooseOption(optionLabel: string): void {
    const trigger = rowTrigger();
    clickOn(trigger);
    const panelId = trigger.getAttribute('aria-controls');
    const panel = [...document.body.querySelectorAll<HTMLElement>('[role="listbox"]')].find(
      (candidate) => candidate.id === panelId,
    );
    const option = [...(panel?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])].find(
      (candidate) => candidate.querySelector('.menu__text')?.textContent === optionLabel,
    );
    if (option === undefined) {
      throw new Error(`a teszt nem talált "${optionLabel}" feliratú opciót`);
    }
    clickOn(option);
  }

  it('egy card szekciót rajzol, aminek a hozzáférhető nevét a fejléc címe adja', () => {
    render();

    const section = container.querySelector('section.card');
    const heading = section?.querySelector(':scope > .card__header > h3');
    expect(heading?.textContent).toBe('Szerkesztő');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
  });

  it('a sor preference-row, a felirata a SelectField triggeréhez kötött label, a választó sm méretű', () => {
    render();

    const trigger = rowTrigger();
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.classList.contains('select--sm')).toBe(true);
    expect(trigger.closest('.preference-row')?.querySelector('.preference-row__title')?.textContent).toBe(ROW_LABEL);
  });

  it('a három opció a döntés szövegével, ebben a sorrendben', () => {
    render();

    const trigger = rowTrigger();
    clickOn(trigger);
    const panelId = trigger.getAttribute('aria-controls');
    const panel = [...document.body.querySelectorAll<HTMLElement>('[role="listbox"]')].find(
      (candidate) => candidate.id === panelId,
    );
    const labels = [...(panel?.querySelectorAll(':scope [role="option"] .menu__text') ?? [])].map(
      (element) => element.textContent,
    );
    expect(labels).toEqual([AUTO_LABEL, 'Ctrl', 'Cmd']);
  });

  it('üres tárolónál az alapértelmezett Automatikus értéket mutatja', () => {
    render();

    expect(rowTrigger().textContent).toBe(AUTO_LABEL);
  });

  it.each([
    ['ctrl', 'Ctrl'],
    ['meta', 'Cmd'],
    ['auto', AUTO_LABEL],
  ])('a tárolt "%s" értéket a "%s" felirattal mutatja', (stored, expectedLabel) => {
    globalThis.localStorage.setItem(UNDO_MODIFIER_STORAGE_KEY, stored);
    render();

    expect(rowTrigger().textContent).toBe(expectedLabel);
  });

  it('ismeretlen tárolt értéknél az Automatikus értéket mutatja', () => {
    globalThis.localStorage.setItem(UNDO_MODIFIER_STORAGE_KEY, 'cmd');
    render();

    expect(rowTrigger().textContent).toBe(AUTO_LABEL);
  });

  // Minden eset más tárolt értékről indul, tehát a beírt érték a választásból
  // jön, nem a kiindulásból.
  it.each([
    ['Ctrl', 'ctrl', 'meta'],
    ['Cmd', 'meta', 'ctrl'],
    [AUTO_LABEL, 'auto', 'ctrl'],
  ])(
    'a(z) "%s" választása azonnal a tárolóba írja a(z) "%s" értéket, és a trigger is azt mutatja',
    (label, value, initial) => {
      globalThis.localStorage.setItem(UNDO_MODIFIER_STORAGE_KEY, initial);
      render();

      chooseOption(label);

      expect(globalThis.localStorage.getItem(UNDO_MODIFIER_STORAGE_KEY)).toBe(value);
      expect(rowTrigger().textContent).toBe(label);
    },
  );
});
