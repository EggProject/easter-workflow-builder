import { describe, expect, it } from 'vitest';
import { resolveSwitchAria, type SwitchAriaInput } from './resolve-switch-aria.ts';

const BASE: SwitchAriaInput = {
  labelId: 'x-label',
  hintId: 'x-hint',
  hasLabel: false,
  hasHint: false,
  ariaLabelledBy: undefined,
  ariaDescribedBy: undefined,
};

describe('resolveSwitchAria', () => {
  it('címke és hint nélkül sem név, sem leírás nem kerül ki', () => {
    expect(resolveSwitchAria(BASE)).toEqual({ labelledBy: undefined, describedBy: undefined });
  });

  it('címkénél a generált címke azonosító a név forrása', () => {
    expect(resolveSwitchAria({ ...BASE, hasLabel: true }).labelledBy).toBe('x-label');
  });

  it('a hívó nem üres aria-labelledby értéke erősebb a generáltnál', () => {
    expect(resolveSwitchAria({ ...BASE, hasLabel: true, ariaLabelledBy: 'kulso' }).labelledBy).toBe('kulso');
  });

  it('a hívó üres aria-labelledby értéke a generált címkére esik vissza', () => {
    expect(resolveSwitchAria({ ...BASE, hasLabel: true, ariaLabelledBy: '' }).labelledBy).toBe('x-label');
  });

  it('hintnél a hint azonosító a leírás', () => {
    expect(resolveSwitchAria({ ...BASE, hasHint: true }).describedBy).toBe('x-hint');
  });

  it('a hívó aria-describedby értékéhez hozzáfűzi a hint azonosítót', () => {
    expect(resolveSwitchAria({ ...BASE, hasHint: true, ariaDescribedBy: 'a b' }).describedBy).toBe('a b x-hint');
  });

  it('a duplikált azonosítót egyszer adja, a felesleges szóközt eldobja', () => {
    expect(resolveSwitchAria({ ...BASE, hasHint: true, ariaDescribedBy: '  x-hint   a ' }).describedBy).toBe(
      'x-hint a',
    );
  });

  it('csak a hívó aria-describedby értéke hint nélkül változatlanul megmarad', () => {
    expect(resolveSwitchAria({ ...BASE, ariaDescribedBy: 'a' }).describedBy).toBe('a');
  });
});
