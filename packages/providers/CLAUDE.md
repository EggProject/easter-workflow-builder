# packages/providers

## Mi ez a mappa

Provider config fájlok és capability leírók. **Jelenleg üres váz**, csak egy placeholder
export van benne. Ez a `src/providers/` migrációjának célmappája, de a migráció **nem**
ennek a lépésnek a része: a `src/providers/` a repo gyökerén marad érintetlenül, amíg a
migráció önálló lépésként le nem fut (lásd SPEC-001 13. szekció).

## Fájlok

| Fájl | Tartalom |
|---|---|
| `src/index.ts` | placeholder export, csak hogy a csomag lefordulhasson |

## Függőségi irány

A `providers` a `core` csomagtól függhet, mástól nem.

## Szabályok

Nincs csomagra jellemző kiegészítő szabály a gyökér `CLAUDE.md`-hez képest. Migráció
után a `one-export-per-file` munkautasítás és a mérési próza kiemelésének szabálya
lesz érvényes (SPEC-001 13. szekció).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. és 13. szekció
- [`../../src/providers/CLAUDE.md`](../../src/providers/CLAUDE.md), az ideiglenes hely, ahonnan a migráció indul
