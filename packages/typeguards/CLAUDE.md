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

| Fájl                                                                                                                                                                                                                       | Tartalom                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                                                                                                                                                                                                             | barrel, csak újraexport                                                                                                                                                                                                                 |
| `src/test-constants/test-constants.ts`                                                                                                                                                                                     | megosztott szám/dátum konstans, a 15 `.spec.ts` fájl fixture-je; nincs megvalósítás párja (SPEC-002 6.2 pont 5. szabálya)                                                                                                               |
| `src/is-record/is-record.ts` (+ `.spec.ts`)                                                                                                                                                                                | `isRecord`, kulcs-érték objektum szűkítése                                                                                                                                                                                              |
| `src/is-record-with-known-keys/is-record-with-known-keys.ts` (+ `.spec.ts`)                                                                                                                                                | `isRecordWithKnownKeys`, kulcs-érték objektum, amelynek minden saját kulcsa a megadott zárt kulcslista eleme; a `packages/db` `NodeConfig` guardjainak ismeretlen kulcs szabálya használja (SPEC-011 5.2)                               |
| `src/is-non-empty-string/is-non-empty-string.ts` (+ `.spec.ts`)                                                                                                                                                            | `isNonEmptyString`                                                                                                                                                                                                                      |
| `src/is-string-array/is-string-array.ts` (+ `.spec.ts`)                                                                                                                                                                    | `isStringArray`, `readonly string[]` szűkítése; a `packages/db` `workflow-graph` tárgyköréből költözött ide, mert nincs domain témája (PLAN-004 4.5 szekció)                                                                            |
| `src/is-string-record/is-string-record.ts` (+ `.spec.ts`)                                                                                                                                                                  | `isStringRecord`, szöveg értékű kulcs-érték objektum szűkítése; a `packages/db` MCP név hozzárendelései használják (SPEC-009 6.1, 6.2)                                                                                                  |
| `src/is-environment-variable-name/is-environment-variable-name.ts` (+ `.spec.ts`)                                                                                                                                          | `isEnvironmentVariableName`, a POSIX név alakú környezeti változó név szűkítése; a `packages/engine` az agent definíciók MCP hivatkozásain használja (SPEC-009 6.1, T-012-27), a `protocol` párja a Zod `EnvironmentVariableNameSchema` |
| `src/is-unknown-array/is-unknown-array.ts` (+ `.spec.ts`)                                                                                                                                                                  | `isUnknownArray`, `readonly unknown[]` szűkítése (az `Array.isArray` `any[]` szűkítése helyett); a `workflow-language` CEL AST bejárása használja (PLAN-010 T-010-21 A-5)                                                               |
| `src/is-plain-object/is-plain-object.ts` (+ `.spec.ts`)                                                                                                                                                                    | `isPlainObject`, sima objektum prototípus alapú szűkítése (`Object.prototype` vagy `null` prototípus); az `isRecord` az osztálypéldányt, a `Map` és a `Date` példányt is átengedi, ez nem (SPEC-010 7.4)                                |
| `src/is-constructor/` (`is-constructor.ts` + `constructor.ts`), `is-string-resolver/` (`is-string-resolver.ts` + `string-resolver.ts`)                                                                                     | a guard mellett a saját témájához tartozó típus (`Constructor<T>`, `StringResolver<T>`), lásd lent                                                                                                                                      |
| `src/is-boolean/`, `is-date-array/`, `is-float/`, `is-function/` (`isFunction` + `isFunctionReturnAny`), `is-instanceof/`, `is-int/`, `is-nil/`, `is-number/`, `is-numeric/`, `is-object/`, `is-string/`, `is-valid-date/` | felhasználó által bemásolt guardok, mindegyik saját mappában, `<név>.ts` + `<név>.spec.ts`                                                                                                                                              |

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

A `typeguards` a workspace futásidejű függőségei közül semmitől nem függhet, L0 réteg (SPEC-002 4. szekció), hasonlóan a `core` csomaghoz. Az `agent`, a `db`, az `engine`, a `protocol`, a `workflow-language`, az
`apps/server` és az `apps/web` importál innen (ismeretlen alakú értékek szűkítéséhez), ez nem okoz
kört, mert ez a csomag semmitől nem függ.

## Szabályok

**Fájlonként egy exportált guard.** Minden typeguard saját fájlt kap, a fájlnév kebab-case a
projekt konvenciója szerint (például `is-non-empty-string.ts`, nem `string-guards.ts` több
guarddal egy fájlban).

**Minden guardhoz kötelező unit teszt.** Mindkét ágra (amikor igazat ad, amikor hamisat ad)
és a típusszűkítésre is - a `packages/provider-capability/src/evidence/fact/is-known-fact.spec.ts` és
`is-unknown-fact.spec.ts` a követendő minta.

**Domain-specifikus guard NEM ide tartozik.** Ha egy guard egy konkrét, egy csomaghoz kötött
típus (például egy diszkriminált unió egyik ágának) állapotát vizsgálja, az a saját
csomagjába kerül, nem ide. Ez a csomag csak olyan guardot fogad, ami bármelyik workspace
csomagban felmerülhet.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 6.1 és 6.2 szekció, T-002-23
