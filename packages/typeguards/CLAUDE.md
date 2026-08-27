# packages/typeguards

## Mi ez a mappa

Általános, újrahasznosítható typeguardok könyvtára: olyan `unknown` értéket szűkítő
függvények, amik nem egyetlen domainhez kötöttek, hanem bármelyik workspace csomag
használhatja őket. Ide **nem**
tartozik domain-specifikus typeguard: az a saját csomagjában marad. Például a `Fact`
`known`/`unknown` állapotát ellenőrző `isKnownFact` és `isUnknownFact` a
`@easter-workflow-builder/provider-capability` csomag `evidence/fact/` témájában van, mert kizárólag a `Fact`
típushoz kötött, nem általános.

## Fájlok

| Fájl                                                                                                                                                                                                                       | Tartalom                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                                                                                                                                                                                                             | barrel, csak újraexport                                                                                                   |
| `src/test-constants/test-constants.ts`                                                                                                                                                                                     | megosztott szám/dátum konstans, a 15 `.spec.ts` fájl fixture-je; nincs megvalósítás párja (SPEC-002 6.2 pont 5. szabálya) |
| `src/is-record/is-record.ts` (+ `.spec.ts`)                                                                                                                                                                                | `isRecord`, kulcs-érték objektum szűkítése                                                                                |
| `src/is-non-empty-string/is-non-empty-string.ts` (+ `.spec.ts`)                                                                                                                                                            | `isNonEmptyString`                                                                                                        |
| `src/is-constructor/` (`is-constructor.ts` + `constructor.ts`), `is-string-resolver/` (`is-string-resolver.ts` + `string-resolver.ts`)                                                                                     | a guard mellett a saját témájához tartozó típus (`Constructor<T>`, `StringResolver<T>`), lásd lent                        |
| `src/is-boolean/`, `is-date-array/`, `is-float/`, `is-function/` (`isFunction` + `isFunctionReturnAny`), `is-instanceof/`, `is-int/`, `is-nil/`, `is-number/`, `is-numeric/`, `is-object/`, `is-string/`, `is-valid-date/` | felhasználó által bemásolt guardok, mindegyik saját mappában, `<név>.ts` + `<név>.spec.ts`                                |

A bemásolt guardok `.spec.ts` végződésűek (nem `.test.ts`); az `isRecord`/`isNonEmptyString` párt
ehhez a mintához igazítottuk (mappánként egy egység, lásd lent a fájl konvenciót).

### A hiányzó `@pct/ts-typing` csomag

Négy bemásolt fájl (`is-constructor.ts`, `is-instanceof.ts`, `is-numeric.ts`,
`is-string-resolver.ts`) egy `@pct/ts-typing` nevű csomagból importált típusokat, ami nem
létezik a monorepóban (nincs `package.json` bejegyzés, nincs workspace tag, nincs a
`bun.lock`-ban). A `Constructor<T>` és a `StringResolver<T>` típus pótolja helyben ezt, a saját
témája mellett (`is-constructor/constructor.ts`, illetve `is-string-resolver/string-resolver.ts`).
Korábban egy közös `src/types.ts` fájlban álltak, a SPEC-002 6.1 pont téma konvenciója szerint
kerültek szét (T-002-23). A `NumericString` szándékosan hiányzik onnan: nálunk pusztán `string`
alias lenne, amit a `sonarjs/redundant-type-aliases` elutasítana, ezért az `is-numeric.ts`
közvetlenül `string`-et használ.

## Függőségi irány

A `typeguards` a workspace futásidejű függőségei közül semmitől nem függhet, L0 réteg (SPEC-002 4. szekció), hasonlóan a `core` csomaghoz. A `@easter-workflow-builder/minimax-client` és a
`@easter-workflow-builder/firecrawl-client` importál innen (ismeretlen alakú JSON válaszok
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
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 6.1 és 6.2 szekció, T-002-23
