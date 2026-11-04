import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isUnsafeEntryPath } from './is-unsafe-entry-path.ts';

const TARGET = path.join(path.sep, 'tmp', 'skill-cel');

describe('isUnsafeEntryPath', () => {
  it.each(['SKILL.md', 'references/a.md', 'scripts/', 'a/b/c.txt', 'név ékezettel.md'])(
    'a(z) %s útvonal megengedett',
    (entryPath) => {
      expect(isUnsafeEntryPath(entryPath, TARGET)).toBe(false);
    },
  );

  it.each([
    ['abszolút', '/etc/passwd'],
    ['meghajtó jel', 'C:/windows/x'],
    ['meghajtó jel per nélkül', 'c:x'],
    ['visszaper', String.raw`a\b`],
    ['NUL bájt', 'a\0b'],
    ['.. szegmens a gyökérből kilépve', '../x'],
    ['.. szegmens belül', 'a/../b'],
    ['üres szegmens', 'a//b'],
    ['. szegmens', './a'],
    ['üres név', ''],
  ])('a(z) %s útvonal tiltott', (_label, entryPath) => {
    expect(isUnsafeEntryPath(entryPath, TARGET)).toBe(true);
  });
});
