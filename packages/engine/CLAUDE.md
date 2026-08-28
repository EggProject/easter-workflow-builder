# packages/engine

## Mi ez a mappa

DAG ütemező, node végrehajtók, hibakezelés és a párhuzamossági szabályozó: a workflow végrehajtó
motor (SPEC-004). A csomag **egy tárgykörű**, ezért a téma mappák közvetlenül a `src/` alatt
állnak, egy szint mélyen, tárgykör mappa nélkül (SPEC-004 12. szekció).

Ez az első lépés a motorban (T-005-8, PLAN-005 F3 fázis eleje): a kilenc befecskendezett port
típusa és a motor hibaosztályainak zárt szótára. Ez a két téma minden hátralévő motor kódnak a
belépési felülete, ezért erre épül a PLAN-005 összes további lépése. A tényleges ütemező, a node
végrehajtók és a spec 12. szekciójában felsorolt tizenhat további téma mappa a PLAN-005 hátralévő
lépéseiben készül.

## Fájlok

| Mappa           | Felelősség                                                                                                                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine-port/`  | a kilenc befecskendezett port típusa és az összefogó `EngineDependencies` (SPEC-004 3.2, 3.3). **Típus-only, nincs `.spec.ts`** (SPEC-002 6.3 pont)                                                               |
| `engine-error/` | a motor hibaosztályainak `EngineErrorKind` uniója (nyitott, később bővülhet), az `isEngineErrorKind` guard és a `formatEngineErrorMessage` hibaüzenet formázó (F-24 konvenció), mindkettő saját `.spec.ts` párral |

## Függőségi irány

Az `engine` L5 réteg (SPEC-002 4. szekció,
`tooling/scripts/src/dependency-graph/package-layer.ts`). A csomag ténylegesen a `core` (az
`Outcome` miatt), a `db` (a `database` port `DatabaseContext` típusa miatt), az `agent` (az
`agentQueryRunner` port `AgentQueryRunner` **típusa** miatt, SPEC-004 3.3), a `provider-capability`
(a `providerDescriptorLookup` port `ProviderId` és `ProviderCapabilityDescriptor` típusa miatt, L1,
szigorúan csökkenő él, SPEC-004 3.2 "Miért nem függ a motor a `provider-registry` csomagtól") és a
`typeguards` (az `isEngineErrorKind` guard `isString` hívása miatt, ugyanaz a minta, mint a
`packages/db` és a `packages/agent` csomagban) csomagtól függ. A `logger` a `package.json`-ban
deklarálva marad (SPEC-002 szerinti előírt függés), de a kódban egyelőre nem használt: ez nem lint
hiba, mert a projektnek nincs "deklarált, de importálatlan workspace függőség" tiltó szabálya, csak
a fordított irány számít hibának, amikor egy import nincs deklarálva (11. szekció "A workspace
függőségek deklarálatlansága"). Nem függ a `provider-registry` csomagtól és nem függ az Agent
SDK-tól (SPEC-004 12. szekció, 56-58. elfogadási kritérium).

**Ellentmondás a SPEC-002-ben, lezárva (2026-08-27).** A SPEC-002 4. szekció "Rétegbesorolás,
mind a 25 csomagra" táblázata korábban az `engine`-t és az `agent`-et **azonos** L4 rétegbe
sorolta, miközben a szöveges indoklás azt sugallta, hogy az `engine` szigorúan az `agent` fölött
áll - a két állítás ellentmondott egymásnak. A user döntése ezt lezárta: **az `engine` az
`agent` fölött van**, mert a végrehajtó motor ütemezi a lépéseket és hívja az Agent SDK
adaptert. A tényleges, `package.json`-ban is meglévő `engine -> agent` függés nem változott, a
SPEC-002 réteg táblázata igazodott hozzá: az `engine` L5 rétegre, a rá épülő `apps/server` -
mert a `server` az `engine`-től is függ - L6 rétegre került. A `bun run check:graph` ez után
nulla eltérést ad. Részletek:
[`../../docs/research/2026-08-27-spec002-migracio-zaras.md`](../../docs/research/2026-08-27-spec002-migracio-zaras.md),
"Lezárás, 2026-08-27" szakasz.

## Szabályok

Ha újabb téma mappa kerül a csomagba, ez a táblázat és a `bun run docs:check` ellenőrzése
ugyanabban a commitban bővül (SPEC-002 6.7).

**Az `EngineErrorKind` unió szándékosan nyitott.** A motor hátralévő fázisai (F4-F7) új
hibaosztályt vehetnek fel, ha a spec további részének átfésülése során hiányzó eset derül ki; ez
természetes növekedés, nem hiba. Egy bővítéskor az `isEngineErrorKind` guard
`ENGINE_ERROR_KIND_KEYS` rekordja és a hozzá tartozó `.spec.ts` teszt listája is kötelezően bővül,
mert a `Record<EngineErrorKind, true>` annotáció ezt fordítási hibával kikényszeríti.

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció).

**`skipLibCheck: true` a `tsconfig.json`-ban.** A `db` csomag forrás szinten fogyasztott (a `db`
`exports` mezője a `./src/index.ts`-re mutat), tehát a `database` port `DatabaseContext` típusán
át a `db` teljes forrásfája, a `drizzle-orm` importjával együtt, bekerül az `engine` TypeScript
programjába is. A `drizzle-orm@0.45.2` egymás között típushibás dialektus deklarációi enélkül a
`typecheck` kapun buknának; ugyanaz a felsőáramú hiba, amit a `packages/db/tsconfig.json` már
dokumentál (11. szekció, gyökér `.claude/CLAUDE.md`).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-004-vegrehajto-motor.md`](../../docs/spec/SPEC-004-vegrehajto-motor.md), 3.2, 3.3 és 12. szekció
- [`../../docs/plan/PLAN-005-vegrehajto-motor.md`](../../docs/plan/PLAN-005-vegrehajto-motor.md), T-005-8
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció
- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
