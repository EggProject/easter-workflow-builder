# packages/provider-capability

## Mi ez a mappa

A provider képességleíró típusai, a mögöttük álló bizonyíték típus, a bizonyítékok
forráskatalógusa. Ide **nem**
tartozik egyetlen konkrét provider egyetlen konkrét értéke sem: a típus mondja meg, milyen
mezők vannak, az érték az `@easter-workflow-builder/provider-minimax` és az
`@easter-workflow-builder/provider-claude-subscription` csomagban áll.

A csomag hét saját téma mappája (a `provider-id` a SPEC-003 8. szekciója szerint bővült ide)
mellett két beolvadt tárgykör áll a `src/` alatt (`evidence`, `evidence-sources`), a korábbi
azonos nevű csomagokból (SPEC-002 5.2, 5.3). Az `evidence` és
az `evidence-sources` tárgykör megtartotta a saját téma mappáit, ezért kétszintű.

## Fájlok

| Mappa                                    | Felelősség                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `descriptor/`                            | az összefogó `ProviderCapabilityDescriptor` típus, minden mezője a többi téma egy-egy exportjára hivatkozik                                                                                                                                                                                                 |
| `model-catalog/`                         | `ModelDescriptor`, `ModelsEndpointCapability`: a modelltábla és a `GET /v1/models` végpont                                                                                                                                                                                                                  |
| `environment/`                           | `EnvironmentRequirement`, `DisallowedEnvironmentRequirement`: kötelező és tiltott env változók; az `acceptedEnvironmentNames` egy követelmény elfogadott bemeneti neveit adja elsőbbségi sorrendben (SPEC-013 4.4)                                                                                          |
| `tool-support/`                          | `ServerToolDescriptor`: a szerver oldali eszközök                                                                                                                                                                                                                                                           |
| `limits/`                                | `ConcurrencyCapability`, `RateLimitCapability`, `RateLimitBucket`: kliens oldali párhuzamosság és rate limit                                                                                                                                                                                                |
| `request-shaping/`                       | a kimenő kérés alakját meghatározó mezőcsoport: `EffortCapability`, `ThinkingCapability`/`ThinkingMode`, `ToolChoiceCapability`/`ToolChoiceValue`, `StructuredOutputCapability`/`StructuredOutputStrategy`/`StructuredOutputStrategyId`, `StreamingCapability`, `PromptCachingCapability`/`PromptCacheMode` |
| `evidence/evidence-reference/`           | `MeasurementId`, `EvidenceReference`, `EvidenceList`: mire mutat egy bizonyíték és hogyan áll listába                                                                                                                                                                                                       |
| `evidence/fact/`                         | a háromállapotú `Fact<T>` típus és a két ágát szűkítő guard, a saját `.spec.ts` fájljaikkal                                                                                                                                                                                                                 |
| `evidence-sources/measurement-document/` | a bizonyítékok nevesített forráskatalógusa: doksi URL-ek, research szekciók, `MeasurementId` feloldás                                                                                                                                                                                                       |
| `provider-id/`                           | a `ProviderId` union, a két támogatott provider azonosítója (SPEC-003 8. szekció)                                                                                                                                                                                                                           |

A hat képességleíró téma mappa fájljai, az `environment/accepted-environment-names.ts` kivételével,
típus-only, ahogy az `evidence-reference/`, a `fact/fact.ts` is, nincs hozzájuk `.spec.ts` (SPEC-002
6.3 pont). A `fact/` két guardját, az `acceptedEnvironmentNames` függvényt és az `evidence-sources/`
`measurementDocument` leképezését viszont futásidejű sor teszi tesztelendővé.

## Függőségi irány

Nem függ egyetlen workspace csomagtól sem, L1 réteg (SPEC-002 4. szekció). Erre a csomagra épül
az `@easter-workflow-builder/provider-minimax`, az
`@easter-workflow-builder/provider-claude-subscription`.

## Szabályok

**Tilos bizonyíték nélküli értéket beírni.** Minden képességmező vagy `known` egy nem üres
`evidence` listával, vagy `unknown` indoklással és a blokkoló mérési esettel. Ezt az
`evidence/fact/` téma `Fact<T>` típusa kényszeríti ki.

**Az `EnvironmentRequirement` a `source` mezőn diszkriminált unió.** A `literalValue` kizárólag a
`literal` ágon létezik, és ott **kötelező**; a `process_env_passthrough` ág nem is ismeri a mezőt. A
harmadik, `process_env_alternatives` ág (SPEC-013 4.4) kötelező `alternativeNames` listát hordoz: a
`name` a kimenő név és az első bemeneti név, az alternatív nevek utána következnek.
Korábban egyetlen, opcionális `literalValue` mezős interfész állt itt, és emiatt a fogyasztó
oldalon (`packages/engine` `resolveRequiredEnvironmentValue`) csendes üres string ág keletkezett a
hiányzó literál értékre - olyan ág, ami a leírók tényleges alakján sosem futott, tehát a
`.claude/CLAUDE.md` 5. szekciója szerint tilos. A javítás iránya ezért a típus szűkítése volt, nem
egy futásidejű hibaág.

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 5.5 szekció
- [`../../docs/spec/SPEC-000-provider-wire-measurement.md`](../../docs/spec/SPEC-000-provider-wire-measurement.md): a típusterv és a mérési esetek
