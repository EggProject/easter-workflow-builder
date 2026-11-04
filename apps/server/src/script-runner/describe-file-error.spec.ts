import { describe, expect, it } from 'vitest';
import { describeFileError } from './describe-file-error.ts';

describe('describeFileError', () => {
  it('a hibakódot és a szkript útvonalát mondja, a gazda üzenetét (abszolút útvonal) nem', () => {
    const error = Object.assign(new Error("ENOENT: no such file or directory, open '/titkos/gyoker/a.txt'"), {
      code: 'ENOENT',
    });
    expect(describeFileError(error, 'a.txt')).toStrictEqual({
      kind: 'rejected',
      name: 'Error',
      message: 'a fájl művelet nem sikerült (ENOENT): a.txt',
    });
  });

  it('kód nélküli hibára csak az útvonalat mondja', () => {
    expect(describeFileError(new Error('/titkos'), 'a.txt')).toStrictEqual({
      kind: 'rejected',
      name: 'Error',
      message: 'a fájl művelet nem sikerült: a.txt',
    });
  });
});
