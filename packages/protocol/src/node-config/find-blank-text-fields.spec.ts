import { describe, expect, it } from 'vitest';
import { findBlankTextFields } from './find-blank-text-fields.ts';

describe('findBlankTextFields', () => {
  it('üres szövegre a mező útvonalát adja', () => {
    expect(findBlankTextFields({ expression: '' }, 'expression')).toEqual([['expression']]);
  });

  it('csak szóközből álló szöveget is üresnek vesz', () => {
    expect(findBlankTextFields({ expression: ' \t\n ' }, 'expression')).toEqual([['expression']]);
  });

  it('nem üres szövegre nincs találat', () => {
    expect(findBlankTextFields({ expression: ' x ' }, 'expression')).toEqual([]);
  });

  it('nem szöveg értékre nincs találat (az alakról a séma dönt)', () => {
    expect(findBlankTextFields({ expression: 7 }, 'expression')).toEqual([]);
  });

  it('a csillag a lista minden elemére kiterjed, a konkrét indexszel', () => {
    const value = { branches: [{ key: 'a' }, { key: '' }, { key: '  ' }] };

    expect(findBlankTextFields(value, 'branches.*.key')).toEqual([
      ['branches', 1, 'key'],
      ['branches', 2, 'key'],
    ]);
  });

  it('üres listára nincs találat', () => {
    expect(findBlankTextFields({ branches: [] }, 'branches.*.key')).toEqual([]);
  });

  it('a csillag helyén nem lista értékre nincs találat', () => {
    expect(findBlankTextFields({ branches: { key: '' } }, 'branches.*.key')).toEqual([]);
  });

  it('a kulcs előtt nem objektum értékre nincs találat', () => {
    expect(findBlankTextFields({ settings: 'szöveg' }, 'settings.source')).toEqual([]);
    expect(findBlankTextFields(undefined, 'settings.source')).toEqual([]);
  });

  it('beágyazott objektumon át is megtalálja a mezőt', () => {
    expect(findBlankTextFields({ settings: { source: '' } }, 'settings.source')).toEqual([['settings', 'source']]);
  });
});
