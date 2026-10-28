import type { SkillSummary } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestState } from '../request-state/request-state.ts';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';
import { SkillLibrarySettingsCard, type SkillLibrarySettingsCardProperties } from './SkillLibrarySettingsCard.tsx';

const ALFA: SkillSummary = { name: 'alfa', description: 'Az alfa skill.', sizeBytes: 100, modifiedAtMs: 1 };
const BETA: SkillSummary = { name: 'beta', description: '', sizeBytes: 200, modifiedAtMs: 2 };

function success(value: readonly SkillSummary[]): RequestState<readonly SkillSummary[]> {
  return { status: 'success', value };
}

describe('SkillLibrarySettingsCard', () => {
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

  function render(overrides: Partial<SkillLibrarySettingsCardProperties> = {}): void {
    act(() => {
      root.render(
        <SkillLibrarySettingsCard
          skillsState={success([ALFA, BETA])}
          uploadSkill={vi.fn()}
          deleteSkill={vi.fn()}
          {...overrides}
        />,
      );
    });
  }

  it('card szekció "Skill könyvtár" címmel, a hozzáférhető nevét a fejléc adja', () => {
    render();

    const section = container.querySelector('section.card');
    const heading = section?.querySelector(':scope > .card__header > h3');
    expect(heading?.textContent).toBe('Skill könyvtár');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
  });

  it('kimondja a két kockázatot: nem tartalmazhat titkot, és futtatható fájlt hordozhat', () => {
    render();

    const text = container.querySelector(':scope section.card > p.settings-screen__hint')?.textContent;
    expect(text).toContain('nem tartalmazhat titkot');
    expect(text).toContain('futtatható fájlokat is hordozhat');
    expect(text).toContain('nem sandbox');
  });

  it('a skilleket a kapott sorrendben, soronként egy csoportban listázza', () => {
    render();

    const titles = [...container.querySelectorAll('.preference-row__title')].map((title) => title.textContent);
    expect(titles).toEqual(['alfa', 'beta']);
    expect(container.querySelector('.empty')).toBeNull();
  });

  it('üres könyvtárnál az Empty elem mutatja az üres állapotot, a feltöltő űrlap ettől még ott van', () => {
    render({ skillsState: success([]) });

    expect(container.querySelector('.empty')?.textContent).toContain('Még nincs feltöltött skill');
    expect(container.querySelector(':scope .empty h3')).toBeNull();
    expect(container.querySelector('.preference-row')).toBeNull();
    expect(container.querySelector('form.skill-upload-form')).not.toBeNull();
  });

  it('a betöltés alatt csontvázat mutat, listát és űrlapot nem', () => {
    render({ skillsState: { status: 'pending' } });

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelector('.preference-row')).toBeNull();
    expect(container.querySelector('form')).toBeNull();
  });

  it('a betöltés előtti idle állapotban is csontvázat mutat', () => {
    render({ skillsState: { status: 'idle' } });

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('a betöltés hibája danger Alert, lista és űrlap nélkül', () => {
    render({ skillsState: { status: 'failure', message: 'A szerver nem érhető el.' } });

    expect(container.querySelector('.alert--danger')?.textContent).toContain('A szerver nem érhető el.');
    expect(container.querySelector('form')).toBeNull();
  });

  it('a sor Törlés gombja a megerősítő modálist nyitja a skill nevével, a törlés a modálisból megy', async () => {
    const deleteSkill = vi.fn((): Promise<RouteOutcome<undefined>> =>
      Promise.resolve({ kind: 'ok', value: undefined }),
    );
    render({ deleteSkill });

    act(() => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Törlés: alfa"]')?.click();
    });
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.querySelector('strong')?.textContent).toBe('alfa');
    expect(deleteSkill).not.toHaveBeenCalled();

    await act(async () => {
      [...document.querySelectorAll('[role="dialog"] button')]
        .find((candidate) => candidate.textContent === 'Törlés')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(deleteSkill).toHaveBeenCalledExactlyOnceWith('alfa');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
