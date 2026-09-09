/* eslint-disable unicorn/no-null -- a teszt a `node-config` séma nullázható mezőit vizsgálja (SPEC-005 protokoll alak). */
import type { AgentStepConfig } from '@easter-workflow-builder/protocol';
import { FieldErrorVisibilityContext } from '@easter-workflow-builder/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentStepConfigFields } from './AgentStepConfigFields.tsx';
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

function checkboxByLabel(container: HTMLElement, label: string): HTMLInputElement {
  const checkbox = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(
    (candidate) => candidate.parentElement?.textContent.includes(label) === true,
  );
  if (checkbox === undefined) {
    throw new Error(`a teszt nem talált "${label}" feliratú jelölőnégyzetet`);
  }
  return checkbox;
}

const BASE_CONFIG: AgentStepConfig = {
  promptTemplate: 'sablon',
  providerId: null,
  modelId: null,
  effort: null,
  thinking: null,
  allowedTools: [],
  disallowedTools: [],
  permissionMode: null,
  maxTurns: null,
  maxBudgetUsd: null,
  systemPrompt: null,
  agents: {},
  skills: null,
  mcpServers: {},
  enabledEngineHooks: [],
  cwd: null,
  additionalDirectories: [],
  sandbox: null,
  agentTools: [],
  sessionMode: 'isolated',
  structuredOutput: null,
};

describe('AgentStepConfigFields', () => {
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

  function render(config: AgentStepConfig, onChange: (next: AgentStepConfig) => void, description = 'nincs'): void {
    act(() => {
      root.render(
        <AgentStepConfigFields
          fieldPathPrefix=""
          config={config}
          onChange={onChange}
          inheritedProviderDescription={description}
        />,
      );
    });
  }

  it('a `providerId` null értékére megjeleníti az örökölt provider leírását', () => {
    render(BASE_CONFIG, vi.fn(), 'a workflow saját providerét örökli: minimax');
    expect(container.textContent).toContain('a workflow saját providerét örökli: minimax');
  });

  it('egy megadott `providerId`-ra nem jelenik meg az öröklés leírása', () => {
    render({ ...BASE_CONFIG, providerId: 'minimax' }, vi.fn(), 'sosem látszik');
    expect(container.textContent).not.toContain('sosem látszik');
  });

  it('a provider felülírás kiválasztása frissíti a mezőt, majd vissza "nincs felülírás"-ra null lesz', () => {
    const onChange = vi.fn();
    render(BASE_CONFIG, onChange);
    chooseOption(container, 'Provider felülírás', 'minimax');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ providerId: 'minimax' }));
    chooseOption(container, 'Provider felülírás', 'nincs felülírás (öröklés)');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ providerId: null }));
  });

  it('a modell azonosító mező szerkesztése frissíti a mezőt, üresre nullázza', () => {
    const onChange = vi.fn();
    render({ ...BASE_CONFIG, modelId: 'sonnet' }, onChange);
    const modelInput = [...container.querySelectorAll('input')].find((input) => input.value === 'sonnet');
    if (modelInput === undefined) {
      throw new Error('a teszt nem találta a modell mezőt');
    }
    act(() => {
      typeInto(modelInput, '');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ modelId: null }));
  });

  it('a session mód kiválasztása frissíti a mezőt', () => {
    const onChange = vi.fn();
    render(BASE_CONFIG, onChange);
    chooseOption(container, 'Session mód', 'continued');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ sessionMode: 'continued' }));
  });

  it('a max. körök száma és a max. büdzsé mező szám mezőként szerkeszthető', () => {
    const onChange = vi.fn();
    render(BASE_CONFIG, onChange);
    const [maxTurnsInput, maxBudgetInput] = [...container.querySelectorAll<HTMLInputElement>('input[type="number"]')];
    if (maxTurnsInput === undefined || maxBudgetInput === undefined) {
      throw new Error('a teszt nem találta a szám mezőket');
    }
    act(() => {
      typeInto(maxTurnsInput, '3');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ maxTurns: 3 }));
    act(() => {
      typeInto(maxBudgetInput, '12.5');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ maxBudgetUsd: 12.5 }));
  });

  it('az effort és a jogosultsági mód szöveg mezőként szerkeszthető', () => {
    const onChange = vi.fn();
    render(BASE_CONFIG, onChange);
    const textInputs = [...container.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])')];
    const effortInput = textInputs.find((input) => input.closest('label')?.textContent.includes('Effort'));
    const permissionModeInput = textInputs.find((input) =>
      input.closest('label')?.textContent.includes('Jogosultsági mód'),
    );
    if (effortInput === undefined || permissionModeInput === undefined) {
      throw new Error('a teszt nem talált effort vagy jogosultsági mód mezőt');
    }
    act(() => {
      typeInto(effortInput, 'high');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ effort: 'high' }));
    act(() => {
      typeInto(permissionModeInput, 'default');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ permissionMode: 'default' }));
  });

  it('a thinking mód kiválasztása frissíti a mezőt, az üres értékű opció nullázza', () => {
    const onChange = vi.fn();
    render(BASE_CONFIG, onChange);
    chooseOption(container, 'Thinking mód', 'adaptive');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ thinking: 'adaptive' }));
    chooseOption(container, 'Thinking mód', 'nincs megadva');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ thinking: null }));
  });

  it('a bekapcsolt motor hookok jelölőnégyzete hozzáadja, majd eltávolítja az elemet', () => {
    const onChange = vi.fn();
    render(BASE_CONFIG, onChange);
    const checkbox = checkboxByLabel(container, 'emit_output_tool_stop');
    act(() => {
      checkbox.click();
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabledEngineHooks: ['emit_output_tool_stop'] }),
    );

    render({ ...BASE_CONFIG, enabledEngineHooks: ['emit_output_tool_stop'] }, onChange);
    const checkedCheckbox = checkboxByLabel(container, 'emit_output_tool_stop');
    act(() => {
      checkedCheckbox.click();
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ enabledEngineHooks: [] }));
  });

  it('az engedélyezett és a tiltott eszközök lista szerkesztő listává bontva menti', () => {
    const onChange = vi.fn();
    render(BASE_CONFIG, onChange);
    const textareas = container.querySelectorAll('textarea');
    const allowedTextarea = [...textareas].find((textarea) =>
      textarea.closest('label')?.textContent.includes('Engedélyezett eszközök'),
    );
    if (allowedTextarea === undefined) {
      throw new Error('a teszt nem talált "Engedélyezett eszközök" mezőt');
    }
    act(() => {
      typeInto(allowedTextarea, 'web_search\nweb_fetch');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ allowedTools: ['web_search', 'web_fetch'] }));

    const disallowedTextarea = [...textareas].find((textarea) =>
      textarea.closest('label')?.textContent.includes('Tiltott eszközök'),
    );
    if (disallowedTextarea === undefined) {
      throw new Error('a teszt nem talált "Tiltott eszközök" mezőt');
    }
    act(() => {
      typeInto(disallowedTextarea, 'bash');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ disallowedTools: ['bash'] }));
  });

  it('a beépített agent eszközök jelölőnégyzete hozzáadja, majd eltávolítja az elemet', () => {
    const onChange = vi.fn();
    render(BASE_CONFIG, onChange);
    const checkbox = checkboxByLabel(container, 'web_search');
    act(() => {
      checkbox.click();
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ agentTools: ['web_search'] }));

    render({ ...BASE_CONFIG, agentTools: ['web_search'] }, onChange);
    const checkedCheckbox = checkboxByLabel(container, 'web_search');
    act(() => {
      checkedCheckbox.click();
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ agentTools: [] }));
  });

  it('a munkakönyvtár mező szerkeszthető', () => {
    const onChange = vi.fn();
    render(BASE_CONFIG, onChange);
    const textInputs = [...container.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])')];
    const cwdInput = textInputs.find((input) => input.closest('label')?.textContent.includes('Munkakönyvtár') === true);
    if (cwdInput === undefined) {
      throw new Error('a teszt nem talált cwd mezőt');
    }
    act(() => {
      typeInto(cwdInput, '/repo');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ cwd: '/repo' }));
  });

  it('a további könyvtárak lista szerkesztő listává bontva menti', () => {
    const onChange = vi.fn();
    render(BASE_CONFIG, onChange);
    const textarea = [...container.querySelectorAll('textarea')].find((candidate) =>
      candidate.closest('label')?.textContent.includes('További engedélyezett könyvtárak'),
    );
    if (textarea === undefined) {
      throw new Error('a teszt nem talált "További engedélyezett könyvtárak" mezőt');
    }
    act(() => {
      typeInto(textarea, '/a\n/b');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ additionalDirectories: ['/a', '/b'] }));
  });

  it('a sandbox mező bekapcsolása a teljes konfigot frissíti', () => {
    const onChange = vi.fn();
    render(BASE_CONFIG, onChange);
    const sandboxCheckbox = checkboxByLabel(container, 'Sandbox felülírás megadva');
    act(() => {
      sandboxCheckbox.click();
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sandbox: {
          enabled: true,
          failIfUnavailable: false,
          autoAllowBashIfSandboxed: false,
          excludedCommands: [],
          enableWeakerNestedSandbox: false,
        },
      }),
    );
  });

  it('a strukturált kimenet mező bekapcsolása a teljes konfigot frissíti', () => {
    const onChange = vi.fn();
    render(BASE_CONFIG, onChange);
    const structuredOutputCheckbox = checkboxByLabel(container, 'Strukturált kimenet felülírás megadva');
    act(() => {
      structuredOutputCheckbox.click();
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ structuredOutput: { strategy: 'emit_output_tool', schema: {} } }),
    );
  });

  it('a `skills` és az `mcpServers` mező olvasható, megnevezi a SPEC-009 okot', () => {
    render({ ...BASE_CONFIG, skills: ['a', 'b'] }, vi.fn());
    expect(container.textContent).toContain('["a","b"]');
    expect(container.textContent).toContain('SPEC-009');
  });

  it('az `agents` szerkesztő jelen van, és a szerkesztése a teljes konfigot frissíti', () => {
    const onChange = vi.fn();
    render({ ...BASE_CONFIG, agents: { kutato: { description: '', prompt: '' } } }, onChange);
    expect(container.querySelector('.agents-field-editor')).not.toBeNull();
    const agentRemoveButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Törlés',
    );
    if (agentRemoveButton === undefined) {
      throw new Error('a teszt nem talált Törlés gombot');
    }
    act(() => {
      agentRemoveButton.click();
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ agents: {} }));
  });

  it('a `systemPrompt` mező vezérlője jelen van, és a szerkesztése a teljes konfigot frissíti', () => {
    const onChange = vi.fn();
    // A `systemPrompt` értéke szándékosan tér el a `BASE_CONFIG.promptTemplate` 'sablon'
    // értékétől, különben a lenti `.find` az azonos szövegű `promptTemplate` textarea-t
    // találná meg elsőként (DOM sorrend szerint az korábban rendereltik).
    render({ ...BASE_CONFIG, systemPrompt: 'rendszer sablon' }, onChange);
    expect(selectTrigger(container, 'Rendszer prompt módja')).toBeDefined();
    const systemPromptTextarea = [...container.querySelectorAll<HTMLTextAreaElement>('textarea')].find(
      (textarea) => textarea.value === 'rendszer sablon',
    );
    if (systemPromptTextarea === undefined) {
      throw new Error('a teszt nem találta a rendszer prompt textarea-t');
    }
    act(() => {
      typeInto(systemPromptTextarea, 'módosított rendszer prompt');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ systemPrompt: 'módosított rendszer prompt' }));
  });

  it('a prompt sablon mező szerkeszthető', () => {
    const onChange = vi.fn();
    render(BASE_CONFIG, onChange);
    const promptTextarea = [...container.querySelectorAll<HTMLTextAreaElement>('textarea')].find(
      (textarea) => textarea.value === 'sablon',
    );
    if (promptTextarea === undefined) {
      throw new Error('a teszt nem találta a prompt sablon mezőt');
    }
    act(() => {
      typeInto(promptTextarea, 'új sablon');
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ promptTemplate: 'új sablon' }));
  });

  it('a `promptTemplate`, a `systemPrompt` és a `providerId` mezőnkénti hibája megjelenik a mezők alatt, aria kötéssel', () => {
    act(() => {
      root.render(
        <FieldErrorVisibilityContext.Provider value>
          <FieldErrorsContext.Provider
            value={
              new Map([
                ['promptTemplate', 'Kötelező mező'],
                ['systemPrompt', 'Érvénytelen alak'],
                ['providerId', 'Ismeretlen provider'],
              ])
            }
          >
            <AgentStepConfigFields
              fieldPathPrefix=""
              config={BASE_CONFIG}
              onChange={vi.fn()}
              inheritedProviderDescription="nincs"
            />
          </FieldErrorsContext.Provider>
        </FieldErrorVisibilityContext.Provider>,
      );
    });
    const promptTextarea = [...container.querySelectorAll<HTMLTextAreaElement>('textarea')].find(
      (textarea) => textarea.value === 'sablon',
    );
    if (promptTextarea === undefined) {
      throw new Error('a teszt nem találta a prompt sablon mezőt');
    }
    expect(promptTextarea.getAttribute('aria-invalid')).toBe('true');
    const promptErrorElement = [...container.querySelectorAll('.field__error')].find(
      (element) => element.id === promptTextarea.getAttribute('aria-describedby'),
    );
    expect(promptErrorElement?.textContent).toBe('Kötelező mező');

    const systemPromptModeTrigger = selectTrigger(container, 'Rendszer prompt módja');
    expect(systemPromptModeTrigger.getAttribute('aria-invalid')).toBe('true');
    const systemPromptErrorElement = [...container.querySelectorAll('.field__error')].find(
      (element) => element.id === systemPromptModeTrigger.getAttribute('aria-describedby'),
    );
    expect(systemPromptErrorElement?.textContent).toBe('Érvénytelen alak');

    const providerTrigger = selectTrigger(container, 'Provider felülírás');
    expect(providerTrigger.getAttribute('aria-invalid')).toBe('true');
    const providerErrorElement = [...container.querySelectorAll('.field__error')].find(
      (element) => element.id === providerTrigger.getAttribute('aria-describedby'),
    );
    expect(providerErrorElement?.textContent).toBe('Ismeretlen provider');
  });
});
