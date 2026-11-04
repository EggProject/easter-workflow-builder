import type { SettingsRecord } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RequestState } from '../request-state/request-state.ts';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';
import { BuiltinSkillsSettingsCard, type BuiltinSkillsSettingsCardProperties } from './BuiltinSkillsSettingsCard.tsx';

/* eslint-disable unicorn/no-null -- a SettingsRecord `defaultProviderId` mezője a dróton ténylegesen `null` értéket hordoz (packages/protocol/src/settings/settings-record.ts). */
const OFF: SettingsRecord = { defaultProviderId: null, persistStreamDeltas: false, builtinSkillsEnabled: false };
const ON: SettingsRecord = { defaultProviderId: null, persistStreamDeltas: false, builtinSkillsEnabled: true };
/* eslint-enable unicorn/no-null */

function success<TValue>(value: TValue): RequestState<TValue> {
  return { status: 'success', value };
}

describe('BuiltinSkillsSettingsCard', () => {
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

  function render(overrides: Partial<BuiltinSkillsSettingsCardProperties> = {}): void {
    act(() => {
      root.render(<BuiltinSkillsSettingsCard settingsState={success(OFF)} saveSettings={vi.fn()} {...overrides} />);
    });
  }

  function switchInput(): HTMLInputElement {
    const found = container.querySelector<HTMLInputElement>('input[role="switch"]');
    if (found === null) {
      throw new Error('a teszt nem találta a kapcsolót');
    }
    return found;
  }

  it('card szekció "Beépített skillek" címmel, a hozzáférhető nevét a fejléc adja', () => {
    render();

    const section = container.querySelector('section.card');
    const heading = section?.querySelector(':scope > .card__header > h3');
    expect(heading?.textContent).toBe('Beépített skillek');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
  });

  it('a Switch kikapcsolt értéknél nincs bekapcsolva, a neve a sor címe, a leírása az "ezután induló lépésekre hat" mondat (O-44)', () => {
    render();

    expect(switchInput().checked).toBe(false);
    const title = container.querySelector('.preference-row__title');
    expect(switchInput().getAttribute('aria-labelledby')).toBe(title?.id);
    const hint = [...container.querySelectorAll('span')].find(
      (candidate) => candidate.id === switchInput().getAttribute('aria-describedby'),
    );
    expect(hint?.textContent).toContain('az ezután induló lépésekre hat');
  });

  it('bekapcsolt értéknél a Switch be van kapcsolva', () => {
    render({ settingsState: success(ON) });

    expect(switchInput().checked).toBe(true);
  });

  it.each([
    ['bekapcsolás', OFF, true],
    ['kikapcsolás', ON, false],
  ])(
    '%s: PUT-ra szánt részleges törzzsel hívja a mentést; futás alatt a kapcsoló tiltott és a Mentés… állapot látszik',
    async (_name, record, expected) => {
      const pending = Promise.withResolvers<RouteOutcome<SettingsRecord>>();
      const saveSettings = vi.fn(() => pending.promise);
      render({ settingsState: success(record), saveSettings });

      await act(async () => {
        switchInput().click();
        await Promise.resolve();
      });

      expect(saveSettings).toHaveBeenCalledWith({ builtinSkillsEnabled: expected });
      expect(switchInput().disabled).toBe(true);
      expect(container.querySelector('[role="status"]')?.textContent).toBe('Mentés…');

      await act(async () => {
        pending.resolve({ kind: 'ok', value: { ...record, builtinSkillsEnabled: expected } });
        await pending.promise;
      });

      expect(switchInput().disabled).toBe(false);
      expect(container.querySelector('[role="status"]')).toBeNull();
      expect(container.querySelector('.alert--danger')).toBeNull();
    },
  );

  it('a mentés hibája danger Alertben jelenik meg, a kapcsoló a mentett értéken marad', async () => {
    const saveSettings = vi.fn(() =>
      Promise.resolve({ kind: 'error', message: 'Váratlan szerver hiba történt.', isTransient: false } as const),
    );
    render({ saveSettings });

    await act(async () => {
      switchInput().click();
      await Promise.resolve();
    });

    expect(container.querySelector('.alert--danger')?.textContent).toContain('Váratlan szerver hiba történt.');
    expect(switchInput().checked).toBe(false);
  });

  it('a beállítás betöltési hibája danger Alertben áll, kapcsoló nélkül', () => {
    render({ settingsState: { status: 'failure', message: 'A szerver nem érhető el.' } });

    expect(container.querySelector('.alert--danger')?.textContent).toContain('A szerver nem érhető el.');
    expect(container.querySelector('input[role="switch"]')).toBeNull();
  });

  it.each([['pending' as const], ['idle' as const]])(
    '%s állapotban csontváz áll a helyén, kapcsoló nélkül',
    (status) => {
      render({ settingsState: { status } });

      expect(container.querySelector(':scope [aria-busy="true"] .skel')).not.toBeNull();
      expect(container.querySelector('input[role="switch"]')).toBeNull();
    },
  );
});
