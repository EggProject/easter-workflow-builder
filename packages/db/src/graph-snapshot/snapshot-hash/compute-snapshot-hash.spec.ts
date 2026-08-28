import { getHashes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { computeSnapshotHash } from './compute-snapshot-hash.ts';

describe('computeSnapshotHash', () => {
  it('a sha256 elérhető a futtatókörnyezetben', () => {
    // SPEC-003 46. kritérium: az elérhető algoritmusok a platform OpenSSL
    // verziójától függnek (F-23), ezért ezt mérni kell, nem feltételezni. Ha
    // hiányzik, a végrehajtás megáll, és nem választunk magunktól másikat.
    expect(getHashes()).toContain('sha256');
  });

  it('64 karakteres, kisbetűs hexadecimális szöveget ad', () => {
    const digest = computeSnapshotHash('{"a":1}');

    expect(digest).toMatch(/^[\da-f]{64}$/);
  });

  it('a dokumentált alapértelmezett hex kimenetet adja az üres objektumra', () => {
    // A SPEC-003 2. szekciójában rögzített, Node 26.7.0 alatt futtatott
    // ellenőrzés értéke.
    expect(computeSnapshotHash('{}')).toBe('44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a');
  });

  it('eltérő szövegre eltérő lenyomatot ad', () => {
    expect(computeSnapshotHash('{"a":1}')).not.toBe(computeSnapshotHash('{"a":2}'));
  });
});
