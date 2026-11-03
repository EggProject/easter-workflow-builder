import { describe, expect, it } from 'vitest';
import { isMacOsMetadataEntry } from './is-mac-os-metadata-entry.ts';

describe('isMacOsMetadataEntry', () => {
  it.each(['__MACOSX/', '__MACOSX/._SKILL.md', '__MACOSX/csomag/._SKILL.md'])('a(z) %s bejegyzés kimarad', (entryPath) => {
    expect(isMacOsMetadataEntry(entryPath)).toBe(true);
  });

  it.each(['SKILL.md', 'csomag/__MACOSX/x', '__macosx/x', '__MACOSX2/x', 'x__MACOSX/y'])(
    'a(z) %s bejegyzés nem kimaradó',
    (entryPath) => {
      expect(isMacOsMetadataEntry(entryPath)).toBe(false);
    },
  );
});
