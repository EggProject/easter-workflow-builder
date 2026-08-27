# packages/evidence-sources

## Mi ez a mappa

A bizonyítékok nevesített forráskatalógusa: hivatalos doksi URL-ek, research szekció
azonosítók, és a `MeasurementId` feloldása `docs/` horgonyra. A `packages/providers` csomag
szétbontásából jött létre (SPEC-002 5.3 szekció). Ide **nem** tartozik a mérés prózai leírása:
a SPEC-001 13. szekció szabálya változatlan, a kódban csak a stabil azonosító és a horgony áll,
a próza a `docs/research/` alatt marad.

## Fájlok

| Mappa                   | Felelősség                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `measurement-document/` | hol olvasható el egy hivatkozott mérés: doksi URL szótár, research szekció azonosítók, `MeasurementId` feloldás |

Egy téma, három fájl: a `document-url.ts` (13 exportált konstans), a `research-section.ts` és a
`measurement-document.ts` ugyanannak a kérdésnek a három rétege, ezért egy mappában állnak
(SPEC-002 6.4 pont, azonos szótárba tartozó konstanshalmaz).

## Függőségi irány

`@easter-workflow-builder/evidence` csomagtól függ (a `MeasurementId` típus miatt), L1 réteg
(SPEC-002 4. szekció). Erre a csomagra épül az `@easter-workflow-builder/provider-minimax`, az
`@easter-workflow-builder/provider-claude-subscription` és az
`@easter-workflow-builder/provider-registry`.

## Szabályok

**A mérési próza nem ide tartozik.** A kódban csak stabil azonosító (`M-01` ... `M-36`), doksi
URL vagy research szekció azonosító marad. A mérés leírása, a nyers szám és az artefaktum
hivatkozás a `docs/research/` alatt van, a `measurement-document.ts` csak a `MeasurementId` ->
docs horgony leképezést oldja fel, ide nem szabad prózát átmásolni.

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 5.3 szekció
- [`../../docs/research/2026-08-26-spec000-meresi-jegyzokonyv.md`](../../docs/research/2026-08-26-spec000-meresi-jegyzokonyv.md): nyers mérési megfigyelések
