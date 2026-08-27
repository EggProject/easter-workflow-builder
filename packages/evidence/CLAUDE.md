# packages/evidence

## Mi ez a mappa

A provider képességleírók háromállapotú bizonyíték típusa (`Fact<TValue>`) és a hozzá tartozó
typeguardok. A `packages/providers` csomag szétbontásából jött létre (SPEC-002 5.2 szekció). Ide
**nem** tartozik a bizonyítékok feloldása konkrét doksi útvonalra vagy research szekcióra: az a
`@easter-workflow-builder/evidence-sources` csomag felelőssége. Ez a csomag csak a típusokat és
az állapotot ismeri, azt nem, hogy hol olvasható el a mérés.

## Fájlok

| Mappa                 | Felelősség                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `evidence-reference/` | mire mutat egy bizonyíték (`MeasurementId`, `EvidenceReference`) és hogyan áll listába (`EvidenceList`)                                       |
| `fact/`               | a háromállapotú érték (`Fact<TValue>`) és a két ágát szűkítő `isKnownFact`/`isUnknownFact` typeguard, a hozzájuk tartozó `.spec.ts` fájlokkal |

A `evidence-reference/measurement-id.ts`, `evidence-reference/evidence-reference.ts`,
`evidence-reference/evidence-list.ts` és a `fact/fact.ts` típus-only fájl, nincs hozzájuk
`.spec.ts` (SPEC-002 6.3 pont).

## Függőségi irány

Nincs workspace függősége, L0 réteg (SPEC-002 4. szekció). Erre a csomagra épül az
`@easter-workflow-builder/evidence-sources`, az `@easter-workflow-builder/provider-capability`,
az `@easter-workflow-builder/provider-minimax`, az `@easter-workflow-builder/provider-claude-subscription`
és az `@easter-workflow-builder/provider-registry`.

## Szabályok

**Tilos bizonyíték nélküli értéket beírni.** Minden képességmező vagy `known` egy nem üres
`evidence` listával, vagy `unknown` indoklással és a blokkoló mérési esettel. A típusrendszer
ezt kikényszeríti: az `EvidenceList` tuple alak miatt üres bizonyítéklistával a `known` ág nem
fordul le, és az `isKnownFact` typeguard nélkül a `value` mező nem olvasható.

**A mérési próza nem ide tartozik.** A kódban csak stabil azonosító (`M-01` ... `M-36`) marad,
doksi URL vagy research szekció formájában. A mérés leírása, a nyers szám és az artefaktum
hivatkozás a `docs/research/` alatt van.

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 5.2 szekció
- [`../../docs/spec/SPEC-000-provider-wire-measurement.md`](../../docs/spec/SPEC-000-provider-wire-measurement.md): a típusterv és a mérési esetek
