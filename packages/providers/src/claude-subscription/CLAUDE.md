# packages/providers/src/claude-subscription

## Mi ez a mappa

A `claude-subscription` provider képességleírója, hivatalos dokumentációból. Ezt a providert a
SPEC-000 1. szekciója szerint **nem mértük drótszinten** (first-party base URL, bejelentkezésen
alapuló hitelesítés), ezért minden `known` mező mögött Anthropic dokumentáció áll, minden
méréssel eldönthető mező `unknown`. A `minimax` leíró értékei ide **nem** másolhatók át.

## Fájlok

| Fájl                         | Tartalom                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| `model-id.ts`                | `ClaudeModelId`                                                                            |
| `family-id.ts`               | `ClaudeFamilyId`                                                                           |
| `required-environment.ts`    | `claudeSubscriptionRequiredEnvironment`, üres lista                                        |
| `disallowed-environment.ts`  | `claudeSubscriptionDisallowedEnvironment`                                                  |
| `structured-output.ts`       | `claudeSubscriptionStructuredOutput`                                                       |
| `tool-choice.ts`             | `claudeSubscriptionToolChoice`                                                             |
| `thinking.ts`                | `claudeSubscriptionThinking`                                                               |
| `effort.ts`                  | `claudeSubscriptionEffort`                                                                 |
| `prompt-caching.ts`          | `claudeSubscriptionPromptCaching`                                                          |
| `streaming.ts`               | `claudeSubscriptionStreaming`                                                              |
| `server-tools.ts`            | `claudeSubscriptionServerTools`                                                            |
| `recommended-agent-tools.ts` | `claudeSubscriptionRecommendedAgentTools`                                                  |
| `models.ts`                  | `claudeSubscriptionModels`                                                                 |
| `rate-limits.ts`             | `claudeSubscriptionRateLimits`                                                             |
| `concurrency.ts`             | `claudeSubscriptionConcurrency`                                                            |
| `descriptor.ts`              | `claudeSubscriptionProvider`, a `satisfies ProviderCapabilityDescriptor<...>` összeállítás |

## Függőségi irány

A `../capability` és a `../evidence` típusaitól, valamint a `../references` nevesített
hivatkozásaitól függ. Nem függ a `../minimax` mappától.

## Szabályok

Ugyanaz a szabály, mint a `../minimax` alatt: bizonyíték nélküli érték tilos, a `purpose` és a
`reason` mező egy mondat, mért szám és artefaktum útvonal nélkül.

## Kapcsolódó dokumentumok

- [`../../../../docs/spec/SPEC-000-provider-wire-measurement.md`](../../../../docs/spec/SPEC-000-provider-wire-measurement.md), 1. szekció
