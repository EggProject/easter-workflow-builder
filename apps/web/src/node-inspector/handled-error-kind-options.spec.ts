import { HandledErrorKindSchema } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { HANDLED_ERROR_KIND_OPTION_GROUPS } from './handled-error-kind-options.ts';

describe('HANDLED_ERROR_KIND_OPTION_GROUPS', () => {
  it('a zárt lista minden értéke pontosan egyszer szerepel a csoportokban', () => {
    const values = HANDLED_ERROR_KIND_OPTION_GROUPS.flatMap((group) => group.options.map((option) => option.value));

    expect(values).toHaveLength(HandledErrorKindSchema.options.length);
    expect(new Set(values)).toStrictEqual(new Set(HandledErrorKindSchema.options));
  });

  it('öt csoport van, mindegyikben legalább egy opció, a címek a csomópont katalógus nevei szerint', () => {
    expect(HANDLED_ERROR_KIND_OPTION_GROUPS.map((group) => group.title)).toStrictEqual([
      'Agent lépés',
      'Sablon, kifejezés és kimenet',
      'Vezérlő csomópontok',
      'Al-workflow',
      'Szkript',
    ]);
    expect(HANDLED_ERROR_KIND_OPTION_GROUPS.every((group) => group.options.length > 0)).toBe(true);
  });

  it('minden felirat magyar mondat, és nem a nyers hibaosztály neve', () => {
    const options = HANDLED_ERROR_KIND_OPTION_GROUPS.flatMap((group) => group.options);
    for (const option of options) {
      expect(option.label).toMatch(/\.$/);
      expect(option.label).not.toContain(option.value);
    }
  });

  it('a feliratok egyediek', () => {
    const labels = HANDLED_ERROR_KIND_OPTION_GROUPS.flatMap((group) => group.options.map((option) => option.label));

    expect(new Set(labels).size).toBe(labels.length);
  });
});
