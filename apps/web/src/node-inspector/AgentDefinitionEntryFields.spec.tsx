import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentDefinitionEntryFields } from './AgentDefinitionEntryFields.tsx';

function typeInto(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * A `detail: 1` kötelező: a `SelectField` a `detail === 0` kattintást
 * billentyűzetből származónak tekinti, és szándékosan nem nyit rá.
 */
function clickOn(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  });
}

/**
 * A `SelectField` trigger `role="combobox"` szerepű gomb; a mezőt a saját
 * `.field` burkolóján belüli `.field__label` szövege azonosítja.
 */
function selectTrigger(container: HTMLElement, label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button.select')].find(
    (candidate) => candidate.closest('.field')?.querySelector('.field__label')?.textContent === label,
  );
  if (button === undefined) {
    throw new Error(`a teszt nem talált "${label}" feliratú select triggert`);
  }
  return button;
}

/**
 * A panel `createPortal`-lal a `document.body`-ba kerül, tehát NEM a
 * `container` leszármazottja; a triggerhez az `aria-controls` köti.
 */
function selectPanel(trigger: HTMLButtonElement): HTMLElement {
  const panelId = trigger.getAttribute('aria-controls');
  const panel = [...document.body.querySelectorAll<HTMLElement>('[role="listbox"]')].find(
    (candidate) => candidate.id === panelId,
  );
  if (panel === undefined) {
    throw new Error('a teszt nem találta a select panelt');
  }
  return panel;
}

function chooseOption(container: HTMLElement, label: string, optionLabel: string): void {
  const trigger = selectTrigger(container, label);
  clickOn(trigger);
  const option = [...selectPanel(trigger).querySelectorAll<HTMLElement>('[role="option"]')].find(
    (candidate) => candidate.querySelector('.menu__text')?.textContent === optionLabel,
  );
  if (option === undefined) {
    throw new Error(`a teszt nem talált "${optionLabel}" feliratú opciót a(z) "${label}" mezőben`);
  }
  clickOn(option);
}

const FULL_ENTRY: Readonly<Record<string, unknown>> = {
  description: 'egy leírás',
  prompt: 'egy prompt',
  model: 'sonnet',
  maxTurns: 5,
  effort: 'high',
  permissionMode: 'default',
  background: true,
  tools: ['web_search'],
  disallowedTools: ['bash'],
  memory: 'project',
  initialPrompt: 'szia',
  skills: ['a'],
  mcpServers: [],
  criticalSystemReminder_EXPERIMENTAL: 'x',
  observer: 'y',
  observerMessage: 'z',
};

describe('AgentDefinitionEntryFields', () => {
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

  it('nem objektum alakú bejegyzésre figyelmeztető szöveget mutat, összeomlás nélkül', () => {
    act(() => {
      root.render(<AgentDefinitionEntryFields value="nem objektum" onChange={vi.fn()} />);
    });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('nem objektum alakú');
  });

  it('egy tömb értékre is a nem-objektum ágat mutatja', () => {
    act(() => {
      root.render(<AgentDefinitionEntryFields value={['nem rekord']} onChange={vi.fn()} />);
    });
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('üres rekordra minden mezőt az alapértékével rajzol (a hiányzó ág lefedettsége)', () => {
    act(() => {
      root.render(<AgentDefinitionEntryFields value={{}} onChange={vi.fn()} />);
    });
    const inputs = [...container.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])')];
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) {
      expect(input.value).toBe('');
    }
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox?.checked).toBe(false);
  });

  it('egy teljesen kitöltött bejegyzésre minden mezőt a tárolt értékkel rajzol', () => {
    act(() => {
      root.render(<AgentDefinitionEntryFields value={FULL_ENTRY} onChange={vi.fn()} />);
    });
    expect(container.textContent).toContain('egy leírás');
    expect(container.textContent).toContain('egy prompt');
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox?.checked).toBe(true);
    expect(container.textContent).toContain('nem megerősített');
    expect(container.textContent).toContain('criticalSystemReminder_EXPERIMENTAL');
  });

  it('egy szöveg mező szerkesztése ráolvaszt, az ismeretlen kulcs túléli (AC60)', () => {
    const onChange = vi.fn();
    const entryWithUnknownKey = { ...FULL_ENTRY, futureField: 'megőrzendő' };
    act(() => {
      root.render(<AgentDefinitionEntryFields value={entryWithUnknownKey} onChange={onChange} />);
    });
    const modelInput = [...container.querySelectorAll<HTMLInputElement>('input')].find(
      (input) => input.value === 'sonnet',
    );
    if (modelInput === undefined) {
      throw new Error('a teszt nem találta a model mezőt');
    }
    act(() => {
      typeInto(modelInput, 'opus');
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ model: 'opus', futureField: 'megőrzendő' }));
  });

  it('a többsoros (textarea) mező szerkesztése frissíti a mezőt', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<AgentDefinitionEntryFields value={FULL_ENTRY} onChange={onChange} />);
    });
    const promptTextarea = [...container.querySelectorAll<HTMLTextAreaElement>('textarea')].find(
      (textarea) => textarea.value === 'egy prompt',
    );
    if (promptTextarea === undefined) {
      throw new Error('a teszt nem találta a prompt mezőt');
    }
    act(() => {
      typeInto(promptTextarea, 'módosított prompt');
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'módosított prompt' }));
  });

  it('a szám mező szerkesztése számmá alakítva frissíti a mezőt', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<AgentDefinitionEntryFields value={FULL_ENTRY} onChange={onChange} />);
    });
    const numberInput = container.querySelector<HTMLInputElement>('input[type="number"]');
    if (numberInput === null) {
      throw new Error('a teszt nem találta a szám mezőt');
    }
    act(() => {
      typeInto(numberInput, '9');
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ maxTurns: 9 }));
  });

  it('a jelölőnégyzet váltása frissíti a boolean mezőt', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<AgentDefinitionEntryFields value={FULL_ENTRY} onChange={onChange} />);
    });
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (checkbox === null) {
      throw new Error('a teszt nem találta a jelölőnégyzetet');
    }
    act(() => {
      checkbox.click();
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ background: false }));
  });

  it('a lista szerkesztő (tools) mentéskor listává bontja a soronkénti szöveget', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<AgentDefinitionEntryFields value={FULL_ENTRY} onChange={onChange} />);
    });
    const toolsTextarea = [...container.querySelectorAll<HTMLTextAreaElement>('textarea')].find(
      (textarea) => textarea.value === 'web_search',
    );
    if (toolsTextarea === undefined) {
      throw new Error('a teszt nem találta a tools mezőt');
    }
    act(() => {
      typeInto(toolsTextarea, 'web_search\nweb_fetch');
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tools: ['web_search', 'web_fetch'] }));
  });

  it('a zárt lista (memory) kiválasztása frissíti a mezőt', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<AgentDefinitionEntryFields value={FULL_ENTRY} onChange={onChange} />);
    });
    chooseOption(container, 'Memória hatóköre', 'local');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ memory: 'local' }));
  });

  it('a zárt lista üres értékű opciója üríti a mezőt', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<AgentDefinitionEntryFields value={FULL_ENTRY} onChange={onChange} />);
    });
    chooseOption(container, 'Memória hatóköre', 'nincs megadva');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ memory: '' }));
  });

  it('a `skills` és az `mcpServers` mező olvasható, és megnevezi a SPEC-009 okot', () => {
    act(() => {
      root.render(<AgentDefinitionEntryFields value={FULL_ENTRY} onChange={vi.fn()} />);
    });
    expect(container.textContent).toContain('SPEC-009');
  });
});
