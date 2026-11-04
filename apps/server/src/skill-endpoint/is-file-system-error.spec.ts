import { mkdir } from 'node:fs/promises';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { isFileSystemError, type FileSystemError } from './is-file-system-error.ts';

async function failureOf(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation;
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('isFileSystemError', () => {
  it('a valódi fájlrendszer hibát felismeri, és a típust szűkíti', async () => {
    const error = await failureOf(mkdir('/nem-letezo-szulo/gyerek'));
    expect(isFileSystemError(error)).toBe(true);
    if (isFileSystemError(error)) {
      expectTypeOf(error).toEqualTypeOf<FileSystemError>();
      expect(error).toMatchObject({ code: 'ENOENT', syscall: 'mkdir' });
    }
  });

  it.each([
    ['a yauzl hibája (nincs code)', new Error('invalid local file header signature')],
    ['a zlib hibája (nincs syscall)', Object.assign(new Error('incorrect header check'), { code: 'Z_DATA_ERROR' })],
    ['nem Error példány', { code: 'ENOENT', syscall: 'open' }],
    ['nem szöveg code', Object.assign(new Error('x'), { code: 2, syscall: 'open' })],
    ['nem objektum', 'ENOENT'],
    ['undefined', undefined],
  ])('nem fájlrendszer hiba: %s', (_label, value) => {
    expect(isFileSystemError(value)).toBe(false);
  });
});
