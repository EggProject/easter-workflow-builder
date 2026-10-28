/* eslint-disable unicorn/no-null -- a teszt a `skills` mező tárolt `null` értékét (nincs beállítva) vizsgálja (SPEC-009 5.2). */
import type { SkillSummary } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestState } from '../request-state/request-state.ts';
import { SkillLibraryContext } from './skill-library-context.ts';
import { SkillsField } from './SkillsField.tsx';

/**
 * A `detail: 1` kötelező: a `SelectField` a `detail === 0` kattintást
 * billentyűzetből származónak tekinti, és szándékosan nem nyit rá.
 */
function clickOn(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  });
}

function modeTrigger(container: HTMLElement): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>('button.select');
  if (button === null) {
    throw new Error('a teszt nem talált select triggert');
  }
  return button;
}

function chooseMode(container: HTMLElement, optionLabel: string): void {
  const trigger = modeTrigger(container);
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

function checkboxByLabel(container: HTMLElement, label: string): HTMLInputElement {
  const checkbox = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(
    (candidate) => candidate.parentElement?.textContent.includes(label) === true,
  );
  if (checkbox === undefined) {
    throw new Error(`a teszt nem talált "${label}" feliratú jelölőnégyzetet`);
  }
  return checkbox;
}

function skill(name: string): SkillSummary {
  return { name, description: `${name} leírása`, sizeBytes: 10, modifiedAtMs: 1 };
}

const LIBRARY: RequestState<readonly SkillSummary[]> = {
  status: 'success',
  value: [skill('alfa'), skill('beta')],
};

describe('SkillsField', () => {
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
    value: unknown,
    onChange: (next: readonly string[] | 'all' | null) => void,
    library: RequestState<readonly SkillSummary[]> = LIBRARY,
  ): void {
    act(() => {
      root.render(
        <SkillLibraryContext.Provider value={library}>
          <SkillsField value={value} onChange={onChange} />
        </SkillLibraryContext.Provider>,
      );
    });
  }

  it('a `null` érték "nincs beállítva" módban áll, jelölőnégyzet nélkül, megnevezve a jelentést', () => {
    render(null, vi.fn());
    expect(modeTrigger(container).textContent).toBe('nincs beállítva');
    expect(container.textContent).toContain('Nem használ feltöltött skillt.');
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  });

  it('a hiányzó kulcs (`undefined`) ugyanúgy "nincs beállítva", mint a `null`', () => {
    render(undefined, vi.fn());
    expect(modeTrigger(container).textContent).toBe('nincs beállítva');
  });

  it('az `\'all\'` érték "minden feltöltött skill" módban áll, jelölőnégyzet nélkül', () => {
    render('all', vi.fn());
    expect(modeTrigger(container).textContent).toBe('minden feltöltött skill');
    expect(container.textContent).toContain('a könyvtár minden skilljét használja');
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  });

  it('a módváltás a tárolt alakot adja: nincs beállítva -> minden -> lista (üres) -> nincs beállítva', () => {
    const onChange = vi.fn();
    render(null, onChange);
    chooseMode(container, 'minden feltöltött skill');
    expect(onChange).toHaveBeenLastCalledWith('all');
    chooseMode(container, 'kiválasztott skillek');
    expect(onChange).toHaveBeenLastCalledWith([]);
    chooseMode(container, 'nincs beállítva');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('listáról a "minden" módra váltás `all`, "minden" módról a listára váltás üres lista', () => {
    const onChange = vi.fn();
    render(['alfa'], onChange);
    chooseMode(container, 'minden feltöltött skill');
    expect(onChange).toHaveBeenLastCalledWith('all');
    render('all', onChange);
    chooseMode(container, 'kiválasztott skillek');
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('a listás mód opciójának újraválasztása a meglévő jelöléseket megtartja', () => {
    const onChange = vi.fn();
    render(['beta'], onChange);
    chooseMode(container, 'kiválasztott skillek');
    expect(onChange).toHaveBeenLastCalledWith(['beta']);
  });

  it('a listás mód a könyvtár neveit jelölőnégyzetként mutatja, a tárolt nevek bejelölve', () => {
    render(['beta'], vi.fn());
    expect(modeTrigger(container).textContent).toBe('kiválasztott skillek');
    expect(container.querySelector('[role="group"]')?.textContent).toContain('Feltöltött skillek');
    expect(checkboxByLabel(container, 'alfa').checked).toBe(false);
    expect(checkboxByLabel(container, 'beta').checked).toBe(true);
  });

  it('a jelölőnégyzet bejelölése hozzáfűzi, a levétele kiveszi a nevet a tárolt listából', () => {
    const onChange = vi.fn();
    render(['beta'], onChange);
    act(() => {
      checkboxByLabel(container, 'alfa').click();
    });
    expect(onChange).toHaveBeenLastCalledWith(['beta', 'alfa']);
    act(() => {
      checkboxByLabel(container, 'beta').click();
    });
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('a könyvtárból hiányzó tárolt név láthatóan "hiányzik" jelzéssel, bejelölve marad, és a levétele kiveszi', () => {
    const onChange = vi.fn();
    render(['törölt', 'törölt', 'alfa'], onChange);
    const missing = checkboxByLabel(container, 'törölt (hiányzik a könyvtárból)');
    expect(missing.checked).toBe(true);
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
    expect(container.textContent).toContain('A könyvtárból hiányzó skillre a futás indítása hibával áll meg');
    act(() => {
      missing.click();
    });
    expect(onChange).toHaveBeenLastCalledWith(['alfa']);
  });

  it('ha nincs hiányzó név, a hiányzó skillre vonatkozó mondat nem jelenik meg', () => {
    render(['alfa'], vi.fn());
    expect(container.textContent).not.toContain('hiányzó skillre');
  });

  it('üres könyvtárnál az üres állapot áll, jelölőnégyzet nélkül', () => {
    render([], vi.fn(), { status: 'success', value: [] });
    expect(container.textContent).toContain('Még nincs feltöltött skill.');
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  });

  it('üres könyvtárnál a tárolt nevek hiányzóként maradnak a listán, üres állapot nélkül', () => {
    render(['törölt'], vi.fn(), { status: 'success', value: [] });
    expect(container.textContent).not.toContain('Még nincs feltöltött skill.');
    expect(checkboxByLabel(container, 'törölt (hiányzik a könyvtárból)').checked).toBe(true);
  });

  it('a könyvtár betöltése alatt (pending és idle) csontváz áll, jelölőnégyzet nélkül', () => {
    render(['alfa'], vi.fn(), { status: 'pending' });
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    render(['alfa'], vi.fn(), { status: 'idle' });
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('a könyvtár betöltési hibája danger Alert, a mód választó használható marad', () => {
    const onChange = vi.fn();
    render(['alfa'], onChange, { status: 'failure', message: 'A skill könyvtár nem tölthető be.' });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('A skill könyvtár nem tölthető be.');
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    chooseMode(container, 'minden feltöltött skill');
    expect(onChange).toHaveBeenLastCalledWith('all');
  });

  it('az érvénytelen alakú tárolt érték megnevezve jelenik meg, és bármelyik mód felülírja', () => {
    const onChange = vi.fn();
    render(['alfa', 1], onChange);
    expect(modeTrigger(container).textContent).toBe('ismeretlen alak');
    expect(container.textContent).toContain('A tárolt érték alakja érvénytelen (["alfa",1])');
    chooseMode(container, 'kiválasztott skillek');
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('a nem sztring tömb alakú érték (szám) szintén érvénytelen alak', () => {
    render(5, vi.fn());
    expect(container.textContent).toContain('A tárolt érték alakja érvénytelen (5)');
  });
});
