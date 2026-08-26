# packages/providers/src/evidence

## Mi ez a mappa

A háromállapotú bizonyíték réteg: a `Fact<T>` típus és a hozzá tartozó bizonyíték- és
typeguard-fájlok. Ez a réteg nem tud semmit a providerekről vagy a képességmezőkről, csak azt
garantálja, hogy `known` érték ne fordulhasson le bizonyíték nélkül. Ide **nem** kerül
provider-specifikus vagy képesség-specifikus típus, azok a `../capability` alá tartoznak.

## Fájlok

| Fájl                    | Tartalom                                                                |
| ----------------------- | ----------------------------------------------------------------------- |
| `measurement-id.ts`     | `MeasurementId` sablon literál típus                                    |
| `evidence-reference.ts` | `EvidenceReference` diszkriminált unió (mérés, doksi, research szekció) |
| `evidence-list.ts`      | `EvidenceList` nem üres tuple                                           |
| `fact.ts`               | `Fact<TValue>` a `known` / `unknown` ággal                              |
| `is-known-fact.ts`      | `isKnownFact` typeguard                                                 |
| `is-unknown-fact.ts`    | `isUnknownFact` typeguard                                               |

## Függőségi irány

Semmilyen workspace csomagtól nem függ. Csak egymást importálják a fájlok itt belül.

## Szabályok

Egy fájlba egy exportált dolog. Típusrés vagy hiányzó bizonyíték esetén a mező `unknown` marad,
tippelt érték ide nem kerülhet.

## Kapcsolódó dokumentumok

- [`../../../../docs/spec/SPEC-000-provider-wire-measurement.md`](../../../../docs/spec/SPEC-000-provider-wire-measurement.md), 5. szekció
