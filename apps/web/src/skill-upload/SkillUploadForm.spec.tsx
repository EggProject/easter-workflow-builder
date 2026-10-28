import type { SkillSummary } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';
import { SkillUploadForm, type SkillUploadFormProperties } from './SkillUploadForm.tsx';

const EXISTING: SkillSummary = { name: 'riport', description: 'Riport.', sizeBytes: 10, modifiedAtMs: 1 };
const UPLOADED: SkillSummary = { name: 'uj-skill', description: 'Új.', sizeBytes: 20, modifiedAtMs: 2 };
const OK: RouteOutcome<SkillSummary> = { kind: 'ok', value: UPLOADED };
const TOO_LARGE: RouteOutcome<SkillSummary> = { kind: 'error', message: 'A csomag túl nagy.', isTransient: false };

function typeInto(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  act(() => {
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function chooseFile(input: HTMLInputElement, files: readonly File[]): void {
  act(() => {
    Object.defineProperty(input, 'files', { configurable: true, value: files });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find((candidate) => candidate.textContent === label);
  if (found === undefined) {
    throw new Error(`a teszt nem találta a "${label}" gombot`);
  }
  return found;
}

async function submit(): Promise<void> {
  await act(async () => {
    button('Feltöltés').click();
    await Promise.resolve();
  });
}

const ARCHIVE = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'csomag.zip', { type: 'application/zip' });

describe('SkillUploadForm', () => {
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

  function render(overrides: Partial<SkillUploadFormProperties> = {}): void {
    act(() => {
      root.render(<SkillUploadForm skills={[EXISTING]} uploadSkill={vi.fn()} {...overrides} />);
    });
  }

  function nameField(): HTMLInputElement {
    const found = container.querySelector<HTMLInputElement>('input.input');
    if (found === null) {
      throw new Error('a teszt nem találta a név mezőt');
    }
    return found;
  }

  function fileInput(): HTMLInputElement {
    const found = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (found === null) {
      throw new Error('a teszt nem találta a fájl választót');
    }
    return found;
  }

  it('a név mező sm méretű "Skill neve" címkével, a feltöltő egyetlen ZIP fájlt fogad, a Feltöltés gomb sm', () => {
    render();

    expect(container.querySelector('.field__label')?.textContent).toBe('Skill neve');
    expect(nameField().classList.contains('input--sm')).toBe(true);
    expect(fileInput().accept).toBe('.zip');
    expect(fileInput().multiple).toBe(false);
    expect(container.querySelector('.dropzone__hint')?.textContent).toBe('ZIP csomag, a gyökerében SKILL.md fájllal');
    expect(button('Feltöltés').classList.contains('btn--sm')).toBe(true);
  });

  it('üres űrlapon a Feltöltés a mezők alatt ad hibát (név, fájl), és a feltöltés hívása elmarad', async () => {
    const uploadSkill = vi.fn();
    render({ uploadSkill });

    expect(container.querySelector('.field__error')).toBeNull();
    await submit();

    expect(uploadSkill).not.toHaveBeenCalled();
    const errors = [...container.querySelectorAll('.field__error')].map((error) => error.textContent);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain('A név 1-64 karakter lehet');
    expect(errors[1]).toBe('Válassz ki egy ZIP csomagot.');
    expect(nameField().getAttribute('aria-invalid')).toBe('true');
  });

  it('érvénytelen névvel és kiválasztott fájllal csak a név hibát mutatja, hívás nélkül', async () => {
    const uploadSkill = vi.fn();
    render({ uploadSkill });
    typeInto(nameField(), 'Rossz Név');
    chooseFile(fileInput(), [ARCHIVE]);

    await submit();

    expect(uploadSkill).not.toHaveBeenCalled();
    const errors = [...container.querySelectorAll('.field__error')].map((error) => error.textContent);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('A név 1-64 karakter lehet');
  });

  it('érvényes névvel fájl nélkül csak a fájl hibát mutatja', async () => {
    const uploadSkill = vi.fn();
    render({ uploadSkill });
    typeInto(nameField(), 'uj-skill');

    await submit();

    expect(uploadSkill).not.toHaveBeenCalled();
    const errors = [...container.querySelectorAll('.field__error')].map((error) => error.textContent);
    expect(errors).toEqual(['Válassz ki egy ZIP csomagot.']);
  });

  it('a kiválasztott fájl a feltöltő alatt sorként látszik, névvel és mérettel; az eltávolítás kiüríti', () => {
    render();
    chooseFile(fileInput(), [ARCHIVE]);

    expect(container.querySelector('.dropzone-file__name')?.textContent).toBe('csomag.zip');
    expect(container.querySelector('.dropzone-file__meta')?.textContent).toBe('4 B');

    act(() => {
      container.querySelector<HTMLButtonElement>('.dropzone-file__remove')?.click();
    });
    expect(container.querySelector('.dropzone-file')).toBeNull();
  });

  it('a fájl választó üres kiválasztása (nincs fájl) kiüríti a kiválasztást', () => {
    render();
    chooseFile(fileInput(), [ARCHIVE]);
    chooseFile(fileInput(), []);

    expect(container.querySelector('.dropzone-file')).toBeNull();
  });

  it('új névvel a feltöltés megerősítés nélkül a körülvágott névvel és a fájl bájtjaival hívódik, siker után az űrlap kiürül', async () => {
    const uploadSkill = vi.fn(() => Promise.resolve(OK));
    render({ uploadSkill });
    typeInto(nameField(), '  uj-skill  ');
    act(() => {
      nameField().dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    chooseFile(fileInput(), [ARCHIVE]);

    await submit();

    expect(uploadSkill).toHaveBeenCalledExactlyOnceWith('uj-skill', ARCHIVE);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(nameField().value).toBe('');
    expect(container.querySelector('.dropzone-file')).toBeNull();
    expect(container.querySelector('.field__error')).toBeNull();
    expect(container.querySelector('.alert--danger')).toBeNull();
  });

  it('a feltöltés alatt a gomb betöltés állapotú és tiltott', async () => {
    const { promise, resolve } = Promise.withResolvers<RouteOutcome<SkillSummary>>();
    render({ uploadSkill: () => promise });
    typeInto(nameField(), 'uj-skill');
    chooseFile(fileInput(), [ARCHIVE]);

    await submit();

    expect(button('Feltöltés').classList.contains('is-loading')).toBe(true);
    expect(button('Feltöltés').disabled).toBe(true);

    await act(async () => {
      resolve(OK);
      await Promise.resolve();
    });
  });

  it('a szerver elutasítása danger Alert az űrlap alatt, az űrlap értéke megmarad', async () => {
    render({ uploadSkill: () => Promise.resolve(TOO_LARGE) });
    typeInto(nameField(), 'uj-skill');
    chooseFile(fileInput(), [ARCHIVE]);

    await submit();

    expect(container.querySelector('.alert--danger')?.textContent).toContain('A csomag túl nagy.');
    expect(nameField().value).toBe('uj-skill');
    expect(container.querySelector('.dropzone-file__name')?.textContent).toBe('csomag.zip');
  });

  it('létező névre a feltöltés a felülírás megerősítő modálisát nyitja, hívás nélkül', async () => {
    const uploadSkill = vi.fn(() => Promise.resolve(OK));
    render({ uploadSkill });
    typeInto(nameField(), 'riport');
    chooseFile(fileInput(), [ARCHIVE]);

    await submit();

    expect(uploadSkill).not.toHaveBeenCalled();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Skill felülírása');
    expect(dialog?.querySelector('strong')?.textContent).toBe('riport');
  });

  it('a felülírás megerősítése után a modális bezár és a feltöltés hívódik', async () => {
    const uploadSkill = vi.fn(() => Promise.resolve(OK));
    render({ uploadSkill });
    typeInto(nameField(), 'riport');
    chooseFile(fileInput(), [ARCHIVE]);
    await submit();

    await act(async () => {
      button('Felülírás').click();
      await Promise.resolve();
    });

    expect(uploadSkill).toHaveBeenCalledExactlyOnceWith('riport', ARCHIVE);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(nameField().value).toBe('');
  });

  it('a felülírás megszakítása bezárja a modálist, feltöltés nélkül, az űrlap értéke megmarad', async () => {
    const uploadSkill = vi.fn(() => Promise.resolve(OK));
    render({ uploadSkill });
    typeInto(nameField(), 'riport');
    chooseFile(fileInput(), [ARCHIVE]);
    await submit();

    act(() => {
      button('Mégse').click();
    });

    expect(uploadSkill).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(nameField().value).toBe('riport');
  });
});
