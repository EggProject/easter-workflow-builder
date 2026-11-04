/* eslint-disable unicorn/no-null -- a `ScriptConfig` nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-014 5.3). */
import type { ScriptConfig } from '@easter-workflow-builder/protocol';
import { FieldErrorVisibilityContext } from '@easter-workflow-builder/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScriptConfigFields } from './ScriptConfigFields.tsx';
import { TIMEOUT_SECONDS_FIELD_ERROR_MESSAGE } from './timeout-seconds-field-error-message.ts';
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

function runtimeTrigger(container: HTMLElement): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>('button.select');
  if (button === null) {
    throw new Error('a teszt nem találta a runtime select triggert');
  }
  return button;
}

/**
 * A panel `createPortal`-lal a `document.body`-ba kerül, tehát NEM a
 * `container` leszármazottja; a triggerhez az `aria-controls` köti.
 */
function chooseRuntime(container: HTMLElement, optionLabel: string): void {
  const trigger = runtimeTrigger(container);
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

function inputByLabel(container: HTMLElement, label: string): HTMLInputElement {
  const field = [...container.querySelectorAll('.field')].find(
    (candidate) => candidate.querySelector('.field__label')?.textContent === label,
  );
  const input = field?.querySelector('input');
  if (input === null || input === undefined) {
    throw new Error(`a teszt nem találta a "${label}" mezőt`);
  }
  return input;
}

function fieldLabels(container: HTMLElement): (string | null | undefined)[] {
  return [...container.querySelectorAll('.field__label')].map((label) => label.textContent);
}

const EXPRESSION_CONFIG: ScriptConfig = { runtime: 'expression', source: 'input.x + 1' };
const JAVASCRIPT_CONFIG: ScriptConfig = {
  runtime: 'javascript',
  source: 'return 1;',
  timeoutMs: 60_000,
  cwd: '/munka',
  memoryLimitMb: 256,
};
const EMPTY_JAVASCRIPT_CONFIG: ScriptConfig = {
  runtime: 'javascript',
  source: 'return 1;',
  timeoutMs: null,
  cwd: null,
  memoryLimitMb: null,
};

describe('ScriptConfigFields', () => {
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

  function render(config: ScriptConfig, onChange: (next: ScriptConfig) => void, prefix = ''): void {
    act(() => {
      root.render(<ScriptConfigFields config={config} onChange={onChange} fieldPathPrefix={prefix} />);
    });
  }

  it('CEL ágon a runtime választó és a forrás áll, a JavaScript mezők nincsenek, a forrás szerkeszthető', () => {
    const onChange = vi.fn();
    render(EXPRESSION_CONFIG, onChange);
    expect(fieldLabels(container)).toEqual(['Futásidő (runtime)', 'Forrás (source)']);
    expect(runtimeTrigger(container).textContent).toContain('CEL kifejezés');
    const textarea = container.querySelector('textarea');
    if (textarea === null) {
      throw new Error('a teszt nem találta a forrás textarea-t');
    }
    expect(textarea.value).toBe('input.x + 1');
    act(() => {
      typeInto(textarea, 'input.x + 2');
    });
    expect(onChange).toHaveBeenLastCalledWith({ runtime: 'expression', source: 'input.x + 2' });
  });

  it('JavaScript ágon megjelenik az időkorlát, a munkakönyvtár és a memória korlát, az értékekkel és az alapérték feliratokkal', () => {
    render(JAVASCRIPT_CONFIG, vi.fn());
    expect(fieldLabels(container)).toEqual([
      'Futásidő (runtime)',
      'Forrás (source)',
      'Időkorlát (másodperc)',
      'Munkakönyvtár (cwd)',
      'Memória korlát (MB)',
    ]);
    expect(runtimeTrigger(container).textContent).toContain('JavaScript');
    const timeout = inputByLabel(container, 'Időkorlát (másodperc)');
    expect(timeout.type).toBe('number');
    expect(timeout.value).toBe('60');
    expect(timeout.placeholder).toBe('Üresen 60 másodperc');
    const cwd = inputByLabel(container, 'Munkakönyvtár (cwd)');
    expect(cwd.value).toBe('/munka');
    expect(cwd.placeholder).toBe('Üresen a szerver munkakönyvtára');
    const memory = inputByLabel(container, 'Memória korlát (MB)');
    expect(memory.type).toBe('number');
    expect(memory.value).toBe('256');
    expect(memory.placeholder).toBe('Üresen a rendszermemória, legfeljebb 2048 MB');
  });

  it('a null értékű JavaScript mezők üresek', () => {
    render(EMPTY_JAVASCRIPT_CONFIG, vi.fn());
    expect(inputByLabel(container, 'Időkorlát (másodperc)').value).toBe('');
    expect(inputByLabel(container, 'Munkakönyvtár (cwd)').value).toBe('');
    expect(inputByLabel(container, 'Memória korlát (MB)').value).toBe('');
  });

  it('CEL-ről JavaScriptre váltva a cél ág alakja áll, a forrás megmarad', () => {
    const onChange = vi.fn();
    render(EXPRESSION_CONFIG, onChange);
    chooseRuntime(container, 'JavaScript');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({
      runtime: 'javascript',
      source: 'input.x + 1',
      timeoutMs: null,
      cwd: null,
      memoryLimitMb: null,
    });
  });

  it('JavaScriptről CEL-re váltva a JavaScript mezők elmaradnak, a forrás megmarad', () => {
    const onChange = vi.fn();
    render(JAVASCRIPT_CONFIG, onChange);
    chooseRuntime(container, 'CEL kifejezés');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith({ runtime: 'expression', source: 'return 1;' });
  });

  it('a már kiválasztott runtime újraválasztása nem hív, a JavaScript mezők megmaradnak', () => {
    const onChange = vi.fn();
    render(JAVASCRIPT_CONFIG, onChange);
    chooseRuntime(container, 'JavaScript');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('az időkorlát másodpercben szerkeszthető, a tárolt érték ezredmásodperc, üresen null', () => {
    const onChange = vi.fn();
    render(JAVASCRIPT_CONFIG, onChange);
    const timeout = inputByLabel(container, 'Időkorlát (másodperc)');
    act(() => {
      typeInto(timeout, '90');
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...JAVASCRIPT_CONFIG, timeoutMs: 90_000 });
    act(() => {
      typeInto(timeout, '1.5');
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...JAVASCRIPT_CONFIG, timeoutMs: 1500 });
    act(() => {
      typeInto(timeout, '');
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...JAVASCRIPT_CONFIG, timeoutMs: null });
  });

  it('az ezredmásodpercnél finomabb időkorlát nem kerekítődik, törtként megy tovább a mentési sémának', () => {
    const onChange = vi.fn<(nextConfig: ScriptConfig) => void>();
    render(JAVASCRIPT_CONFIG, onChange);
    act(() => {
      typeInto(inputByLabel(container, 'Időkorlát (másodperc)'), '1.0004');
    });
    const nextConfig = onChange.mock.lastCall?.[0];
    if (nextConfig?.runtime !== 'javascript') {
      throw new Error('a teszt nem kapott JavaScript beállítást');
    }
    expect(Number.isSafeInteger(nextConfig.timeoutMs)).toBe(false);
  });

  it('a munkakönyvtár szerkeszthető, üresen null', () => {
    const onChange = vi.fn();
    render(JAVASCRIPT_CONFIG, onChange);
    const cwd = inputByLabel(container, 'Munkakönyvtár (cwd)');
    act(() => {
      typeInto(cwd, '/masik');
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...JAVASCRIPT_CONFIG, cwd: '/masik' });
    act(() => {
      typeInto(cwd, '');
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...JAVASCRIPT_CONFIG, cwd: null });
  });

  it('a memória korlát szerkeszthető, üresen null, a tört érték változatlanul megy a mentési sémának', () => {
    const onChange = vi.fn();
    render(JAVASCRIPT_CONFIG, onChange);
    const memory = inputByLabel(container, 'Memória korlát (MB)');
    act(() => {
      typeInto(memory, '512');
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...JAVASCRIPT_CONFIG, memoryLimitMb: 512 });
    act(() => {
      typeInto(memory, '16.5');
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...JAVASCRIPT_CONFIG, memoryLimitMb: 16.5 });
    act(() => {
      typeInto(memory, '');
    });
    expect(onChange).toHaveBeenLastCalledWith({ ...JAVASCRIPT_CONFIG, memoryLimitMb: null });
  });

  it('a négy mező hibája az előtaggal együtt a saját mezője alatt jelenik meg, aria kötéssel', () => {
    act(() => {
      root.render(
        <FieldErrorVisibilityContext.Provider value>
          <FieldErrorsContext.Provider
            value={
              new Map([
                ['settings.source', 'Forrás hiba'],
                ['settings.timeoutMs', 'Időkorlát hiba'],
                ['settings.cwd', 'Munkakönyvtár hiba'],
                ['settings.memoryLimitMb', 'Memória hiba'],
              ])
            }
          >
            <ScriptConfigFields config={JAVASCRIPT_CONFIG} onChange={vi.fn()} fieldPathPrefix="settings." />
          </FieldErrorsContext.Provider>
        </FieldErrorVisibilityContext.Provider>,
      );
    });
    const messages = [...container.querySelectorAll('.field__error')].map((element) => element.textContent);
    // Az időkorlát mező a séma ezredmásodperces mondata helyett a saját, másodperces mondatát mutatja (T-015-12).
    expect(messages).toEqual([
      'Forrás hiba',
      TIMEOUT_SECONDS_FIELD_ERROR_MESSAGE,
      'Munkakönyvtár hiba',
      'Memória hiba',
    ]);
    const timeout = inputByLabel(container, 'Időkorlát (másodperc)');
    expect(timeout.getAttribute('aria-invalid')).toBe('true');
    const errorId = CSS.escape(timeout.getAttribute('aria-describedby') ?? '');
    expect(container.querySelector(`#${errorId}`)?.textContent).toBe(TIMEOUT_SECONDS_FIELD_ERROR_MESSAGE);
  });

  it('előtag nélkül a node saját útvonalai (`source`, `timeoutMs`) számítanak', () => {
    act(() => {
      root.render(
        <FieldErrorVisibilityContext.Provider value>
          <FieldErrorsContext.Provider value={new Map([['timeoutMs', 'Időkorlát hiba']])}>
            <ScriptConfigFields config={JAVASCRIPT_CONFIG} onChange={vi.fn()} fieldPathPrefix="" />
          </FieldErrorsContext.Provider>
        </FieldErrorVisibilityContext.Provider>,
      );
    });
    expect([...container.querySelectorAll('.field__error')].map((element) => element.textContent)).toEqual([
      TIMEOUT_SECONDS_FIELD_ERROR_MESSAGE,
    ]);
  });
});
