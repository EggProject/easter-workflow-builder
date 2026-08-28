import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as barrel from '../index.ts';

/**
 * A SPEC-003 4. elfogadási kritériuma szó szerint: "A barrel **nem** exportál
 * Drizzle tábla objektumot, `drizzle()` példányt, `BetterSQLite3Database`
 * típust vagy `better-sqlite3` szimbólumot. Ezt egy `.spec.ts` mechanikusan
 * igazolja a barrel exportált kulcsainak listáján." Ez a fájl az a `.spec.ts`
 * (T-003-27).
 *
 * **Miért a `sqlite-connection` téma mappában áll.** A SPEC-003 1. kritériuma
 * tiltja, hogy a barrelen kívül bármilyen fájl közvetlenül a `src/` alatt
 * álljon, tehát `src/index.spec.ts` nem lehet. A `sqlite-connection` a
 * barrel egyetlen olyan témája, ami ténylegesen tartja a tiltott
 * szimbólumokat (`drizzle()` példány és `better-sqlite3` handle az
 * `open-database.ts` lezárásában, SPEC-003 9.1 szekció), tehát a zártságot
 * itt kell bizonyítani. Az implementációs pár nélküli `.spec.ts` fájlnak van
 * előzménye a csomagban (`graph-snapshot/graph-snapshot-immutability.spec.ts`).
 *
 * Két, egymást kiegészítő ellenőrzés kell, mert a barrel túlnyomó része
 * `export type`, ami fordításkor törlődik, tehát futásidőben nem
 * felsorolható:
 *
 * 1. futásidejű névtér: pontosan mely ÉRTÉKEK jönnek ki a csomagból,
 * 2. a barrel forrásszövegéből kiolvasott export utasítások: a TÍPUS
 *    exportok neve és minden újraexportált modul útvonala.
 */

const BARREL_PATH = path.join(import.meta.dirname, '..', 'index.ts');

/**
 * Egy `export { ... } from '...';` vagy `export type { ... } from '...';`
 * utasítás. A `[^}]*` a sortöréseket is átfogja, tehát a többsoros
 * blokkokat is megfogja; a komment sorok szándékosan nem illeszkednek erre
 * az alakra, tehát a doksi szövege nem tud hamis találatot adni.
 */
const EXPORT_STATEMENT = /export\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']+)';/g;

function readExportStatements(): { names: readonly string[]; moduleSpecifiers: readonly string[] } {
  const source = fs.readFileSync(BARREL_PATH, 'utf8');
  const names: string[] = [];
  const moduleSpecifiers: string[] = [];
  for (const match of source.matchAll(EXPORT_STATEMENT)) {
    // `noUncheckedIndexedAccess` miatt a csoportok `string | undefined`-ok; a
    // minta felépítéséből következően mindkettő mindig megvan, az `?? ''` csak
    // a fordítót elégíti ki.
    const nameList = match[1] ?? '';
    const specifier = match[2] ?? '';
    names.push(
      ...nameList
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name.length > 0),
    );
    moduleSpecifiers.push(specifier);
  }
  return { names, moduleSpecifiers };
}

describe('a packages/db barrel exportlistája (SPEC-003 9.3 szekció, 4. kritérium)', () => {
  it('futásidőben pontosan a hét nevesített értéket adja ki, factory függvény és adatbázis handle nélkül', () => {
    expect(new Set(Object.keys(barrel))).toStrictEqual(
      new Set([
        'ENV_EASTER_DB_FILE',
        'resolveDatabaseFilePath',
        'defaultDatabaseFilePath',
        'ensureDatabaseDirectory',
        'openDatabase',
        'isRunEventKind',
        'isApprovalDecision',
      ]),
    );
  });

  it('minden újraexportált modul a csomagon belüli, relatív útvonal, tehát külső szimbólum nem szivároghat ki', () => {
    const { moduleSpecifiers } = readExportStatements();
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    for (const specifier of moduleSpecifiers) {
      expect(specifier.startsWith('./')).toBe(true);
    }
    // A két tiltott csomag néven sem szerepelhet.
    expect(moduleSpecifiers).not.toContain('drizzle-orm');
    expect(moduleSpecifiers).not.toContain('drizzle-orm/better-sqlite3');
    expect(moduleSpecifiers).not.toContain('better-sqlite3');
  });

  it('egyetlen exportált név sem Drizzle tábla objektum, drizzle() példány vagy better-sqlite3 szimbólum', () => {
    const { names } = readExportStatements();
    // Épség ellenőrzés: a forrásszövegből kiolvasott lista tartalmazza a
    // futásidőben ténylegesen látható értékeket is, tehát a minta valóban a
    // valódi export utasításokat fogta meg, nem a semmit.
    for (const runtimeName of Object.keys(barrel)) {
      expect(names).toContain(runtimeName);
    }

    const forbiddenExactNames = new Set(['drizzle', 'BetterSQLite3Database', 'SqliteDatabase', 'Database']);
    for (const name of names) {
      expect(name.endsWith('Table')).toBe(false);
      expect(forbiddenExactNames.has(name)).toBe(false);
    }
  });
});
