# packages/providers

## Mi ez a mappa

Provider config fájlok és capability leírók: a `claude-subscription` és a `minimax` provider
drótszintű képességeinek típusos, bizonyítékkal alátámasztott leírása. A repo gyökér
`src/providers/` mappájának migrációjából jött létre (SPEC-001 13. szekció), az a mappa a
migráció után törölve lett. Ide **nem** kerül a mérés prózai leírása, a nyers megfigyelés vagy
az artefaktum hivatkozás: azok a `docs/research/` alatt maradnak.

## Fájlok

| Fájl            | Tartalom                                     |
| --------------- | -------------------------------------------- |
| `package.json`  | csomag manifeszt, `typecheck` script         |
| `tsconfig.json` | a `tooling/tsconfig/node.json` kiterjesztése |
| `src/index.ts`  | barrel, csak újraexport                      |

Az `src/` alatti négy mappa felelőssége:

| Mappa                  | Felelősség                                                                    |
| ---------------------- | ----------------------------------------------------------------------------- |
| `capability/`          | a `ProviderCapabilityDescriptor` generikus típus és mezőcsoportjai            |
| `references/`          | nevesített doksi URL-ek, research szekció azonosítók, mérés -> docs leképezés |
| `minimax/`             | a `minimax` provider kitöltött, mérési adatokra épülő képességleírója         |
| `claude-subscription/` | a `claude-subscription` provider kitöltött, hivatalos doksira épülő leírója   |

A háromállapotú `Fact<T>` bizonyíték típus és a hozzá tartozó typeguardok kiköltöztek az
`@easter-workflow-builder/evidence` csomagba (SPEC-002 5.2 szekció, T-002-6 lépés), erre a
csomag `workspace:*` függőséggel hivatkozik.

## Függőségi irány

A `core` és az `@easter-workflow-builder/evidence` csomagtól függhet, mástól nem (SPEC-002 4.
szekció). A `core`-tól jelenleg egyetlen fájl sem importál, ez holt függőség, amit a SPEC-002
5.19 szekciója megfigyelt, de nem ennek a specnek a hatóköre javítani.

## Szabályok

**Tilos bizonyíték nélküli értéket beírni.** Minden képességmező vagy `known` egy nem üres
`evidence` listával, vagy `unknown` indoklással és a blokkoló mérési esettel. A típusrendszer
ezt kikényszeríti: az `EvidenceList` tuple alak miatt üres bizonyítéklistával a `known` ág nem
fordul le, és az `isKnownFact` typeguard nélkül a `value` mező nem olvasható.

**A mérési próza nem ide tartozik.** A kódban csak stabil azonosító (`M-19`, doksi URL, research
szekció azonosító) és egy rövid, egymondatos `purpose`/`reason` marad. A mérés leírása, a nyers
szám és az artefaktum hivatkozás a `docs/research/` alatt van; a `references/measurement-document.ts`
oldja fel a `MeasurementId` -> docs horgony leképezést, ide nem szabad prózát átmásolni.

Egy fájlba egy exportált dolog (munkautasítás, nem lint szabály). Tippelni, extrapolálni tilos:
ha nincs dokumentált szabály vagy mérés, a mező `unknown` marad.

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció), a leíró objektum literál
`satisfies ProviderCapabilityDescriptor<...>` alakban kapcsolódik a típushoz.

**Coverage: nincs kizárva.** A gyökér `vitest.config.ts` `coverage.exclude` listájában nincs
`packages/providers` bejegyzés, a csomag a 100 százalékos küszöb hatókörében van.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-000-provider-wire-measurement.md`](../../docs/spec/SPEC-000-provider-wire-measurement.md): a típusterv és a mérési esetek
- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 13. szekció: a migráció terve
- [`../../docs/research/2026-08-26-spec000-meresi-jegyzokonyv.md`](../../docs/research/2026-08-26-spec000-meresi-jegyzokonyv.md): nyers mérési megfigyelések
- [`../../docs/research/2026-08-26-spec000-kiertekeles.md`](../../docs/research/2026-08-26-spec000-kiertekeles.md): Q1-Q12 lezárása és a tervezési következmények
- [`../../docs/research/2026-08-26-agent-sdk-minimax.md`](../../docs/research/2026-08-26-agent-sdk-minimax.md): a research alapfájl
