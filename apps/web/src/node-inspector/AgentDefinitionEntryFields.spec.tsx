import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FieldErrorVisibilityContext } from '@easter-workflow-builder/ui';
import { AgentDefinitionEntryFields } from './AgentDefinitionEntryFields.tsx';
import { UNCONFIRMED_AGENT_DEFINITION_FIELD_KEYS } from './agent-definition-field-table.ts';
import { FieldErrorsContext } from './field-errors-context.ts';

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

function labelsOfInvalidFields(scope: ParentNode): readonly (string | null | undefined)[] {
  return [...scope.querySelectorAll('[aria-invalid="true"]')].map(
    (field) => field.closest('.field')?.querySelector('.field__label')?.textContent,
  );
}

function renderEntryWithErrors(root: Root, errors: ReadonlyMap<string, string>, isSaveAttempted: boolean): void {
  act(() => {
    root.render(
      <FieldErrorVisibilityContext.Provider value={isSaveAttempted}>
        <FieldErrorsContext.Provider value={errors}>
          <AgentDefinitionEntryFields
            fieldPathPrefix="settings.agents.kutato."
            value={{ description: '', prompt: '' }}
            onChange={vi.fn()}
          />
        </FieldErrorsContext.Provider>
      </FieldErrorVisibilityContext.Provider>,
    );
  });
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
      root.render(
        <AgentDefinitionEntryFields fieldPathPrefix="agents.kutato." value="nem objektum" onChange={vi.fn()} />,
      );
    });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('nem objektum alakú');
  });

  it('egy tömb értékre is a nem-objektum ágat mutatja', () => {
    act(() => {
      root.render(
        <AgentDefinitionEntryFields fieldPathPrefix="agents.kutato." value={['nem rekord']} onChange={vi.fn()} />,
      );
    });
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('üres rekordra minden mezőt az alapértékével rajzol (a hiányzó ág lefedettsége)', () => {
    act(() => {
      root.render(<AgentDefinitionEntryFields fieldPathPrefix="agents.kutato." value={{}} onChange={vi.fn()} />);
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
      root.render(
        <AgentDefinitionEntryFields fieldPathPrefix="agents.kutato." value={FULL_ENTRY} onChange={vi.fn()} />,
      );
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
      root.render(
        <AgentDefinitionEntryFields fieldPathPrefix="agents.kutato." value={entryWithUnknownKey} onChange={onChange} />,
      );
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
      root.render(
        <AgentDefinitionEntryFields fieldPathPrefix="agents.kutato." value={FULL_ENTRY} onChange={onChange} />,
      );
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
      root.render(
        <AgentDefinitionEntryFields fieldPathPrefix="agents.kutato." value={FULL_ENTRY} onChange={onChange} />,
      );
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
      root.render(
        <AgentDefinitionEntryFields fieldPathPrefix="agents.kutato." value={FULL_ENTRY} onChange={onChange} />,
      );
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
      root.render(
        <AgentDefinitionEntryFields fieldPathPrefix="agents.kutato." value={FULL_ENTRY} onChange={onChange} />,
      );
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
      root.render(
        <AgentDefinitionEntryFields fieldPathPrefix="agents.kutato." value={FULL_ENTRY} onChange={onChange} />,
      );
    });
    chooseOption(container, 'Memória hatóköre', 'local');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ memory: 'local' }));
  });

  it('a zárt lista üres értékű opciója üríti a mezőt', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        <AgentDefinitionEntryFields fieldPathPrefix="agents.kutato." value={FULL_ENTRY} onChange={onChange} />,
      );
    });
    chooseOption(container, 'Memória hatóköre', 'nincs megadva');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ memory: '' }));
  });

  it('a `skills` és az `mcpServers` mező olvasható, és megnevezi a SPEC-009 okot', () => {
    act(() => {
      root.render(
        <AgentDefinitionEntryFields fieldPathPrefix="agents.kutato." value={FULL_ENTRY} onChange={vi.fn()} />,
      );
    });
    expect(container.textContent).toContain('SPEC-009');
  });

  it('a három nem megerősített mező (M-90) értékkel is csak olvasható szöveg, vezérlő nélkül', () => {
    const unconfirmedValues = {
      criticalSystemReminder_EXPERIMENTAL: 'emlekezteto-ertek',
      observer: 'megfigyelo-ertek',
      observerMessage: 'uzenet-ertek',
    } as const satisfies Readonly<Record<(typeof UNCONFIRMED_AGENT_DEFINITION_FIELD_KEYS)[number], string>>;
    act(() => {
      root.render(
        <AgentDefinitionEntryFields
          fieldPathPrefix="agents.kutato."
          value={{ ...FULL_ENTRY, ...unconfirmedValues }}
          onChange={vi.fn()}
        />,
      );
    });
    const controls = [
      ...container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input, textarea, select',
      ),
    ];
    expect(controls.length).toBeGreaterThan(0);
    for (const key of UNCONFIRMED_AGENT_DEFINITION_FIELD_KEYS) {
      const readOnlyLine = [...container.querySelectorAll('p')].find(
        (paragraph) => paragraph.querySelector('b')?.textContent === key,
      );
      expect(readOnlyLine?.textContent).toBe(`${key}: ${unconfirmedValues[key]}`);
      for (const control of controls) {
        const controlLabel = control.closest('.field')?.querySelector('.field__label')?.textContent ?? '';
        expect(control.value).not.toBe(unconfirmedValues[key]);
        expect(controlLabel.toLowerCase()).not.toContain(key.toLowerCase());
      }
    }
  });

  describe('a kötelező mezők hibája (SPEC-008 5.4, O-38)', () => {
    it('mentési kísérlet után a hiba a mező pontos útvonalán, a leírás és a prompt alatt áll', () => {
      renderEntryWithErrors(
        root,
        new Map([
          ['settings.agents.kutato.description', 'A mező nem lehet üres.'],
          ['settings.agents.kutato.prompt', 'A mező nem lehet üres.'],
        ]),
        true,
      );

      expect(labelsOfInvalidFields(container)).toEqual(['Leírás', 'Prompt']);
      expect(container.querySelectorAll('.field__error')).toHaveLength(2);
    });

    it('mentési kísérlet nélkül az érintetlen mező nem jelez, az érintett (elhagyott) igen', () => {
      renderEntryWithErrors(root, new Map([['settings.agents.kutato.description', 'A mező nem lehet üres.']]), false);
      expect(labelsOfInvalidFields(container)).toEqual([]);

      const description = [...container.querySelectorAll('textarea')].find(
        (textarea) => textarea.closest('.field')?.querySelector('.field__label')?.textContent === 'Leírás',
      );
      act(() => {
        description?.focus();
        description?.blur();
      });

      expect(labelsOfInvalidFields(container)).toEqual(['Leírás']);
    });

    it('egy pontot tartalmazó nevű másik bejegyzés hibája nem jelenik meg ennek a bejegyzésnek a mezőjén', () => {
      // A `kutato.description` nevű bejegyzés `prompt` mezőjének útvonala
      // előtagként illeszkedne a `kutato` bejegyzés `description` mezőjére.
      renderEntryWithErrors(
        root,
        new Map([['settings.agents.kutato.description.prompt', 'A mező nem lehet üres.']]),
        true,
      );

      expect(labelsOfInvalidFields(container)).toEqual([]);
    });
  });
});
