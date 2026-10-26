/* eslint-disable unicorn/no-null -- a `JoinNodeConfig.onUnhandledError` a dróton ténylegesen `null` értéket hordoz (SPEC-005). */
import type { JoinNodeConfig } from '@easter-workflow-builder/protocol';
import { FieldErrorVisibilityContext } from '@easter-workflow-builder/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JoinNodeFields } from './JoinNodeFields.tsx';
import { FieldErrorsContext } from './field-errors-context.ts';

function typeInto(element: HTMLTextAreaElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
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

const MODE_LABEL = 'Összefésülés módja';

const MERGE_CONFIG: JoinNodeConfig = {
  type: 'join',
  mode: 'merge',
  onUnhandledError: null,
};
const SCRIPT_CONFIG: JoinNodeConfig = {
  type: 'join',
  mode: 'script',
  settings: { source: 'a + b', runtime: 'expression' },
  onUnhandledError: null,
};
const AI_SYNTHESIS_CONFIG: JoinNodeConfig = {
  type: 'join',
  mode: 'ai_synthesis',
  settings: {
    promptTemplate: 'foglald össze',
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
    cwd: null,
    additionalDirectories: [],
    sandbox: null,
    sessionMode: 'isolated',
    structuredOutput: null,
  },
  onUnhandledError: null,
};

describe('JoinNodeFields', () => {
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

  it('"merge" módra csak a mód választó áll, beállítás mező nincs (user döntés 2026-10-26)', () => {
    act(() => {
      root.render(<JoinNodeFields config={MERGE_CONFIG} onChange={vi.fn()} inheritedProviderDescription="nincs" />);
    });
    expect(container.querySelectorAll('.field')).toHaveLength(1);
    expect(container.querySelector('textarea')).toBeNull();
  });

  it('"script" módra a forrás szerkeszthető', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<JoinNodeFields config={SCRIPT_CONFIG} onChange={onChange} inheritedProviderDescription="nincs" />);
    });
    const textarea = container.querySelector('textarea');
    if (textarea === null) {
      throw new Error('a teszt nem találta a forrás textarea-t');
    }
    expect(textarea.value).toBe('a + b');
    act(() => {
      typeInto(textarea, 'a - b');
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ settings: { source: 'a - b', runtime: 'expression' } }),
    );
  });

  it('"ai_synthesis" módra a teljes AgentStepConfig űrlapot rendereli, szerkesztése a settings-en át adja vissza', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        <JoinNodeFields config={AI_SYNTHESIS_CONFIG} onChange={onChange} inheritedProviderDescription="nincs" />,
      );
    });
    // Az `AgentStepConfigFields` ma töredéket ad vissza (nincs saját burkoló
    // doboza), tehát a jelenlétét a saját tartalmán mérjük: a prompt sablon
    // elöl, a felülírások pedig összecsukható panelekben.
    expect(container.querySelector('.accordion')).not.toBeNull();
    expect(container.textContent).toContain('foglald össze');
    const promptTextarea = [...container.querySelectorAll('textarea')].find(
      (textarea) => textarea.value === 'foglald össze',
    );
    if (promptTextarea === undefined) {
      throw new Error('a teszt nem találta a prompt sablon mezőt');
    }
    act(() => {
      typeInto(promptTextarea, 'módosított prompt');
    });
    const lastCall = onChange.mock.calls.at(-1);
    if (lastCall === undefined) {
      throw new Error('a teszt nem talált onChange hívást');
    }
    expect(lastCall[0]).toMatchObject({
      type: 'join',
      mode: 'ai_synthesis',
      settings: { promptTemplate: 'módosított prompt' },
    });
  });

  it('a mód váltása a másik két módra egy érvényes alapértelmezett beállítást ad, az onUnhandledError megmarad', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        <JoinNodeFields
          config={{ ...MERGE_CONFIG, onUnhandledError: 'fail_run' }}
          onChange={onChange}
          inheritedProviderDescription="nincs"
        />,
      );
    });
    chooseOption(container, MODE_LABEL, 'szkript');
    expect(onChange).toHaveBeenLastCalledWith({
      type: 'join',
      mode: 'script',
      settings: { source: '', runtime: 'expression' },
      onUnhandledError: 'fail_run',
    });

    chooseOption(container, MODE_LABEL, 'AI szintézis');
    const lastCall = onChange.mock.calls.at(-1);
    if (lastCall === undefined) {
      throw new Error('a teszt nem talált onChange hívást');
    }
    expect(lastCall[0]).toMatchObject({ type: 'join', mode: 'ai_synthesis', onUnhandledError: 'fail_run' });

    chooseOption(container, MODE_LABEL, 'összefésülés');
    expect(onChange).toHaveBeenLastCalledWith({
      type: 'join',
      mode: 'merge',
      onUnhandledError: 'fail_run',
    });
  });

  it('választatlan módra (mode: null) csak a mód választó áll, a helyőrző felirattal, és egy választás a mód alapértelmezett beállítását adja (SPEC-008 O-33)', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        <JoinNodeFields
          config={{ type: 'join', mode: null, onUnhandledError: 'fail_branch' }}
          onChange={onChange}
          inheritedProviderDescription="nincs"
        />,
      );
    });
    const trigger = selectTrigger(container, MODE_LABEL);
    expect(trigger.textContent).toBe('Válassz…');
    expect(trigger.querySelector('.select__value')?.classList.contains('select__value--placeholder')).toBe(true);
    expect(container.querySelectorAll('.field')).toHaveLength(1);
    expect(container.querySelector('textarea')).toBeNull();

    chooseOption(container, MODE_LABEL, 'összefésülés');
    expect(onChange).toHaveBeenLastCalledWith({
      type: 'join',
      mode: 'merge',
      onUnhandledError: 'fail_branch',
    });
  });

  it('a mód listája pontosan a három mód, üres opció nélkül, és választás után a helyőrző nem látszik: üresre visszaállni nem lehet (user döntés 2026-10-14)', () => {
    const onChange = vi.fn<(nextConfig: JoinNodeConfig) => void>();
    act(() => {
      root.render(<JoinNodeFields config={MERGE_CONFIG} onChange={onChange} inheritedProviderDescription="nincs" />);
    });
    const trigger = selectTrigger(container, MODE_LABEL);
    expect(trigger.textContent).toBe('összefésülés');
    expect(trigger.querySelector('.select__value')?.classList.contains('select__value--placeholder')).toBe(false);
    const optionLabels = [...selectPanel(trigger).querySelectorAll('[role="option"]')].map(
      (option) => option.querySelector('.menu__text')?.textContent,
    );
    expect(optionLabels).toEqual(['összefésülés', 'szkript', 'AI szintézis']);

    chooseOption(container, MODE_LABEL, 'szkript');
    chooseOption(container, MODE_LABEL, 'AI szintézis');
    chooseOption(container, MODE_LABEL, 'összefésülés');
    expect(onChange.mock.calls.map(([nextConfig]) => nextConfig.mode)).toEqual(['script', 'ai_synthesis', 'merge']);
  });

  it('választatlan módra a `mode` hibája a mód választó alatt jelenik meg, aria kötéssel (SPEC-008 5.4, O-33)', () => {
    act(() => {
      root.render(
        <FieldErrorVisibilityContext.Provider value>
          <FieldErrorsContext.Provider value={new Map([['mode', 'A mező nem lehet üres.']])}>
            <JoinNodeFields
              config={{ type: 'join', mode: null, onUnhandledError: 'fail_run' }}
              onChange={vi.fn()}
              inheritedProviderDescription="nincs"
            />
          </FieldErrorsContext.Provider>
        </FieldErrorVisibilityContext.Provider>,
      );
    });
    const trigger = selectTrigger(container, MODE_LABEL);
    expect(trigger.getAttribute('aria-invalid')).toBe('true');
    const errorElement = container.querySelector('.field__error');
    expect(errorElement?.id).toBe(trigger.getAttribute('aria-describedby'));
    expect(errorElement?.textContent).toBe('A mező nem lehet üres.');
  });

  it('"script" módra a `settings.source` mezőnkénti hibája a forrás mező alatt jelenik meg', () => {
    act(() => {
      root.render(
        <FieldErrorVisibilityContext.Provider value>
          <FieldErrorsContext.Provider value={new Map([['settings.source', 'Kötelező mező']])}>
            <JoinNodeFields config={SCRIPT_CONFIG} onChange={vi.fn()} inheritedProviderDescription="nincs" />
          </FieldErrorsContext.Provider>
        </FieldErrorVisibilityContext.Provider>,
      );
    });
    const textarea = container.querySelector('textarea');
    if (textarea === null) {
      throw new Error('a teszt nem találta a forrás textarea-t');
    }
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    const errorElement = container.querySelector('.field__error');
    expect(errorElement?.id).toBe(textarea.getAttribute('aria-describedby'));
    expect(errorElement?.textContent).toBe('Kötelező mező');
  });

  it('"ai_synthesis" módra a `settings.promptTemplate` hiba a beágyazott AgentStepConfigFields `promptTemplate` mezője alatt jelenik meg (ScopedFieldErrors)', () => {
    act(() => {
      root.render(
        <FieldErrorVisibilityContext.Provider value>
          <FieldErrorsContext.Provider value={new Map([['settings.promptTemplate', 'Kötelező mező']])}>
            <JoinNodeFields config={AI_SYNTHESIS_CONFIG} onChange={vi.fn()} inheritedProviderDescription="nincs" />
          </FieldErrorsContext.Provider>
        </FieldErrorVisibilityContext.Provider>,
      );
    });
    const promptTextarea = [...container.querySelectorAll<HTMLTextAreaElement>('textarea')].find(
      (textarea) => textarea.value === 'foglald össze',
    );
    if (promptTextarea === undefined) {
      throw new Error('a teszt nem találta a prompt sablon mezőt');
    }
    expect(promptTextarea.getAttribute('aria-invalid')).toBe('true');
    const errorElement = container.querySelector('.field__error');
    expect(errorElement?.id).toBe(promptTextarea.getAttribute('aria-describedby'));
    expect(errorElement?.textContent).toBe('Kötelező mező');
  });
});
