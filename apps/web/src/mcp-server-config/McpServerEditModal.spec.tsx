import type { McpServerDefinition, McpServerDefinitionRecord } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestState } from '../request-state/request-state.ts';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';
import { McpServerEditModal } from './McpServerEditModal.tsx';

const NAMES: RequestState<readonly string[]> = {
  status: 'success',
  value: ['GITHUB_TOKEN_CEG', 'GITHUB_TOKEN_SAJAT', 'MCP_TOKEN'],
};

const STDIO_RECORD: McpServerDefinitionRecord = {
  name: 'github',
  definition: {
    type: 'stdio',
    command: 'npx',
    args: ['-y'],
    envNames: ['GITHUB_TOKEN'],
    envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' },
  },
};

function saved(record: McpServerDefinitionRecord): RouteOutcome<McpServerDefinitionRecord> {
  return { kind: 'ok', value: record };
}

function typeInto(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  act(() => {
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function clickOn(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  });
}

function pressEnter(input: HTMLInputElement): void {
  act(() => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  });
}

function triggerByLabel(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll<HTMLButtonElement>('button[role="combobox"]')].find(
    (candidate) =>
      document.querySelector(`[id="${CSS.escape(candidate.getAttribute('aria-labelledby') ?? '')}"]`)?.textContent ===
      label,
  );
  if (found === undefined) {
    throw new Error(`a teszt nem talált "${label}" feliratú választót`);
  }
  return found;
}

function choose(label: string, optionLabel: string): void {
  const trigger = triggerByLabel(label);
  clickOn(trigger);
  const panel = document.querySelector(`[id="${CSS.escape(trigger.getAttribute('aria-controls') ?? '')}"]`);
  const option = [...(panel?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])].find(
    (candidate) => candidate.querySelector('.menu__text')?.textContent === optionLabel,
  );
  if (option === undefined) {
    throw new Error(`a teszt nem talált "${optionLabel}" feliratú opciót`);
  }
  clickOn(option);
}

describe('McpServerEditModal', () => {
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
    options: {
      readonly record?: McpServerDefinitionRecord;
      readonly existingNames?: readonly string[];
      readonly environmentNames?: RequestState<readonly string[]>;
      readonly saveServer?: (
        name: string,
        definition: McpServerDefinition,
      ) => Promise<RouteOutcome<McpServerDefinitionRecord>>;
      readonly onClose?: () => void;
    } = {},
  ): void {
    act(() => {
      root.render(
        <McpServerEditModal
          record={options.record}
          existingNames={options.existingNames ?? []}
          environmentNames={options.environmentNames ?? NAMES}
          saveServer={options.saveServer ?? vi.fn()}
          onClose={options.onClose ?? vi.fn()}
        />,
      );
    });
  }

  function inputByLabel(label: string): HTMLInputElement {
    const labelElement = [...container.querySelectorAll('.field__label')].find(
      (candidate) => candidate.textContent === label,
    );
    const input = labelElement?.closest('label')?.querySelector('input');
    if (input === null || input === undefined) {
      throw new Error(`a teszt nem talált "${label}" feliratú mezőt`);
    }
    return input;
  }

  function tagInput(label: string): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>(`input.tagi__input[aria-label="${CSS.escape(label)}"]`);
    if (input === null) {
      throw new Error(`a teszt nem talált "${label}" címkéző mezőt`);
    }
    return input;
  }

  function button(label: string): HTMLButtonElement {
    const found = [...container.querySelectorAll('button')].find((candidate) => candidate.textContent === label);
    if (found === undefined) {
      throw new Error(`a teszt nem találta a "${label}" gombot`);
    }
    return found;
  }

  async function submit(label = 'Mentés'): Promise<void> {
    await act(async () => {
      button(label).click();
      await Promise.resolve();
    });
  }

  function tagTexts(): readonly string[] {
    return [...container.querySelectorAll('.tagi__tag-text')].map((tag) => tag.textContent);
  }

  function fieldErrors(): readonly string[] {
    return [...container.querySelectorAll('.field__error')].map((error) => error.textContent);
  }

  it('új szervernél "MCP szerver hozzáadása" címmel, üres stdio űrlapot mutat, szerkeszthető névvel', () => {
    render();

    expect(container.querySelector(':scope [role="dialog"] h2')?.textContent).toBe('MCP szerver hozzáadása');
    expect(inputByLabel('Név').readOnly).toBe(false);
    expect(triggerByLabel('Típus').textContent).toBe('stdio (helyi parancs)');
    expect(inputByLabel('Parancs').value).toBe('');
    expect(tagInput('Argumentumok')).toBeDefined();
    expect(tagInput('Deklarált környezeti változók')).toBeDefined();
    expect(container.querySelector('.mcp-server-form__hint')).toBeNull();
    expect(button('Mentés')).toBeDefined();
  });

  it('üres beküldésre a név és a parancs alatt jelenik meg a hiba, és a mentés hívása elmarad', async () => {
    const saveServer = vi.fn();
    render({ saveServer });

    expect(fieldErrors()).toEqual([]);
    await submit();

    expect(saveServer).not.toHaveBeenCalled();
    expect(fieldErrors()).toEqual([
      'A név csak betűt, számot, aláhúzást és kötőjelet tartalmazhat, nem lehet üres, és nem lehet __proto__, constructor vagy prototype.',
      'A mező nem lehet üres.',
    ]);
    expect(inputByLabel('Név').getAttribute('aria-invalid')).toBe('true');
  });

  it('a deklarált változó nevek hibája a címkéző mezőhöz van kötve (aria-describedby, aria-invalid), de csak a megjelenésével együtt', () => {
    render();
    expect(tagInput('Deklarált környezeti változók').hasAttribute('aria-invalid')).toBe(false);
    expect(tagInput('Deklarált környezeti változók').hasAttribute('aria-describedby')).toBe(false);

    typeInto(tagInput('Deklarált környezeti változók'), '1ROSSZ');
    pressEnter(tagInput('Deklarált környezeti változók'));

    const error = [...container.querySelectorAll('.field__error')].find((candidate) =>
      candidate.textContent.includes('betűvel vagy aláhúzással kezdődik'),
    );
    expect(error?.id).not.toBe('');
    expect(tagInput('Deklarált környezeti változók').getAttribute('aria-invalid')).toBe('true');
    expect(tagInput('Deklarált környezeti változók').getAttribute('aria-describedby')).toBe(error?.id);
  });

  it('stdio kitöltés után a mentés a nevet és a definíciót adja, siker után bezár', async () => {
    const saveServer = vi.fn(() => Promise.resolve(saved(STDIO_RECORD)));
    const onClose = vi.fn();
    render({ saveServer, onClose });

    typeInto(inputByLabel('Név'), 'github');
    typeInto(inputByLabel('Parancs'), 'npx');
    typeInto(tagInput('Argumentumok'), '-y');
    pressEnter(tagInput('Argumentumok'));
    typeInto(tagInput('Deklarált környezeti változók'), 'GITHUB_TOKEN');
    pressEnter(tagInput('Deklarált környezeti változók'));
    expect(tagTexts()).toEqual(['-y', 'GITHUB_TOKEN']);
    choose('Szerver oldali változó: GITHUB_TOKEN', 'GITHUB_TOKEN_SAJAT');
    await submit();

    expect(saveServer).toHaveBeenCalledExactlyOnceWith('github', {
      type: 'stdio',
      command: 'npx',
      args: ['-y'],
      envNames: ['GITHUB_TOKEN'],
      envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_SAJAT' },
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a hozzárendelés visszaválasztható az "azonos név" opcióra: a bejegyzés kimarad a mentésből', async () => {
    const saveServer = vi.fn(() => Promise.resolve(saved(STDIO_RECORD)));
    render({ record: STDIO_RECORD, saveServer });

    expect(triggerByLabel('Szerver oldali változó: GITHUB_TOKEN').textContent).toBe('GITHUB_TOKEN_CEG');
    choose('Szerver oldali változó: GITHUB_TOKEN', 'azonos név (GITHUB_TOKEN)');
    await submit();

    expect(saveServer).toHaveBeenCalledExactlyOnceWith('github', {
      type: 'stdio',
      command: 'npx',
      args: ['-y'],
      envNames: ['GITHUB_TOKEN'],
      envBindings: {},
    });
  });

  it('címke eltávolítása után a hozzárendelés választója eltűnik', () => {
    render({ record: STDIO_RECORD });
    expect(triggerByLabel('Szerver oldali változó: GITHUB_TOKEN')).toBeDefined();

    clickOn(container.querySelector('button[aria-label="Eltávolítás: GITHUB_TOKEN"]') ?? container);

    expect(container.querySelector('input.tagi__input[aria-label="Deklarált környezeti változók"]')).not.toBeNull();
    expect(document.querySelectorAll('button[role="combobox"]')).toHaveLength(1);
  });

  it('szabálytalan deklarált változó név a hozzáadás után azonnal hibát ad a mező alatt, és a beküldést megállítja', async () => {
    const saveServer = vi.fn();
    render({ saveServer });
    typeInto(inputByLabel('Név'), 'github');
    typeInto(inputByLabel('Parancs'), 'npx');

    typeInto(tagInput('Deklarált környezeti változók'), '1ROSSZ');
    pressEnter(tagInput('Deklarált környezeti változók'));

    expect(fieldErrors()).toEqual([expect.stringContaining('betűvel vagy aláhúzással kezdődik')]);
    await submit();
    expect(saveServer).not.toHaveBeenCalled();
  });

  it('http típusnál az URL és az Authorization változó választó áll, a mentés az authEnvName-et adja', async () => {
    const saveServer = vi.fn(() => Promise.resolve(saved(STDIO_RECORD)));
    render({ saveServer });

    typeInto(inputByLabel('Név'), 'tavoli');
    choose('Típus', 'http (távoli szerver)');
    expect(container.querySelector('input.tagi__input')).toBeNull();
    typeInto(inputByLabel('URL'), '  https://mcp.example.test  ');
    expect(triggerByLabel('Authorization fejléc: szerver oldali változó').textContent).toBe('nincs');
    choose('Authorization fejléc: szerver oldali változó', 'MCP_TOKEN');
    await submit();

    expect(saveServer).toHaveBeenCalledExactlyOnceWith('tavoli', {
      type: 'http',
      url: 'https://mcp.example.test',
      authEnvName: 'MCP_TOKEN',
    });
  });

  it('üres URL a mező alatt ad hibát, sse típusnál is', async () => {
    const saveServer = vi.fn();
    render({ saveServer });
    typeInto(inputByLabel('Név'), 'tavoli');
    choose('Típus', 'sse (távoli szerver)');

    await submit();

    expect(saveServer).not.toHaveBeenCalled();
    expect(fieldErrors()).toEqual(['A mező nem lehet üres.']);
  });

  it('szerkesztésnél a név csak olvasható és megmagyarázott, a mentés a tárolt névvel megy', async () => {
    const saveServer = vi.fn(() => Promise.resolve(saved(STDIO_RECORD)));
    render({ record: STDIO_RECORD, existingNames: ['github'], saveServer });

    expect(container.querySelector(':scope [role="dialog"] h2')?.textContent).toBe('MCP szerver szerkesztése');
    expect(inputByLabel('Név').readOnly).toBe(true);
    expect(inputByLabel('Név').value).toBe('github');
    expect(container.querySelector('.mcp-server-form__hint')?.textContent).toContain('A név nem módosítható');
    expect(container.querySelector('.alert--warning')).toBeNull();
    expect(inputByLabel('Parancs').value).toBe('npx');

    typeInto(inputByLabel('Parancs'), 'node');
    await submit();

    expect(saveServer).toHaveBeenCalledExactlyOnceWith('github', expect.objectContaining({ command: 'node' }));
  });

  it('új szervernél a létező név figyelmeztetést ad, és a gomb Felülírás feliratú', async () => {
    const saveServer = vi.fn(() => Promise.resolve(saved(STDIO_RECORD)));
    render({ existingNames: ['github'], saveServer });
    typeInto(inputByLabel('Parancs'), 'npx');

    typeInto(inputByLabel('Név'), 'github');

    expect(container.querySelector('.alert--warning')?.textContent).toContain('Már van github nevű MCP szerver');
    expect(() => button('Mentés')).toThrow();
    await submit('Felülírás');
    expect(saveServer).toHaveBeenCalledExactlyOnceWith('github', expect.objectContaining({ command: 'npx' }));

    typeInto(inputByLabel('Név'), 'masik');
    expect(container.querySelector('.alert--warning')).toBeNull();
    expect(button('Mentés')).toBeDefined();
  });

  it('a mentés alatt a gomb betöltés állapotú és tiltott, a Mégse is tiltott', async () => {
    const { promise, resolve } = Promise.withResolvers<RouteOutcome<McpServerDefinitionRecord>>();
    render({ record: STDIO_RECORD, saveServer: () => promise });

    await submit();

    expect(button('Mentés').classList.contains('is-loading')).toBe(true);
    expect(button('Mentés').disabled).toBe(true);
    expect(button('Mégse').disabled).toBe(true);

    await act(async () => {
      resolve(saved(STDIO_RECORD));
      await Promise.resolve();
    });
  });

  it('a szerver elutasítása danger Alert a modálisban, a modális nyitva marad', async () => {
    const onClose = vi.fn();
    render({
      record: STDIO_RECORD,
      onClose,
      saveServer: () =>
        Promise.resolve({
          kind: 'error',
          message: 'A kérés érvénytelen.',
          isTransient: false,
        } satisfies RouteOutcome<never>),
    });

    await submit();

    expect(container.querySelector('.alert--danger')?.textContent).toContain('A kérés érvénytelen.');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a szerver környezet neveinek betöltési hibája danger Alert, ha van választó', () => {
    render({ record: STDIO_RECORD, environmentNames: { status: 'failure', message: 'A szerver nem érhető el.' } });

    expect(container.querySelector('.alert--danger')?.textContent).toContain('A szerver nem érhető el.');
  });

  it('deklarált változó nélküli stdio szervernél nincs választó, ezért a betöltési hiba sem jelenik meg', () => {
    render({ environmentNames: { status: 'failure', message: 'A szerver nem érhető el.' } });

    expect(container.querySelector('.alert--danger')).toBeNull();
  });

  it('a Mégse és a Bezárás gomb bezár, mentés nélkül', () => {
    const saveServer = vi.fn();
    const onClose = vi.fn();
    render({ saveServer, onClose });

    act(() => {
      button('Mégse').click();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Bezárás"]')?.click();
    });

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(saveServer).not.toHaveBeenCalled();
  });
});
