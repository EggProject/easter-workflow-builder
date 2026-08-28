# packages/engine

## Mi ez a mappa

DAG ütemező, node végrehajtók, hibakezelés és a párhuzamossági szabályozó: a workflow végrehajtó
motor (SPEC-004). A csomag **egy tárgykörű**, ezért a téma mappák közvetlenül a `src/` alatt
állnak, egy szint mélyen, tárgykör mappa nélkül (SPEC-004 12. szekció).

A csomag a PLAN-005 F3 fázisában épül fel, lépésenként egy-egy téma mappával. Ma öt téma áll
készen: a kilenc befecskendezett port típusa és a motor hibaosztályainak szótára (T-005-8), a
motor eseményei (T-005-9), a végrehajtható gráf szerkezete a gráf alak ellenőrzéseivel
(T-005-10) és az ág hatókör verem a kiegyensúlyozottság ellenőrzésével (T-005-11). A tényleges
ütemező, a node végrehajtók és a spec 12. szekciójában felsorolt további téma mappák a PLAN-005
hátralévő lépéseiben készülnek.

## Fájlok

| Mappa           | Felelősség                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine-port/`  | a kilenc befecskendezett port típusa és az összefogó `EngineDependencies` (SPEC-004 3.2, 3.3). **Típus-only, nincs `.spec.ts`** (SPEC-002 6.3 pont)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `engine-error/` | a motor hibaosztályainak `EngineErrorKind` uniója (nyitott, később bővülhet), az `isEngineErrorKind` guard és a `formatEngineErrorMessage` hibaüzenet formázó (F-24 konvenció), mindkettő saját `.spec.ts` párral                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `engine-event/` | a 13, motor eredetű `run_event` `kind` payload alakja (egy fájl egy payload típus), az összefogó `EngineEvent` diszkriminált unió és a `writeEngineEvent` motor esemény író, ami a `database.events.appendEngineEvent`-et hívja, `occurredAtMs`-t a `clock` portból számítva (SPEC-004 13. szekció, PLAN-005 T-005-9). A `StepStartedPayload` ma csak az öt kötelező mezőt hordozza; a SPEC-004 11.3 táblázat jelölő mezőit a `capability-policy` téma (T-005-13) veszi fel egy KÉSŐBBI lépésben. Az `EngineEvent['kind']` unió pontosan 13 tagú tesztje és a `writeEngineEvent` `.spec.ts`-e valós `:memory:` adatbázis ellen fut |
| `run-graph/`    | a pillanatkép átindexelése `ExecutableGraph` alakra (`buildExecutableGraph`), a visszaél keresés (`findLoopBackEdges`), a kör keresés a visszaélek elhagyása után (`detectGraphCycle`), a `loop` node alakjának két ellenőrzése (`validateLoopBackEdgeBody`, `validateLoopBranchEdges`) és az elérhetőség számítás (`computeReachableNodeIds`), a SPEC-004 4.1 és 4.6 szekciója szerint (PLAN-005 T-005-10). Tiszta függvények, a téma egyetlen sora sem érint adatbázist. Az `executable-graph.ts` **típus-only, nincs `.spec.ts`**                                                                                               |
| `branch-scope/` | a hatókör verem két alakja (`branch-scope.ts` a futáskori, `static-scope-stack.ts` a futás indítás előtti, validációs), a `validateScopeBalance` kiegyensúlyozottság ellenőrzés és a belőle levezetett `FanOutJoinPairing` (SPEC-004 4.3 és 4.5, PLAN-005 T-005-11). Tiszta függvény, adatbázis nélkül. A három típusfájl **típus-only, nincs `.spec.ts`**                                                                                                                                                                                                                                                                         |

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

**A `run-graph` téma határa.** A téma a gráf **alakjáról** dönt, a futásról nem, és csak a
SPEC-004 4.6 szekció négy lépését végzi el. Ami tudatosan kimarad: a `dangling_edge` és az
`unreachable_node` hibaág (a `run-validation` téma dolga, T-005-15; ide a `computeReachableNodeIds`
nyers halmaza tartozik), a hatókör verem és a fan-out/join párosítás (`branch-scope` téma,
T-005-11), és a node config vizsgálata (a `SnapshotNode.config` `unknown` marad, a node típusa a
típusos `type` mezőből jön).

**A `branch-scope` téma két alakja.** A `BranchScope` a **futáskori** verem (SPEC-004 4.3 szó
szerinti alakja), amiben a bejegyzést nyitó lépés `stepRunId` értéke áll; ezt a `run-context` és a
`scheduling` téma tölti majd fel (T-005-16, T-005-17). A `StaticScopeFrame` ugyanannak a veremnek a
**futás indítás előtti** alakja: ott még nincs `step_run` sor (SPEC-004 4.8, "Az 1 ... 5. lépés
egyetlen adatot sem ír"), ezért a keret a hatókört nyitó gráf csomópont azonosítóját hordozza. A
két alak ugyanazt a fogalmat írja le, más életciklusban, ezért a validáció nem tudja a futáskori
típust használni.

**Két értelmezési döntés a hatókör bejárásban**, mindkettő a SPEC-004 szövegéből vezetve, mert a
spec nem mondja ki tételesen:

- A terminális node ellenőrzése **kizárólag a `fan_out` keretet** nézi, ahogy a 4.5 szekció írja, a
  `loop` keretet nem. A visszaél elhagyása után a ciklustörzs visszaélt kibocsátó node-ja
  terminálisnak látszana, nyitott `loop` kerettel, holott a ciklus a saját `exit` ágán szabályosan
  zár. Ugyanezért áll a terminális jelző a **teljes** kimenő él listán, a visszaéleket is
  beleértve: a visszaél futásidőben valódi folytatás (4.6).
- A `fan_out` node `on_error` éle **nem** kap új hatókör keretet, minden más kimenő éle igen. A 4.4 5. pontja szerint a hibára futó példány az `on_error` élére tesz `live` jelölést, tehát nem bomlik
  elemekre és nem is nyit hatókört; keret nélkül a hibaág vissza tud találkozni a `join` utáni
  ágakkal, kerettel viszont minden ilyen gráf `unbalanced_fan_out_scope` hibát adna.

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
