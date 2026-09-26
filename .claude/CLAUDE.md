# Szabálykönyv

A projekt egyetlen, folyamatosan vezetett szabálykönyve: kizárólag a projekt szabályait
tartalmazza, nem a felhasználó általános viselkedési elvárásait. A gyökér `CLAUDE.md` 1-7.
szekciója a felhasználó saját, kézzel írt viselkedési szabálykönyve (gondolkodásmód,
kommunikáció, kódolási alapelvek); azt ez a fájl nem ismétli meg, csak hivatkozik rá. Ha egy
tétel mindkét dokumentumba illene, csak egy helyen áll.

Minden szabály mellett ott a forrása. Ha egy szabály itt és a forrásdokumentumban is szerepel, a
forrásdokumentum az erősebb, és az eltérést itt kell javítani. A `docs/plan/PLAN-*.md` fájlok
tartalma ide **nem** kerül: azok végrehajtási tervek, nem szabályok. Nyitott ellentmondás esetén a
menetet a 14. szekció írja le. Karbantartás: az utolsó szekció.

Rövidítések a forrásokban: `SPEC-00n` plusz szekciószám a `docs/spec/` alatti spec, `research` a
`docs/research/` alatti mért tény, "gyökér CLAUDE.md" a repo gyökerének fájlja (szekciószámmal az
1-7. szekcióra hivatkozik; szám nélkül olyan projekt-specifikus döntésre, ami korábban a gyökér
`CLAUDE.md` "Project-Specific Guidelines" szekciójában állt, onnan mára ide konszolidálva),
"csomag CLAUDE.md" az adott csomag gyökerének fájlja. Nyitott, méréssel eldöntendő technikai
kérdésre a 4. szekció 2. pontjának jelölési konvenciója vonatkozik (nyitva jelölés, "mi a
viselkedés addig", "mi zárná le"), függetlenül attól, melyik szekcióban merül fel.

---

## 1. Mi ez a projekt

Vizuális workflow tervező és futtató a `@anthropic-ai/claude-agent-sdk` felett. A felhasználó
gráf szerkesztőben rakja össze a workflow-t, elindítja, és real time látja a rajzon, hol tart.
Mellette egy Claude Code CLI szerű transcript panel mutatja, mit csinál az agent.
Forrás: gyökér `CLAUDE.md`.

---

## 2. Munkamenet

| Szabály                                                                                                                                                                                     | Forrás                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `docs/spec/SPEC-<n>-*.md` a specifikáció, `docs/plan/PLAN-<n>-*.md` a végrehajtási terv. A plan linkeli a specet, Todo lépésekre bontva, függőségekkel és elfogadási kritériumokkal.        | gyökér `CLAUDE.md`    |
| `docs/research/` a verifikált kutatási tények tárolója, forrás URL-lel. Új tényt ide vezess.                                                                                                | gyökér `CLAUDE.md`    |
| Feature branchben dolgozunk, a `main` védett. Branch minta: `feat/spec-<n>-<rövid-név>`. Zárás PR-rel.                                                                                      | gyökér `CLAUDE.md`    |
| Minden lépés önálló, zöld commit: a kilenc kapu előbb fut le (8. szekció).                                                                                                                  | gyökér `CLAUDE.md` 7. |
| **Pusholni nem tudsz.** A futtatókörnyezet izolált Linux sandbox, nincs SSH kulcs, nincs `gh`. Minden commit sorozat után szólni kell a usernek, hogy pusholjon, és megadni a branch nevét. | gyökér `CLAUDE.md`    |
| Fájlt átnevezni `git mv` paranccsal kell, nem kézi törléssel és újralétrehozással, különben a git indexben a régi betűzés marad (12. szekció).                                              | SPEC-002 10.          |

A Todo lista, a commit kötelezettsége, az askuserquestion tool és a "mindig azt kell csinálni,
amit a user kér" szabály szó szerint a gyökér `CLAUDE.md` 7. szekciójában áll, itt nem ismételjük.

**Model routing, kötelező.** A feladat -> modell hozzárendelés a gyökér `CLAUDE.md` 6. szekció
MODEL ROUTING pontja alatt áll szó szerint, itt nem ismételjük.

---

## 3. Kommunikációs szabályok

A kommunikációs szabályok (nincs gondolatjel, nincs AI klisé, nincs közbenső válasz, nincs
túlzott bocsánatkérés) szó szerint a gyökér `CLAUDE.md` 6. szekciójában állnak, itt nem
ismételjük. Kiegészítés, ami ott nincs kimondva: **a kommunikáció nyelve magyar.**

---

## 4. Bizonyíték kényszer

Ez a projekt legszigorúbb szabálycsoportja. A tippelés és a webes validálás tilalmának alapszabálya
a gyökér `CLAUDE.md` 1. és 6. szekciójában áll szó szerint, itt csak a projektre szűkített
kiegészítés. Forrás: gyökér `CLAUDE.md` 1. és 6., SPEC-000 2. és 5., SPEC-003 13.

1. **Konkrét precedens a "nincs dokumentált szabály, nem adsz számot" elvre:** a
   `sonarjs/cognitive-complexity` küszöbe a plugin alapértelmezésén marad, a Playwright `retries`
   a dokumentált `0` értéken, az artefaktum retenciós napszámot nem állítjuk be, a
   párhuzamossági korlátra nincs szállított alapérték.
2. **A "nem ellenőrzött" jelölés.** Ha nincs megerősítés, a mondat vagy nem hangzik el, vagy
   kifejezetten "nem ellenőrzött" jelöléssel megy ki. Feltételezéssel lezárt pont nincs: a
   nyitott kérdés explicit nyitva jelölést kap, a "mi a viselkedés addig" és a "mi zárná le"
   mezővel (SPEC-001 15., SPEC-003 13.).
3. **A mérési próza nem a kódba való.** A kódban stabil azonosító (`M-01` ... `M-36`), doksi URL
   vagy research szekció azonosító marad, plusz egy mondat indok. A mérés leírása, a nyers számok
   és az artefaktum hivatkozás a `docs/research/` alatt van (SPEC-001 13.).
4. **Új verziószám mindig élő registry vagy hivatalos forrás lekérdezésből jön**, két független
   forrással, és a `docs/research/2026-08-26-toolchain.md` fájlba vezetve.

---

## 5. Kódolási elvárások

Forrás: gyökér `CLAUDE.md` 2., 3., 7., SPEC-001 7., SPEC-002 6.

**Típusok**

- **Tilos az `any`**, helyette `unknown` plusz typeguard. Kilenc explicit ESLint szabály őrzi
  (`no-explicit-any` és nyolc `no-unsafe-*`), nem csak preset öröklésen keresztül.
- **Tilos az `as` típuskényszerítés**, helyette `satisfies` vagy explicit típusannotáció.
  `consistent-type-assertions` `assertionStyle: 'never'` plusz `no-unsafe-type-assertion`.
- **Az `as const` megengedett**, mert const assertion, nem type assertion. Az
  `assertionStyle: 'never'` mérés szerint nem jelzi (SPEC-001 V-7), és a `satisfies` nem
  helyettesíti mutálható objektum literál mezőjében (`packages/db` CLAUDE.md).
- **Tilos a `!` non-null assertion**, ugyanolyan tippelés, mint az `as`.
- Strict generikus TypeScript. Diszkriminált unióhoz kimerítő `switch`
  (`switch-exhaustiveness-check`), csomaghatáron átmenő típus nem következtetett.
- **Valódi privát mező.** A `private` kulcsszó tiltott, a `#` alak az elvárt, mezőn, metóduson és
  konstruktor parameter propertyn is. `no-restricted-syntax` AST szelektor plusz az
  `erasableSyntaxOnly` fordítói kapcsoló őrzi (SPEC-001 7., V-8).

**Typeguardok**

- Kötelező használni a projektben létező guardokat, nem újraírni. Ha nincs, írni kell.
- Általános, újrahasznosítható guard: `@easter-workflow-builder/typeguards`, fájlonként egy
  guard, kebab-case fájlnév, mindkét ágra és a típusszűkítésre kötelező unit teszt.
- Domain specifikus guard a **saját csomagjában**, a témája mappájában marad.
- Minden guard `value is T` alakú és `unknown` bemenetet fogad (SPEC-003 9.4).
- **Kimondott, hatókörben szűkített kivétel: a `packages/protocol` csomag.** Minden drótszintű
  alak Zod sémából származik (`.safeParse()` a futásidejű ellenőrzés, `z.infer` a típus), nem
  kézzel írt typeguardból. A `typeguards` csomag emiatt nem szűnik meg és nem csökken a szerepe:
  a `protocol` is használhat belőle guardot ott, ahol a kérdés nem drótszintű alak. Négy kötött
  séma írási szabály tartozik hozzá: minden bejövő objektum `z.strictObject` (ismeretlen kulcs
  elutasítva), nincs `.default()` és nincs `.transform()` a protokoll sémáiban, minden kimenő
  alak `.readonly()`, az uniók `z.discriminatedUnion`. A `.parse()` tiltott, csak `.safeParse()`
  fut, és minden validáló függvény `Outcome<T>` alakban ad választ, hogy a dobó kivétel ne törje
  meg a projekt `Outcome` konvencióját (SPEC-005 7.2, 7.3, 7.4).
- **A `protocol` a `db` domain uniót is duplikálhatja, ha gépi sodródás védelem tartozik hozzá.**
  A hat drótszintű felsorolás mellé a `node-config` téma is így kerül be: a tíz ág Zod sémája a
  `db` `NodeConfig` uniójának szándékos duplikátuma, mert az `apps/web` a `db` csomagtól nem
  függhet, tehát enélkül a szerkesztő űrlapjának nincs típusa. A védelem helye kötött, az
  `apps/server` csomag (az egyetlen, ahol a két oldal egyszerre látszik), a formája pedig a
  meglévő `enum-drift-protection` téma mintája: megvalósítás nélküli regressziós teszt,
  típusszintű kétirányú kölcsönös értékadhatóság a `typecheck` kapun, plusz futásidejű ág ott,
  ahol a `db` guardot exportál. **Ami a `db` oldalon `Record<string, unknown>`, azt a séma sem
  szűkíti** (`AgentStepConfig.agents`, `JoinMergeNodeConfig.settings`), különben a védelem
  megbukna. Ez a SPEC-005 egy eredeti döntésének kimondott felülírása (SPEC-005 7.7,
  SPEC-008 5.3, user döntés 2026-09-05).
- **A `protocol` a motor hibaosztályainak részhalmazát is duplikálhatja, ugyanezzel a
  védelemmel.** A `ProtocolErrorClass` zárt szótár (SPEC-005 8.5) a motor `EngineErrorKind`
  uniójának szándékos részhalmaza, plusz a `db` `already_decided` ága; mivel részhalmaz, a
  típusszintű ág egyirányú (`Exclude<ProtocolErrorClass, EngineErrorKind>` pontosan
  `'already_decided'`), a futásidejű ág a motor `isEngineErrorKind` guardja. Helye az
  `apps/server` `error-class-drift-protection` témája (user döntés 2026-09-26, "Ismert okokra
  saját mondat").

**Fájlok és tesztek**

- **Egy fájlba egy dolog**: egy fájl egy exportált egység. Ez **munkautasítás, nem lint szabály**;
  nincs hozzá ESLint implementáció, a betartás code review kérdése (SPEC-001 7., AC15).
- A teszt a megvalósítás **mellett** áll, ugyanabban a mappában, `.spec.ts` végződéssel. `.test.ts`
  a repóban nem létezik. A neve a megvalósítás fájlneve plusz `.spec.ts` (SPEC-002 6.2).
- Típus-only fájlhoz **nem** készül `.spec.ts`, és a csomag `CLAUDE.md` `## Fájlok` táblázata
  jelöli, hogy típus-only, hogy az olvasó ne hiányolja a tesztet (SPEC-002 6.3).
- Van megvalósítás nélküli regressziós teszt is: konfigurációs invariánst őriz, saját téma
  mappában, a mappa neve annak a dolognak a neve, amit őriz (SPEC-002 6.2 5.).
- **Minden bugot a javítás után teszttel kell lefedni**, hogy ne fordulhasson elő újra (gyökér
  `CLAUDE.md` 7.).

**Egyszerűség és sebészi változtatás**

- Minimum kód, ami megoldja a problémát. Nincs spekulatív absztrakció egyszer használt kódra,
  nincs kért nélküli konfigurálhatóság, nincs hibakezelés lehetetlen esetre.
- Csak azt írod át, amit muszáj. Nem "javítasz" szomszédos kódot, kommentet, formázást. A saját
  változtatásod árváit takarítod, a meglévő halott kódot jelzed, nem törlöd.
- **A 100 százalékos, kizárás nélküli lefedettségi küszöb miatt tilos olyan ágat bevezetni, ami
  típusilag vagy logikailag garantáltan sosem fut.** Ez több konkrét tervezési döntés oka a
  `packages/db` csomagban (`packages/db` CLAUDE.md).

**Dokumentáció a kódban**

A "jól dokumentált, de nem túlmagyarázott kódbázis" alapelve a gyökér `CLAUDE.md` 7. szekciójában
áll, itt nem ismételjük.

- A kód kommentjei és a `CLAUDE.md` fájlok magyarul íródnak. Ez a repóban kivétel nélküli,
  megfigyelt gyakorlat; írott spec szabály nincs rá.

---

## 6. Csomag és mappa konvenció

Teljes szabályrendszer: SPEC-002 6. szekció. Itt csak a döntési szabályok.

**Névtér.** Minden workspace csomag neve `@easter-workflow-builder/` prefixet visel, kivétel
nélkül, a `tooling/*` és a `tools/*` csomagokat is beleértve (SPEC-002 3.).

**Mikor új csomag, mikor almappa.** A csomagon belül kell tagolni, nem új csomaggal. A workspace
25 csomagból áll: 19 `packages`, 2 `apps`, 3 `tooling`, 1 `tools` (gyökér `CLAUDE.md`,
SPEC-002 4.).

**Mappaszerkezet.**

- A csoportosítás alapja a **téma**, a domain fogalom, nem a fájlok száma és nem technikai réteg.
- A `src/` alatt alapesetben egy szint mély (`src/<téma>/`), és kétszintű két okból lehet
  (`src/<tárgykör>/<téma>/`): a csomag több tárgykört fog össze, vagy egy tárgykörön belül
  egyetlen téma mappa maga több, önállóan megnevezhető fogalmat hordoz. Ilyen ma pontosan három
  van: a `core` és a `provider-capability` (első ok), valamint a `db`, ahol a `workflow-graph`,
  a `graph-snapshot` és a `run-event` téma mappa vált tárgykör mappává (második ok, PLAN-004).
  **Harmadik szint tilos.**
- Az `index.ts` barrelen kívül egyetlen fájl sem állhat közvetlenül a `src/` alatt. Téma mappán
  belül nincs `index.ts`.
- Ha egy tárgykörnek egyetlen témája van és a nevük megegyezik, a mappaszint nem duplázódik
  (`<x>/<x>/` tilos).
- **Tiltott mappanevek:** `types/`, `interfaces/`, `models/`, `utils/`, `helpers/`, `lib/`,
  `common/`, `shared/`, `internal/`, `private/`, `config/`. A tiltás a puszta névre vonatkozik: a
  `minimax-config/` és a `firecrawl-config/` helyes, mert megnevezi a szolgáltatást.
- Két kivétel a hatókör alól: `apps/web/src/vite-env.d.ts` és a `tools/wire-probe` csomag
  (SPEC-002 6.8). Az előbbi a korábbi `apps/web/src/main.ts` kivétel helyére lépett, miután a
  valódi UI belépési pont felállt (SPEC-007 12.2, T-008-30).

**A bontási kritérium.** Darabszám küszöb nincs, mert nincs rá forrásunk. A darabszám csak azt
jelzi, hol érdemes lefuttatni a próbát. Forrás: PLAN-004 3. szekció.

Bontani akkor kell, ha **mind a három** teljesül:

1. **Több fogalom.** A mappa fájljai legalább két olyan csoportba esnek, aminek külön,
   felismerhető domain neve van, és egyetlen fájl sem tartozik egyszerre kettőbe.
2. **A fájlnév nem árulja el a csoportot.** Ha a fájlnevek közös előtaggal már megnevezik a
   csoportot, a mappa önmagát dokumentálja, és a bontás nulla információt tenne hozzá. Bontani
   akkor kell, ha van olyan fájl, aminek a nevéből egy junior nem tudja megmondani, melyik
   csoporthoz tartozik.
3. **Az irány körmentes.** A csoportok között az import irány egyirányú. Ha két csoport oda-vissza
   hivatkozik, az egy fogalom volt, nem kettő.

A bontást **bármelyik** megállítja:

4. **Nincs domain neve.** Ha a csoportnak csak technikai réteg neve adható, az nem csoport.
5. **A typeguard elszakadna attól, amit őriz.** Az `is-<x>.ts` mindig ugyanabban a mappában áll,
   mint az `<x>.ts`.
6. **A teszt elszakadna a megvalósítástól.** A `.spec.ts` mindig a párja mellett marad.

Egy fájl akkor áll egyedül egy mappában, ha a fogalomnak ténylegesen egy fájlja van, nem azért,
mert máshova nem fért be.

**Elnevezési elv.** Ami egy konkrét külső szolgáltatóhoz köthető, azt a csomag nevében meg kell
nevezni, előbb a szolgáltató, utána a funkció: `provider-minimax`, `minimax-client`,
`firecrawl-client`, `tool-minimax-web-search`, `tool-firecrawl-web-fetch`,
`tool-minimax-understand-image`. A próba: ha holnap egy második implementáció érkezik ugyanarra a
funkcióra, megkülönböztethető marad-e a kettő. A szolgáltatófüggetlen csomagokat (`core`,
`typeguards`, `mcp-tool-kit`, `protocol`, `logger`, `db`, `engine`, `ui`) és a saját domain
fogalmukról szólókat (`provider-capability`, `provider-registry`, `agent-tool-bundle`) nem kell
megnevezni. **Az MCP eszköznevek (`web_search`, `web_fetch`, `understand_image`) nem változnak**,
azok az agent felé kimenő szerződés (SPEC-002 6.9).

**Publikus felület.** A csomag felülete kizárólag a `src/index.ts` barrel, csak nevesített
újraexporttal; `export *` tilos. Ami nincs a barrelben, az kívülről nem használható. A barrel a
coverage kizárási listáján van, tehát nem tartalmazhat futásidejű elágazást. A barrel
újraexportálja azokat az idegen csomagból jövő típusokat, amik a csomag saját publikus
szignatúráiban megjelennek. Placeholder export (`IS_<CSOMAG>_PLACEHOLDER`) az első valódi export
felvételekor törlendő (SPEC-002 6.6).

**Rétegzés.** A gráf aciklikus, minden él szigorúan csökkenő rétegszám felé mutat. Az eszköz
csomagok (`eslint-config`, `tsconfig`, `scripts`, `wire-probe`) kizárólag `devDependencies` helyen
jelenhetnek meg. A réteg térkép a `tooling/scripts/src/dependency-graph/package-layer.ts`
fájlban áll: **új csomagnak kötelező felkerülnie oda**, különben a `bun run check:graph` hiányzó
réteg-hozzárendelés hibát ad (SPEC-002 4.).

**`CLAUDE.md` elhelyezés.** A ténylegesen kikényszerített szabály: kizárólag a repo gyökerében és
minden workspace csomag gyökerében (minden könyvtárban, ami saját `package.json` fájlt tartalmaz).
Sem téma mappa, sem tárgykör mappa, sem a `drizzle/` mappa nem kap sajátot. A `bun run docs:check`
pontosan ezt ellenőrzi `git ls-files '*/package.json'` alapján (gyökér `CLAUDE.md` 7., SPEC-002
6.7, SPEC-001 14., `claude-md.sh` fejléc). A SPEC-001 14. szekció "Hol kell" táblázata és a 39.
elfogadási kritériuma ezt a szabályt tükrözi.

A csomag szintű `CLAUDE.md` kötelező szekciói: `# <útvonal>`, `## Mi ez a mappa`, `## Fájlok`,
`## Függőségi irány`, `## Szabályok`, `## Kapcsolódó dokumentumok`. A `## Fájlok` táblázata a
**téma mappákat** sorolja fel, nem az egyes fájlokat. Tilos beleírni: a gyökér szabályok szó
szerinti ismétlését, verziószámot, ami a toolchain research fájlban is szerepel, és mérési
narratívát. Ha egy mappa fájlkészlete változik, a `## Fájlok` táblázat **ugyanabban a commitban**
változik (SPEC-001 14., SPEC-002 6.7). A `bun run docs:check` ezt kizárólag **létezés** szerint
ellenőrzi, a táblázat tartalmi frissessége code review kérdése, gépi kikényszerítés nincs rá
(SPEC-001 14. "Karbantartási szabály"). **Javaslat, nem eldöntött kérdés:** egy tartalmi
ellenőrző script megírása mérlegelhető, ha valaha megéri a ráfordítást; ez nem döntés, csak
felvetés.

---

## 7. Stack és verziók

A rögzített verziók egyetlen forrása: `docs/research/2026-08-26-toolchain.md`. Számot ide nem
írunk, hogy egy frissítés egy helyen történjen.

**A stack, szám nélkül.** TypeScript, Bun (csomagkezelő és workspace), Node (runtime), Turborepo,
React, Vite, `@xyflow/react`, Drizzle ORM + `better-sqlite3`, `ws`, `pino` + `pino-roll`, Vitest,
Playwright, ESLint flat config (gyökér `CLAUDE.md`). A workflow sablon nyelve Mustache
(`mustache`), a kifejezés nyelve CEL (`@marcbachmann/cel-js`); a bevezetésük a PLAN-010 szerint
történik (user döntés 2026-09-23, SPEC-010).

**Miért ezek, röviden**

| Döntés                                                                                                    | Indok                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TypeScript 6.0.x fix, nem frissítjük 7-re                                                                 | a `typescript-eslint` peer range-e `<6.1.0`, a TS 7 támogatás "not planned", mert nincs stabil compiler API                                                                                                                                                                                                                    |
| Bun csak csomagkezelő és workspace, a runtime Node                                                        | a Vitest 4 Bun alatt nem támogatott, a v8 coverage `node:inspector`-t igényel, ami Bunban hiányzik                                                                                                                                                                                                                             |
| Turborepo `tasks` séma, nincs `pipeline` kulcs                                                            | Turborepo 2.x                                                                                                                                                                                                                                                                                                                  |
| Nincs TypeScript projekt referencia, nincs `composite`                                                    | a Turborepo hivatalos ajánlása; a build sorrendet a `turbo.json` `dependsOn` adja (SPEC-001 D-1)                                                                                                                                                                                                                               |
| Forrás fogyasztás: az `exports` a `./src/index.ts`-re mutat                                               | méréssel igazolt, nincs build lépés a könyvtárcsomagokban (SPEC-001 V-1)                                                                                                                                                                                                                                                       |
| Prettier formáz, ESLint nem; `eslint-config-prettier/flat` az utolsó elem, `eslint-plugin-prettier` nincs | a Prettier saját dokumentált ajánlása (SPEC-001 8.)                                                                                                                                                                                                                                                                            |
| Az Agent SDK verziója pinelve                                                                             | a kimenő request body mezőlista verziónként bővül, egy új mező MiniMax ellen 400-at okozhat                                                                                                                                                                                                                                    |
| Sablon nyelv Mustache, kifejezés nyelv CEL, mindkét csomag pontos verzióval pinelve                       | a Mustache logika mentes, a CEL nem Turing-teljes (user döntés, SPEC-010 4.); a CEL JS binding fiatal, ezért a frissítése előtt a blokkoló mérés regresszióként fut (SPEC-010 4.2 1. pont); a Mustache név feloldás saját adat tulajdonságra szűkített, mert szűkítés nélkül egy sablon a szervert leállíthatja (SPEC-010 6.6) |

**Tiltások**

- **Tilos `bun:` prefixű modult használni a termékkódban** (`bun:sqlite`, `Bun.serve`), mert a
  Vitest Node alatt fut és nem tudja importálni őket. A WebSocket réteg `ws`, az SQLite driver
  `better-sqlite3`.
- **Vitest futtatása `bun run vitest`, soha nem `bun test`** (az a Bun saját runnere).
- **Nincs Docker.** Az agent sandboxot az SDK `sandbox` opciója adja. A tilalom a termék agent
  sandboxára vonatkozik, nem a CI futtatókörnyezetére (SPEC-001 15., V-19).
- **`npm` és `npx` nem használható**, csak `bun run` és `bun x` (`bunx`). A
  `devEngines.packageManager` deklaráció után az `npx` megtagadja a futást; ez egy valós CI hibát
  okozott, lásd 12. szekció.
- Eltávolított vagy deprecated TypeScript opció (`baseUrl`, `moduleResolution: node`,
  `target: es5`, ...) egyetlen configba sem kerülhet, és `"ignoreDeprecations"` kapcsolót sem
  használunk (SPEC-001 6.).
- **Titok soha nem kerül adatbázisba vagy gitbe.** A DB csak env változó **nevet** tárol
  (gyökér `CLAUDE.md`, SPEC-003 9.3).

---

## 8. Minőségi kapuk

**Ez a szekció a kapuk listájának mérvadó, egyetlen forrása. Minden más dokumentum, ami a
kapuk számát vagy listáját említi, ide mutat.** Minden lépés végén mind a kilenc parancs nulla
kilépési kóddal fut, és a lépés csak ezután commitolható. Forrás: gyökér `package.json`
scriptjei, `.github/workflows/ci.yml` `gate` mátrix, SPEC-003 15. szekció 44. kritérium.

| Parancs                  | Mit őriz                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `bun run format:check`   | Prettier formázás                                                                        |
| `bun run typecheck`      | típushelyesség a teljes workspace-en                                                     |
| `bun run lint`           | `any`, `as`, `private`, kör, deklarálatlan függőség tilalma                              |
| `bun run test`           | Vitest, 100 százalék lefedettség mind a négy metrikán                                    |
| `bun run build`          | build task                                                                               |
| `bun run docs:check`     | `CLAUDE.md` minden kötelező helyen                                                       |
| `bun run check:casing`   | a git index betűzése egyezik a relatív importokéval                                      |
| `bun run check:graph`    | aciklikus gráf, szigorúan csökkenő rétegszám                                             |
| `bun run check:db-drift` | a `packages/db` séma és a commitolt `packages/db/drizzle` migrációk szinkronban vannak-e |

A `test` és a `build` a CI-ben önálló jobként fut, a többi hét a `gate` mátrix egy-egy lába;
mind a kilenc egyenrangú kapu, egyik sem "kiegészítő" a másikhoz képest (`tooling/scripts`
CLAUDE.md, SPEC-003 10.3).

**A `bun run test:e2e` és a `bun run coverage:e2e:report` nem tagja a kilenc kapunak, de
2026-09-05 óta KIKÉNYSZERÍTETT KÜSZÖBŰ CI KAPU.** A Playwright futtatás és az e2e lefedettségi
riport a CI-ban külön `e2e` jobban fut, a `build` jobra várva; nem szerepel sem a gyökér kilenc
kapu parancsai között, sem a `gate` mátrixban.

**Miért nem a tizedik kapu, és mi teszi mégis kapuvá.** A kilenc kapu a **lokális, commit előtti**
készlet: mindegyik parancs futtatható build és böngésző nélkül, másodpercek alatt. Az e2e ezzel
szemben Chromium telepítést és teljes frontend buildet igényel (a fejlesztői sandboxban ráadásul
csak a 12. szekcióban leírt `LD_LIBRARY_PATH` kerülővel indul el), ezért marad külön kategória, a
CI saját `e2e` jobjában. Ami kapuvá teszi: a `bun run coverage:e2e:report` a küszöb alatt **nem
nulla kilépési kódot** ad, ettől az `e2e` job elbukik, az `e2e` job pedig szerepel az összesítő
`ci` job `needs` listájában (`[gate, test, build, e2e]`), ami a repository ruleset egyetlen
kötelező státuszcsekkje. A lánc mind a három szeme mérve, illetve dokumentált forrásból igazolva:
`docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md` 6. szekció.

**A küszöb értéke mért szám, ratchet.** A kikényszerítés helye az `apps/web/package.json`
`coverage:e2e:report` scriptjének `--check-coverage` kapcsolója, mind a négy metrikára. A számokat
ide nem írjuk (egy frissítés egy helyen történjen), a származtatás, a nem fedett részek tételes
listája és a "nulla fájl kizárás" döntés a research fájlban áll. A küszöb pontosan a mért érték,
felfelé kerekítés nélkül. Az `nyc` összehasonlítása szigorúan kisebb (`coverage < threshold`),
tehát a küszöbbel egyenlő érték átmegy. A kapu konfigurációját (a `--check-coverage` megléte és a
`ci` job `needs` listája) az `apps/web/src/e2e-coverage-threshold/` regressziós tesztje őrzi.

**A ratchet valójában a fedetlen sorok számára vonatkozik, nem a százalékra** (user döntés
2026-09-09). A cél az, hogy a lefedettség ne tudjon ÉSZREVÉTLENÜL romlani, nem az, hogy a
százalék soha ne csökkenhessen. Ha a fedetlen tételek száma egyetlen metrikán sem nő, és a
csökkenést kizárólag fedett kód törlése okozza (a nevező zsugorodik, a számláló nem), a küszöb
lefelé követheti a mért értéket - de csakis tételes levezetéssel a research fájlban: melyik fájlból
mennyi fedett kód tűnt el, és a fedetlen tételek darabszáma előtte és utána azonos. Ha a fedetlen
sorok száma nő, az valódi lefedettség-romlás, és tesztet kell írni a hiányra, nem a küszöböt
csökkenteni - ez a tiltás a korábbi, szigorú olvasat, és változatlanul érvényes erre az esetre.
Elfogadott precedens: `docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md` 15. szekció.

**Az e2e küszöb nem 100 százalék, és ez felhasználói döntés.** A unit lefedettség változatlanul
100 százalék, kizárás nélkül. Az e2e küszöb alatta van, mert marad néhány, e2e-vel elvileg sem
elérhető sor (build időben rögzülő `VITE_*` konfiguráció hibaágai, React `useEffect` cleanup, ami
csak leszereléskor fut, és egy olyan hibaág, amit nem lehet felhasználói úton előidézni). Ezek
tételesen, fájlonként indokolva a research fájlban állnak, és mind unit teszttel fedett.

**Vitest projektek.** A gyökér `vitest.config.ts` `test.projects` mezője fogja össze a
`packages/*` és `apps/*` csomagokat; `apps/web` és `packages/ui` saját `vitest.config.ts`-e adja a
`happy-dom` környezetet, a többi Node alatt fut. A `tools/wire-probe` csomagnak nincs `test` npm
scriptje, de a `no-shadowed-path-import.spec.ts` regressziós tesztje mégis lefut: a gyökér
`vitest.config.ts` a `tools/wire-probe/src/**/*.{test,spec}.ts` mintát explicit projektként veszi
fel, függetlenül attól, van-e a csomagnak `test` scriptje (gyökér `CLAUDE.md`).

**Lefedettség.** 100 százalék mind a négy metrikán, kizárás nélkül. A `vitest.config.ts`
`coverage.exclude` listája **termékkód** kizárásra nem bővíthető: ez a tiltás célja, nem a
szó szerinti "egyetlen sor sem kerülhet rá" olvasat. Csomag-specifikus **termékkód** kizárás ma
nincs; a korábbi, ideiglenes `apps/web/src/main.ts` kizárás a valódi UI belépési pont
megérkezésekor (SPEC-007 12.2, T-008-30) törölve lett a listáról (gyökér `CLAUDE.md`, SPEC-002
9., SPEC-003 12.4). **Egy teszt fájl
bejegyzés nem termékkód kizárás**, ezért a lista egyetlen `**/*.spec.tsx` sorral bővült, a már
meglévő `**/*.spec.ts` bejegyzés pontos analógjaként egy másik kiterjesztésre: a `packages/ui`
és az `apps/web` React komponens tesztjei `.spec.tsx` fájlok, valódi JSX-szel (user döntés,
SPEC-007 O-1, 2026-09-01). Más sor a listán nem bővíthető.

**Token takarékos wrapper kötelezettség.** Minden zajos parancshoz (lint, teszt, prettier, build,
mérés) kötelező bash wrapper a `tooling/scripts` alatt, ami csak összegzést és a hibákat írja ki.
A wrapper szerződése: fejléc egy sor, összegzés egy sor, hibablokk csak ha van hiba; a burkolt
parancs kilépési kódját adja tovább; a teljes kimenetet `.turbo/wrapper-logs/` alá menti, és az
útját csak hiba esetén nevezi meg. A wrapperek bash scriptek, nem Node programok, hogy egy hibás
telepítés se némítsa el őket (gyökér `CLAUDE.md`, SPEC-001 11.).

**CI.** A kapuk külön jobokban, párhuzamosan futnak, `fail-fast: false` mellett; a `gate` mátrix
minden lába ugyanazt a gyökér npm scriptet hívja, amit a fejlesztő helyben futtat. Az `e2e` a
`build` jobra vár. Az összesítő `ci` job az egyetlen, amit a repository ruleset kötelező
státuszcsekként megkövetel, ezért egy új kapu felvétele nem igényel ruleset módosítást. A
`coverage-comment` **nem** minőségi kapu, ezért nincs a `ci` job `needs` listájában. A CI nem kap
MiniMax API kulcsot (SPEC-001 12.).

---

## 9. Provider réteg

Két provider az első verzióban, backend TypeScript config fájlokban rögzítve, **nincs hozzájuk
CRUD felület**, csak választani lehet közülük: `claude-subscription` (Claude Code bejelentkezés) és
`minimax` (`ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic`). Választás három szinten:
globális alapértelmezés, workflow felülírás, lépés felülírás. A provider választó komponens része
a "Kapcsolat teszt" gomb. Forrás: gyökér `CLAUDE.md`.

**A képesség leíró és a bizonyíték kényszer.** A MiniMax képességei szűkebbek az Anthropicénál:
nincs strukturált kimenet, a `tool_choice` csak `auto`/`none` lehet, a `thinking` csak
`adaptive`/`disabled`, az `effort` `output_config`-ként megy ki, amit a MiniMax elutasít. Ezért van
`ProviderCapabilityDescriptor`. Minden képességmező háromállapotú `Fact<T>` burkolóban
áll: vagy `known` egy **nem üres** bizonyítéklistával, vagy `unknown` indoklással és a blokkoló
mérési eset azonosítójával. A nem üres lista típusszintű követelmény, tehát bizonyíték nélküli
`known` mező **nem fordul le**. Képességet megtippelni tilos: minden mező mögött mérés vagy
hivatkozott hivatalos doksi áll, különben `unknown` (SPEC-000 5., gyökér `CLAUDE.md`).

**Hatókör: kizárólag a `MiniMax-M3`.** A többi MiniMax modellt tilos említeni dokumentumban,
kódban, kommentben és a usernek szóló jelentésben is. Ha egy hivatkozott GitHub issue mégis másik
modellről szól, a mondat ne nevezze meg a modellt, csak a kockázatot és a saját M3 mérésünk
eredményét (gyökér `CLAUDE.md`).

**SDK verzió frissítés előtt** a SPEC-000 mérései regresszióként futtatandók (gyökér `CLAUDE.md`).

**Titok kezelés.** A kulcs csak env változóból jön, a mérési configban sem szerepel literálként.
Az `authorization` és `x-api-key` header maszkolt, a `MINIMAX_API_KEY` értékének minden
előfordulása `REDACTED`-re cserélődik még a lemezre írás előtt, memóriában. Nyers, maszkolatlan
artefaktum sosem íródik lemezre. Commit előtt kötelező ellenőrzés: a kulcs értékére futtatott
keresés nulla találatot ad (SPEC-000 3., `tools/wire-probe` CLAUDE.md).

---

## 10. Perzisztencia

Részletek: SPEC-003 és `packages/db/CLAUDE.md`. A négy szabály, ami minden más felett áll:

**1. A `Fact` mintájú típusszintű garancia a repositoryn.** A séma garanciái nem kerülhetők meg:
a barrel nem exportál Drizzle tábla objektumot, `drizzle()` példányt vagy `better-sqlite3`
szimbólumot, a `package.json` `exports` csak a barrelre mutat, tehát mély import sincs. Nincs
általános `updateStatus` metódus, csak nevesített állapotváltók, compare and set `WHERE`
feltétellel; nulla módosított sor `illegal_status_transition` hibaágat ad. Minden művelet
`Outcome<T>` értéket ad vissza, kivétel nem repül ki a rétegből. A hibaosztály neve szó szerint,
zárójelben szerepel az `Outcome` üzenetében (SPEC-003 7.3, 9.1, 9.3).

**2. Pillanatkép, tartalom szerinti címzés.** Minden futás pillanatképet tárol a gráfról. A sort a
tartalmának `sha256` lenyomata azonosítja, RFC 8785 szerinti kanonikus alakon. A dedup nem a
lenyomaton áll: ha a lenyomathoz már van sor, a tárolt dokumentumot **bájtra** összehasonlítjuk, és
eltérés esetén `graph_snapshot_hash_collision` hibaág jön, semmi nem íródik. A pillanatkép
megváltoztathatatlan: repository szinten nincs módosító művelet, és egy `BEFORE UPDATE` trigger is
megbuktatja a kísérletet (SPEC-003 5.5, 5.6).

**3. Delta kapcsoló.** A `content_block_delta` jellegű események perzisztálása kapcsolható,
**alapértelmezésben kikapcsolva**, a felhasználó explicit döntése alapján. Pontosan egy `kind`
értékre hat, a `sdk_stream_event` értékre. Az érték a futás indításakor befagy a
`workflow_run.persisted_stream_deltas` oszlopba, tehát futás közben nem változhat. Nem
megkerülhető: az `appendSdkEvent` bemeneti típusában nincs kapcsoló mező, a beszúrás egyetlen
utasítás, ami a futás sorából olvassa ki a befagyasztott értéket. Az élő WebSocket nézetre nincs
hatása, mert az a motorból jön, nem az adatbázisból (SPEC-003 6.6).

**4. Végleges törlés.** Nincs soft delete, nincs archiválás, nincs `deleted_at` és nincs kuka. Egy
workflow törlése a futásait, a pillanatképeit, a lépés futásait, minden eseményét és minden
jóváhagyását véglegesen elviszi, az al-workflow futásaival együtt. A `deleteWorkflow` az egyetlen
törlési út, és a bemenete kötelezően tartalmazza az `acknowledgeIrreversible: true` literált. A
pillanatkép nem kaszkádon megy: a futások törlése után, ugyanabban a tranzakcióban árva söprés
viszi el. A felületnek megerősítést kell kérnie, megnevezve, mi vész el (SPEC-003 4.15, 9.2).

**Amit a "megnevezve, mi vész el" konkrétan jelent.** A megnevezés forrása a `DeletionSummary`
alakja, ami a `packages/db` repository rétegében dől el, onnan tükrözi a `packages/protocol`
`DeletionSummarySchema`, és a felület azt jeleníti meg: `runCount`, `eventCount`,
`snapshotCount`. A fenti bekezdés kaszkád-felsorolása (lépés futás, jóváhagyás) azt írja le, mi
**törlődik**, nem azt, mi **számlálódik**: a lépés futások és a jóváhagyások a futással együtt,
kaszkádban tűnnek el, tehát a futás darabszáma fedi őket. Ez a pont korábban a SPEC-007 48.
kritériumában négy mezős felsorolásként állt, ami nem egyezett a sémával; a spec 2026-09-02-án a
séma szerint javítva (SPEC-007 10.1, 48. kritérium).

**Migrációk.** `drizzle-kit generate`, a generált SQL és a snapshot gitbe kerül; a `migrate()` az
`openDatabase` része, a hálózati kapcsolatok fogadása előtt. **A `drizzle-kit push` tiltott.**
Kézzel írt SQL a `--custom` üres migrációba kerül. Fejlesztés és éles ugyanazon az úton megy
(SPEC-003 10.3).

**Teszt.** Minden `.spec.ts` valós `better-sqlite3` adatbázis ellen fut, `:memory:` példányon, ami
a **commitolt** migrációkkal épül fel. Mockolt adatbázis nincs (SPEC-003 12.1, 12.2).

---

## 11. Frontend és e2e tesztelés

Eddig nem volt önálló szekció a frontend felületi elvárásokra és a Playwright e2e tesztek
írási szabályaira, ez pótolja azt.

**Playwright locator és várakozás szabályok.** Forrás:
`docs/research/2026-08-29-playwright-teszt-szabalyok.md`, a teljes, 15 tételes "Alkalmazható
szabálylista" ott áll részletesen, itt csak a lényeg.

- **Locator sorrend**, a hivatalos Quick Guide dokumentált sorrendje szerint: `getByRole`
  elsőként, utána `getByLabel` (form mezőn), `getByPlaceholder`, `getByAltText`, `getByTitle`,
  `getByText` (csak nem interaktív elemen), végül `getByTestId`. CSS és XPath szelektor csak
  akkor, ha egyik sem alkalmazható (research 2. szekció, <https://playwright.dev/docs/locators>).
- **Tilos a `page.waitForTimeout()` és a kézi `setTimeout`/`sleep`.** Ezt maga a hivatalos
  Playwright dokumentáció mondja ki, szó szerint: "Note that `page.waitForTimeout()` should
  only be used for debugging. Tests using the timer in production are going to be flaky. Use
  signals such as network events, selectors becoming visible and others instead."
  (<https://playwright.dev/docs/api/class-page#page-wait-for-timeout>, research 5. szekció).
  Helyette web-first assertion, `locator.waitFor({ state })`, `page.waitForResponse()` vagy
  `expect.poll`/`toPass` (research 7. szekció).
- **`toBeDetached` néven nincs önálló assertion.** A "nincs csatolva a DOM-hoz" állítást a
  hivatalos API kizárólag `toBeAttached({ attached: false })` alakban tudja kifejezni.
  `toBeAttached()` csak a DOM-hoz csatoltságot ellenőrzi, láthatóságtól függetlenül;
  `toBeVisible()` ennél szigorúbb, csatoltság ÉS láthatóság együtt kell hozzá. A kettő nem
  felcserélhető (research 6. szekció, <https://playwright.dev/docs/api/class-locatorassertions>).
- **A timeout tilalom határa.** A kézi, idő alapú várakozás tilalma (`waitForTimeout`,
  `setTimeout`, `sleep`) maradéktalanul megvalósítható kizárólag állapot alapú eszközökkel. Ez
  **nem** jelenti a Playwright beépített assertion timeoutjának (alapból 5000 ms) vagy a test
  timeoutnak (alapból 30000 ms) a nullázását vagy kikapcsolását: erre a hivatalos doksi nem ad
  dokumentált megoldást, és nem is ajánlja. Ezeket a beépített felső korlátokat nem szabad
  nullázni vagy eltávolítani (research 8. szekció, NEM MEGERŐSÍTETT pont az
  `expect.timeout`/`test.timeout` nullázására).
- **Vizuális állítást csak kifestett pixel bizonyít.** Ha a teszt tárgya az, hogy valami LÁTSZIK
  (vonal, keret, szín), a DOM megléte és a `toBeVisible()` nem elég: mindkettő zöld marad, ha az
  elem a háttér színével fest. A bizonyíték két képernyőkép ugyanarról a kivágatról, egyszer az
  elemmel, egyszer elrejtve, és a két kép csatorna eltérése. Ehhez jön, hogy az állítás a VALÓS
  alkalmazás alakján fusson, ne egy csak a tesztnek gyártott elrendezésen, és mindkét témában.
  Mérten megkülönböztető: az él vonalán 236 (világos) és 53 (sötét) az ép, 0 és 1 az elrontott
  érték, miközben a `toBeVisible()` mindkét esetben átment
  (`docs/research/2026-09-09-graf-el-vonal-meres.md` 4. szekció, user kérés 2026-09-09).

**A Playwright lokálisan legfeljebb HÁROM workert használhat** (user kérés 2026-09-24): "A
Playwright teszteknél maximum három worker futhat. Több nem, lokál... mert megöli a gépet." A
korlát a TELJES GÉPRE vonatkozik, nem konfigurációnként: lokálisan egyszerre csak egy Playwright
folyamat futhat, az e2e shardok (`--shard=1/3` ... `3/3`) egymás UTÁN, sorban futnak, nem
párhuzamosan, mert két egyidejű Playwright folyamat együttes worker száma is a korlát alá esik.
A `apps/web/playwright.config.ts` és `playwright.screenshots.config.ts` `workers` mezője ezt
kódolja (`docs/research/2026-09-24-playwright-worker-korlat.md`), a
`apps/web/src/playwright-worker-limit/` regressziós tesztje őrzi a `test` kapun.
**Nyitott pont a CI-ági workers érték méretezésére** (a 4. szekció 2. pontja szerinti
jelöléssel): a user kifejezett kérése szerint "CI-ban futhat több is, mert az elviseli... ha
elviseli, ott majd meg kell nézni" - tehát a tényleges CI worker szám felső korlátja jelenleg
NEM MÉRT. Mi a viselkedés addig: a CI-ági érték változatlan marad azon, amit a config már eddig
is használt (jelenleg `1`, a `docs/ci#workers` ajánlása szerint). Mi zárná le: a tényleges CI
futtatókörnyezet terhelhetőségének mérése (hány worker fut le stabilan a GitHub Actions
runneren), és a mérés eredményének átvezetése ebbe a szakaszba és a `playwright.config.ts`
kommentjébe.

**E2E mockolás.** Forrás: felhasználó kérése ("e2e -nel minden mockolva legyen mint unit
test-nel").

- Az e2e tesztben minden külső hívás mockolva legyen, ugyanúgy, mint egy unit tesztben: a
  REST hívások `page.route()`-tal adott, garantált válasszal mennek, valós backend szervert a
  teszt nem szólíthat meg.

**SSE mockolás: lezárva, hibrid úton.** Forrás:
`docs/research/2026-08-30-sse-mockolas-meres.md`, ami a
`docs/research/2026-08-29-playwright-teszt-szabalyok.md` 9. szekciójának nyitott kérdését
saját, dokumentált méréssel lezárta (10 lefuttatott Playwright teszt a pinelt
`@playwright/test@1.62.1` és chromium ellen). A korábbi nyitva jelölés ezzel törölve; a
döntést a `docs/spec/SPEC-007-frontend-alkalmazas.md` 13.4 szekciója valósítja meg.

A "minden mockolva legyen" szabály az SSE csatornán (`GET /events`, `EventSource`) **az
alapeset**, egyetlen, mérten körülhatárolt kivétellel.

- **`page.route()` + `route.fulfill({ contentType: 'text/event-stream' })` a HASZNÁLANDÓ út**
  minden olyan teszthez, ami egyetlen, lezárt SSE válaszon belüli viselkedést ellenőriz: a
  kapcsolat megnyitása, a `data:` keretek feldolgozása és a rájuk következő DOM frissülés, az
  `id:` mező hatása az adott üzenet `lastEventId` mezőjére, az `event:` mezős nevesített
  keretek, és a `Content-Type` beállítás. Mind mérten működik, és a hivatkozott
  `microsoft/playwright` #15353 issue `Content-Type: null` állítása a pinelt verzió ellen
  **nem reprodukálható**.
- **`page.route()` NEM használható három, mérten bizonyított esetben**: a **`Last-Event-ID`
  alapú újracsatlakozás** fejléc szintű ellenőrzésére, mert a második kapcsolat kérés
  fejlécei a route rétegen nem tartalmazzák a fejlécet (holott a böngésző azt egy valódi
  szerver felé a kontroll mérés szerint bizonyítottan elküldi); **egy már megnyitott,
  folyamatban lévő mockolt kapcsolatba menet közben beszúrt új keret** szimulálására, mert a
  `route.fulfill()` egyszeri, lezárt aktus ("Route is already handled!"), és a `Route` típusa
  sem enged streamelést; és **bármely állítás, aminek a kapcsolat nyitva maradása az
  előfeltétele** (2026-09-05-i mérés,
  `docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md` 4. szekció): a `route.fulfill()`
  lezárt válasz, tehát az `EventSource` a keretek után azonnal `error`-t kap, a `readyState`
  kiesik `OPEN`-ből, és a `replaying`/`live` fázis csak egy meg nem figyelhető pillanatra
  áll fenn.
- **A kivétel útja: célra írt, könnyű `node:http` teszt szerver**, kizárólag a `GET /events`
  végponttal, a DOM végállapotára várva web-first assertionnel. Ez méréssel igazoltan
  működik, és megfelel a kézi timeout tilalmának. A REST hívások ebben az esetben is
  `page.route()` mockon mennek; a teszt szerver adatbázist nem nyit és motort nem indít. A
  szerver az operációs rendszer által kiosztott szabad porton figyel, és a lap `GET /events`
  kérését a `route.continue({ url })` irányítja rá (nem mock: a kérés valódi hálózaton megy), így a
  párhuzamos workerek nem ütköznek (12. szekció, `apps/web/e2e/run-view-stream.ts`).
- **A kivételt a frontend specnek explicit ki kell mondania**, indoklással és a mérési fájlra
  hivatkozva. A SPEC-007 13.4 ezt megteszi.
- **Egy keret egy felhasználói eseménnyel egy feladatban** a nyitott `node:http` kapcsolaton
  sem küldhető: a hálózati keret a kattintás és a böngésző következő renderelési lépése közé
  nem időzíthető megbízhatóan (mérve, `docs/research/2026-09-23-transcript-panel-meresek.md` 16. szekció). Ilyenkor a keret a lapon rögzített, valódi `EventSource` példányon, az esemény
  capture fázisában kiváltott `MessageEvent`-ként érkezik, a hálózati kerettel azonos alakban
  (`captureEventSources` az `apps/web/e2e/run-view-stream.ts` fájlban); a kapcsolat
  maga a teszt szerveren nyitott. Ez nem a hálózati út mockja, csak az időzítésé, ezért csak
  a kattintással egy feladatban érkező sorra használható (SPEC-008 7.4). A keret mindig a mérés
  előtt kerül commitba, de nem minden úton ugyanabba, mint a kinyitás: a csak `click` úton
  (szkriptből kiváltott esemény, amin belül nincs mikrofeladat pont) egyetlen commitba kerül a
  kinyitással; egér, `Space` és `Enter` úton (valódi bemenet, a figyelők között mikrofeladat
  pont) a hook kattintás figyelője utáni első commitba, a kinyitás commitja ELŐTT (mérve a React
  DevTools csatlakozási pontján, `apps/web/measurement/transcript-scroll.ts` `render-sorrend`
  jelenete, research 17. szekció).
- **Ami NEM MEGERŐSÍTETT**: Firefox és WebKit ellen nem futott mérés, mert az
  `apps/web/playwright.config.ts` ma kizárólag chromiumot definiál. Ha a projektlista bővül,
  a mérést meg kell ismételni azokra a motorokra is.

**Frontend felületi elvárások.** Forrás: felhasználó kérése.

- **Várakozás jelzése.** Minden felületi ponton, ahol a usernek várnia kell (async művelet,
  workflow futás, agent lépés, API hívás), látható jelzés kell, ami mutatja, hogy várakozás
  van folyamatban: loading spinner, progress bar, skeleton állapot vagy explicit státusz
  szöveg. Nem maradhat felületi állapot, ahol egy érzékelhető késleltetésű várakozás jelzés
  nélkül fut le.
- **Teljes böngésző szélesség és reszponzivitás.** A frontend layout a teljes böngésző
  szélességet használja, nem egy keskeny, középre igazított oszlopot. Ez megerősíti és
  kiterjeszti azt, amit a felhasználó eredeti specifikációja már kimondott: az
  `eggproject-design` skill topnav shell-jét kell használni, és a content terület a teljes
  rendelkezésre álló területet "faltól falig" tölti ki. A kiterjesztés: a layoutnak minden
  támogatott viewport méreten reszponzívnak kell lennie, nem csak egyetlen, fix asztali
  szélességen.
- **A teljes területű munkafelületen az `.app-content` belső margója nulla.** Ma két ilyen
  screen van, a gráf szerkesztő és a futás nézet; mindkettőnek önálló, `:has(> .<screen>)`
  szabálya van a `topnav-shell.css` fájlban, és mindkettőn a screen nem-vászon elemei kapják
  meg a `--ep-layout-gutter` oldalsó térközt. A próba, ami eldönti, jár-e egy screennek: a
  tartalma `flex: 1`-gyel tölti-e ki az `.app-content` tartalom dobozát (ilyenkor a 80px alsó
  padding üres sávot hagy alatta), vagy hosszú, görgetett lista (ilyenkor a padding a szánt
  légtér) (SPEC-008 10., T-009-22).
- **A töréspont literál akkor is token érték, ha JS-ben áll.** A
  `media-query-breakpoint-invariant` teszt kizárólag CSS fájlokat vizsgál, van viszont olyan
  reszponzív váltás, amit CSS-sel nem lehet megoldani: ha a két sáv DOM szerkezete vagy ARIA
  szemantikája más (`Tabs` kontra `Resizable`, illetve az elválasztó `aria-orientation`
  értéke), akkor a váltás `matchMedia` bekötésen megy. Ilyenkor a query literálhoz **saját
  regressziós teszt kell**, ami magából a `design-token/breakpoints.css` fájlból olvasott
  token értékkel hasonlítja össze; kitalált szám JS-ben sem állhat. Precedens:
  `apps/web/src/run-view/run-view-layout-band.spec.ts` (SPEC-008 10., T-009-22).
- **Csak létező design system elem használható.** Ami a `eggproject-design*` skillekben nincs
  meg, azt nem gyártjuk le sajátként némán: jelezni kell a usernek. Ami megvan, azt át kell
  emelni, nem egy másik komponens osztályát ráhúzni. Konkrét precedens: a `<textarea>` elemre
  a kész `.textarea` komponens jár, nem az egysoros `.input` osztály
  (`docs/research/2026-09-08-design-system-audit.md` 4.4, user kérés 2026-09-09).
- **Ha a forrás komponensnek React és statikus HTML változata is van, a React változat jár.** Mi
  React alkalmazás vagyunk. A `select.css` mindkettőt kiszolgálja ugyanazon a `.select` héjon, de
  a natív `<select>` retrofitről a forrás saját kommentje mondja ki, hogy a STATIKUS oldalaké
  ("the native `<select>` retrofit ON STATIC PAGES uses the platform control"), és a platform
  indikátorát rajzolja: a chevron a jobb szegélyre tapad (mérve 9px), a React trigger 22px-e
  helyett. A natív ág megépítése ezért nem "bájtra másolás" volt, hanem a rossz ág kiválasztása
  (`docs/research/2026-09-09-select-chevron-meres.md`, user kérés 2026-09-09).
- **Tilos a card in card.** Kártya alakú dobozon (szegély plusz lekerekítés plusz saját
  háttér) belül nem állhat második ilyen doboz, és nem lehet dupla belső térköz sem. Ami a
  tagoláshoz kell: vagy összecsukható panel (`accordion`), vagy megnevezett, doboz nélküli
  csoport. Kitalált, a design system `.card`-jától eltérő tokenkombinációjú "kártyaszerű"
  osztály nem vezethető be (user kérés 2026-09-09).
- **A gombok `sm` méretűek**, kivéve modálisban és popupban. A szöveg nélküli gomb ikon gomb
  (`.btn--icon`), és **kötelező** hozzáférhető nevet adni neki (`aria-label`), különben a
  `getByRole('button', { name })` locator sem találja, amire a projekt e2e tesztjei épülnek
  (user kérés 2026-09-09).
- **Az űrlap hibaüzenete kizárólag a mező alatt jelenik meg**, összesítő az űrlap tetején
  nincs. A megjelenés szabálya: a mező **érintett és érvénytelen**, VAGY az űrlapot már
  **legalább egyszer megpróbálták beküldeni** (és a beküldés hiba miatt nem sikerült) **és a
  mező érvénytelen**. Ugyanez az érték dönt az `aria-invalid` kitételéről is, mert a WCAG 2.2
  ARIA21 technika kimondja: "The aria-invalid attribute should not be set to 'true' before
  input validation is performed"
  (<https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA21>). A mező és az üzenet összekötése
  `aria-describedby`, a megjelenés eljuttatása a képernyőolvasóhoz `role="alert"`, mindkettő a
  W3C WAI Forms Tutorial "User Notifications" lapja szerint
  (<https://www.w3.org/WAI/tutorials/forms/notifications/>). **NEM MEGERŐSÍTETT**, és ezért nem
  is állítjuk, hogy a WAI előírná az időzítést: a WCAG 3.3.1 Understanding lapja szerint "This
  criterion does not mandate any particular way in which errors should be displayed"
  (<https://www.w3.org/WAI/WCAG22/Understanding/error-identification>), tehát a fenti szabály
  felhasználói termékdöntés (user kérés 2026-09-09).
- **A REST hívás hibája a design system `danger` `Alert` blokkjában jelenik meg, a szerver belső
  szövege nélkül** (user döntés 2026-09-24, "Mindhárom javítás"). A felületen kizárólag a
  hibakódhoz rendelt magyar mondat áll, utána semmi (nincs ".:"), és a szerver `message` mezője
  (azonosító, zárójeles hibaosztály) nem jut a felületre; a hibaág nem nyers `<p role="alert">`,
  hanem a `packages/ui` `Alert` eleme (`variant="danger"`, a szerepet a komponens adja, a forrás
  szerint). A mező alatti űrlap hiba (előző pont), a futás nézet "Várakozás a szerverre"
  `warning` jelzése és a soronkénti műveletek `Toast` értesítése nem tartozik ide. Részletek és
  határok: SPEC-007 8.4. **Ismert okokra saját mondat** (user döntés 2026-09-26, SPEC-007 O-10
  lezárva): a SPEC-005 8.5 zárt szótárába eső hibaosztályt a szerver a törzs `errorClass`
  mezőjében adja, a kliens ehhez saját magyar mondatot rendel, és a `message` szövegét nem elemzi;
  hiányzó mezőnél a kód mondata marad, a mentés mezőútja nem kap mondatot. Az
  akciósáv magassága 1440x600-on a kérdés szövegét levágja (SPEC-008 14.2 O-17). Védelem:
  `apps/web/src/greppable-invariants/` (18), a `perform-route-request.spec.ts`, a
  `protocol-error-class-message.spec.ts`, a `rest-error-paths.spec.ts` és a
  `rest-error-class.spec.ts`.

---

## 12. Buktatók, amiket már megtapasztaltunk

Ezek valós, drágán megtanult hibák. Mindegyik mellett ott a védelem, ami visszatérés esetén elkapja.

**Git és build**

- **Fájlnév betűzés a git indexben.** Case-insensitive fejlesztői fájlrendszeren egy hibás
  átnevezés a git indexet a régi betűzésen hagyhatja, miközben a lemez már a helyeset mutatja.
  Sem a `git status`, sem a lemez alapú eszközök (`tsc forceConsistentCasingInFileNames`,
  ESLint `import-x/no-unresolved`) nem jeleznek, mert ők a lemezt látják. Csak a CI
  kis-nagybetű érzékeny checkoutján derül ki: `TS2307 Cannot find module`. Védelem:
  `bun run check:casing` és `git mv` használata (`casing.sh` fejléc, SPEC-002 10.).
- **A workspace függőségek deklarálatlansága.** Amíg egyetlen `package.json` sem deklarálta a
  workspace függőségeit, a Turborepo függőségi gráfja üres volt, és a cache soha nem
  invalidálódott. Minden workspace közötti függőség `"workspace:*"` alakban áll a `dependencies`
  mezőben (research: spec001 ellenőrzések melléklet, SPEC-002 8.).
- **`npx` a CI-ben.** A `devEngines.packageManager` bevezetése után az `npx` megtagadja a futást,
  a CI e2e jobja viszont `npx playwright install` parancsot hívott. Javítva `bunx` alakra
  (research: spec001 ellenőrzések melléklet).
- **`overrides.type-fest` a gyökér `package.json` fájlban.** A Vitest, a Playwright és az nyc fája
  behozza a `hasha@5.2.2` csomagot, ami régi `type-fest` verziót igényel, és a Bun ezt hoistolta;
  ez ütközött az `eslint-plugin-import-x` láncával. Az override ezért kell (gyökér `CLAUDE.md`).

**Turborepo és teszt infrastruktúra**

- **Turbo cache és a nem deklarált `outputs`.** A nyers e2e coverage könyvtár
  (`apps/web/e2e/.nyc_output/`) a `test:e2e` task **deklarált `outputs`-a**, az `inputs` pedig
  negációval kizárja. Enélkül cache találatkor a Playwright el sem indul, a nyers adat nem
  keletkezik újra, és a rákövetkező `nyc report` `ENOENT ... scandir` hibával bukik. Pontosan ez
  döntötte el a CI E2E jobját. Védelem: a `turbo-e2e-coverage-outputs` regressziós teszt őrzi a
  konfigurációs invariánst (gyökér `CLAUDE.md`, research V-20).
- **Wrapper stdout és stderr szétválasztás.** A CI a coverage riport wrapper stdoutját fájlba
  irányítja, ezért egy korábbi verzióban bukás esetén a naplóban egyetlen hibaüzenet sem jelent
  meg. Az `e2e-coverage.sh` és a `db-drift.sh` óta a stdout kizárólag az összegzés, minden hiba a
  stderr-re megy (`tooling/scripts` CLAUDE.md).
- **Vitest coverage csak a gyökér configban.** Projekt szinten "Unsupported Option", ezért a
  lefedettség egyetlen, gyökér szintű folyamatban gyűlik: a `test.sh` és a `//#test` task is
  közvetlenül a gyökér `vitest run --coverage` parancsot hívja. Ugyanez az elv a Prettiernél is
  (gyökér `CLAUDE.md`, `tooling/scripts` CLAUDE.md).
- **A teszt törzse az 5000 ms-os alapértelmezett korlát alá esik, a gyűjtési fázis nem.** Két
  időzített bomba állt a határon, és a CI-t egy olyan commitnál buktatta el, ami hozzájuk sem
  nyúlt. (1) Repó szintű TypeScript parse a teszt törzsében: a V8 coverage a `typescript` csomag
  kódját is műszerezi, ezért a teljes repó AST-je sokszorosára lassul, és a költség a repó
  méretével nő. Védelem: a `tooling/scripts` `casing` témájának előszűrője, ami a parse-ot csak a
  gyanús fájlokra futtatja. (2) A teljes alkalmazás modulgráfját betöltő dinamikus `import()` a
  teszt törzsében: a gráfot statikus, előtöltő importtal kell a gyűjtési fázisba tenni
  (`apps/web/src/app-mount/main.spec.ts`). Időkorlátot emelni csak a teszt terhelés alatt mért
  eloszlásából szabad (user kérés 2026-09-23). Mérés és a korlát közeli tesztek listája:
  `docs/research/2026-09-23-teszt-idokorlat-bombak.md`.
- **A `//#test` név nem lehetett sima `test`.** A Turborepo `--dry=json` mérés szerint a
  nem-prefixelt taskok kihagyják a `//` csomagot, tehát a per-csomag taskgráf a gyökeret sosem
  érintené (`tooling/scripts` CLAUDE.md, SPEC-001 V-18).
- **Playwright rootless konténerben.** A sandbox nem-root felhasználóként fut, nincs `sudo`, az
  `apt-get install` megtagadja. Egyetlen rendszerkönyvtár hiányzik (`libXdamage.so.1`), és root
  nélkül is telepíthető: `apt-get download` plusz `dpkg -x`, majd `LD_LIBRARY_PATH`. **Ez
  kizárólag környezeti változó, a repóban semmit nem kell módosítani**, ezért a CI-re nincs
  hatása. `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS`-et nem használunk (gyökér `CLAUDE.md`,
  research V-19).
- **`[INVALID_ANNOTATION]` figyelmeztetés a `VITE_COVERAGE=true` instrumentált buildben.** Az
  Istanbul minden JSX feltételes ág elé (`feltétel ? (jsx1) : (jsx2)` alak) egy vessző operátoros
  számlálót told (`cov_xxx().b[n][0]++, _jsx(...)`), ami a Babel/SWC JSX transzformáció
  `/* @__PURE__ */` kommentjét eltolja a hívás elől. A Rolldown emiatt nem tudja értelmezni a
  kommentet, és minden ilyen esetre `[INVALID_ANNOTATION]` figyelmeztetést ír a `webServer`
  buildlogba. **Ártalmatlan minden eddig talált előfordulásra** (saját mérés, `vite build` a
  `VITE_COVERAGE=true` env változóval, 2026-09-23, T-009-25: kilenc fájl, húsz előfordulás -
  `src/app-shell/app-shell.tsx`, `src/graph-editor/GraphEditorScreen.tsx`,
  `src/node-inspector/JoinNodeFields.tsx`, `src/run-control/RunControlBar.tsx`,
  `src/run-event-row/RunEventRow.tsx`, `src/run-history/run-history-screen.tsx`,
  `src/run-view/RunViewLayout.tsx`, `src/transcript-panel/TranscriptPanel.tsx`,
  `src/workflow-list/workflow-list-screen.tsx`): mindegyik olyan `? (/* @__PURE__ */jsx(...)) :
(/* @__PURE__ */jsx(...))` ág, aminek az eredménye MINDIG felhasznált (`return` vagy render
  gyerek), tehát a PURE jelzés nem tehetne semmit: az csak akkor engedne eltávolítást, ha az
  eredmény eldobva állna, ami itt sosem igaz. `VITE_COVERAGE` nélkül (a valódi, éles build) az
  előfordulások száma NULLA (saját mérés), tehát a felhasználó felé szállított kód nem érintett.
  **Ez a besorolás fájlonként újra ellenőrizendő, ha valaki egy `/* @__PURE__ */`-lel jelölt hívás
  eredményét ELDOBva használná** (pl. egy csak mellékhatásért hívott függvény): a
  `node-inspector.spec.ts` egyik tesztje szerint UGYANEBBEN a buildben, egy MÁSIK, nem JSX ternary
  mechanizmus (a zod alapértelmezett locale regisztrációjának tree-shake-elése) ténylegesen
  megváltoztatja a megjelenő hibaszöveget (rövidebb "Invalid input" jelenik meg) - az az eset már
  dokumentált és kezelt ott, külön jelenség, nem ez a kilenc fájl. **Újramérve 2026-09-24**
  (a transcript sor tipográfiája után, a `test:e2e` `webServer` buildlogjából): nyolc fájl,
  huszonhét előfordulás, az `app-shell.tsx` már nincs köztük. A `RunEventRow.tsx` egyik új
  előfordulása nem ternary alakú: a `const title = (<>...</>)` deklaráció Istanbul statement
  számlálója (`(cov().s[n]++, _jsxs(...))`) tolja el a kommentet; az eredmény itt is
  felhasznált, tehát a besorolás változatlan.

**Frontend állapot és layout**

- **Egy "legutolsó érték" alakú React állapot löketben érkező eseményfolyamnál keretet veszít, az
  újratöltést kiváltó jelzéseket is.** A React a natív `EventSource` kezelőből jövő frissítéseket
  egy renderbe vonja össze, tehát egy `lastFrame` függésű effekt a köztes kereteket sosem látja:
  valós Chromiumban egyetlen hálózati darabban érkező 10, 1000 és 3000 keretre az effekt
  mindháromszor EGYSZER futott, a függvény alakú állapotfrissítés viszont mindet megkapta (saját
  mérés, `docs/research/2026-09-23-transcript-panel-meresek.md` 1. szekció). **A korábbi
  feltevés, hogy az ilyen állapot "valami történt, tölts újra" jelzésre még jó, hamisnak bizonyult**:
  a jelzés szűrője (melyik keret, melyik futás) is csak az utolsó keretet látja. A szerver a pótlás
  végén szinkron `replay_complete` keretet ír, így a `run_finished` után a futás nézet fejléce
  "fut" állapotban ragadt, a futás előzmények listája pedig egy `run_event` plusz `protocol_error`
  löketre nem töltött újra; mindkettő valódi böngészőben mérve (T-009-25a,
  `docs/research/2026-09-23-elo-csomopont-allapot.md`). A szabály: stream keretet kizárólag a
  `stream-client` `subscribeToFrames` útja ad, keretenként; a `lastFrame` állapot törölve. Ha egy
  keret újratöltést vált ki, a kérések összevonva futnak (`createCoalescedReload`), különben a
  veszteségmentes út egy ezer keretes pótlásból kérés vihart csinálna. Védelem: az
  `apps/web/e2e/sse-real-server.spec.ts` löket tesztjei (`pushBatch`: egy `write` hívásban küldött
  keretek) a futás nézet fejlécére, a csomópont jelvényére és a futás előzmények listájára, plusz
  a `use-stream-connection.spec.tsx`, `RunViewScreen.spec.tsx`, `run-history-screen.spec.tsx` és
  `use-live-step-runs.spec.tsx` egy render kötegen belüli keretsorozatra mért tesztjei; a régi
  kódon mind az öt e2e teszt elbukik.
- **A dokumentum `scrollWidth` mérése nem látja a saját görgető dobozban maradó túllógást.** A
  `react-window` lista gyökere `overflow-y: auto`, amitől az `overflow-x` is `auto` lesz, tehát
  egy kilógó transcript sor a LISTÁT görgeti vízszintesen, a dokumentumot nem: csonkolás nélkül
  mérve a dokumentum túllógása 0, a listáé 3719 pixel (375 pixelen). A vízszintes túllógás
  tesztje ezért a görgető dobozt is méri (`responsive.spec.ts`, T-009-25).
- **A `toBeInViewport()` alapértéke a részleges láthatóságot is elfogadja** (a `ratio` alapértéke
  0, <https://playwright.dev/docs/api/class-locatorassertions#locator-assertions-to-be-in-viewport>).
  A transcript görgetés tesztjei emiatt nem vették észre, hogy az utolsó sor alja lemarad: a
  becslésnél egy pixellel magasabb átmeneti sor miatt, és mert a `height: 100%` plusz belső
  térközű burkoló `box-sizing` nélkül a lista alsó 16 pixelét a panel levágta. Ha egy teszt tárgya
  az, hogy valami TELJESEN látszik, `toBeInViewport({ ratio: 1 })` kell, ami a levágó ősöket is
  figyelembe veszi. Védelem: `apps/web/e2e/sse-real-server.spec.ts` lista alja tesztjei
  (`docs/research/2026-09-23-transcript-panel-meresek.md` 13. szekció).
- **A `react-window` látható tartomány jelentése a mért sormagasság mögött jár.** Egy sor
  kinyitása után a lista a sor új magasságát a következő mérésből kapja meg, és addig a jelentései
  a kinyitás előtti elrendezést írják le. Egy ebben az ablakban érkező új sor követése ezért a
  kinyitott sort elrántotta, már a `dfcaa38` előtt is: 40 ms-os streamnél a véletlen fázisú, csak
  `click` eseménnyel indított kinyitások mintegy harmadában (a `dfcaa38` előtti hookkal 60/200,
  ebből 40 egy soros és 20 teljes elrántás, saját mérés 2026-09-25 a repóbeli mérő eszközzel,
  minden kísérletet számolva; a korábbi 34/205 és "mintegy hatod" egy hibás szűrőből jött, lásd
  lent; a repón kívüli mérések 12/40 és 23/80, egy független ellenőrzés 38/100 arányt adott,
  research 17. és 18. szekció). A szabály: felhasználói layout változás után görgetési döntés
  csak a mért magassággal számolt jelentés után születhet; a hook ezért a fejléc `click`
  eseményétől szünetelteti a követést, a szünet alatti jelentés nem kapcsolhatja vissza, és egy
  kinyitás szünete a mérés után is tart, amíg a felhasználó vissza nem ér az aljára vagy meg nem
  nyomja az ugrás gombot (user döntés 2026-09-25: az utolsó sor kinyitása is megállítja a
  követést). Védelem: a `use-transcript-auto-scroll.spec.tsx` kinyitás tesztjei és az
  `sse-real-server.spec.ts` négy kinyitási út e2e tesztjei mindkét témában, az utolsó soréi három
  időzítéssel (`docs/research/2026-09-23-transcript-panel-meresek.md` 15., 16. és 18. szekció).
- **Egy mérés szűrője nem dobhatja ki azt, amit mér.** A mérő eszköz verseny jelenete egy
  kísérletet csak akkor számolt, ha a kinyitás utáni harmadik képkockán az utolsó sor nem látszott;
  a teljes elrántás viszont a listát az aljára viszi, tehát pontosan azt a kísérletet dobta ki. A
  hamis szám (34/205, "minden elrántás -53 pixel") két dokumentumba is bekerült, és egy független
  ellenőrzés találta meg: ugyanazzal a hookkal a szűrővel 33/170, szűrő nélkül 60/200. Ha egy
  szűrő a kimenetel alapján dönt arról, mi számít, előbb meg kell nézni, hogy a keresett hiba maga
  nem változtatja-e meg a szűrő bemenetét. Védelem: a jelenet ma minden kísérletet számol
  (`apps/web/measurement/transcript-scroll.ts`, research 18. szekció).
- **Egy "várj a következő X-ig" állapotnak mindig kell kilépés arra az esetre is, ha X sosem
  jön.** A `d598677` a kinyitás után a mérésig visszatartotta a görgetést ÉS az érkezések
  számlálását; egy képkockán belüli ki-be csukás (dupla kattintás) után a sor magassága nem
  változott, mérés nem jött, és a lista végleg megállt: nem követett, gomb sem jelent meg, és a
  kézi görgetés sem oldotta fel. A javított hook a váltásokat fejlécenként párosítja (páros számú
  kattintás = nincs mérendő változás), a várakozás alatt is számol, és az ugrás gomb mindig lezárja.
  Védelem: `sse-real-server.spec.ts` dupla kattintás tesztjei tárolt sorokkal (research 16.
  szekció).
- **A mérés kilépése maga is elmaradhat: egy rejtett fülön leszerelt sor sosem kap mérést.** A
  `c7b2e35` három kilépése (mérés, páros kattintás, ugrás gomb) mellett 375 pixelen a kinyitás és
  a fülváltás egy feladatban a lista követését végleg leállította: a rejtett sor 0 magasságát a
  `useDynamicRowHeight` nem tárolja, a sor a szűkült kirajzolt tartományból leszerelődik, a
  gyorsítótár nem változik, és a kézi görgetés az aljára sem oldotta fel (mérve: a három új sor
  után 53, 106, 159 pixel lemaradás, "6 új esemény"). A negyedik kilépés a kézi visszatérés az
  aljára (user döntés 2026-09-24), az alj előzetes elhagyásának feltételével. A tanulság: egy
  külső jelre (itt a mérésre) váró állapotnál a felhasználó saját, egyértelmű szándéka is legyen
  kilépés. Védelem: `sse-real-server.spec.ts` fülváltás és ugrás gomb tesztjei, a `bffd75d`
  állapotán bukik (research 17. szekció).
- **A böngésző görgetés rögzítése (scroll anchoring) a virtualizált lista mellett saját
  görgetést csinál.** Bekapcsolt `overflow-anchor` mellett folyamatos streamnél a véletlen fázisú
  kinyitások egy részében a lista a hook nélkül elmozdult (két saját mérésben 9/80 és 7/80, mind -36
  pixel, kikapcsolva 0/80, minden kísérletet számolva; a korábbi 6/78 a hibás szűrőből jött; egy
  független ellenőrzés 5/80-at mért, köztük egy -574 pixeles teljes elrántást, tehát a "mind -36"
  nem általános). A -36 a gomb akkori sávjának magassága volt: a sáv helyének fenntartásával
  (`1c7dd13`) bekapcsolt rögzítéssel is 0/80 lett (research 19. szekció). Az ugrás gomb azóta
  saját sáv nélkül, a lista fölött lebeg, és a megjelenése a listát nem mozdítja (research 20.
  szekció). Az elmozdulás miatt a listán `overflow-anchor: none` áll
  (user döntés 2026-09-24, CSS Scroll Anchoring spec, MDN). A jelenség fázisfüggő, időzítő nélküli
  lépéssorral nem állítható elő (hat érkezési mód, 0/120); a védelem ezért KIZÁRÓLAG a
  konfigurációt őrzi: az e2e a lista kiszámított `overflow-anchor` értékét ellenőrzi. A korábbi,
  képkockánként mérő rész vak volt (a CSS nélkül is zöld), és kikerült (research 17. és 18.
  szekció).
- **A `react-window` az érkezés utáni első renderben még a régi látható tartományt jelenti.** A
  látható tartomány a könyvtárban állapot, amit egy layout effekt számol újra, tehát a sorszám
  növekedése után előbb a régi utolsó sorra vágott jelentés jön (2 a 4 sorból), és csak utána az
  új (3 a 4-ből). A szünet "alj elhagyása, majd visszatérés" kilépése ezt nem teli listán hamis
  párnak vette: a szünet minden érkezésnél lezárult, gomb nem jelent meg, és a lista megtelése után
  minden új sor a kinyitott sort 53 pixellel feljebb vitte. Az e2e addig csak teli listát (20 + 10
  sor) vizsgált, és a "determinisztikus" állítás erre az esetre nem volt igaz. A tanulság: egy
  állapotgép, ami egy könyvtár jelentéseinek SORRENDJÉBŐL következtet, a jelentés érvényességi
  idejét is ellenőrizze, és a tesztje fedje a határesetet (itt a nem teli listát). Védelem:
  `is-pre-arrival-range-report.ts` és a `sse-real-server.spec.ts` rövid lista e2e tesztjei két
  méreten, két témában, az utolsó és egy korábbi sorra (research 19. szekció).
- **Rögzített porton figyelő teszt szerver párhuzamos futtatásnál ütközik.** Az
  `sse-real-server.spec.ts` szervere a build időben rögzített `VITE_STREAM_ORIGIN` portjára
  kötődött, a fájl ezért soros volt, de `--repeat-each 3` mellett három worker egyszerre futtatta a
  fájl három példányát, és `EADDRINUSE` jött. Ma minden teszt szervere az operációs rendszer által
  kiosztott szabad porton figyel, és a lap kérését a `route.continue({ url })` irányítja rá (Node
  `server.listen(0)`, Playwright `route.continue`); `--repeat-each 3` mellett három workerrel a
  fájl minden tesztje zöld, nulla `EADDRINUSE` (legutóbb 279/279, 93 teszt, research 20. szekció).
- **Egy korrekciós gépezet helyett előbb az okot kell megszüntetni.** Az átmeneti sor egy
  pixellel magasabb volt (a jelvény túlnőtt a sordobozon), és a `dfcaa38` ezt egy újragörgető
  gépezettel kompenzálta, ami két újabb hibát hozott. A sor fejlécének pontosan egy szövegsor
  magasra állításával minden összecsukott sor egyforma, és az eredeti követés 0 pixelre pontos
  (research 16. szekció).

**Képernyőkép és vizuális bizonyíték**

- **A repón kívül élő képernyőkép készítő script háromszor adott hamis bizonyítékot.** A script
  `/tmp/shots/` alatt élt, minden munkamenet újraírta, és kétszer ÜRES `edges` tömböt, egyszer
  pedig két csomópontra szűkített gráfot adott a `readWorkflowGraph` mockon. Ahol nincs él, ott
  nincs mit kirajzolni: a szállított képekről hiányoztak a vonalak, a felhasználó jogosan hitte,
  hogy a termék romlott el, és a végrehajtó agent mindháromszor késznek jelentette. A termékkód
  végig hibátlan volt, bisecttel és pixel méréssel igazolva. **A tanulság általános: minden
  bizonyíték előállító eszköz a repóba tartozik, verziókövetve, mert amit munkamenetenként újra
  kell írni, azt munkamenetenként újra el is lehet rontani.** Védelem: a fixtúra
  (`apps/web/e2e/showcase-graph.ts`), a képernyőkép készítés
  (`apps/web/e2e/capture-screenshots.ts`) és a `bun run screenshots` parancs a repóban van, a
  fixtúra alakját (legalább öt él, minden csomópont bekötve) és minden élének kifestett vonalát
  pedig az `apps/web/e2e/showcase-graph.spec.ts` regressziós teszt őrzi a `test:e2e` kapun
  (`docs/research/2026-09-09-graf-el-vonal-meres.md` 6. szekció).
- **A fenti védelem 2026-09-15-ig KIZÁRÓLAG SZÖVEGES volt**, és egy független ellenőrzés jogosan
  mondta ki, hogy semmi nem buktatja el azt a munkamenetet, ami megint saját, eldobható scriptet ír
  saját, éltelen fixtúrával. A **gépi** védelem neve
  `tooling/scripts/src/screenshot-pipeline/screenshot-pipeline.spec.ts`: hét invariáns a
  `bun run test` kapun (tehát a CI `ci` job `needs` listáján keresztül kötelező státuszcsekk).
  **Hatókör (user döntés 2026-09-25):** a védelem kizárólag a repóba commitolt forráskódot
  olvassa a `test` kapun, és csak a böngésző képernyőkép, a videó és a trace kép lemezre írását
  tiltja a saját teszt- és segédkódunkban; a termék futását, az agentek fájlírását (az Agent SDK
  eszközeivel, futásidőben) és a termékkód egyéb fájlírását nem érinti. A megvalósításban: a
  termékkód (a `packages/*/src` és az `apps/*/src` nem teszt fájlja) csak akkor vizsgált, ha
  Playwright csomagot importál; minden más commitolt kód (teszt, e2e, config, eszköz, shell
  script, GitHub Actions YAML, `package.json` script) vizsgált. Ha egyszer egy
  termékfunkció maga készít és ment böngésző képernyőképet (például weboldalt fényképező agent
  eszköz), arra kifejezett, user által jóváhagyott kivétel kell. **Szabály, és a gépi ellenőrzés
  kimondott korlátja (user döntés 2026-09-25, egy független ellenőrzés mérése nyomán):
  Playwright segédfájl (ami egy "lap" típusú paramétert kap, és képet készíthet vagy írhat)
  kizárólag egy csomag `e2e/` vagy `measurement/` mappájában állhat**, a `packages/*/src` és az
  `apps/*/src` alatt nem. Ok: a termékkód csak Playwright importtal vizsgált (a `1a83b02` hatókör
  szűkítése óta), tehát egy oda tett, Playwright import nélküli segéd a lapon át képet készíthet
  vagy írhat úgy, hogy a kapu nem látja. Ez rossz helyre tett fájl, nem szándékos hamisítás, ezért
  a betartása code review kérdés, gépi kényszer nincs rá. Amit fog: a
  szentesített `apps/web/e2e/capture-screenshots.ts` fájlon kívül egyetlen commitolt fájl sem írhat
  képernyőképet lemezre, a szentesített script nem tarthat saját gráf literált, `mockRoute` vagy
  `page.route` hívást, a `screenshots` npm scriptek és a Playwright config a szentesített fájlra
  mutatnak, és a csővezeték minden futása bizonyítékot hagy az
  `apps/web/e2e/screenshot-manifest.json` fájlban (a fixtúra és a script `sha256` lenyomata, plusz
  képenként a pixel méréssel kifestettnek igazolt élek azonosítója). Ha a fixtúra vagy a script
  megváltozik, a lenyomat elavul és a kapu bukik, amíg a valódi Chromium futás le nem fut újra -
  éltelen fixtúrával viszont az a futás elbukik, tehát friss bizonyíték nem keletkezhet belőle. A
  manifeszt szándékosan nem tartalmaz nyers mért számot (4. szekció 3. pont), ezért determinisztikus.
  **A megkerülhetőség kimondva:** a két `sha256` érték kézzel átírható, és a repóba sosem kerülő,
  `/tmp` alatti script kimenetét egyetlen repón belüli kapu sem látja; a védelem azt zárja ki, hogy
  a hiba ÉSZREVÉTLENÜL visszatérjen, nem azt, hogy valaki szándékosan hamisítson. Ez a két tétel
  a védelem ELVI korlátja, felhasználói döntés szerint elfogadva (2026-09-15): gépi kényszert nem
  építünk rájuk. **Harmadik elvi korlát (2026-09-25, ugyanerre a mintára):** a védelmet adó teszt
  saját gyengítése (a fájllista szűrése, egy invariáns kihagyása, egy segédfüggvény megrontása)
  code review kérdés; gépi önvédelmet nem építünk rá, lásd a hetedik bejegyzést.
  Forrás: felhasználói kérés 2026-09-15, `tooling/scripts` CLAUDE.md `## Fájlok` táblázat.
- **A gépi kényszer első alakjának három MÉRT rése, mind javítva (2026-09-15).** Egy független
  ellenőrzés a fenti hat invariánson át tudott vinni egy rontó scriptet, három okból: a vizsgált
  kiterjesztés lista nem ismerte az `.mts` és a `.cts` alakot; az első invariáns egy
  karakterosztályos ablakban keresett, tehát BÁRMELY függvényhívás a `path` mező előtt
  hatástalanította; és a hat szállított képből kettő (a nagyított kivágat) sosem kapott pixel
  mérést, tehát a frissesség bizonyíték csak négyre szólt. A javítás: a két kiterjesztés felvéve;
  az ablak teljesen megszűnt (egy fájlnak nem lehet EGYSZERRE képernyőkép hívása és `path`
  opciója, ami a commitolt fán mérten egyetlen fájlra illeszkedik); és MINDEN szállított kép mért,
  a futás nézet két új képét is beleértve. **A karakterosztályos ablak általános tanulsága:** egy
  greppes invariánsban a tiltott karakterosztály mindig hagy kerülő utat egy másik karakterrel, a
  puszta együttes jelenlét vizsgálata nem.
- **A negyedik mért rés: a kép formátuma és az írás módja (2026-09-25, javítva).** Az első
  invariáns csak a `path` opciót, a második csak a PNG fájlnevet nézte, ezért egy JPEG formátumú,
  memóriába kért képernyőkép plusz egy `writeFileSync('x.jpg')` hívás bármely commitolt fájlban
  mind a hat invariánson átment (egy független ellenőrzés mérte, és saját injekcióval is: 6/6
  zöld, egy stream alapú és egy két fájlra bontott, író segédfüggvényes változattal együtt). A
  javítás a puszta együttes jelenlétre épül, a kép formátumától függetlenül, az alább felsorolt
  írási utakon (az "írás módjától függetlenül" megfogalmazás túlzó volt, lásd a hatodik
  bejegyzést): egy
  képernyőképet készítő fájl (Playwright API hívás, vagy a CLI `screenshot` alparancsa), és minden
  fájl, ami azt közvetve is importálja, nem hivatkozhat a Node fájlrendszer vagy folyamatindító
  moduljára, a `Bun.write`-ra, a Playwright tesztcsatolmányára vagy letöltés mentésére, és a `path`
  opciót sem használhatja; mindaz, amit ez a kör importál (workspace csomagon át is), szintén nem
  hivatkozhat lemezre író modulra, a lefedettségi fixtúra (`coverage-fixture.ts`) kimondott
  kivételével; a Playwright `use` képernyőkép opciója `off`-tól eltérő értékkel, és a CLI
  alparancsa shell scriptből önmagában tilos. A három injekció utána a `test` kapun bukik (1/7), a
  jogos, memóriában mérő pixel tesztek zöldek; a hetedik invariáns az ellenőrzés függvényét tizenegy
  szintetikus eseten futtatta. **Pontosítás (2026-09-25):** az eredeti "egy gyengítése maga is
  bukik" mondat túlzó volt: egy független ellenőrzés tizennégy gyengítéséből ötöt a tizenegy eset
  nem fogott (a `Bun.write`, a `saveAs` és az `fs/promises` törlése, a képösszehasonlító assertion
  minta törlése, és az opció értékének `'on'`-ra szűkítése), és az (1) invariáns régi alakjára
  állítása a három injekcióval zöld maradt. Mindkettő javítva, lásd a következő bejegyzést.
  **A bejegyzés nyitott pontja lezárva (user döntés 2026-09-25):** a Node beépített moduljain
  kívüli író csomag (például egy új függőség) és a szándékos elrejtés (a hívás vagy a modul nevének
  futásidejű összerakása) szándékos megkerülés, elfogadott korlát; a lista a hatodik bejegyzésben.
  Forrás: `tooling/scripts` CLAUDE.md `## Fájlok` táblázat, a spec fájl fejléce.
- **Az ötödik mért réscsoport: jóhiszemű alakok, amik minden invariánson átmentek (2026-09-25,
  javítva).** Egy független ellenőrzés a `741f63e` után öt kerülő utat mért, mindegyik jóhiszemű
  kódként is írható: a rövidített `{ path }` opció (a `path:` minta nem látta); az opció objektum
  egy másik fájlban (a kör függőségeiben a `path` kulcs szabad volt); a `use` képernyőkép opciója
  nem literál értékkel (feltételes kifejezés); a CDP `Page` domén képernyőkép metódusa plusz
  `writeFileSync`; és a trace képernyőképei (a trace zip a teszt kimeneti könyvtárába kerül, és a
  telepített Playwright a trace képernyőképet alapból bekapcsolja). A javítás: a `path` kulcs
  minden alakja (sima, idézőjeles, rövidített) tiltott a képernyőkép körben ÉS a függőségeiben (a
  változó típusannotációja, `let path: string`, nem kulcs; mérve ez az egyetlen alak a
  függőségekben); a képernyőkép, a trace és a trace képernyőkép kapcsoló opciója ZÁRT LISTÁS: csak a
  szó szerinti `'off'`, a trace objektumnál a `{ mode: '<mód>', screenshots: false }`, a kapcsolónál
  a szó szerinti `false` engedett, minden más alak (nem literál, rövidített kulcs, objektum) tiltott;
  és a CDP két képet adó metódusa (képernyőkép, screencast) képernyőkép hívásnak számít. **A trace
  döntés:** a zipben lemezre kerülő kép is lemezre írt kép, tehát tiltott; a meglévő
  `apps/web/playwright.config.ts` a korábbi `on-first-retry` módot megtartva, képernyőkép nélkül
  maradt zöld (`{ mode: 'on-first-retry', screenshots: false }`; `retries: 0` mellett nem is
  rögzített; 2026-09-25 óta `'off'`, lásd a hatodik bejegyzést). A hetedik invariáns akkor
  harmincnégy esetet futtatott, és egy új, nyolcadik invariáns a saját forrásából ellenőrizte,
  hogy az (1) törzse a hetedik által igazolt függvényt futtatja a commitolt fán (2026-09-25 óta
  törölve, lásd a hetedik bejegyzést). Igazolva: mind az
  öt kerülő út (a trace két alakkal, hat injekció) egyenként a `test` kapun bukott (1/8), a régi
  alakon mind zöld volt (7/7); harminchárom gyengítés (a független ellenőrzés öt nem fogott
  gyengítésével és az akkori lezárások gyengítéseivel együtt) mind bukott a hetedik invariánson,
  és az (1) régi alakra állítása a három injekcióval a nyolcadikon bukott. A bejegyzés idején
  nyitva maradt a fenti nyitott pont két tétele és a Playwright videó felvétele; mindhármat a
  2026-09-25-i user döntés zárta le, lásd a hatodik bejegyzést. Forrás: `tooling/scripts`
  CLAUDE.md `## Fájlok` táblázat, a spec fájl fejléce és a (7) esetei.
- **A hatodik réscsoport és a hatókör rendezése (2026-09-25, user döntések).** Egy független
  ellenőrzés a `decfa69` után további, a kapun átmenő utakat mért. Ami jóhiszemű kódban is
  előfordulhat, az bezárva: a `.jsx` kiterjesztés (a vizsgált lista ma a Playwright betöltő
  nyolc kiterjesztése), a `.bash` shell script, és a `package.json` scriptek (a CLI `screenshot`
  alparancsa, valamint a nem `off` értékű `--trace` kapcsoló, a config trace opciójával azonos
  zárt lista szerint); a kiterjesztés szűrő a hetedik invariáns által igazolt függvényen belül
  áll. **A videó felvétel is kép:** a `use` videó opciója zárt listás (kizárólag a szó szerinti
  `'off'`, az objektum alak `off` módban sem), a böngésző kontextus videó felvétele bármely
  alakban tilos, és az oldal screencast objektuma képernyőkép hívásnak számít. Az
  `apps/web/playwright.config.ts` trace és videó opciója `'off'` (a korábbi `on-first-retry` trace
  mód a `retries: 0` mellett halott volt). A (7) és (8) gyengítései közül nem bukott az (1)
  állítás elhagyása vagy szűrése (a (8) csak részsztringet keresett), a (2) és a (8)
  semlegesítése, egy kiterjesztés kivétele a listából, a `require` import-él törlése és a
  kivétel lista bővítése. A javítás: az (1), (2), (7), (8) invariáns és a leírás blokk fejlécének
  szövege lenyomattal rögzített lett, amit a (8) a leírás blokkon belül, egy új, kilencedik
  invariáns azon kívül, független kóddal számolt; a kiterjesztés listák, az import-él minta és a
  kivétel lista gyengítése a hetedik invariáns esetein bukik. **Pontosítás (2026-09-25):** az
  akkori "egyik kihagyása sem marad észrevétlen" állítás hamis volt: a lenyomat csak a rögzített
  blokkokat fedte, tehát például a (6) kihagyása és a segédfüggvényeken át végzett gyengítés
  észrevétlen maradt; a (8) és a (9) azóta törölve, lásd a hetedik bejegyzést. Mérve: a harmincöt egy pontú gyengítés mind bukik, AST elemzés egyikhez sem
  kellett; a kilenc injekció az (1)-en bukik, a régi alakon közülük hét zöld volt, kettőt azon nem
  futtattunk (`docs/research/2026-09-25-kepernyokep-vedelem-hatokor.md` 6. szekció). **Pontosítás:**
  a `741f63e` óta használt "a formátumtól és az írás módjától függetlenül" megfogalmazás túlzó volt;
  a védelem a kép formátumától független, az írás módjától csak a felsorolt utakon (a Node
  `fs`, `fs/promises` és `child_process` modulja string literálként megnevezve, `Bun.write`,
  tesztcsatolmány, letöltés mentése, a CLI a shell és a `package.json` scriptből, a Playwright
  képernyőkép, videó és trace opciói). **Elfogadott korlátok (user döntés 2026-09-25), a
  2026-09-15-i két elvi korlát mintájára:** a szándékos megkerülést a szöveg alapú ellenőrzés nem
  látja, és gépi kényszert nem építünk rá. Ide tartozik a hívás átnevezett vagy álnéven tárolt
  hivatkozáson át (`call`, `bind`, destrukturálás), a `path` kulcs összerakása
  (`Object.fromEntries`, számított kulcs), a modulnév összerakása vagy sablon literálja
  (``import(`node:fs`)``, ``process.getBuiltinModule(`fs`)``), a Node beépített moduljain kívüli
  író csomag, az SQLite BLOB mező, és a kép becsempészése a lefedettségi fixtúra JSON kimenetébe.
  Ezek elkapásához AST vagy adatfolyam elemzés kellene. Forrás: `tooling/scripts` CLAUDE.md
  `## Fájlok` táblázat, a spec fájl fejléce és a (7) esetei.
- **A hetedik rendezés: a hatókör a megvalósításban, a lenyomat törlése, három jóhiszemű rés
  (2026-09-25).** Egy független ellenőrzés a `0bf5685` után mérte, hogy a hatókör mondata hű, a
  megvalósítás nem: a kapu minden commitolt kódfájlt olvasott, a termékkódot is, és ártatlan
  termékbeli alakok bukást adtak (egy naplózási szint `trace` kulcsa, egy MIME térkép `video`
  kulcsa, egy Vitest pillanatkép assertion, egy `'screenshot'` literál, egy kommentben álló
  képernyőkép hívás; az utolsó a mérésünkben 31 fájlt jelölt meg). A javítás: a termékkód csak
  Playwright importtal vizsgált (a pontos határ a második bejegyzésben), és a pillanatkép
  assertion (`toMatchSnapshot`) író minta lett, nem közvetlen: egy unit teszt szöveges
  pillanatképe nem jelez, a képernyőkép körben viszont bukik. **Kimondott következmény:** egy
  termékcsomag író függvénye, amit egy teszt a képével hív, nem látszik, mert a termékkód
  fájlírása a hatókörön kívül esik. Három jóhiszemű rés bezárva: a GitHub Actions YAML (`.yml`,
  `.yaml`) shell parancsként vizsgált (egy `playwright test --trace on` workflow lépés
  átcsúszott); a nem `off` értékű `--trace` kapcsoló a `playwright` szó nélkül is tiltott (egy
  `bun run test:e2e -- --trace=on` script átcsúszott); a `.js` végű relatív import a TypeScript
  párjára is feloldódik, a telepített Playwright betöltő sorrendjében. **A (8) és a (9)
  törölve:** egy komment, egy átnevezés vagy egy új jogos (7) eset is bukást adott, az üzenet
  csak egy lenyomat volt teendő nélkül, a jogos javítás és a gyengítés ugyanaz a lépés volt (a
  lenyomat bemásolása), és a segédfüggvényeken át nem is védett (öt saját gyengítés zöld
  maradt). A (7) marad a viselkedés önellenőrzése; a teszt saját gyengítése code review kérdés
  (harmadik elvi korlát, a második bejegyzésben). Mérve: a hat hamis pozitív injekció a régi
  alakon mind bukott, az újon mind zöld; a korábbi tizennyolc kerülő út és a három új rés az (1)
  invariánson bukik, a három új rés a régi alakon zöld volt; az új kód nyolc egy pontú
  gyengítése a (7)-en bukik. Forrás: `docs/research/2026-09-25-kepernyokep-vedelem-hatokor.md` 7. szekció, `tooling/scripts` CLAUDE.md `## Fájlok` táblázat.
- **A `fitView` prop kizárólag a KEZDETI nézetre szól.** A beállítás panel megnyitása után a vászon
  keskenyebb lesz, a nézet viszont a régi nagításon marad, tehát a gráf jobb széle levágódik - ez
  adta a "két csomópont ránagyítva" képet. A képernyőkép készítés ezért a panel megnyitása UTÁN
  nyomja meg a React Flow saját "Fit View" vezérlő gombját, és a záró állítása mérhető: nulla
  csomópont lóg ki a vászon befoglaló dobozából (`showcase-graph.ts`, `countNodesOutsideCanvas`).
- **A React Flow `minZoom` alapértelmezése 0.5, ezért a fixtúra szélessége felső korlátos.** Egy
  1440x900-as ablakban, nyitott panel mellett a vászon 1013 pixel széles, tehát 1842 pixelnél
  szélesebb gráfot a `fitView` már nem tud beilleszteni: a `minZoom`-on megáll. A bemutató fixtúra
  emiatt négy oszlop széles (1582 pixel). Számítás és mérés:
  `docs/research/2026-09-09-graf-el-vonal-meres.md` 6. szekció.
- **A kifestett vonal pixel mérése mérési szondát igényel, ha a kivágat nagyobb egy tenyérnyi üres
  területnél.** A React Flow háttér pontmintáját és a csomópont kártyák árnyékát a HÁTTÉRSZÍNNEL
  festő (tehát hibás) él is eltakarja, tehát az elrejtésekor újra előbukkannak, és ez önmagában
  eltérést ad: mérve a hibás állapot 25-ig felment, miközben az ép állapot 16-ról indult, azaz a
  két tartomány átfedett és a mérés nem döntött. A szonda mindkét képernyőképen eltünteti a nem
  egyenletes hátteret (a pontmintát `display: none`, a kártyákat és a paneleket
  `visibility: hidden` alá); ezzel a hibás állapot 3-ig, az ép 15-től felfelé megy, és a küszöb
  mért szám lehet. `visibility` és nem `display`, mert az utóbbi a React Flow méret figyelőjén át
  elmozdíthatná az éleket a két felvétel között
  (`docs/research/2026-09-09-graf-el-vonal-meres.md` 7. szekció).
- **A számokat előállító mérő eszköz is a repóba tartozik, nem csak a képkészítő.** A
  transcript görgetés research 16. szekciójának táblái repón kívüli, azóta elveszett scriptből
  jöttek, tehát a számok nem voltak újra előállíthatók. Azóta a mérő eszköz
  `apps/web/measurement/transcript-scroll.ts` (`bun run measure:transcript`), ugyanazzal a
  fixtúrával, mint az e2e (`apps/web/e2e/run-view-stream.ts`). A mérő eszköz csak számot ír
  (`MEASUREMENT <json>` sorok), képet nem: képernyőképet lemezre kizárólag a szentesített
  `capture-screenshots.ts` írhat, ezt a `screenshot-pipeline` invariánsai őrzik. Nem `.spec.ts`
  és nem kapu, mert a verseny jelenete a mért változó miatt időzítőt használ (research 17.
  szekció, user kérés 2026-09-24).

**Adatbázis és Drizzle**

- **A `JSON.stringify` kulcssorrend.** Az egész indexű kulcsokat (`"9"`, `"10"`) mindig növekvő
  számsorrendben írja ki, az RFC 8785 viszont UTF-16 sorrendet ír elő, ahol a `"10"` megelőzi a
  `"9"` kulcsot. A kanonizáló ezért kulcsonként maga fűzi össze a kimenetet, és soha nem ad
  újraépített objektumot a `JSON.stringify` hívásnak. Ugyanez az oka annak, hogy a pillanatkép
  beszúrás **nyers `sql` sablonnal** megy, nem a Drizzle `mode: 'json'` oszlopán át, ami íráskor
  újraszerializálna (SPEC-003 5.6, `packages/db` CLAUDE.md).
- **Rendezés összehasonlítóval.** A `unicorn/require-array-sort-compare` nem engedi el a
  komparátort, a `sonarjs/no-alphabetical-sort` pedig `localeCompare`-t javasolna, ami locale
  függő, tehát kanonizálásra hibás. A megoldás explicit UTF-16 kódegység összehasonlító
  (`packages/db` CLAUDE.md).
- **Drizzle `.get<T>()` típusdefiníciós pontatlanság.** A deklarált visszatérési típus nem
  tartalmaz `undefined`-et, a mögöttes `better-sqlite3` viszont azt ad nulla találatra. Ezért van
  `row === undefined` ellenőrzés olyan típuson, amit a fordító sosem jelez, indokolt
  `eslint-disable` kísérettel (`packages/db` CLAUDE.md).
- **Kétféle hibaút a Drizzle-ben.** A típusos insert builder a nyers `SqliteError`-t közvetlenül
  dobja, a nyers `database.run(sql...)` viszont minden hibát egy új `DrizzleError`-ba csomagol, az
  eredetit a `.cause` mezőben. A catch ágnak ezért a `.cause`-t kell vizsgálnia
  (`packages/db` CLAUDE.md).
- **`PRAGMA foreign_keys = ON` kapcsolatonként kell, és tranzakción belül csendben hatástalan.**
  Ezért a nyitás első lépése, a migrációk és minden tranzakció előtt (SPEC-003 10.2, 14.).
- **A `better-sqlite3` bekapcsolt `foreign_keys` pragmával nyit alapból.** Az FK nélküli ág
  teszteléséhez explicit ki kell kapcsolni, nem elég kihagyni a bekapcsolást
  (`packages/db` CLAUDE.md, saját mérés).
- **A `drizzle.config.ts` `schema` mezője explicit fájllista, nem glob.** A `.spec.ts` fájlok
  `vitest` importja miatt a drizzle-kit esbuild alapú CJS bundlere elhasalna egy `./src/**/*.ts`
  mintán, és negációs glob mintát a hivatalos config doksi nem dokumentál. **Új tábla fájlt fel
  kell venni a listába** (`packages/db` CLAUDE.md).
- **`skipLibCheck: true` a `packages/db` tsconfigjában.** A `drizzle-orm` egyetlen csomagban
  szállítja az összes dialektus deklarációját, és ezek egymás között típushibásak; dokumentált
  felsőáramú hiba, nem a mi kódunké (`packages/db` CLAUDE.md).
- **Ugyanez a hiba a `db`-t forrás szinten fogyasztó csomagokban is jelentkezik.** A `db`
  `exports` mezője a `./src/index.ts`-re mutat, build lépés nélkül (7. szekció "Forrás
  fogyasztás"), tehát a `db` teljes forrásfája, a `drizzle-orm` importjával együtt, bekerül a
  fogyasztó csomag TypeScript programjába is. Az `engine` csomag a `DatabaseContext` port típus
  importjakor futott bele elsőként (T-005-8): a `skipLibCheck: true` ott is kellett, saját
  indoklással (`packages/engine` CLAUDE.md). Minden jövőbeli, `db`-től függő csomag ugyanezt a
  kapcsolót fogja igényelni.
- **Tábla séma tesztelése `getTableConfig` nélkül nem ad 100 százalékot.** Az index lista és a
  `.references(() => ...)` callback lusta: sima insert vagy select soha nem hívja meg őket
  (`packages/db` CLAUDE.md).

**Lint és típus**

- A `unicorn/prefer-global-this` miatt a böngészőben futó `page.evaluate()` callbackben
  `globalThis`-en keresztül kell hivatkozni, nem `window`-n (`apps/web` CLAUDE.md).
- A `unicorn/no-null` miatt a repository bemeneti típusok konvenciója úgy áll, hogy a kódban ne
  keletkezzen `null` literál a bemenet feldolgozásakor (`packages/db` CLAUDE.md).
- A `typescript-eslint` és a `eslint-plugin-sonarjs` csomagnál a névvel importált `configs` exportot
  használjuk, nem a default plugin exporton keresztüli `.configs` elérést, mert az utóbbi az
  `ESLint.Plugin` index-szignatúrás típusán megy át, ami "possibly undefined" típushibát ad
  (`tooling/eslint-config` CLAUDE.md).
- A `projectService` `allowDefaultProject` globja nem tartalmazhat `**`-ot, és egy fájl nem lehet
  egyszerre `allowDefaultProject` alatt és egy valódi tsconfig `include` listáján (gyökér
  `eslint.config.ts`).

**Provider**

- **A MiniMax hibajelzés nem a HTTP státuszban van.** Hibás API kulcsra is HTTP 200 érkezik, a hiba
  csak a `base_resp.status_code` mezőben látszik. Ezért minden válasz először a burkolón megy át
  (`packages/minimax-client` CLAUDE.md).
- **A `web_search` tool sémája lapos**, mert a mérés szerint a MiniMax a tool sémát nem utasítja
  vissza újrapróbálkozással, tehát egy bonyolultabb séma azonnali, javíthatatlan hibát okozna
  (`packages/tool-minimax-web-search` CLAUDE.md).

---

## 13. Hol keresd a részleteket

| Téma                                                                 | Forrás                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| provider drótszintű mérés, `ProviderCapabilityDescriptor` típusterv  | `docs/spec/SPEC-000-provider-wire-measurement.md`                              |
| a mérések kiértékelése, tervezési következmények                     | `docs/research/2026-08-26-spec000-kiertekeles.md`, `...-meresi-jegyzokonyv.md` |
| monorepo, toolchain, ESLint szabályok, CI, wrapperek                 | `docs/spec/SPEC-001-monorepo-toolchain.md`                                     |
| a SPEC-001 ellenőrzési pontjai (V-1 ... V-20), mérésekkel            | `docs/research/2026-08-26-spec001-ellenorzesek.md`                             |
| csomag architektúra, mappa és csomagnév konvenció                    | `docs/spec/SPEC-002-csomag-architektura.md`, 6. szekció                        |
| domain modell, perzisztencia, állapotgépek, repository réteg         | `docs/spec/SPEC-003-domain-perzisztencia.md`                                   |
| a `packages/db` belső szerkezetének bontási terve                    | `docs/plan/PLAN-004-csomag-belso-szerkezet.md`                                 |
| rögzített verziók és a mögöttük álló okok                            | `docs/research/2026-08-26-toolchain.md`                                        |
| tároló motor kiértékelés, méretmérések                               | `docs/research/2026-08-27-tarolo-motor-ertekeles.md`                           |
| SDK session log kontra `run_event` és `graph_snapshot`               | `docs/research/2026-08-28-sdk-session-log.md`                                  |
| Playwright e2e teszt szabályok, a 15 tételes szabálylista            | `docs/research/2026-08-29-playwright-teszt-szabalyok.md`                       |
| az SSE mockolás mérése, a hibrid döntés bizonyítéka                  | `docs/research/2026-08-30-sse-mockolas-meres.md`                               |
| az e2e lefedettségi küszöb mérése, származtatása, kizárási döntése   | `docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md`                          |
| a gráf éleinek kifestett vonala, a bisect és a pixel mérés           | `docs/research/2026-09-09-graf-el-vonal-meres.md`                              |
| a select chevron helyének mérése, a React kontra natív ág döntése    | `docs/research/2026-09-09-select-chevron-meres.md`                             |
| a transcript panel: keret veszteség, sormagasság, cím csonkolás      | `docs/research/2026-09-23-transcript-panel-meresek.md`                         |
| a csomópontok élő állapota, a löketben érkező keretek mérése         | `docs/research/2026-09-23-elo-csomopont-allapot.md`                            |
| a frontend alkalmazás váza, a `packages/ui` és a kliens rétegek      | `docs/spec/SPEC-007-frontend-alkalmazas.md`                                    |
| a sablon nyelv (Mustache) és a kifejezés nyelv (CEL) implementációja | `docs/spec/SPEC-010-sablon-es-kifejezes-nyelv.md`                              |
| a sablon és kifejezés nyelv jelöltjei, csomagjai, forrásai           | `docs/research/2026-09-23-sablon-es-kifejezes-nyelv.md`, `...-csomagok.md`     |
| egy konkrét csomag felelőssége, fájljai, saját szabályai             | az adott csomag gyökerének `CLAUDE.md` fájlja                                  |

---

## 14. Ellentmondás esetén

**Nyitott tétel jelenleg nincs.**

A korábban itt állt hatodik tétel (a fejlesztői REST hívás originje és a szerver CORS engedélyének
hatóköre) 2026-09-05-én lezárult: a user termékdöntése szerint a **szerver portja `3001`**, a Vite
dev szerver az alapértelmezett `5173` porton marad, és a dev REST hívás a Vite proxyn megy. Ezzel a
SPEC-006 CORS engedélye változatlan marad (kizárólag a `STREAM_PATH` útvonalra), az SSE csatorna
pedig továbbra is közvetlenül a backend originre kapcsolódik, a proxyt megkerülve. A döntés
átvezetve a SPEC-006 O-1 és 5.7, a SPEC-007 O-4 tételébe, és a SPEC-008 3. szekciója írja le a
teljes elrendezést.

A korábban itt állt öt tétel (a `.spec.tsx` fájlok és a
`coverage.exclude` lista, a `CLAUDE.md` elhelyezés, a "nyolcadik kapu" elnevezés, a SPEC-001 14.
"Karbantartási szabály" kontra `claude-md.sh`, a kétszintű csomagok száma) mindegyike lezárult.

A `.spec.tsx` tétel lezárása: a user 2026-09-01-én a `.spec.tsx` út mellett döntött (SPEC-007
O-1). A `vitest.config.ts` `coverage.exclude` listája egyetlen `**/*.spec.tsx` sorral bővült, a
már meglévő `**/*.spec.ts` bejegyzés analógjaként; a `packages/ui` és az `apps/web` React
komponens tesztjei `.spec.tsx` fájlok, valódi JSX-szel. A 8. szekció szövege ennek megfelelően
pontosítva: a "nem bővíthető" tiltás a **termékkód** kizárásokra vonatkozik, egy teszt fájl
bejegyzésre nem.

A másik négy tétel egyike sem volt valódi nyitott kérdés: mindegyik már eldöntött állapotot írt
le, csak a régi forrásdokumentum (SPEC-001, PLAN-002) nem lett átvezetve a döntéshez. Az
átvezetés megtörtént (SPEC-001 14. szekció és 39. kritérium, SPEC-003 44. kritérium, PLAN-002 és
PLAN-003 kapu-listája, `tooling/scripts/CLAUDE.md`, `.github/workflows/ci.yml`), a tételek
törölve. A kétszintű csomagok száma a PLAN-004 F1 fázisa óta a SPEC-002-ben és e szabálykönyv 6.
szekciójában is "három" (`core`, `provider-capability`, `db`).

A szekció alábbi része az eljárás: mi a teendő, ha egy munkamenet tényleges, felhasználói döntést
igénylő ellentmondást talál két forrásdokumentum között. A fent lezárt tétel pontosan ezt az
eljárást követte, az 1 ... 4. pont szerint.

1. **Nem döntjük el csendben.** Ha az egyik forrás egyértelműen elavult (a döntés megvan, csak
   nincs átvezetve), az nem ide tartozik: azt a talált helyen kell kijavítani, a döntéshez igazítva.
   Ide csak az kerül, amit tényleg a usernek kell eldöntenie.
2. **Új, számozott tétel kerül ebbe a szekcióba**, amíg nyitva van: melyik két forrás mond mást,
   mi a tényleges eltérés, mi az érvényes viselkedés addig, és mi zárná le a kérdést.
3. **A usert az askuserquestion tool-lal kell megkérdezni**, összetett kérdést kisebb, érthető
   részekre bontva (gyökér `CLAUDE.md` 7.).
4. **Lezárás után a döntést át kell vezetni minden érintett forrásdokumentumba**, majd a tételt
   törölni kell erről a listáról.
5. **Javaslat nem ellentmondás.** Egy felvetés, amit nem kell eldönteni, de érdemes megemlíteni
   (pl. "megérné-e megírni X ellenőrzést") nem ebbe a szekcióba kerül, hanem oda, ahol felmerül,
   "Javaslat, nem döntés" jelöléssel, hogy ne torlódjon fel megválaszolatlan kérdésként.

---

## 15. A szabálykönyv karbantartása

- **Mikor kerül bele új szabály.** Amikor egy döntés a projekt egészére vagy egy visszatérő
  munkamenetre vonatkozik: user döntés, lezárt nyitott kérdés, mérésből származó megkötés, vagy egy
  valós hiba, amit nem szabad megismételni. A hibák a 11. szekcióba kerülnek, a védelemmel együtt,
  ami elkapja.
- **Mi nem kerül bele.** Terv (`PLAN-*`) tartalma, fájlszintű leképezés, mérési narratíva, nyers
  számok, egyetlen csomagra szűkülő részlet (az a csomag `CLAUDE.md` fájljába való), és
  verziószám, ami a toolchain research fájlban áll.
- **Ki írja bele.** Aki a döntést végrehajtja, ugyanabban a commitban, amiben a döntés a kódba vagy
  a specbe kerül. A szabály nem maradhat csak a beszélgetésben.
- **Forrás nélkül nincs szabály.** Minden bejegyzés mellé a forrás megnevezése kell (spec szekció,
  research fájl, csomag `CLAUDE.md`, vagy saját, most futtatott mérés). Ha csak sejtés, nem kerül
  ide.
- **Ellentmondás esetén.** Nem döntjük el csendben. A 14. szekció írja le a menetet: addig, amíg
  nyitva áll, ott kap egy számozott tételt, lezárás után minden érintett forrásdokumentumba át kell
  vezetni, és a tételt onnan törölni kell.
- **Az ellenőrzés.** A `bun run docs:check` ezt a fájlt nem kényszeríti ki és nem is tiltja: a
  `git ls-files '*/package.json'` alapján dolgozik, a `.claude/` könyvtárban pedig nincs
  `package.json`. A `bun run format:check` viszont **fedi**, mert a `.prettierignore` nem zárja ki,
  tehát a fájlt Prettier formázottan kell hagyni.
