# packages/provider-capability

## Mi ez a mappa

A provider képességleíró típusai. Kizárólag típus, egyetlen futásidejű sor nélkül. A
`packages/providers` csomag szétbontásából jött létre (SPEC-002 5.5 szekció). Ide **nem**
tartozik egyetlen konkrét provider egyetlen konkrét értéke sem: a típus mondja meg, milyen
mezők vannak, az érték az `@easter-workflow-builder/provider-minimax` és az
`@easter-workflow-builder/provider-claude-subscription` csomagban áll.

## Fájlok

| Mappa              | Felelősség                                                                                                                                                                                                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `descriptor/`      | az összefogó `ProviderCapabilityDescriptor` típus, minden mezője a többi téma egy-egy exportjára hivatkozik                                                                                                                                                                                                 |
| `model-catalog/`   | `ModelDescriptor`, `ModelsEndpointCapability`: a modelltábla és a `GET /v1/models` végpont                                                                                                                                                                                                                  |
| `environment/`     | `EnvironmentRequirement`, `DisallowedEnvironmentRequirement`: kötelező és tiltott env változók                                                                                                                                                                                                              |
| `tool-support/`    | `ServerToolDescriptor`, `AgentToolRecommendation`: szerver oldali és saját folyamatban futó eszközök                                                                                                                                                                                                        |
| `limits/`          | `ConcurrencyCapability`, `RateLimitCapability`, `RateLimitBucket`: kliens oldali párhuzamosság és rate limit                                                                                                                                                                                                |
| `request-shaping/` | a kimenő kérés alakját meghatározó mezőcsoport: `EffortCapability`, `ThinkingCapability`/`ThinkingMode`, `ToolChoiceCapability`/`ToolChoiceValue`, `StructuredOutputCapability`/`StructuredOutputStrategy`/`StructuredOutputStrategyId`, `StreamingCapability`, `PromptCachingCapability`/`PromptCacheMode` |

Mind a 21 fájl típus-only, nincs hozzájuk `.spec.ts` (SPEC-002 6.3 pont).

## Függőségi irány

Az `@easter-workflow-builder/evidence` (a `Fact<T>` és `EvidenceList` típus miatt) és az
`@easter-workflow-builder/agent-tool-id` (az `AgentToolId` típus miatt) csomagtól függ, L1
réteg (SPEC-002 4. szekció). Erre a csomagra épül az `@easter-workflow-builder/provider-minimax`
és az `@easter-workflow-builder/provider-claude-subscription`.

## Szabályok

**Tilos bizonyíték nélküli értéket beírni.** Minden képességmező vagy `known` egy nem üres
`evidence` listával, vagy `unknown` indoklással és a blokkoló mérési esettel. Ezt az
`@easter-workflow-builder/evidence` csomag `Fact<T>` típusa kényszeríti ki.

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 5.5 szekció
- [`../../docs/spec/SPEC-000-provider-wire-measurement.md`](../../docs/spec/SPEC-000-provider-wire-measurement.md): a típusterv és a mérési esetek
