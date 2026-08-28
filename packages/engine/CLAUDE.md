# packages/engine

## Mi ez a mappa

DAG ütemező, node végrehajtók, hibakezelés és a párhuzamossági szabályozó: a workflow végrehajtó
motor (SPEC-004). A csomag **egy tárgykörű**, ezért a téma mappák közvetlenül a `src/` alatt
állnak, egy szint mélyen, tárgykör mappa nélkül (SPEC-004 12. szekció).

A csomag a PLAN-005 F3 fázisában épül fel, lépésenként egy-egy téma mappával. Ma kilenc téma áll
készen: a kilenc befecskendezett port típusa és a motor hibaosztályainak szótára (T-005-8), a
motor eseményei (T-005-9), a végrehajtható gráf szerkezete a gráf alak ellenőrzéseivel
(T-005-10), az ág hatókör verem a kiegyensúlyozottság ellenőrzésével (T-005-11), a háromszintű
provider feloldás (T-005-12), a leírótól függő viselkedések (T-005-13), a kötelező/tiltott env
változók feldolgozása (T-005-14) és a futás indítási validációja, ami az előző hatot egyetlen
`validateRun` menetbe fogja (T-005-15). A tényleges ütemező, a node végrehajtók és a spec 12.
szekciójában felsorolt további téma mappák a PLAN-005 hátralévő lépéseiben készülnek.

## Fájlok

| Mappa                   | Felelősség                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine-port/`          | a kilenc befecskendezett port típusa és az összefogó `EngineDependencies` (SPEC-004 3.2, 3.3). **Típus-only, nincs `.spec.ts`** (SPEC-002 6.3 pont)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `engine-error/`         | a motor hibaosztályainak `EngineErrorKind` uniója (nyitott, később bővülhet), az `isEngineErrorKind` guard és a `formatEngineErrorMessage` hibaüzenet formázó (F-24 konvenció), mindkettő saját `.spec.ts` párral                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `engine-event/`         | a 13, motor eredetű `run_event` `kind` payload alakja (egy fájl egy payload típus), az összefogó `EngineEvent` diszkriminált unió és a `writeEngineEvent` motor esemény író, ami a `database.events.appendEngineEvent`-et hívja, `occurredAtMs`-t a `clock` portból számítva (SPEC-004 13. szekció, PLAN-005 T-005-9). A `StepStartedPayload` az öt kötelező mező mellett a SPEC-004 11.3 táblázat három opcionális jelölő mezőjét is hordozza (`strategyUnproven`, `modelIdentifierUnproven`, `serverToolAvailabilityUnproven`), amiket a `capability-policy` téma `unknown` ágai töltenek (T-005-13). Az `EngineEvent['kind']` unió pontosan 13 tagú tesztje és a `writeEngineEvent` `.spec.ts`-e valós `:memory:` adatbázis ellen fut                                                                                                                                                                        |
| `run-graph/`            | a pillanatkép átindexelése `ExecutableGraph` alakra (`buildExecutableGraph`), a visszaél keresés (`findLoopBackEdges`), a kör keresés a visszaélek elhagyása után (`detectGraphCycle`), a `loop` node alakjának két ellenőrzése (`validateLoopBackEdgeBody`, `validateLoopBranchEdges`) és az elérhetőség számítás (`computeReachableNodeIds`), a SPEC-004 4.1 és 4.6 szekciója szerint (PLAN-005 T-005-10). Tiszta függvények, a téma egyetlen sora sem érint adatbázist. Az `executable-graph.ts` **típus-only, nincs `.spec.ts`**                                                                                                                                                                                                                                                                                                                                                                            |
| `branch-scope/`         | a hatókör verem két alakja (`branch-scope.ts` a futáskori, `static-scope-stack.ts` a futás indítás előtti, validációs), a `validateScopeBalance` kiegyensúlyozottság ellenőrzés és a belőle levezetett `FanOutJoinPairing` (SPEC-004 4.3 és 4.5, PLAN-005 T-005-11). Tiszta függvény, adatbázis nélkül. A három típusfájl **típus-only, nincs `.spec.ts`**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `capability-policy/`    | a SPEC-004 11.3 táblázat leírótól függő viselkedései, viselkedésenként egy tiszta függvényben, plusz a döntések eredmény típusai (PLAN-005 T-005-13). Ami itt áll, a táblázat sorszámával: 1. `resolveStructuredOutputStrategy`, 3. `validateMaxTurnsFloor`, 4. `validateForcedToolChoiceRisk`, 5. `resolveModelWireIdentifier`, 6. `requireModelSelection`, 7. `validateModelId`, 8. `resolveThinkingMode`, 9. `resolveEffortInclusion`, 12. `resolveDisallowedServerTools`, 13. `shouldIncludePartialMessages`, 14. `resolveConcurrencySuggestion`, 15. `RATE_LIMIT_RETRY_POLICY`, 16. `resolveConnectionTestMode`, 17. `validateSdkVersionMatch`. A 10. és a 11. sor a `provider-environment` témáé, a 2. sor az `agent-step` témáé, lásd "Szabályok". Az öt eredmény típusfájl **típus-only, nincs `.spec.ts`**                                                                                             |
| `provider-resolution/`  | a `resolveEffectiveProvider` háromszintű provider feloldás: lépés felülírás > workflow felülírás > globális alapértelmezés, egyik hiányában sem `no_default_provider` hiba (SPEC-004 11.1, PLAN-005 T-005-12). Tiszta függvény, egyetlen node/lépés szintű hívás; a több node-ra való végigfuttatás a `run-validation` téma dolga (T-005-15). Nincs önálló leíró kereső wrapper, lásd "Szabályok"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `run-validation/`       | a futás indítási validációja: a SPEC-004 4.7 táblázat mind a tíz ellenőrzése (`validateStartNode`, `validateEdgeEndpoints`, `validateNodeReachability`, `validateImplementedNodeTypes`, `validateBranchEdgeKeys`, `validateDefaultBranchKey`, `validateErrorHandlerEdges`, `validateNodeConfigs`, `validateUnhandledErrorPolicy`, `validateJoinMergeSettings`), a 4.2 fenntartott `branch_key` szabálya (`validateReservedBranchKeys`), a 4.8 2. lépésének node-onkénti provider feloldása (`resolveNodeProviders`), és az ezeket a `run-graph` és a `branch-scope` téma ellenőrzéseivel egyetlen menetbe fogó `validateRun` (PLAN-005 T-005-15). Az `executable-node-config.ts` és a `validated-run.ts` **típus-only**; az előbbi mégis kap `.spec.ts`-t, mert a garanciája fordítási idejű, lásd "Szabályok". **A SPEC-004 11.2 provider validáció bedrótozása itt tudatosan nem történt meg**, lásd ugyanott |
| `provider-environment/` | a SPEC-004 11.3 táblázat 10. és 11. sora: a `buildProviderEnvironmentBlock` a lépés kimenő `Options.env` blokkját állítja össze a `requiredEnv[]` és a `disallowedEnv[]` leíró mezőből, a `processEnvironment` porton át (PLAN-005 T-005-14). A `resolveRequiredEnvironmentValue` egyetlen `requiredEnv` bejegyzést old fel: `literal` forrásnál a leíró `literalValue` mezőjét, `process_env_passthrough` forrásnál a port olvasott értékét adja, hiányzó változóra `missing_provider_env` hibával, kizárólag a névvel. A `disallowedEnv[]` neve a feloldás **előtt** kizár, hogy egy tiltott, de hiányzó változó se okozzon hibát. Tiszta függvény, adatbázis és esemény nélkül: sem üzenetben, sem eseményben nem ad vissza env **értéket**, csak nevet (17. szekció 33. és 64. kritérium)                                                                                                                   |

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

**A `provider-resolution` téma nem kap önálló leíró kereső wrappert.** A SPEC-004 12. szekció
táblázata a témát "a háromszintű provider feloldás és a leíró keresés portja" néven nevezi meg, de
a leíró keresést a T-005-8-ban már meglévő `providerDescriptorLookup: (providerId: ProviderId) =>
ProviderCapabilityDescriptor<string, string>` port önmagában, hozzáadott logika nélkül elvégzi: a
hívás egy közvetlen függvényhívás, nincs mit köré csomagolni. Egy `lookup-provider-descriptor.ts`
fájl ezért csak a port nevét ismételné meg új néven, ami a "Minimum kód" elv (gyökér `CLAUDE.md`
2.) szerint felesleges egyszer használt absztrakció. A leírót ténylegesen a `capability-policy`
téma (T-005-13) és a `run-validation` téma (T-005-15) hívja majd, közvetlenül a porton keresztül,
a `resolveEffectiveProvider` eredményével. Hasonlóképp ez a téma **nem** jár be egy teljes
`ExecutableGraph`-ot node-onként: a SPEC-004 4.8 2. lépésének ("Provider feloldás minden node-ra")
orchesztrálása a `run-validation` téma (T-005-15) felelőssége, ami node-onként egyszer hívja meg
ezt a téma egyetlen, tiszta függvényét.

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

**A `capability-policy` téma határa és három értelmezési döntése.** A téma a SPEC-004 11.3
táblázatának tizenhat leírótól függő sorából tizennégyet valósít meg; a maradék kettő és a
táblázat 2. sora szándékosan máshova tartozik:

- a kötelező env blokk (10. sor) és a tiltott env változók levétele (11. sor) a
  `provider-environment` téma dolga (T-005-14), mert azok a `processEnvironment` porton át
  olvasnak, nem tiszta leíró döntések;
- a `Stop` hook összeállítása (2. sor) nem leíró mező, hanem a kiválasztott stratégia
  következménye, ezért az `Options` összeállításához tartozik (`agent-step` téma, T-005-19).

A három értelmezési döntés, mindegyik a spec szövegéből vezetve:

- **A 15. sor (429 kezelés) konstans, nem elágazó függvény.** A motor nem lát HTTP választ, mert
  a kérést az `agentQueryRunner` port mögött az SDK indítja, tehát a leíró `known` ága sem tudna
  más motor viselkedést előírni, mint az `unknown` ága. Egy leíróból olvasó elágazás itt olyan ág
  lenne, ami sosem fut másképp, amit a 100 százalékos lefedettségi küszöb miatt tilos bevezetni.
  A döntést ezért a `RATE_LIMIT_RETRY_POLICY` konstans és a hozzá tartozó regressziós teszt
  őrzi.
- **A 16. sor a `modelsEndpoint.directHttpReachable` mezőt nem olvassa.** Nem elhagyás, hanem
  következmény: a motor egyetlen hálózati kapcsolatot sem nyit (7. elfogadási kritérium), tehát
  egy közvetlen, SDK-n kívüli HTTP út járhatósága a motornak nem választható menet. A mező a
  kapcsolat teszt diagnosztikájának marad, a döntést egyedül a `calledBySdk` viszi.
- **Az 1. sor akkor is `structured_output_strategy_unsupported` hibát ad, ha a leíró a kért
  stratégiát egyáltalán nem írja le.** A táblázat mezője (`structuredOutput.strategies[].usable`)
  indexelést tartalmaz, tehát a kiválasztás ennek a viselkedésnek a része, és bizonyíték nélkül a
  motor nem állíthatja, hogy a stratégia működik ezzel a providerrel (11.2, a tippelés tilalma).

A `StepStartedPayload` három opcionális jelölő mezője (`strategyUnproven`,
`modelIdentifierUnproven`, `serverToolAvailabilityUnproven`) ennek a témának az `unknown` ágaiból
származik, és a T-005-9-ben jelzett, tervezett bővítés beváltása. Az utolsó szándékosan logikai,
nem névlista: a bizonytalanság éppen azt jelentheti, hogy a tool nevek sem ismertek.

**A `run-validation` téma határa: a SPEC-004 11.2 provider validáció bedrótozása egy későbbi
lépésre vár.** A SPEC-004 4.8 3. lépése a gráf validációt és a provider validációt egyetlen
blokként nevezi meg, és a `capability-policy` téma (T-005-13) a leírótól függő ellenőrzéseket már
megírta. A `validateRun` mégis csak a **gráf** oldalt drótozza be, plusz a 4.8 2. lépésének
provider **feloldását**; a leíró alapú ellenőrzések (`validateModelId`, `resolveThinkingMode`,
`resolveEffortInclusion`, `resolveStructuredOutputStrategy`, `validateMaxTurnsFloor`,
`validateForcedToolChoiceRisk`, `validateSdkVersionMatch`) hívása a **T-005-19 `agent-step`
lépésre** marad. Az indok nem a lépés mérete: ezek a függvények nem `Outcome<void>` ellenőrzések,
hanem **döntéseket** adnak vissza (`CapabilityFieldInclusion`, `StructuredOutputStrategyDecision`,
`ModelIdentifierDecision`, `DisallowedServerToolsDecision`), amiket az `Options` objektum
összeállítása fogyaszt, és amikből a `StepStartedPayload` három `unproven` jelölője származik. Ha
a validáció most lefuttatná őket, az eredményt vagy eldobná (és a T-005-19 mindent újraszámolna,
két, egymástól elcsúszható hívási úttal), vagy a `ValidatedRun` hordozná az egész `Options`
előképet, ami az `agent-step` téma felelőssége. A helyes drótozás ezért az, hogy a T-005-19
`buildStepOptions` tiszta függvénye megszületik, és a `validateRun` **azt** futtatja le szárazon
minden `agent_step` és `ai_synthesis` módú node-ra, egyetlen kódúton. Addig a viselkedés: egy
leíró szintű hiba (például ismeretlen `modelId`) nem a futás indítását, hanem az érintett lépést
buktatja meg. Ez nyitott átvezetés, nem elfogadott végállapot.

**A `validateRun` az első hibánál megáll, nem gyűjt hibalistát.** A SPEC-004 egyetlen helyen sem
mondja ki, melyik a kettő közül, ezért ez **tervezési döntés, nem mérésből jövő szám**: az
ellenőrzések egymás előfeltételei (a `dangling_edge` után az elérhetőségi bejárás, a
`malformed_node_config` után a config szintű ellenőrzések értelmezhetetlenek lennének), és az
`Outcome` alak eleve egyetlen üzenetet hordoz. Ha a szerkesztőnek valaha teljes hibalista kell, az
külön felület lesz, nem ennek a függvénynek a bővítése.

**Minden node kap feloldott providert, nem csak az agent jellegűek.** A pillanatkép dokumentum
`SnapshotNode.effectiveProviderId` mezője kötelező és nullázhatatlan, node típustól függetlenül
(SPEC-003 5.1), ezért a `resolveNodeProviders` a gráf minden node-jára lefuttatja a feloldást. A
nem agent jellegű node-oknál (start, branch, fan_out, loop, human_approval, error_handler,
sub_workflow, `join` `merge`) nincs lépés szintű felülírás, tehát rájuk a workflow és a globális
szint dönt. Ebből következik, hogy hiányzó globális alapértelmezés akkor is `no_default_provider`
hibát ad, ha a gráfban egyetlen agent lépés sincs; ez összhangban áll a SPEC-003 4.13
szekcióval, ami a hiányt a **futás indításának** feltételeként fogalmazza meg.

**Az `executable-node-config.spec.ts` a repó egyetlen `.spec.ts` fájlja egy típus-only fájl
mellett.** A konvenció szerint típus-only fájlhoz nem készül teszt (SPEC-002 6.3), itt viszont
pontosan a típus a viselkedés: az `ExecutableNodeConfig` garanciája fordítási idejű. A teszt
`@ts-expect-error` direktívákkal áll, ami akkor **bukik**, ha a megjelölt sor mégis lefordul
("Unused '@ts-expect-error' directive"), tehát a `bun run typecheck` kapu azonnal pirosra vált, ha
a `script` ágak visszakerülnek az unióba. A `@ts-expect-error` a `ban-ts-comment` szabály alatt
leírással megengedett, ezért minden direktíva mellett ott az indok.

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
- [`../../docs/spec/SPEC-004-vegrehajto-motor.md`](../../docs/spec/SPEC-004-vegrehajto-motor.md), 11.2 és 11.3 szekció
- [`../../docs/plan/PLAN-005-vegrehajto-motor.md`](../../docs/plan/PLAN-005-vegrehajto-motor.md), T-005-8
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció
- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
