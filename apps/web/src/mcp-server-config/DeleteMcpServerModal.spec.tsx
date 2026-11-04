import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';
import { DeleteMcpServerModal } from './DeleteMcpServerModal.tsx';

const OK: RouteOutcome<undefined> = { kind: 'ok', value: undefined };
const SERVER_ERROR: RouteOutcome<undefined> = {
  kind: 'error',
  message: 'A keresett elem nem létezik.',
  isTransient: false,
};

describe('DeleteMcpServerModal', () => {
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
    serverName: string | undefined,
    deleteServer: (name: string) => Promise<RouteOutcome<undefined>>,
    onClose = vi.fn(),
  ): void {
    act(() => {
      root.render(<DeleteMcpServerModal serverName={serverName} onClose={onClose} deleteServer={deleteServer} />);
    });
  }

  function button(label: string): HTMLButtonElement {
    const found = [...container.querySelectorAll('button')].find((candidate) => candidate.textContent === label);
    if (found === undefined) {
      throw new Error(`a teszt nem találta a "${label}" gombot`);
    }
    return found;
  }

  it('szerver nélkül nem rajzol dialógust', () => {
    render(undefined, vi.fn());

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('megnevezi a szervert, kimondja mi vész el, és hogy a hivatkozó workflow indítása hibával áll meg', () => {
    render('github', vi.fn());

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('MCP szerver törlése');
    expect(dialog?.querySelector('strong')?.textContent).toBe('github');
    expect(dialog?.textContent).toContain('definíciója az alapértelmezett hozzárendelésével véglegesen törlődik');
    expect(dialog?.textContent).toContain('a workflow indítása a törlés után hibával áll meg');
  });

  it('a Törlés a szerver nevével hívja a törlést, siker után bezár', async () => {
    const deleteServer = vi.fn(() => Promise.resolve(OK));
    const onClose = vi.fn();
    render('github', deleteServer, onClose);

    await act(async () => {
      button('Törlés').click();
      await Promise.resolve();
    });

    expect(deleteServer).toHaveBeenCalledExactlyOnceWith('github');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a törlés alatt a Törlés gomb betöltés állapotú és tiltott, a Mégse is tiltott', async () => {
    const { promise, resolve } = Promise.withResolvers<RouteOutcome<undefined>>();
    render('github', () => promise);

    await act(async () => {
      button('Törlés').click();
      await Promise.resolve();
    });

    expect(button('Törlés').classList.contains('is-loading')).toBe(true);
    expect(button('Törlés').disabled).toBe(true);
    expect(button('Mégse').disabled).toBe(true);

    await act(async () => {
      resolve(OK);
      await Promise.resolve();
    });
  });

  it('a hiba danger Alert a modálisban, a modális nyitva marad', async () => {
    const onClose = vi.fn();
    render('github', () => Promise.resolve(SERVER_ERROR), onClose);

    await act(async () => {
      button('Törlés').click();
      await Promise.resolve();
    });

    expect(container.querySelector('.alert--danger')?.textContent).toContain('A keresett elem nem létezik.');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('másik szerver megnyitásakor az előző hiba eltűnik', async () => {
    render('github', () => Promise.resolve(SERVER_ERROR));
    await act(async () => {
      button('Törlés').click();
      await Promise.resolve();
    });
    expect(container.querySelector('.alert--danger')).not.toBeNull();

    render('masik', () => Promise.resolve(SERVER_ERROR));

    expect(container.querySelector('.alert--danger')).toBeNull();
  });

  it('a Mégse bezár, törlés nélkül', () => {
    const deleteServer = vi.fn();
    const onClose = vi.fn();
    render('github', deleteServer, onClose);

    act(() => {
      button('Mégse').click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(deleteServer).not.toHaveBeenCalled();
  });
});
