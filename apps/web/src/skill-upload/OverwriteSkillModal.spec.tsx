import type { SkillSummary } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OverwriteSkillModal } from './OverwriteSkillModal.tsx';

const SKILL: SkillSummary = { name: 'riport', description: 'Riport.', sizeBytes: 10, modifiedAtMs: 1 };

describe('OverwriteSkillModal', () => {
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

  function button(label: string): HTMLButtonElement {
    const found = [...container.querySelectorAll('button')].find((candidate) => candidate.textContent === label);
    if (found === undefined) {
      throw new Error(`a teszt nem találta a "${label}" gombot`);
    }
    return found;
  }

  it('skill nélkül nem rajzol dialógust', () => {
    act(() => {
      root.render(<OverwriteSkillModal skill={undefined} onConfirm={undefined} onCancel={vi.fn()} />);
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('megnevezi a skillt és kimondja, mi vész el: a régi tartalom teljes cseréje, hibánál a régi marad', () => {
    act(() => {
      root.render(<OverwriteSkillModal skill={SKILL} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Skill felülírása');
    expect(dialog?.querySelector('strong')?.textContent).toBe('riport');
    expect(dialog?.textContent).toContain('a régi skill teljes tartalmát lecseréli');
    expect(dialog?.textContent).toContain('a régi skill érintetlen marad');
  });

  it('a Felülírás a megerősítést, a Mégse és a bezárás a lemondást hívja', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    act(() => {
      root.render(<OverwriteSkillModal skill={SKILL} onConfirm={onConfirm} onCancel={onCancel} />);
    });

    act(() => {
      button('Felülírás').click();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    act(() => {
      button('Mégse').click();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
