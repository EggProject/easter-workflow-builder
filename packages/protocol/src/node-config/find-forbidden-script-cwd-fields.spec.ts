/* eslint-disable unicorn/no-null -- a `cwd` mező helyén a dróton `null` is állhat */
import { describe, expect, it } from 'vitest';
import { findForbiddenScriptCwdFields } from './find-forbidden-script-cwd-fields.ts';

describe('findForbiddenScriptCwdFields', () => {
  it('a tiltott cwd mezőre a mező útvonalát adja, beágyazva is', () => {
    expect(findForbiddenScriptCwdFields({ cwd: '/proc/self' }, 'cwd')).toEqual([['cwd']]);
    expect(findForbiddenScriptCwdFields({ settings: { cwd: '/dev' } }, 'settings.cwd')).toEqual([['settings', 'cwd']]);
  });

  it.each([
    ['megengedett útvonal', { cwd: '/tmp' }],
    ['null', { cwd: null }],
    ['szám', { cwd: 7 }],
    ['hiányzó mező', {}],
  ])('%s esetén nincs találat', (_description, value) => {
    expect(findForbiddenScriptCwdFields(value, 'cwd')).toEqual([]);
  });

  it('a nem objektum közbenső értékre nincs találat', () => {
    expect(findForbiddenScriptCwdFields({ settings: 7 }, 'settings.cwd')).toEqual([]);
    expect(findForbiddenScriptCwdFields('x', 'cwd')).toEqual([]);
  });
});
