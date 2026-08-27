/* eslint-disable unicorn/no-null -- a `storedDocument` paraméter `string | null`: a `null` azt jelenti, hogy a lenyomathoz nincs sor (SPEC-003 5.6) */
import { describe, expect, it } from 'vitest';
import { resolveSnapshotReuse } from './resolve-snapshot-reuse.ts';

const CANONICAL = '{"nodes":[],"version":1}';

describe('resolveSnapshotReuse', () => {
  it('insert ágat ad, ha a lenyomathoz nincs sor', () => {
    expect(resolveSnapshotReuse(null, CANONICAL)).toEqual({ kind: 'ok', value: 'insert' });
  });

  it('reuse ágat ad, ha a tárolt dokumentum bájtra azonos', () => {
    expect(resolveSnapshotReuse(CANONICAL, CANONICAL)).toEqual({ kind: 'ok', value: 'reuse' });
  });

  it('graph_snapshot_hash_collision hibaágat ad eltérő tárolt dokumentumra', () => {
    const outcome = resolveSnapshotReuse('{"nodes":[],"version":2}', CANONICAL);

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('graph_snapshot_hash_collision');
  });
});
