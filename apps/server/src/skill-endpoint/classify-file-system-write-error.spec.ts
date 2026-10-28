import { describe, expect, it } from 'vitest';
import { classifyFileSystemWriteError } from './classify-file-system-write-error.ts';

describe('classifyFileSystemWriteError', () => {
  it.each([
    ['ENAMETOOLONG', 'skill_archive_unreadable'],
    ['EEXIST', 'skill_archive_path_collision'],
    ['ENOTDIR', 'skill_archive_path_collision'],
    ['EISDIR', 'skill_archive_path_collision'],
  ])('a csomag okozta %s kód osztálya %s', (code, errorClass) => {
    expect(classifyFileSystemWriteError(code)).toBe(errorClass);
  });

  it.each(['ENOSPC', 'EACCES', 'EIO', 'EMFILE', 'EROFS'])('a szerver oldali %s kód nem kliens hiba', (code) => {
    expect(classifyFileSystemWriteError(code)).toBeUndefined();
  });
});
