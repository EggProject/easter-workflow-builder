import { describe, expect, it } from 'vitest';
import { computeSnapshotHash } from './compute-snapshot-hash.ts';
import type { GraphSnapshotHash } from './graph-snapshot-hash.ts';
import { isGraphSnapshotHash } from './is-graph-snapshot-hash.ts';

describe('isGraphSnapshotHash', () => {
  it('igazat ad a computeSnapshotHash kimenetére', () => {
    expect(isGraphSnapshotHash(computeSnapshotHash('{}'))).toBe(true);
    expect(isGraphSnapshotHash('0'.repeat(64))).toBe(true);
    expect(isGraphSnapshotHash('abcdef0123456789'.repeat(4))).toBe(true);
  });

  it('hamisat ad rossz hosszra', () => {
    expect(isGraphSnapshotHash('')).toBe(false);
    expect(isGraphSnapshotHash('a'.repeat(63))).toBe(false);
    expect(isGraphSnapshotHash('a'.repeat(65))).toBe(false);
    // A SHA-512 lenyomat 128 karakter (F-24), az nem fogadható el.
    expect(isGraphSnapshotHash('a'.repeat(128))).toBe(false);
  });

  it('hamisat ad nagybetűs vagy nem hexadecimális karakterre', () => {
    expect(isGraphSnapshotHash('A'.repeat(64))).toBe(false);
    expect(isGraphSnapshotHash(`${'a'.repeat(63)}g`)).toBe(false);
    expect(isGraphSnapshotHash(`${'a'.repeat(63)}-`)).toBe(false);
  });

  it('hamisat ad sortörésre vagy szóközre a lenyomat körül', () => {
    expect(isGraphSnapshotHash(`${'a'.repeat(64)}\n`)).toBe(false);
    expect(isGraphSnapshotHash(`\n${'a'.repeat(64)}`)).toBe(false);
    expect(isGraphSnapshotHash(` ${'a'.repeat(64)}`)).toBe(false);
  });

  it('hamisat ad nem szöveg bemenetre', () => {
    expect(isGraphSnapshotHash(undefined)).toBe(false);
    expect(isGraphSnapshotHash(7)).toBe(false);
    expect(isGraphSnapshotHash({ hash: 'a'.repeat(64) })).toBe(false);
    expect(isGraphSnapshotHash([computeSnapshotHash('{}')])).toBe(false);
  });

  it('igaz ágon GraphSnapshotHash típusra szűkít', () => {
    const value: unknown = computeSnapshotHash('{}');
    if (isGraphSnapshotHash(value)) {
      // Fordítási idejű állítás: a szűkített érték a névleges típusra értékelhető.
      const narrowed: GraphSnapshotHash = value;
      expect(narrowed).toBe(computeSnapshotHash('{}'));
    } else {
      expect.unreachable('a computeSnapshotHash kimenete érvényes lenyomat');
    }
  });
});
