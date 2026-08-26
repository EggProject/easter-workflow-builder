# packages/typeguards

## Mi ez a mappa

Általános, újrahasznosítható typeguardok könyvtára: olyan `unknown` értéket szűkítő
függvények, amik nem egyetlen domainhez kötöttek, hanem bármelyik workspace csomag
használhatja őket. **Jelenleg üres váz**, csak egy placeholder export van benne, hogy a
csomag lefordulhasson - a tényleges guardokat a felhasználó másolja be ide. Ide **nem**
tartozik domain-specifikus typeguard: az a saját csomagjában marad. Például a `Fact`
`known`/`unknown` állapotát ellenőrző `isKnownFact` és `isUnknownFact` a
`packages/providers/src/evidence` alatt van, mert kizárólag a `Fact` típushoz kötött, nem
általános.

## Fájlok

| Fájl           | Tartalom                                              |
| -------------- | ----------------------------------------------------- |
| `src/index.ts` | placeholder export, csak hogy a csomag lefordulhasson |

## Függőségi irány

A `typeguards` a workspace futásidejű függőségei közül semmitől nem függhet, hasonlóan a
`core` csomaghoz. Jelenleg egyetlen másik workspace csomag sem importál innen.

## Szabályok

**Fájlonként egy exportált guard.** Minden typeguard saját fájlt kap, a fájlnév kebab-case a
projekt konvenciója szerint (például `is-non-empty-string.ts`, nem `string-guards.ts` több
guarddal egy fájlban).

**Minden guardhoz kötelező unit teszt.** Mindkét ágra (amikor igazat ad, amikor hamisat ad)
és a típusszűkítésre is - a `packages/providers/src/evidence/is-known-fact.test.ts` és
`is-unknown-fact.test.ts` a követendő minta.

**Domain-specifikus guard NEM ide tartozik.** Ha egy guard egy konkrét, egy csomaghoz kötött
típus (például egy diszkriminált unió egyik ágának) állapotát vizsgálja, az a saját
csomagjába kerül, nem ide. Ez a csomag csak olyan guardot fogad, ami bármelyik workspace
csomagban felmerülhet.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
