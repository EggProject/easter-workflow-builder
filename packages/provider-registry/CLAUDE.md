# packages/provider-registry

## Mi ez a mappa

A két provider leíró (`claude-subscription`, `minimax`) egyetlen, kulcs szerint elérhető
readonly rekordban, plusz a leíró invariánsokat kikényszerítő bejáró regressziós teszt. A
`packages/providers` csomag utolsó lépése, ami a teljes szétbontás (SPEC-002 5. szekció) után
ez alatt a néven folytatódik (SPEC-002 5.7 szekció, T-002-10 lépés). A `registry` név
`provider-registry`-re változott, mert a csomagon belül a `registry` szó önmagában nem mondta
meg, minek a regisztere.

## Fájlok

| Mappa                | Felelősség                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `provider-registry/` | a `ProviderRegistry` típus, a `providerRegistry` érték, és a rá épülő bejáró regressziós teszt |

## Függőségi irány

Az `@easter-workflow-builder/provider-minimax` és az
`@easter-workflow-builder/provider-claude-subscription` csomagtól függ (`dependencies`), L3
réteg (SPEC-002 4. szekció). A `.spec.ts` további dev függősége az
`@easter-workflow-builder/provider-capability` (`devDependencies`), mert a bejárás a `Fact`
invariánsokat és a `MeasurementId` feloldhatóságot ellenőrzi.

## Szabályok

**Tartalmi változás nincs.** A `providerRegistry` fa a `packages/providers` alatti szétbontás
előtti állapottal normalizált JSON alakban bitre azonos. A bizonyítás módja és eredménye a
`docs/research/` alatt van dokumentálva.

**NEM tartalmazza a provider kiválasztás logikáját** (globális, workflow és lépés szintű
felülírás). Az az `@easter-workflow-builder/engine` és az `@easter-workflow-builder/server`
hatóköre, külön specifikáció tárgya.

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as`
típuskényszerítés (helyette `satisfies` vagy explicit típusannotáció).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 5.7 szekció
- [`../../docs/spec/SPEC-000-provider-wire-measurement.md`](../../docs/spec/SPEC-000-provider-wire-measurement.md): a típusterv és a mérési esetek
