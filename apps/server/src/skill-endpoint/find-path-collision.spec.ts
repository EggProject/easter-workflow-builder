import { describe, expect, it } from 'vitest';
import { findPathCollision } from './find-path-collision.ts';
import type { PlannedZipEntry } from './planned-zip-entry.ts';

const file = (entryPath: string): PlannedZipEntry => ({ path: entryPath, kind: 'file' });
const directory = (entryPath: string): PlannedZipEntry => ({ path: entryPath, kind: 'directory' });

describe('findPathCollision', () => {
  it('eltérő útvonalaknál nincs ütközés, a könyvtár és a benne álló fájl sem ütközik', () => {
    expect(findPathCollision([directory('a'), file('a/b.md'), file('a/c.md'), file('SKILL.md')])).toBeUndefined();
  });

  it('két azonos útvonal ütközik', () => {
    expect(findPathCollision([file('a.md'), file('a.md')])).toBe('a.md');
  });

  it('két csak kis-nagybetűben eltérő útvonal ütközik', () => {
    expect(findPathCollision([file('Readme.md'), file('README.MD')])).toBe('README.MD');
  });

  it('egy fájl és egy azonos nevű könyvtár bejegyzés ütközik', () => {
    expect(findPathCollision([file('x'), directory('X')])).toBe('X');
  });

  it('egy fájl, ami egy másik bejegyzés szülő könyvtára is, ütközik', () => {
    expect(findPathCollision([file('x'), file('x/y.md')])).toBe('x');
  });
});
