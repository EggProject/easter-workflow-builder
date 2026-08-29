import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * SPEC-004 10.1 szekció, AC-53: "A motor csak helyreállított adatbázissal
 * példányosítható értelemben ... A motor maga soha nem nyit adatbázist."
 * Ezt a garanciát a `database: DatabaseContext` port SZERKEZETILEG adja
 * (SPEC-004 3.2 szekció): a motor mindig egy MÁR megnyitott kapcsolatot kap
 * paraméterként, `openDatabase` nem szerepel a kilenc port között. Ez a
 * teszt gépi bizonyíték arra, hogy ez a garancia a forráskódban sem sérül:
 * a `packages/engine/src` alatt egyetlen TERMÉKKÓD fájl (a `.spec.ts`
 * fájlokon kívül) sem tartalmazza az `openDatabase` azonosítót, sem
 * hívásként, sem importként.
 *
 * **Miért itt, a `startup-recovery` témában áll**, és nem a jövőbeli
 * T-005-29 "konfigurációs invariáns" gyűjtőtesztjében: az AC-53 kifejezetten
 * ennek a témának az elfogadási kritériuma (PLAN-005 T-005-27 sora), a
 * T-005-29 tervezett grep listája (provider azonosító, `@anthropic-ai`,
 * `Date.now`, ...) nem nevesíti az `openDatabase`-t.
 */

const SRC_ROOT = path.join(import.meta.dirname, '..');

function collectProductionSourceFiles(directory: string): readonly string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectProductionSourceFiles(fullPath));
      continue;
    }
    if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('a packages/engine/src egyetlen sora sem nyit adatbázist (SPEC-004 10.1 szekció, AC-53)', () => {
  it('egyetlen termékkód fájl sem tartalmazza az openDatabase azonosítót', () => {
    const files = collectProductionSourceFiles(SRC_ROOT);
    expect(files.length).toBeGreaterThan(0);

    const offenders = files.filter((file) => fs.readFileSync(file, 'utf8').includes('openDatabase'));
    expect(offenders).toStrictEqual([]);
  });
});
