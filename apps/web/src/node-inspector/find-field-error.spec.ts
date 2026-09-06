import { describe, expect, it } from 'vitest';
import { findFieldError } from './find-field-error.ts';

describe('findFieldError', () => {
  it('a mező pontos útvonalán talált hibát adja vissza', () => {
    const errors = new Map([['promptTemplate', 'kötelező mező']]);
    expect(findFieldError(errors, 'promptTemplate')).toBe('kötelező mező');
  });

  it('a mező ALATTI útvonal hibáját is felszedi, mert a felhasználó egyetlen mezőt lát', () => {
    const errors = new Map([['backoffMs.1', 'Invalid input']]);
    expect(findFieldError(errors, 'backoffMs')).toBe('Invalid input');
  });

  it('a pontos találat erősebb, mint az alatta lévő', () => {
    const errors = new Map([
      ['backoffMs', 'tömböt vártam'],
      ['backoffMs.1', 'Invalid input'],
    ]);
    expect(findFieldError(errors, 'backoffMs')).toBe('tömböt vártam');
  });

  it('az előtag egyezés pontnál vág, tehát nem szed fel másik mezőt', () => {
    const errors = new Map([['effortLimit', 'érvénytelen']]);
    expect(findFieldError(errors, 'effort')).toBeUndefined();
  });

  it('találat nélkül undefined értéket ad', () => {
    const errors = new Map([['modelId', 'érvénytelen']]);
    expect(findFieldError(errors, 'promptTemplate')).toBeUndefined();
  });

  it('üres térképre undefined értéket ad', () => {
    expect(findFieldError(new Map<string, string>(), 'promptTemplate')).toBeUndefined();
  });
});
