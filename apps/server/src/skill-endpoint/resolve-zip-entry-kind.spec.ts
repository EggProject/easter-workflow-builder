import { describe, expect, it } from 'vitest';
import { resolveZipEntryKind } from './resolve-zip-entry-kind.ts';

const UNIX = 0x3_14;
const MS_DOS = 0x14;
const unixMode = (mode: number): number => mode * 0x1_00_00;

describe('resolveZipEntryKind', () => {
  it('Unix gazdán a szabályos fájl típus és a / nélküli név fájl', () => {
    expect(resolveZipEntryKind(UNIX, unixMode(0o10_0644), 'a.txt')).toBe('file');
  });

  it('Unix gazdán a könyvtár típus és a / végű név könyvtár', () => {
    expect(resolveZipEntryKind(UNIX, unixMode(0o4_0755), 'a/')).toBe('directory');
  });

  it.each([
    ['szimbolikus link', 0o12_0777, 'link'],
    ['FIFO', 0o1_0644, 'fifo'],
    ['karakteres eszköz', 0o2_0644, 'tty'],
    ['blokk eszköz', 0o6_0644, 'disk'],
    ['socket', 0o14_0644, 'sock'],
  ])('Unix gazdán a(z) %s nem támogatott', (_label, mode, name) => {
    expect(resolveZipEntryKind(UNIX, unixMode(mode), name)).toBe('unsupported');
  });

  it('a könyvtár típus / nélküli névvel, és a fájl típus / végű névvel nem támogatott', () => {
    expect(resolveZipEntryKind(UNIX, unixMode(0o4_0755), 'a')).toBe('unsupported');
    expect(resolveZipEntryKind(UNIX, unixMode(0o10_0644), 'a/')).toBe('unsupported');
  });

  it('nem Unix gazdán a felső bitek figyelmen kívül maradnak, a név dönt', () => {
    expect(resolveZipEntryKind(MS_DOS, unixMode(0o12_0777), 'a.txt')).toBe('file');
    expect(resolveZipEntryKind(MS_DOS, 0x10, 'a/')).toBe('directory');
  });

  it('Unix gazdán üres típus mezővel a név dönt', () => {
    expect(resolveZipEntryKind(UNIX, 0, 'a.txt')).toBe('file');
    expect(resolveZipEntryKind(UNIX, 0, 'a/')).toBe('directory');
  });
});
