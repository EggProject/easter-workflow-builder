# packages/provider-minimax

## Mi ez a mappa

A `minimax` provider kitöltött, mérési és dokumentációs bizonyítékokkal alátámasztott
képességleírója. A `packages/providers` csomag szétbontásából jött létre (SPEC-002 5.6
szekció). Ide **nem** tartozik a két leíró (`minimax`, `claude-subscription`) összekapcsolása
egyetlen rekordba: az az `@easter-workflow-builder/provider-registry` feladata.

## Fájlok

| Mappa              | Felelősség                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `descriptor/`      | az összefogó `minimaxProvider` érték, minden mezője a többi téma egy-egy exportjára hivatkozik                                 |
| `model-catalog/`   | `MiniMaxFamilyId`, `MiniMaxModelId`, `minimaxModels`                                                                           |
| `environment/`     | `minimaxRequiredEnvironment`, `minimaxDisallowedEnvironment`                                                                   |
| `tool-support/`    | `minimaxServerTools`, `minimaxRecommendedAgentTools`                                                                           |
| `limits/`          | `minimaxConcurrency`, `minimaxRateLimits`                                                                                      |
| `request-shaping/` | `minimaxEffort`, `minimaxThinking`, `minimaxStructuredOutput`, `minimaxToolChoice`, `minimaxStreaming`, `minimaxPromptCaching` |

## Függőségi irány

Az `@easter-workflow-builder/provider-capability`, az `@easter-workflow-builder/evidence` és az
`@easter-workflow-builder/evidence-sources` csomagtól függ, L2 réteg (SPEC-002 4. szekció).

## Szabályok

**Tartalmi változás nincs.** Minden `Fact` `state`, `value` és `evidence` értéke bitre azonos
maradt a `packages/providers/src/minimax` alatti eredeti tartalommal (SPEC-002 5.6 szekció,
T-002-9 lépés).

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
