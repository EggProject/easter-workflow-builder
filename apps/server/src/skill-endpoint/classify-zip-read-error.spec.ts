import { describe, expect, it } from 'vitest';
import { classifyZipReadError } from './classify-zip-read-error.ts';

describe('classifyZipReadError', () => {
  it.each([
    'compressed/uncompressed size mismatch for stored file: 3 != 2',
    'too many bytes in the stream. expected 1. got at least 2',
    'not enough bytes in the stream. expected 9. got only 2',
  ])('a "%s" méret eltérés', (message) => {
    expect(classifyZipReadError(new Error(message))).toBe('skill_archive_entry_size_mismatch');
  });

  it('az erős titkosítás a titkosított bejegyzés osztálya', () => {
    expect(classifyZipReadError(new Error('strong encryption is not supported'))).toBe('skill_archive_entry_encrypted');
  });

  it('minden más hiba, nem Error érték is, a nem olvasható csomag', () => {
    expect(classifyZipReadError(new Error('invalid local file header signature: 0x0'))).toBe(
      'skill_archive_unreadable',
    );
    expect(classifyZipReadError('valami')).toBe('skill_archive_unreadable');
  });
});
