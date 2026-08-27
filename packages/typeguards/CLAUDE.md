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

| Fájl                                                                                                                                                                                                                                                                 | Tartalom                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/index.ts`                                                                                                                                                                                                                                                       | barrel, újraexport és a csomag eredeti placeholder exportja                                    |
| `src/types.ts`                                                                                                                                                                                                                                                       | `Constructor`, `StringResolver` - helyi pótlás a hiányzó `@pct/ts-typing` csomagra (lásd lent) |
| `src/test-constants.ts`                                                                                                                                                                                                                                              | megosztott szám/dátum konstansok a `.spec.ts` fájloknak (`sonarjs/no-magic-numbers` miatt)     |
| `src/is-record/is-record.ts` (+ `.spec.ts`)                                                                                                                                                                                                                          | `isRecord`, kulcs-érték objektum szűkítése                                                     |
| `src/is-non-empty-string/is-non-empty-string.ts` (+ `.spec.ts`)                                                                                                                                                                                                      | `isNonEmptyString`                                                                             |
| `src/is-boolean/`, `is-constructor/`, `is-date-array/`, `is-float/`, `is-function/` (`isFunction` + `isFunctionReturnAny`), `is-instanceof/`, `is-int/`, `is-nil/`, `is-number/`, `is-numeric/`, `is-object/`, `is-string/`, `is-string-resolver/`, `is-valid-date/` | felhasználó által bemásolt guardok, mindegyik saját mappában, `<név>.ts` + `<név>.spec.ts`     |

A bemásolt guardok `.spec.ts` végződésűek (nem `.test.ts`); az `isRecord`/`isNonEmptyString` párt
ehhez a mintához igazítottuk (mappánként egy egység, lásd lent a fájl konvenciót).

### A hiányzó `@pct/ts-typing` csomag

Négy bemásolt fájl (`is-constructor.ts`, `is-instanceof.ts`, `is-numeric.ts`,
`is-string-resolver.ts`) egy `@pct/ts-typing` nevű csomagból importált típusokat, ami nem
létezik a monorepóban (nincs `package.json` bejegyzés, nincs workspace tag, nincs a
`bun.lock`-ban). A `src/types.ts` pótolja helyben a `Constructor<T>` és `StringResolver<T>`
típusokat. A `NumericString` szándékosan hiányzik onnan: nálunk pusztán `string` alias lenne,
amit a `sonarjs/redundant-type-aliases` elutasítana, ezért az `is-numeric.ts` közvetlenül
`string`-et használ.

## Függőségi irány

A `typeguards` a workspace futásidejű függőségei közül semmitől nem függhet, hasonlóan a
`core` csomaghoz. A `packages/agent-tools` importál innen (ismeretlen alakú JSON válaszok
szűkítéséhez), ez nem okoz kört, mert ez a csomag semmitől nem függ.

## Szabályok

**Fájlonként egy exportált guard.** Minden typeguard saját fájlt kap, a fájlnév kebab-case a
projekt konvenciója szerint (például `is-non-empty-string.ts`, nem `string-guards.ts` több
guarddal egy fájlban).

**Minden guardhoz kötelező unit teszt.** Mindkét ágra (amikor igazat ad, amikor hamisat ad)
és a típusszűkítésre is - a `packages/providers/src/evidence/is-known-fact.spec.ts` és
`is-unknown-fact.spec.ts` a követendő minta.

**Domain-specifikus guard NEM ide tartozik.** Ha egy guard egy konkrét, egy csomaghoz kötött
típus (például egy diszkriminált unió egyik ágának) állapotát vizsgálja, az a saját
csomagjába kerül, nem ide. Ez a csomag csak olyan guardot fogad, ami bármelyik workspace
csomagban felmerülhet.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
