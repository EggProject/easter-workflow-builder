/* eslint-disable unicorn/no-null -- a `JoinNodeConfig.onUnhandledError` a dróton ténylegesen `null` értéket hordoz (SPEC-005). */
import type { JoinNodeConfig } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JoinNodeFields } from './JoinNodeFields.tsx';
import { FieldErrorsContext } from './field-errors-context.ts';

function typeInto(element: HTMLSelectElement | HTMLTextAreaElement, value: string): void {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLTextAreaElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

const MERGE_CONFIG: JoinNodeConfig = {
  type: 'join',
  mode: 'merge',
  settings: { strategy: 'concat' },
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
    enabledEngineHooks: [],
    cwd: null,
    additionalDirectories: [],
    sandbox: null,
    agentTools: [],
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

  it('"merge" módra a beállítás nyers JSON-ként szerkeszthető, érvényes objektumra frissít', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<JoinNodeFields config={MERGE_CONFIG} onChange={onChange} inheritedProviderDescription="nincs" />);
    });
    const textarea = container.querySelector('textarea');
    if (textarea === null) {
      throw new Error('a teszt nem találta a settings textarea-t');
    }
    act(() => {
      typeInto(textarea, JSON.stringify({ strategy: 'last' }));
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ settings: { strategy: 'last' } }));
  });

  it('"merge" módra egy nem objektum alakú JSON-ra nem hívja az onChange-et', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<JoinNodeFields config={MERGE_CONFIG} onChange={onChange} inheritedProviderDescription="nincs" />);
    });
    const textarea = container.querySelector('textarea');
    if (textarea === null) {
      throw new Error('a teszt nem találta a settings textarea-t');
    }
    act(() => {
      typeInto(textarea, JSON.stringify([1, 2, 3]));
    });
    expect(onChange).not.toHaveBeenCalled();
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
    expect(container.querySelector('.agent-step-config-fields')).not.toBeNull();
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
    const select = container.querySelector<HTMLSelectElement>('select');
    if (select === null) {
      throw new Error('a teszt nem találta a mód legördülőt');
    }
    act(() => {
      typeInto(select, 'script');
    });
    expect(onChange).toHaveBeenLastCalledWith({
      type: 'join',
      mode: 'script',
      settings: { source: '', runtime: 'expression' },
      onUnhandledError: 'fail_run',
    });

    act(() => {
      typeInto(select, 'ai_synthesis');
    });
    const lastCall = onChange.mock.calls.at(-1);
    if (lastCall === undefined) {
      throw new Error('a teszt nem talált onChange hívást');
    }
    expect(lastCall[0]).toMatchObject({ type: 'join', mode: 'ai_synthesis', onUnhandledError: 'fail_run' });

    act(() => {
      typeInto(select, 'merge');
    });
    expect(onChange).toHaveBeenLastCalledWith({
      type: 'join',
      mode: 'merge',
      settings: {},
      onUnhandledError: 'fail_run',
    });
  });

  it('egy DOM szinten érvénytelen mód értékre nem hívja az onChange-et', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<JoinNodeFields config={MERGE_CONFIG} onChange={onChange} inheritedProviderDescription="nincs" />);
    });
    const select = container.querySelector<HTMLSelectElement>('select');
    if (select === null) {
      throw new Error('a teszt nem találta a mód legördülőt');
    }
    act(() => {
      typeInto(select, 'nincs-ilyen-mod');
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('"script" módra a `settings.source` mezőnkénti hibája a forrás mező alatt jelenik meg', () => {
    act(() => {
      root.render(
        <FieldErrorsContext.Provider value={new Map([['settings.source', 'Kötelező mező']])}>
          <JoinNodeFields config={SCRIPT_CONFIG} onChange={vi.fn()} inheritedProviderDescription="nincs" />
        </FieldErrorsContext.Provider>,
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
        <FieldErrorsContext.Provider value={new Map([['settings.promptTemplate', 'Kötelező mező']])}>
          <JoinNodeFields config={AI_SYNTHESIS_CONFIG} onChange={vi.fn()} inheritedProviderDescription="nincs" />
        </FieldErrorsContext.Provider>,
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
