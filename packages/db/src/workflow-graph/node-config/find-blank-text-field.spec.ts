import { describe, expect, it } from 'vitest';
import { findBlankTextField } from './find-blank-text-field.ts';

describe('findBlankTextField', () => {
  it('üres szövegre a mező útvonalát adja', () => {
    expect(findBlankTextField({ expression: '' }, 'expression')).toBe('expression');
  });

  it('csak szóközből álló szöveget is üresnek vesz', () => {
    expect(findBlankTextField({ expression: ' \t\n ' }, 'expression')).toBe('expression');
  });

  it('nem üres szövegre nincs találat', () => {
    expect(findBlankTextField({ expression: ' x ' }, 'expression')).toBeUndefined();
  });

  it('nem szöveg értékre nincs találat (az alakról az isNodeConfig dönt)', () => {
    expect(findBlankTextField({ expression: 7 }, 'expression')).toBeUndefined();
  });

  it('a csillag a lista elemein megy végig, és az első üres elem indexét adja', () => {
    const value = { branches: [{ key: 'a' }, { key: '' }, { key: '  ' }] };

    expect(findBlankTextField(value, 'branches.*.key')).toBe('branches.1.key');
  });

  it('kitöltött vagy üres listára nincs találat', () => {
    expect(findBlankTextField({ branches: [{ key: 'a' }, { key: 'b' }] }, 'branches.*.key')).toBeUndefined();
    expect(findBlankTextField({ branches: [] }, 'branches.*.key')).toBeUndefined();
  });

  it('a csillag helyén nem lista értékre nincs találat', () => {
    expect(findBlankTextField({ branches: { key: '' } }, 'branches.*.key')).toBeUndefined();
  });

  it('a kulcs előtt nem objektum értékre nincs találat', () => {
    expect(findBlankTextField({ settings: 'szöveg' }, 'settings.source')).toBeUndefined();
    expect(findBlankTextField(undefined, 'settings.source')).toBeUndefined();
  });

  it('beágyazott objektumon át is megtalálja a mezőt', () => {
    expect(findBlankTextField({ settings: { source: '' } }, 'settings.source')).toBe('settings.source');
  });
});
