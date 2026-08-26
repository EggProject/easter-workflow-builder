# packages/typeguards

## Mi ez a mappa

Általános, újrahasznosítható typeguardok könyvtára: olyan `unknown` értéket szűkítő
függvények, amik nem egyetlen domainhez kötöttek, hanem bármelyik workspace csomag
használhatja őket. Ide **nem**
tartozik domain-specifikus typeguard: az a saját csomagjában marad. Például a `Fact`
`known`/`unknown` állapotát ellenőrző `isKnownFact` és `isUnknownFact` a
`packages/providers/src/evidence` alatt van, mert kizárólag a `Fact` típushoz kötött, nem
általános.

## Fájlok

| Fájl                              | Tartalom                                                    |
| --------------------------------- | ----------------------------------------------------------- |
| `src/index.ts`                    | barrel, újraexport és a csomag eredeti placeholder exportja |
| `src/is-record.ts`                | `isRecord`, kulcs-érték objektum szűkítése                  |
| `src/is-record.test.ts`           | az `isRecord` unit tesztje                                  |
| `src/is-non-empty-string.ts`      | `isNonEmptyString`                                          |
| `src/is-non-empty-string.test.ts` | az `isNonEmptyString` unit tesztje                          |

## Függőségi irány

A `typeguards` a workspace futásidejű függőségei közül semmitől nem függhet, hasonlóan a
`core` csomaghoz. A `packages/agent-tools` importál innen (ismeretlen alakú JSON válaszok
szűkítéséhez), ez nem okoz kört, mert ez a csomag semmitől nem függ.

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
