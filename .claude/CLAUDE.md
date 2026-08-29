# Szabálykönyv

A projekt egyetlen, folyamatosan vezetett szabálykönyve: kizárólag a projekt szabályait
tartalmazza, nem a felhasználó általános viselkedési elvárásait. A gyökér `CLAUDE.md` 1-7.
szekciója a felhasználó saját, kézzel írt viselkedési szabálykönyve (gondolkodásmód,
kommunikáció, kódolási alapelvek); azt ez a fájl nem ismétli meg, csak hivatkozik rá. Ha egy
tétel mindkét dokumentumba illene, csak egy helyen áll.

Minden szabály mellett ott a forrása. Ha egy szabály itt és a forrásdokumentumban is szerepel, a
forrásdokumentum az erősebb, és az eltérést itt kell javítani. A `docs/plan/PLAN-*.md` fájlok
tartalma ide **nem** kerül: azok végrehajtási tervek, nem szabályok. Nyitott ellentmondás esetén a
menetet a 13. szekció írja le. Karbantartás: az utolsó szekció.

Rövidítések a forrásokban: `SPEC-00n` plusz szekciószám a `docs/spec/` alatti spec, `research` a
`docs/research/` alatti mért tény, "gyökér CLAUDE.md" a repo gyökerének fájlja (szekciószámmal az
1-7. szekcióra hivatkozik; szám nélkül olyan projekt-specifikus döntésre, ami korábban a gyökér
`CLAUDE.md` "Project-Specific Guidelines" szekciójában állt, onnan mára ide konszolidálva),
"csomag CLAUDE.md" az adott csomag gyökerének fájlja.

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
| Fájlt átnevezni `git mv` paranccsal kell, nem kézi törléssel és újralétrehozással, különben a git indexben a régi betűzés marad (11. szekció).                                              | SPEC-002 10.          |

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
- Két kivétel a hatókör alól: `apps/web/src/main.ts` és a `tools/wire-probe` csomag
  (SPEC-002 6.8).

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
Playwright, ESLint flat config (gyökér `CLAUDE.md`).

**Miért ezek, röviden**

| Döntés                                                                                                    | Indok                                                                                                       |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| TypeScript 6.0.x fix, nem frissítjük 7-re                                                                 | a `typescript-eslint` peer range-e `<6.1.0`, a TS 7 támogatás "not planned", mert nincs stabil compiler API |
| Bun csak csomagkezelő és workspace, a runtime Node                                                        | a Vitest 4 Bun alatt nem támogatott, a v8 coverage `node:inspector`-t igényel, ami Bunban hiányzik          |
| Turborepo `tasks` séma, nincs `pipeline` kulcs                                                            | Turborepo 2.x                                                                                               |
| Nincs TypeScript projekt referencia, nincs `composite`                                                    | a Turborepo hivatalos ajánlása; a build sorrendet a `turbo.json` `dependsOn` adja (SPEC-001 D-1)            |
| Forrás fogyasztás: az `exports` a `./src/index.ts`-re mutat                                               | méréssel igazolt, nincs build lépés a könyvtárcsomagokban (SPEC-001 V-1)                                    |
| Prettier formáz, ESLint nem; `eslint-config-prettier/flat` az utolsó elem, `eslint-plugin-prettier` nincs | a Prettier saját dokumentált ajánlása (SPEC-001 8.)                                                         |
| Az Agent SDK verziója pinelve                                                                             | a kimenő request body mezőlista verziónként bővül, egy új mező MiniMax ellen 400-at okozhat                 |

**Tiltások**

- **Tilos `bun:` prefixű modult használni a termékkódban** (`bun:sqlite`, `Bun.serve`), mert a
  Vitest Node alatt fut és nem tudja importálni őket. A WebSocket réteg `ws`, az SQLite driver
  `better-sqlite3`.
- **Vitest futtatása `bun run vitest`, soha nem `bun test`** (az a Bun saját runnere).
- **Nincs Docker.** Az agent sandboxot az SDK `sandbox` opciója adja. A tilalom a termék agent
  sandboxára vonatkozik, nem a CI futtatókörnyezetére (SPEC-001 15., V-19).
- **`npm` és `npx` nem használható**, csak `bun run` és `bun x` (`bunx`). A
  `devEngines.packageManager` deklaráció után az `npx` megtagadja a futást; ez egy valós CI hibát
  okozott, lásd 11. szekció.
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

**A `bun run test:e2e` és a `bun run coverage:e2e:report` nem tagja a kilenc kapunak.** A
Playwright futtatás és az e2e lefedettségi riport a CI-ban külön `e2e` jobban fut, a `build`
jobra várva; nem szerepel sem a gyökér kilenc kapu parancsai között, sem a `gate` mátrixban.

**Vitest projektek.** A gyökér `vitest.config.ts` `test.projects` mezője fogja össze a
`packages/*` és `apps/*` csomagokat; `apps/web` és `packages/ui` saját `vitest.config.ts`-e adja a
`happy-dom` környezetet, a többi Node alatt fut. A `tools/wire-probe` csomagnak nincs `test` npm
scriptje, de a `no-shadowed-path-import.spec.ts` regressziós tesztje mégis lefut: a gyökér
`vitest.config.ts` a `tools/wire-probe/src/**/*.{test,spec}.ts` mintát explicit projektként veszi
fel, függetlenül attól, van-e a csomagnak `test` scriptje (gyökér `CLAUDE.md`).

**Lefedettség.** 100 százalék mind a négy metrikán, kizárás nélkül. A `vitest.config.ts`
`coverage.exclude` listája nem bővíthető. Csomag-specifikus kizárás ma nincs; az egyetlen
ideiglenes kizárás az `apps/web/src/main.ts`, ami a valódi UI belépési pont megérkezésekor
törlendő (gyökér `CLAUDE.md`, SPEC-002 9., SPEC-003 12.4).

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

**Migrációk.** `drizzle-kit generate`, a generált SQL és a snapshot gitbe kerül; a `migrate()` az
`openDatabase` része, a hálózati kapcsolatok fogadása előtt. **A `drizzle-kit push` tiltott.**
Kézzel írt SQL a `--custom` üres migrációba kerül. Fejlesztés és éles ugyanazon az úton megy
(SPEC-003 10.3).

**Teszt.** Minden `.spec.ts` valós `better-sqlite3` adatbázis ellen fut, `:memory:` példányon, ami
a **commitolt** migrációkkal épül fel. Mockolt adatbázis nincs (SPEC-003 12.1, 12.2).

---

## 11. Buktatók, amiket már megtapasztaltunk

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
- **A `//#test` név nem lehetett sima `test`.** A Turborepo `--dry=json` mérés szerint a
  nem-prefixelt taskok kihagyják a `//` csomagot, tehát a per-csomag taskgráf a gyökeret sosem
  érintené (`tooling/scripts` CLAUDE.md, SPEC-001 V-18).
- **Playwright rootless konténerben.** A sandbox nem-root felhasználóként fut, nincs `sudo`, az
  `apt-get install` megtagadja. Egyetlen rendszerkönyvtár hiányzik (`libXdamage.so.1`), és root
  nélkül is telepíthető: `apt-get download` plusz `dpkg -x`, majd `LD_LIBRARY_PATH`. **Ez
  kizárólag környezeti változó, a repóban semmit nem kell módosítani**, ezért a CI-re nincs
  hatása. `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS`-et nem használunk (gyökér `CLAUDE.md`,
  research V-19).

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

## 12. Hol keresd a részleteket

| Téma                                                                | Forrás                                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| provider drótszintű mérés, `ProviderCapabilityDescriptor` típusterv | `docs/spec/SPEC-000-provider-wire-measurement.md`                              |
| a mérések kiértékelése, tervezési következmények                    | `docs/research/2026-08-26-spec000-kiertekeles.md`, `...-meresi-jegyzokonyv.md` |
| monorepo, toolchain, ESLint szabályok, CI, wrapperek                | `docs/spec/SPEC-001-monorepo-toolchain.md`                                     |
| a SPEC-001 ellenőrzési pontjai (V-1 ... V-20), mérésekkel           | `docs/research/2026-08-26-spec001-ellenorzesek.md`                             |
| csomag architektúra, mappa és csomagnév konvenció                   | `docs/spec/SPEC-002-csomag-architektura.md`, 6. szekció                        |
| domain modell, perzisztencia, állapotgépek, repository réteg        | `docs/spec/SPEC-003-domain-perzisztencia.md`                                   |
| a `packages/db` belső szerkezetének bontási terve                   | `docs/plan/PLAN-004-csomag-belso-szerkezet.md`                                 |
| rögzített verziók és a mögöttük álló okok                           | `docs/research/2026-08-26-toolchain.md`                                        |
| tároló motor kiértékelés, méretmérések                              | `docs/research/2026-08-27-tarolo-motor-ertekeles.md`                           |
| SDK session log kontra `run_event` és `graph_snapshot`              | `docs/research/2026-08-28-sdk-session-log.md`                                  |
| egy konkrét csomag felelőssége, fájljai, saját szabályai            | az adott csomag gyökerének `CLAUDE.md` fájlja                                  |

---

## 13. Ellentmondás esetén

**Jelenleg nincs nyitott ellentmondás.** A korábban itt állt négy tétel (`CLAUDE.md` elhelyezés,
a "nyolcadik kapu" elnevezés, a SPEC-001 14. "Karbantartási szabály" kontra `claude-md.sh`, a
kétszintű csomagok száma) egyike sem valódi nyitott kérdés volt: mindegyik már eldöntött állapotot
írt le, csak a régi forrásdokumentum (SPEC-001, PLAN-002) nem lett átvezetve a döntéshez. Az
átvezetés megtörtént (SPEC-001 14. szekció és 39. kritérium, SPEC-003 44. kritérium, PLAN-002 és
PLAN-003 kapu-listája, `tooling/scripts/CLAUDE.md`, `.github/workflows/ci.yml`), a tételek
törölve. A kétszintű csomagok száma a PLAN-004 F1 fázisa óta a SPEC-002-ben és e szabálykönyv 6.
szekciójában is "három" (`core`, `provider-capability`, `db`).

Ez a szekció ezért nem egy lista, hanem egy eljárás: mi a teendő, ha egy jövőbeli munkamenet
tényleges, felhasználói döntést igénylő ellentmondást talál két forrásdokumentum között.

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

## 14. A szabálykönyv karbantartása

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
- **Ellentmondás esetén.** Nem döntjük el csendben. A 13. szekció írja le a menetet: addig, amíg
  nyitva áll, ott kap egy számozott tételt, lezárás után minden érintett forrásdokumentumba át kell
  vezetni, és a tételt onnan törölni kell.
- **Az ellenőrzés.** A `bun run docs:check` ezt a fájlt nem kényszeríti ki és nem is tiltja: a
  `git ls-files '*/package.json'` alapján dolgozik, a `.claude/` könyvtárban pedig nincs
  `package.json`. A `bun run format:check` viszont **fedi**, mert a `.prettierignore` nem zárja ki,
  tehát a fájlt Prettier formázottan kell hagyni.
