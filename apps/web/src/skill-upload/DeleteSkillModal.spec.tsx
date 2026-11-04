import type { SkillSummary } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';
import { DeleteSkillModal } from './DeleteSkillModal.tsx';

const SKILL: SkillSummary = { name: 'riport', description: 'Riport.', sizeBytes: 10, modifiedAtMs: 1 };

const OK: RouteOutcome<undefined> = { kind: 'ok', value: undefined };
const SERVER_ERROR: RouteOutcome<undefined> = {
  kind: 'error',
  message: 'A keresett elem nem létezik.',
  isTransient: false,
};

describe('DeleteSkillModal', () => {
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
    skill: SkillSummary | undefined,
    deleteSkill: (name: string) => Promise<RouteOutcome<undefined>>,
    onClose = vi.fn(),
  ): void {
    act(() => {
      root.render(<DeleteSkillModal skill={skill} onClose={onClose} deleteSkill={deleteSkill} />);
    });
  }

  function button(label: string): HTMLButtonElement {
    const found = [...container.querySelectorAll('button')].find((candidate) => candidate.textContent === label);
    if (found === undefined) {
      throw new Error(`a teszt nem találta a "${label}" gombot`);
    }
    return found;
  }

  it('skill nélkül nem rajzol dialógust', () => {
    render(undefined, vi.fn());

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('megnevezi a skillt és kimondja, mi vész el: a könyvtár minden fájlja véglegesen, és a hivatkozó lépés futása hibával áll meg', () => {
    render(SKILL, vi.fn());

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Skill törlése');
    expect(dialog?.querySelector('strong')?.textContent).toBe('riport');
    expect(dialog?.textContent).toContain('könyvtára minden fájljával véglegesen törlődik');
    expect(dialog?.textContent).toContain('hivatkozik a skillre');
  });

  it('a Törlés a skill nevével hívja a törlést, siker után bezár', async () => {
    const deleteSkill = vi.fn(() => Promise.resolve(OK));
    const onClose = vi.fn();
    render(SKILL, deleteSkill, onClose);

    await act(async () => {
      button('Törlés').click();
      await Promise.resolve();
    });

    expect(deleteSkill).toHaveBeenCalledExactlyOnceWith('riport');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a törlés alatt a Törlés gomb betöltés állapotú és tiltott, a Mégse is tiltott', async () => {
    const { promise, resolve } = Promise.withResolvers<RouteOutcome<undefined>>();
    render(SKILL, () => promise);

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
    render(SKILL, () => Promise.resolve(SERVER_ERROR), onClose);

    await act(async () => {
      button('Törlés').click();
      await Promise.resolve();
    });

    expect(container.querySelector('.alert--danger')?.textContent).toContain('A keresett elem nem létezik.');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('másik skill megnyitásakor az előző hiba eltűnik', async () => {
    render(SKILL, () => Promise.resolve(SERVER_ERROR));
    await act(async () => {
      button('Törlés').click();
      await Promise.resolve();
    });
    expect(container.querySelector('.alert--danger')).not.toBeNull();

    render({ ...SKILL, name: 'masik' }, () => Promise.resolve(SERVER_ERROR));

    expect(container.querySelector('.alert--danger')).toBeNull();
  });

  it('a Mégse bezár, törlés nélkül', () => {
    const deleteSkill = vi.fn();
    const onClose = vi.fn();
    render(SKILL, deleteSkill, onClose);

    act(() => {
      button('Mégse').click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(deleteSkill).not.toHaveBeenCalled();
  });
});
