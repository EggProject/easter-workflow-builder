# packages/providers/src/capability

## Mi ez a mappa

A `ProviderCapabilityDescriptor` generikus típus és minden mezőcsoportjának saját fájlja.
Ez a réteg csak típus, nincs benne adat literál és nincs konkrét provider érték. A tényleges
kitöltött leírók a `../minimax` és a `../claude-subscription` alatt vannak.

## Fájlok

| Fájl                                    | Tartalom                                                               |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `structured-output-strategy-id.ts`      | `StructuredOutputStrategyId`                                           |
| `structured-output-strategy.ts`         | `StructuredOutputStrategy`                                             |
| `structured-output-capability.ts`       | `StructuredOutputCapability`                                           |
| `tool-choice-value.ts`                  | `ToolChoiceValue`                                                      |
| `tool-choice-capability.ts`             | `ToolChoiceCapability`                                                 |
| `thinking-mode.ts`                      | `ThinkingMode`                                                         |
| `thinking-capability.ts`                | `ThinkingCapability<TFamilyId>`                                        |
| `effort-capability.ts`                  | `EffortCapability`                                                     |
| `prompt-cache-mode.ts`                  | `PromptCacheMode`                                                      |
| `prompt-caching-capability.ts`          | `PromptCachingCapability`                                              |
| `streaming-capability.ts`               | `StreamingCapability`                                                  |
| `server-tool-descriptor.ts`             | `ServerToolDescriptor`                                                 |
| `agent-tool-id.ts`                      | `AgentToolId`                                                          |
| `agent-tool-recommendation.ts`          | `AgentToolRecommendation`                                              |
| `model-descriptor.ts`                   | `ModelDescriptor<TModelId, TFamilyId>`                                 |
| `models-endpoint-capability.ts`         | `ModelsEndpointCapability`                                             |
| `rate-limit-bucket.ts`                  | `RateLimitBucket<TModelId>`                                            |
| `rate-limit-capability.ts`              | `RateLimitCapability<TModelId>`                                        |
| `concurrency-capability.ts`             | `ConcurrencyCapability`                                                |
| `environment-requirement.ts`            | `EnvironmentRequirement`                                               |
| `disallowed-environment-requirement.ts` | `DisallowedEnvironmentRequirement`                                     |
| `provider-capability-descriptor.ts`     | `ProviderCapabilityDescriptor<TModelId, TFamilyId>`, az összegző típus |

## Függőségi irány

Csak a `../evidence` alól importál (`Fact`, `EvidenceList`). Providerspecifikus fájltól nem függ.

## Szabályok

Egy fájlba egy exportált típus. Típusrés esetén (lásd a SPEC-001 13. szekcióban hivatkozott,
migráció előtti leírás "Típusrések" táblázata) a mező típusa marad, amíg a javítás külön
döntés nem lesz.

## Kapcsolódó dokumentumok

- [`../../../../docs/spec/SPEC-000-provider-wire-measurement.md`](../../../../docs/spec/SPEC-000-provider-wire-measurement.md), 5. szekció
