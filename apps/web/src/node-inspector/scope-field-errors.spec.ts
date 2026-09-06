import { describe, expect, it } from 'vitest';
import { scopeFieldErrors } from './scope-field-errors.ts';

describe('scopeFieldErrors', () => {
  it('az előtaggal kezdődő útvonalakról levágja az előtagot', () => {
    const errors = new Map([
      ['settings.promptTemplate', 'kötelező'],
      ['settings.agents.kutato.prompt', 'kötelező'],
    ]);
    expect([...scopeFieldErrors(errors, 'settings')]).toEqual([
      ['promptTemplate', 'kötelező'],
      ['agents.kutato.prompt', 'kötelező'],
    ]);
  });

  it('az előtagon kívüli útvonalakat eldobja', () => {
    const errors = new Map([
      ['mode', 'érvénytelen mód'],
      ['settings.source', 'kötelező'],
    ]);
    expect([...scopeFieldErrors(errors, 'settings')]).toEqual([['source', 'kötelező']]);
  });

  it('a magát az előtagot megnevező útvonalat NEM veszi be, mert az a mező egésze, nem az almezője', () => {
    const errors = new Map([['settings', 'objektumot vártam']]);
    expect(scopeFieldErrors(errors, 'settings').size).toBe(0);
  });

  it('üres térképre üres térképet ad', () => {
    expect(scopeFieldErrors(new Map<string, string>(), 'settings').size).toBe(0);
  });
});
