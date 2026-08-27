import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canonicalizeSnapshotDocument } from './canonicalize-snapshot-document.ts';
import { computeSnapshotHash } from './compute-snapshot-hash.ts';
import { readGraphSnapshot } from './read-graph-snapshot.ts';

/**
 * A commitolt 1. verziójú fixture dokumentum és a hozzá tartozó lenyomat
 * literál (SPEC-003 18. és 48. kritérium).
 *
 * A lenyomat szó szerint áll a kódban, nem futásidőben számolva: **ez a teszt
 * bukik meg, ha a kanonizálás vagy a lenyomat algoritmus valaha észrevétlenül
 * megváltozik**. Ütközés esetén a kanonizálót kell visszaállítani, a literált
 * nem szabad felülírni (PLAN-003 kockázat táblázat).
 */
const FIXTURE_HASH = '113e419e401a4972067366c651af5ffc543e2427aa60eb6631194ef14cb9aa29';

function readFixture(): unknown {
  const text = readFileSync(new URL('graph-snapshot-document-v1-fixture.json', import.meta.url), 'utf8');
  const parsed: unknown = JSON.parse(text);
  return parsed;
}

describe('graph-snapshot-document-v1 fixture', () => {
  it('a mai olvasó megjelenítendő dokumentumot ad belőle', () => {
    const outcome = readGraphSnapshot(readFixture());

    expect(outcome.kind).toBe('ok');
    expect(outcome.kind === 'ok' ? outcome.value.version : 0).toBe(1);
    expect(outcome.kind === 'ok' ? outcome.value.nodes.length : 0).toBe(3);
  });

  it('a kanonizálás és a lenyomat képzés pontosan a commitolt literált adja', () => {
    const canonical = canonicalizeSnapshotDocument(readFixture());

    expect(canonical.kind).toBe('ok');
    if (canonical.kind !== 'ok') {
      return;
    }
    expect(computeSnapshotHash(canonical.value)).toBe(FIXTURE_HASH);
    expect(FIXTURE_HASH).toMatch(/^[\da-f]{64}$/);
  });

  it('a kanonikus szöveg kulcsai UTF-16 sorrendben állnak, és a kanonizálás idempotens', () => {
    const canonical = canonicalizeSnapshotDocument(readFixture());

    expect(canonical.kind).toBe('ok');
    if (canonical.kind !== 'ok') {
      return;
    }
    // A gyökér kulcsai rendezve: `edges`, `nodes`, `sdkVersionPin`, `version`,
    // `workflow` - a fixture fájlban ez a sorrend más.
    expect(canonical.value.startsWith('{"edges":[')).toBe(true);
    expect(canonical.value).not.toContain('\n');
    // A saját kimenetét visszaparsolva ugyanazt a szöveget kell adnia: ez
    // egyszerre igazolja, hogy érvényes JSON, és hogy a rendezés fixpont.
    const reparsed: unknown = JSON.parse(canonical.value);
    expect(canonicalizeSnapshotDocument(reparsed)).toEqual(canonical);
  });
});
