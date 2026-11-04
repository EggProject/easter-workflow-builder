import type { SkillSummary } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillRow } from './SkillRow.tsx';

const SKILL: SkillSummary = {
  name: 'riport-keszito',
  description: 'Havi riportot készít.',
  sizeBytes: 2048,
  modifiedAtMs: Date.UTC(2026, 9, 28, 12, 0, 0),
};

describe('SkillRow', () => {
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

  function render(skill: SkillSummary, onDelete = vi.fn()): void {
    act(() => {
      root.render(<SkillRow skill={skill} onDelete={onDelete} />);
    });
  }

  it('a csoport a skill nevét viseli, a név, a leírás, a méret és a módosítás ideje látszik', () => {
    render(SKILL);

    const group = container.querySelector('[role="group"]');
    expect(group?.classList.contains('skill-row')).toBe(true);
    const title = container.querySelector('.preference-row__title');
    expect(group?.getAttribute('aria-labelledby')).toBe(title?.id);
    expect(title?.textContent).toBe('riport-keszito');
    const hints = [...container.querySelectorAll('.settings-screen__hint')].map((hint) => hint.textContent);
    expect(hints[0]).toBe('Havi riportot készít.');
    expect(hints[1]).toBe(`2.0 KB · Módosítva: ${new Date(SKILL.modifiedAtMs).toLocaleString('hu-HU')}`);
  });

  it('üres leírásnál saját mondat áll a leírás helyén', () => {
    render({ ...SKILL, description: '' });

    expect(container.querySelector('.settings-screen__hint')?.textContent).toBe('Nincs leírás.');
  });

  it('a Törlés gomb sm méretű, a neve a skill nevét hordozza, kattintásra a skillt adja át', () => {
    const onDelete = vi.fn();
    render(SKILL, onDelete);

    const button = container.querySelector('button');
    expect(button?.classList.contains('btn--sm')).toBe(true);
    expect(button?.getAttribute('aria-label')).toBe('Törlés: riport-keszito');
    expect(button?.textContent).toBe('Törlés');
    act(() => {
      button?.click();
    });
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(SKILL);
  });
});
