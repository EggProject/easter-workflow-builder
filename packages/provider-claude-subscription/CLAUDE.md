# packages/provider-claude-subscription

## Mi ez a mappa

A `claude-subscription` provider kitöltött, hivatalos dokumentációra épülő képességleírója. A
`packages/providers` csomag szétbontásából jött létre (SPEC-002 5.6 szekció). Ide **nem**
tartozik a két leíró (`minimax`, `claude-subscription`) összekapcsolása egyetlen rekordba: az
az `@easter-workflow-builder/provider-registry` feladata.

## Fájlok

| Mappa              | Felelősség                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `descriptor/`      | az összefogó `claudeSubscriptionProvider` érték, minden mezője a többi téma egy-egy exportjára hivatkozik                                                                                        |
| `model-catalog/`   | `ClaudeFamilyId`, `ClaudeModelId`, `claudeSubscriptionModels`                                                                                                                                    |
| `environment/`     | `claudeSubscriptionRequiredEnvironment`, `claudeSubscriptionDisallowedEnvironment`                                                                                                               |
| `tool-support/`    | `claudeSubscriptionServerTools`, `claudeSubscriptionRecommendedAgentTools`                                                                                                                       |
| `limits/`          | `claudeSubscriptionConcurrency`, `claudeSubscriptionRateLimits`                                                                                                                                  |
| `request-shaping/` | `claudeSubscriptionEffort`, `claudeSubscriptionThinking`, `claudeSubscriptionStructuredOutput`, `claudeSubscriptionToolChoice`, `claudeSubscriptionStreaming`, `claudeSubscriptionPromptCaching` |

## Függőségi irány

Az `@easter-workflow-builder/provider-capability` csomagtól függ (a leíró típusok, a `Fact` és
a bizonyítékok forráskatalógusa mind ott áll), L2 réteg (SPEC-002 4. szekció).

## Szabályok

**Tartalmi változás nincs.** Minden `Fact` `state`, `value` és `evidence` értéke bitre azonos
maradt a `packages/providers/src/claude-subscription` alatti eredeti tartalommal (SPEC-002 5.6
szekció, T-002-9 lépés).

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció), a leíró objektum literál
`satisfies ProviderCapabilityDescriptor<...>` alakban kapcsolódik a típushoz.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 5.6 szekció
- [`../../docs/spec/SPEC-000-provider-wire-measurement.md`](../../docs/spec/SPEC-000-provider-wire-measurement.md): a típusterv és a mérési esetek
