# SPEC-003 F1 fázis: O-5, O-6, O-7, O-8 nyitott kérdés lezárása

Ez a fájl a PLAN-003 F1 fázisának (T-003-3, T-003-4, T-003-5) futtatott próbáit rögzíti,
mielőtt a `packages/db` séma megírása elkezdődött volna. A próbákhoz keletkező kód eldobható
volt, egy ideiglenes, a repón kívüli próba csomagban futott
(`bun add better-sqlite3@13.0.3 @types/better-sqlite3@9.6.0 drizzle-orm@0.45.2
drizzle-kit@0.31.10`), nem került a repóba. A verziók forrása:
[`2026-08-26-toolchain.md`](2026-08-26-toolchain.md).

## O-7: `better-sqlite3` 13.0.3 viselkedése Node 26 alatt (T-003-3)

**Kérdés:** prebuild vagy forrásfordítás történik-e telepítéskor, és betölthető-e a modul.

**Próba és eredmény, helyi Linux környezet (Ubuntu 22.04, aarch64, Node 26.7.0, Bun 1.4.0):**

```
$ bun add better-sqlite3@13.0.3 @types/better-sqlite3@9.6.0
installed better-sqlite3@13.0.3
installed @types/better-sqlite3@9.6.0
5 packages installed [702.00ms]
```

A telepítés **prebuildot** használt, nem forrásfordítást: a csomag `node_modules/better-sqlite3/prebuilds/`
mappája nyolc platform-architektúra kombinációra tartalmaz `.node` bináris fájlt
(`linux-x64.node`, `linux-arm64.node`, `linuxmusl-x64.node`, `linuxmusl-arm64.node`,
`darwin-x64.node`, `darwin-arm64.node`, `win32-x64.node`, `win32-arm64.node`), a
`lib/binding.js` a `process.platform` és `process.arch` alapján ezek közül tölt be egyet, és a
`build/Release/` mappában **nem** keletkezett `.node` fájl (kizárólag `node-gyp` állapot
`.stamp` fájlok), tehát a natív addon forrásfordítás nélkül töltődött be.

Futtatott próba:

```js
import Database from 'better-sqlite3';
const db = new Database(':memory:');
const row = db.prepare('SELECT 1 AS one').get();
// { one: 1 }
db.pragma('foreign_keys = ON');
db.pragma('foreign_keys', { simple: true });
// 1
db.prepare('select sqlite_version() as v').get();
// { v: '3.53.4' }
```

Kimenet: `OK: better-sqlite3 loaded and worked under v26.7.0`. A `new Database(':memory:')` és a
`SELECT 1` lefutott.

**CI runner (`ubuntu-latest`, x64, GitHub Actions, `.github/workflows/ci.yml`).** Közvetlen CI
futtatás ebből a végrehajtásból nem történt (a CI csak PR-en indul). A helyi próba **más**
architektúrán futott (aarch64), mint a CI runner (x64); a bizonyíték nem közvetlen CI futás,
hanem a letöltött npm csomag tartalmának vizsgálata: a `prebuilds/linux-x64.node` fájl jelen
van ugyanabban a `better-sqlite3@13.0.3` tarballban, amit a helyi próba is használt, tehát a
glibc alapú `ubuntu-latest` runner ugyanazon a betöltési útvonalon (platform szerinti prebuild)
jutna működő bináris addonhoz, forrásfordítás nélkül. Ez a tény a végleges CI futás előtt
megállapítható a csomag tartalmából, de a szó szerinti "futtatott próba mindkét
környezetben" kritérium csak a helyi ágra teljesül közvetlen futtatással; a CI ág megerősítése
az első ilyen PR CI futásakor válik ténylegesen megfigyeltté.

**Következtetés:** a blokkoló kockázat (6. szekció, PLAN-003 kockázat tábla) nem áll fenn.
`better-sqlite3` 13.0.3 telepíthető és importálható Node 26.7.0 alatt, prebuild használatával.

## O-8: a `drizzle.config.ts` `schema` glob felszedi-e a téma mappák tábláit (T-003-4)

**Próba.** Egy kétmappás, a `packages/db` tervezett szerkezetét utánzó próba séma:
`src/workflow-graph/workflow.ts`, `src/workflow-graph/workflow-node.ts` (idegen kulccsal és
indexszel), `src/workflow-graph/workflow-repository.ts` (nem tábla, csak függvény, hogy a
glob ne csak a tábla fájlokat kapja el), `src/graph-snapshot/graph-snapshot.ts`, plusz egy
`src/index.ts` barrel. A `drizzle.config.ts`:

```ts
export default defineConfig({ dialect: 'sqlite', schema: './src/**/*.ts', out: './drizzle' });
```

**Eredmény**, `bun x drizzle-kit generate`:

```
3 tables
graph_snapshot 2 columns 0 indexes 0 fks
workflow_node 2 columns 1 indexes 1 fks
workflow 3 columns 0 indexes 0 fks

[✓] Your SQL migration file ➜ drizzle/0000_lonely_eternity.sql 🚀
```

Mind a három tábla felkerült, két különböző téma mappából, a nem tábla exportot tartalmazó
`workflow-repository.ts` és a barrel `index.ts` fájl nem okozott hibát és nem termelt hamis
táblát. **A `./src/**/*.ts` glob felszedi a téma mappák összes tábláját**, explicit
útvonallistára nincs szükség.

**"Nincs séma változás" viselkedés, ugyanaz a séma, második futtatás:**

```
No schema changes, nothing to migrate 😴
```

Kilépési kód `0`, **nem** hoz létre új migrációs fájlt, a `drizzle/` mappa tartalma
változatlan marad (a `0000_lonely_eternity.sql` fájl és a `meta/` könyvtár, új fájl nem
keletkezett). Ez a viselkedés a drizzle-kit dokumentációban szó szerint nincs kimondva
(SPEC-003 O-5 sora), ezért ez a mérés a forrása.

**Következtetés:** a `drizzle.config.ts` `schema` mezője a `./src/**/*.ts` glob mintát kapja,
a T-003-10 lépésben nem kell explicit útvonallistára váltani.

## O-5: `drizzle-kit generate` pontos viselkedése séma változás nélkül (T-003-4)

Lásd fent, ugyanaz a próba zárja: `No schema changes, nothing to migrate 😴`, kilépési kód `0`,
fájlrendszeren nincs hatás. A drift ellenőrző wrapper (T-003-25) erre a viselkedésre épülhet:
egy `git status --porcelain` a `drizzle/` mappára a generálás után jelzi, ha bármi változott.

## O-6: a pillanatkép módosítást tiltó trigger SQL pontos alakja (T-003-5)

**Próba.** A `drizzle-kit generate --custom --name=block-graph-snapshot-update` üres migrációs
fájlt generált (`drizzle/0001_block-graph-snapshot-update.sql`), amibe az alábbi, a SQLite
hivatalos `CREATE TRIGGER` dokumentációja szerinti szintaxis került
(https://sqlite.org/lang_createtrigger.html, "6. The RAISE() function" szakasz):

```sql
CREATE TRIGGER graph_snapshot_no_update
BEFORE UPDATE ON graph_snapshot
BEGIN
  SELECT RAISE(ABORT, 'graph_snapshot is immutable');
END;
```

**Eredmény**, `drizzle-orm/better-sqlite3/migrator` `migrate()` hívással alkalmazva egy
`:memory:` adatbázison, `foreign_keys = ON` pragmával:

```
INSERT ok
DELETE ok
UPDATE blocked as expected: graph_snapshot is immutable SQLITE_CONSTRAINT_TRIGGER
row after failed update attempt: {"hash":"abc","document_version":1}
tables: [ '__drizzle_migrations', 'graph_snapshot', 'workflow_node', 'workflow' ]
triggers: [ 'graph_snapshot_no_update' ]
```

Az `UPDATE` hibázik (`SQLITE_CONSTRAINT_TRIGGER`), a sor tartalma változatlan marad, az
`INSERT` és a `DELETE` sikeres. A `migrate()` mindkét migrációs fájlt (a generált SQL sémát és
a kézzel írt trigger migrációt) egy sorozatban alkalmazta, és felvette a `__drizzle_migrations`
naplótáblát.

**Következtetés:** a trigger a tervezett szintaxissal működik, a T-003-15 lépés ezt a szó
szerinti SQL-t építheti be a `packages/db/drizzle` custom migrációjába. A T-003-15 emiatt
**nem** szűkül a repository szintű zártságra; mindkét védelem (5.5 szekció, 1. és 2. pont)
megvalósítható.
