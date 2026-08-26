# packages/providers/src/minimax

## Mi ez a mappa

A `minimax` provider kitöltött képességleírója, mérési adatokból. Minden `known` mező mögött
SPEC-000 mérési eset vagy research fájl ténye áll, a `evidence` mezőben stabil azonosítóval.
A mérés részletei (mit mértünk, mi jött ki, artefaktum útvonal) a
`docs/research/2026-08-26-spec000-kiertekeles.md` és a
`docs/research/2026-08-26-spec000-meresi-jegyzokonyv.md` alatt vannak, **ide nem kerülnek át**.

## Fájlok

| Fájl                         | Tartalom                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `model-id.ts`                | `MiniMaxModelId`                                                                |
| `family-id.ts`               | `MiniMaxFamilyId`                                                               |
| `required-environment.ts`    | `minimaxRequiredEnvironment`                                                    |
| `disallowed-environment.ts`  | `minimaxDisallowedEnvironment`                                                  |
| `structured-output.ts`       | `minimaxStructuredOutput`                                                       |
| `tool-choice.ts`             | `minimaxToolChoice`                                                             |
| `thinking.ts`                | `minimaxThinking`                                                               |
| `effort.ts`                  | `minimaxEffort`                                                                 |
| `prompt-caching.ts`          | `minimaxPromptCaching`                                                          |
| `streaming.ts`               | `minimaxStreaming`                                                              |
| `server-tools.ts`            | `minimaxServerTools`                                                            |
| `recommended-agent-tools.ts` | `minimaxRecommendedAgentTools`                                                  |
| `models.ts`                  | `minimaxModels`                                                                 |
| `rate-limits.ts`             | `minimaxRateLimits`                                                             |
| `concurrency.ts`             | `minimaxConcurrency`                                                            |
| `descriptor.ts`              | `minimaxProvider`, a `satisfies ProviderCapabilityDescriptor<...>` összeállítás |

## Függőségi irány

A `../capability` és a `../evidence` típusaitól, valamint a `../references` nevesített
hivatkozásaitól függ. Nem függ a `../claude-subscription` mappától.

## Szabályok

**Tilos bizonyíték nélküli értéket beírni.** A `purpose` és a `reason` mező egy mondat, mért
szám és artefaktum útvonal nélkül; a hivatkozás helye az `evidence` mező. Kommentben sem
szerepelhet `M-` mintájú azonosító vagy `tools/wire-probe/artifacts` útvonalrészlet.

## Kapcsolódó dokumentumok

- [`../../../../docs/research/2026-08-26-spec000-kiertekeles.md`](../../../../docs/research/2026-08-26-spec000-kiertekeles.md)
- [`../../../../docs/research/2026-08-26-spec000-meresi-jegyzokonyv.md`](../../../../docs/research/2026-08-26-spec000-meresi-jegyzokonyv.md)
