/* eslint-disable unicorn/no-null -- a teszt a hivatkozás `authEnvName` mezőjének `null` értékét (nincs felülírás) vizsgálja (SPEC-009 6.2). */
import type { McpServerDefinitionRecord, McpServerReference } from '@easter-workflow-builder/protocol';
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestState } from '../request-state/request-state.ts';
import { McpServerLibraryContext } from './mcp-server-library-context.ts';
import { McpServerReferencesField } from './McpServerReferencesField.tsx';

/**
 * A `detail: 1` kötelező: a `SelectField` a `detail === 0` kattintást
 * billentyűzetből származónak tekinti, és szándékosan nem nyit rá.
 */
function clickOn(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  });
}

function trigger(container: HTMLElement, label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll<HTMLButtonElement>('button.select')].find(
    (candidate) => candidate.closest('.field')?.querySelector('.field__label')?.textContent === label,
  );
  if (found === undefined) {
    throw new Error(`a teszt nem talált "${label}" feliratú választót`);
  }
  return found;
}

function optionLabels(select: HTMLButtonElement): readonly string[] {
  const panel = document.querySelector(`[id="${CSS.escape(select.getAttribute('aria-controls') ?? '')}"]`);
  return [...(panel?.querySelectorAll(':scope [role="option"] .menu__text') ?? [])].map((option) => option.textContent);
}

function choose(container: HTMLElement, label: string, optionLabel: string): void {
  const select = trigger(container, label);
  clickOn(select);
  const panel = document.querySelector(`[id="${CSS.escape(select.getAttribute('aria-controls') ?? '')}"]`);
  const option = [...(panel?.querySelectorAll<HTMLElement>(':scope [role="option"]') ?? [])].find(
    (candidate) => candidate.querySelector('.menu__text')?.textContent === optionLabel,
  );
  if (option === undefined) {
    throw new Error(`a teszt nem talált "${optionLabel}" feliratú opciót a(z) "${label}" mezőben`);
  }
  clickOn(option);
}

function checkbox(container: HTMLElement, label: string): HTMLInputElement {
  const found = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(
    (candidate) => candidate.parentElement?.textContent === label,
  );
  if (found === undefined) {
    throw new Error(`a teszt nem talált "${label}" feliratú jelölőnégyzetet`);
  }
  return found;
}

const GITHUB: McpServerDefinitionRecord = {
  name: 'github',
  definition: {
    type: 'stdio',
    command: 'npx',
    args: [],
    envNames: ['GITHUB_TOKEN', 'GITHUB_ORG'],
    envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' },
  },
};
const TAVOLI: McpServerDefinitionRecord = {
  name: 'tavoli',
  definition: { type: 'http', url: 'https://mcp.example.test', authEnvName: 'TAVOLI_AUTH' },
};
const ESEMENY: McpServerDefinitionRecord = {
  name: 'esemeny',
  definition: { type: 'sse', url: 'https://sse.example.test', authEnvName: null },
};
const NINCS_VALTOZO: McpServerDefinitionRecord = {
  name: 'helyi',
  definition: { type: 'stdio', command: 'tool', args: [], envNames: [], envBindings: {} },
};
const NO_OVERRIDE: McpServerReference = { envBindings: {}, authEnvName: null };

function ok<TValue>(value: TValue): RequestState<TValue> {
  return { status: 'success', value };
}

describe('McpServerReferencesField', () => {
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
    properties: Partial<ComponentProps<typeof McpServerReferencesField>> = {},
    servers: RequestState<readonly McpServerDefinitionRecord[]> = ok([GITHUB, TAVOLI, ESEMENY, NINCS_VALTOZO]),
    environmentNames: RequestState<readonly string[]> = ok(['GITHUB_TOKEN_CEG', 'GITHUB_TOKEN_SAJAT', 'TAVOLI_AUTH']),
  ): void {
    act(() => {
      root.render(
        <McpServerLibraryContext.Provider value={{ servers, environmentNames }}>
          <McpServerReferencesField value={undefined} onChange={vi.fn()} {...properties} />
        </McpServerLibraryContext.Provider>,
      );
    });
  }

  it('betöltés alatt skeleton áll, a lista nem', () => {
    render({}, { status: 'pending' });

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('a lista betöltésének hibája danger Alert', () => {
    render({}, { status: 'failure', message: 'Nem sikerült.' });

    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Nem sikerült.');
  });

  it('üres központi listánál és hivatkozás nélkül a Beállításokra mutató üres állapot áll', () => {
    render({}, ok([]));

    expect(container.textContent).toContain('Még nincs MCP szerver.');
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('a központi lista nevei jelöletlen jelölőnégyzetek, felülírás nélkül', () => {
    render();

    expect(['github', 'tavoli', 'esemeny', 'helyi'].map((name) => checkbox(container, name).checked)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(container.querySelector('button.select')).toBeNull();
  });

  it('bejelölés a névvel, felülírás nélküli hivatkozást ad, a többi hivatkozás megmarad', () => {
    const onChange = vi.fn();
    render({ value: { tavoli: { envBindings: {}, authEnvName: 'TAVOLI_AUTH' } }, onChange });

    act(() => {
      checkbox(container, 'github').click();
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      tavoli: { envBindings: {}, authEnvName: 'TAVOLI_AUTH' },
      github: NO_OVERRIDE,
    });
  });

  it('a jelölés levétele kiveszi a hivatkozást, a többi megmarad', () => {
    const onChange = vi.fn();
    render({ value: { github: NO_OVERRIDE, tavoli: NO_OVERRIDE }, onChange });

    act(() => {
      checkbox(container, 'github').click();
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ tavoli: NO_OVERRIDE });
  });

  it('a bejelölt stdio szerver deklarált változónként mutat választót, a központi alapértelmezéssel', () => {
    render({ value: { github: NO_OVERRIDE } });

    const token = trigger(container, 'github: GITHUB_TOKEN szerver oldali változója');
    expect(token.textContent).toBe('központi alapértelmezés (GITHUB_TOKEN_CEG)');
    expect(trigger(container, 'github: GITHUB_ORG szerver oldali változója').textContent).toBe(
      'központi alapértelmezés (GITHUB_ORG)',
    );
    clickOn(token);
    expect(optionLabels(token)).toEqual([
      'központi alapértelmezés (GITHUB_TOKEN_CEG)',
      'GITHUB_TOKEN_CEG',
      'GITHUB_TOKEN_SAJAT',
      'TAVOLI_AUTH',
    ]);
  });

  it('a szerver oldali név kiválasztása az envBindings bejegyzést írja, a többi bejegyzés megmarad', () => {
    const onChange = vi.fn();
    render({
      value: { github: { envBindings: { GITHUB_ORG: 'ORG_X' }, authEnvName: null } },
      onChange,
    });

    choose(container, 'github: GITHUB_TOKEN szerver oldali változója', 'GITHUB_TOKEN_SAJAT');

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      github: { envBindings: { GITHUB_ORG: 'ORG_X', GITHUB_TOKEN: 'GITHUB_TOKEN_SAJAT' }, authEnvName: null },
    });
  });

  it('a központi alapértelmezés opció törli a felülírást, a többi bejegyzés megmarad', () => {
    const onChange = vi.fn();
    render({
      value: {
        github: { envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_SAJAT', GITHUB_ORG: 'ORG_X' }, authEnvName: null },
      },
      onChange,
    });

    choose(container, 'github: GITHUB_TOKEN szerver oldali változója', 'központi alapértelmezés (GITHUB_TOKEN_CEG)');

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      github: { envBindings: { GITHUB_ORG: 'ORG_X' }, authEnvName: null },
    });
  });

  it('a bejelölt http szerver az Authorization fejléc felülírását mutatja, az alapértelmezéssel', () => {
    const onChange = vi.fn();
    render({ value: { tavoli: NO_OVERRIDE }, onChange });

    const authorization = trigger(container, 'tavoli: Authorization fejléc szerver oldali változója');
    expect(authorization.textContent).toBe('központi alapértelmezés (TAVOLI_AUTH)');
    choose(container, 'tavoli: Authorization fejléc szerver oldali változója', 'GITHUB_TOKEN_SAJAT');

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      tavoli: { envBindings: {}, authEnvName: 'GITHUB_TOKEN_SAJAT' },
    });
  });

  it('a tárolt authEnvName a felülírás: a "központi alapértelmezés" opció `null`-ra állítja', () => {
    const onChange = vi.fn();
    render({
      value: { tavoli: { envBindings: {}, authEnvName: 'GITHUB_TOKEN_SAJAT' } },
      onChange,
    });

    expect(trigger(container, 'tavoli: Authorization fejléc szerver oldali változója').textContent).toBe(
      'GITHUB_TOKEN_SAJAT',
    );
    choose(container, 'tavoli: Authorization fejléc szerver oldali változója', 'központi alapértelmezés (TAVOLI_AUTH)');

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ tavoli: NO_OVERRIDE });
  });

  it('az sse szerver alapértelmezés nélküli Authorization választót kap, "nincs" alapértelmezéssel', () => {
    render({ value: { esemeny: NO_OVERRIDE } });

    expect(trigger(container, 'esemeny: Authorization fejléc szerver oldali változója').textContent).toBe(
      'központi alapértelmezés (nincs)',
    );
  });

  it('deklarált változó nélküli stdio szervernek nincs felülírása', () => {
    render({ value: { helyi: NO_OVERRIDE } });

    expect(checkbox(container, 'helyi').checked).toBe(true);
    expect(container.querySelector('button.select')).toBeNull();
  });

  it('a központi listából hiányzó tárolt név láthatóan jelölt, jelölve marad, felülírás nélkül, és levehető', () => {
    const onChange = vi.fn();
    render({ value: { torolt: NO_OVERRIDE, github: NO_OVERRIDE }, onChange });

    const missing = checkbox(container, 'torolt (hiányzik a központi listából)');
    expect(missing.checked).toBe(true);
    expect(container.textContent).toContain('hibával áll meg');
    // csak a `github` két deklarált változójának választója áll, a hiányzó névé nem
    expect(container.querySelectorAll('button.select')).toHaveLength(2);
    act(() => {
      missing.click();
    });

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ github: NO_OVERRIDE });
  });

  it('érvénytelen alakú tárolt érték: megjegyzés, üres halmaz, a módosítás felülírja', () => {
    const onChange = vi.fn();
    render({ value: ['github'], onChange });

    expect(container.textContent).toContain('A tárolt érték alakja érvénytelen (["github"])');
    expect(checkbox(container, 'github').checked).toBe(false);
    act(() => {
      checkbox(container, 'github').click();
    });
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ github: NO_OVERRIDE });
  });

  it('a szerver környezeti nevek betöltése alatt a felülíró választó betöltés állapotú', () => {
    render({ value: { tavoli: NO_OVERRIDE } }, undefined, { status: 'pending' });

    expect(trigger(container, 'tavoli: Authorization fejléc szerver oldali változója').disabled).toBe(true);
  });

  it('a szerver környezeti nevek hibája danger Alert, ha van hivatkozás; hivatkozás nélkül nincs', () => {
    render({ value: { tavoli: NO_OVERRIDE } }, undefined, { status: 'failure', message: 'Nincs lista.' });
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Nincs lista.');

    render({ value: undefined }, undefined, { status: 'failure', message: 'Nincs lista.' });
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('a Provider nélkül az alapértelmezett, betöltött üres lista áll', () => {
    act(() => {
      root.render(<McpServerReferencesField value={undefined} onChange={vi.fn()} />);
    });

    expect(container.textContent).toContain('Még nincs MCP szerver.');
  });
});
