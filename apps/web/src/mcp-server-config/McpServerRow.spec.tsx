import type { McpServerDefinitionRecord } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { McpServerRow } from './McpServerRow.tsx';

const SERVER: McpServerDefinitionRecord = {
  name: 'github',
  definition: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', 'szerver'],
    envNames: ['GITHUB_TOKEN'],
    envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' },
  },
};

describe('McpServerRow', () => {
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

  it('csoportként a nevével nevezett sor: név, parancs argumentumokkal, változók az alapértelmezett hozzárendeléssel', () => {
    act(() => {
      root.render(<McpServerRow server={SERVER} onEdit={vi.fn()} onDelete={vi.fn()} />);
    });

    const row = container.querySelector('[role="group"]');
    const title = row?.querySelector('.preference-row__title');
    expect(title?.textContent).toBe('github');
    expect(row?.getAttribute('aria-labelledby')).toBe(title?.id);
    const hints = [...(row?.querySelectorAll('.settings-screen__hint') ?? [])].map((hint) => hint.textContent);
    expect(hints).toEqual(['stdio: npx -y szerver', 'Változók: GITHUB_TOKEN ← GITHUB_TOKEN_CEG']);
  });

  it('a Szerkesztés és a Törlés gomb a szervert adja a kezelőnek', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    act(() => {
      root.render(<McpServerRow server={SERVER} onEdit={onEdit} onDelete={onDelete} />);
    });

    act(() => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Szerkesztés: github"]')?.click();
    });
    expect(onEdit).toHaveBeenCalledExactlyOnceWith(SERVER);
    expect(onDelete).not.toHaveBeenCalled();

    act(() => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Törlés: github"]')?.click();
    });
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(SERVER);
  });
});
