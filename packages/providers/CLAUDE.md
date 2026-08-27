# packages/providers

## Mi ez a mappa

A két provider leíró (`claude-subscription`, `minimax`) egyetlen, kulcs szerint elérhető
rekordba fűzése (`providerRegistry`). A csomag a `packages/providers` -> sok kisebb csomag
szétbontás (SPEC-002 5. szekció) végállapotához közelít: minden korábbi tartalom kiköltözött
önálló csomagba, itt már csak az összefűző `registry.ts` és a hozzá tartozó bejáró regressziós
teszt maradt. A csomag maga a T-002-10 lépésben megszűnik, a tartalma
`@easter-workflow-builder/provider-registry` néven folytatódik (SPEC-002 5.7 szekció).

## Fájlok

| Fájl                   | Tartalom                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `package.json`         | csomag manifeszt, `typecheck` script                                                            |
| `tsconfig.json`        | a `tooling/tsconfig/node.json` kiterjesztése                                                    |
| `src/index.ts`         | barrel, csak újraexport                                                                         |
| `src/registry.ts`      | a `ProviderRegistry` típus és a `providerRegistry` érték                                        |
| `src/registry.spec.ts` | bejáró regressziós teszt: a `Fact` invariánsokat és a `MeasurementId` feloldhatóságot ellenőrzi |

A háromállapotú `Fact<T>` bizonyíték típus és a hozzá tartozó typeguardok az
`@easter-workflow-builder/evidence` csomagban vannak (SPEC-002 5.2 szekció, T-002-6 lépés). A
nevesített doksi URL-ek, research szekció azonosítók és a `MeasurementId` -> docs horgony
leképezés az `@easter-workflow-builder/evidence-sources` csomagban (SPEC-002 5.3 szekció,
T-002-7 lépés). A `ProviderCapabilityDescriptor` generikus típus az
`@easter-workflow-builder/provider-capability`, az `AgentToolId` szótár az
`@easter-workflow-builder/agent-tool-id` csomagban (SPEC-002 5.4 és 5.5 szekció, T-002-8 lépés).
A `minimax` és a `claude-subscription` kitöltött leíró az
`@easter-workflow-builder/provider-minimax` és az
`@easter-workflow-builder/provider-claude-subscription` csomagban (SPEC-002 5.6 szekció,
T-002-9 lépés).

## Függőségi irány

A `core`, az `@easter-workflow-builder/evidence`, az `@easter-workflow-builder/evidence-sources`,
az `@easter-workflow-builder/agent-tool-id`, az `@easter-workflow-builder/provider-capability`,
az `@easter-workflow-builder/provider-minimax` és az
`@easter-workflow-builder/provider-claude-subscription` csomagtól függhet, mástól nem (SPEC-002 4. szekció). A `core`-tól jelenleg egyetlen fájl sem importál, ez holt függőség, amit a
SPEC-002 5.19 szekciója megfigyelt, de nem ennek a specnek a hatóköre javítani.

## Szabályok

**Tartalmi változás nincs.** A `providerRegistry` fa a szétbontás előtti és utáni állapotban
normalizált JSON alakban bitre azonos (SPEC-002 T-002-10 lépés, a bizonyítás módja a
`docs/research/` alatt).

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as`
típuskényszerítés (helyette `satisfies` vagy explicit típusannotáció).

**Coverage: nincs kizárva.** A gyökér `vitest.config.ts` `coverage.exclude` listájában nincs
`packages/providers` bejegyzés, a csomag a 100 százalékos küszöb hatókörében van.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 5.7 szekció
- [`../../docs/spec/SPEC-000-provider-wire-measurement.md`](../../docs/spec/SPEC-000-provider-wire-measurement.md): a típusterv és a mérési esetek
- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 13. szekció: a migráció terve
- [`../../docs/research/2026-08-26-spec000-meresi-jegyzokonyv.md`](../../docs/research/2026-08-26-spec000-meresi-jegyzokonyv.md): nyers mérési megfigyelések
- [`../../docs/research/2026-08-26-agent-sdk-minimax.md`](../../docs/research/2026-08-26-agent-sdk-minimax.md): a research alapfájl
