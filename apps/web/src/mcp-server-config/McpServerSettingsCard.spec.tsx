import type { McpServerDefinition, McpServerDefinitionRecord } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestState } from '../request-state/request-state.ts';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';
import { McpServerSettingsCard, type McpServerSettingsCardProperties } from './McpServerSettingsCard.tsx';

const GITHUB: McpServerDefinitionRecord = {
  name: 'github',
  definition: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', 'szerver'],
    envNames: ['GITHUB_TOKEN'],
    envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' },
  },
};
const TAVOLI: McpServerDefinitionRecord = {
  name: 'tavoli',
  // eslint-disable-next-line unicorn/no-null -- a definíció `authEnvName` mezője `null` a "nincs Authorization" állapotban.
  definition: { type: 'http', url: 'https://mcp.example.test', authEnvName: null },
};

function success(value: readonly McpServerDefinitionRecord[]): RequestState<readonly McpServerDefinitionRecord[]> {
  return { status: 'success', value };
}

function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find((candidate) => candidate.textContent === label);
  if (found === undefined) {
    throw new Error(`a teszt nem találta a "${label}" gombot`);
  }
  return found;
}

describe('McpServerSettingsCard', () => {
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

  function render(overrides: Partial<McpServerSettingsCardProperties> = {}): void {
    act(() => {
      root.render(
        <McpServerSettingsCard
          serversState={success([GITHUB, TAVOLI])}
          environmentNamesState={{ status: 'success', value: ['GITHUB_TOKEN_CEG'] }}
          saveServer={vi.fn()}
          deleteServer={vi.fn()}
          {...overrides}
        />,
      );
    });
  }

  it('card szekció "MCP szerverek" címmel, a hozzáférhető nevét a fejléc adja', () => {
    render();

    const section = container.querySelector('section.card');
    const heading = section?.querySelector(':scope > .card__header > h3');
    expect(heading?.textContent).toBe('MCP szerverek');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
  });

  it('kimondja, hogy a definíció csak neveket tárol, és a lépés felülírhatja a hozzárendelést', () => {
    render();

    const text = container.querySelector(':scope section.card > p.settings-screen__hint')?.textContent;
    expect(text).toContain('csak neveket tárol');
    expect(text).toContain('felülírhatja');
  });

  it('a szervereket a kapott sorrendben, soronként egy csoportban listázza', () => {
    render();

    const titles = [...container.querySelectorAll('.preference-row__title')].map((title) => title.textContent);
    expect(titles).toEqual(['github', 'tavoli']);
    expect(container.querySelector('.empty')).toBeNull();
  });

  it('üres listánál az Empty elem mutatja az üres állapotot, a Hozzáadás gomb ettől még ott van', () => {
    render({ serversState: success([]) });

    expect(container.querySelector('.empty')?.textContent).toContain('Még nincs MCP szerver');
    expect(container.querySelector('.preference-row')).toBeNull();
    expect(button('MCP szerver hozzáadása').classList.contains('btn--sm')).toBe(true);
  });

  it('a betöltés alatt és előtte csontvázat mutat, listát és gombot nem', () => {
    render({ serversState: { status: 'pending' } });
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelector('.preference-row')).toBeNull();
    expect(container.querySelector('button.mcp-server-card__add')).toBeNull();

    render({ serversState: { status: 'idle' } });
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('a betöltés hibája danger Alert, lista nélkül', () => {
    render({ serversState: { status: 'failure', message: 'A szerver nem érhető el.' } });

    expect(container.querySelector('.alert--danger')?.textContent).toContain('A szerver nem érhető el.');
    expect(container.querySelector('.preference-row')).toBeNull();
  });

  it('a Hozzáadás gomb üres szerkesztő modálist nyit a létező nevekkel, a Mégse bezárja', () => {
    render();

    act(() => {
      button('MCP szerver hozzáadása').click();
    });
    expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe('MCP szerver hozzáadása');

    act(() => {
      button('Mégse').click();
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('a sor Szerkesztés gombja a tárolt definícióval nyitja a modálist, a mentés a modálisból megy, siker után bezár', async () => {
    const saveServer = vi.fn<
      (name: string, definition: McpServerDefinition) => Promise<RouteOutcome<McpServerDefinitionRecord>>
    >(() => Promise.resolve({ kind: 'ok', value: GITHUB }));
    render({ saveServer });

    act(() => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Szerkesztés: github"]')?.click();
    });
    expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe('MCP szerver szerkesztése');
    expect(saveServer).not.toHaveBeenCalled();

    await act(async () => {
      button('Mentés').click();
      await Promise.resolve();
    });

    expect(saveServer).toHaveBeenCalledExactlyOnceWith('github', GITHUB.definition);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('a sor Törlés gombja a megerősítő modálist nyitja a szerver nevével, a törlés a modálisból megy', async () => {
    const deleteServer = vi.fn((): Promise<RouteOutcome<undefined>> =>
      Promise.resolve({ kind: 'ok', value: undefined }),
    );
    render({ deleteServer });

    act(() => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Törlés: github"]')?.click();
    });
    expect(document.querySelector('[role="dialog"] strong')?.textContent).toBe('github');
    expect(deleteServer).not.toHaveBeenCalled();

    await act(async () => {
      [...document.querySelectorAll('[role="dialog"] button')]
        .find((candidate) => candidate.textContent === 'Törlés')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(deleteServer).toHaveBeenCalledExactlyOnceWith('github');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
