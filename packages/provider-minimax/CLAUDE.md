# packages/provider-minimax

## Mi ez a mappa

A `minimax` provider kitöltött, dokumentációs bizonyítékokkal alátámasztott képességleírója a
`MiniMax-M3.1-Flash` modellre (SPEC-013, a korábbi modell helyére). A `packages/providers` csomag szétbontásából jött létre (SPEC-002 5.6
szekció). Ide **nem** tartozik a két leíró (`minimax`, `claude-subscription`) összekapcsolása
egyetlen rekordba: az az `@easter-workflow-builder/provider-registry` feladata.

## Fájlok

| Mappa              | Felelősség                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `descriptor/`      | az összefogó `minimaxProvider` érték, minden mezője a többi téma egy-egy exportjára hivatkozik; a `.spec.ts` a SPEC-013 3.2 táblázatát állítja mezőnként |
| `measurement-gap/` | `notMeasuredOnFlash`: az előző modellre mért, a Flash-re nem mért mező `unknown` ténye, a megismétlendő mérés azonosítójával                             |
| `model-catalog/`   | `MiniMaxFamilyId`, `MiniMaxModelId`, `minimaxModels`                                                                                                     |
| `environment/`     | `minimaxRequiredEnvironment`, `minimaxDisallowedEnvironment`                                                                                             |
| `tool-support/`    | `minimaxServerTools`                                                                                                                                     |
| `limits/`          | `minimaxConcurrency`, `minimaxRateLimits`                                                                                                                |
| `request-shaping/` | `minimaxEffort`, `minimaxThinking`, `minimaxStructuredOutput`, `minimaxToolChoice`, `minimaxStreaming`, `minimaxPromptCaching`                           |

## Függőségi irány

Az `@easter-workflow-builder/provider-capability` csomagtól függ (a leíró típusok, a `Fact` és
a bizonyítékok forráskatalógusa mind ott áll), L2 réteg (SPEC-002 4. szekció).

## Szabályok

**Az előző modellre végzett mérés a Flash-re nem vihető át** (SPEC-013 3.2). Egy mező akkor
`known`, ha egy Flash-re vonatkozó vagy modelltől független hivatalos forrás magát az értéket
állítja, és két, a MiniMaxtól független forrás megerősíti; minden más mező `unknown`, a `blockedBy`
mezőben a megismétlendő mérés azonosítójával. Ha nincs mérési eset, ami a mezőt lezárná (a rate limit
`requestsPerMinute` és `tokensPerMinute`), a `blockedBy` üres, és a `reason` kimondja, hogy független
forrás hiányzik.

**A mérési próza nem ide tartozik.** A kódban csak stabil azonosító (`M-01` ... `M-36`), doksi
URL vagy research szekció azonosító marad. A mérés leírása a `docs/research/` alatt van.

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció), a leíró objektum literál
`satisfies ProviderCapabilityDescriptor<...>` alakban kapcsolódik a típushoz.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 5.6 szekció
- [`../../docs/spec/SPEC-000-provider-wire-measurement.md`](../../docs/spec/SPEC-000-provider-wire-measurement.md): a típusterv és a mérési esetek
- [`../../docs/research/2026-08-26-spec000-meresi-jegyzokonyv.md`](../../docs/research/2026-08-26-spec000-meresi-jegyzokonyv.md): nyers mérési megfigyelések
- [`../../docs/research/2026-08-26-agent-sdk-minimax.md`](../../docs/research/2026-08-26-agent-sdk-minimax.md): a research alapfájl
