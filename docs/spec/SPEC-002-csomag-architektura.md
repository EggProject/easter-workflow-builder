# SPEC-002: Csomag architektúra és mappa konvenció

|          |                                                                                                                                           |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz  | tervezet                                                                                                                                  |
| Dátum    | 2026-08-27                                                                                                                                |
| Előzmény | [`SPEC-001-monorepo-toolchain.md`](SPEC-001-monorepo-toolchain.md), 3. szekció csomagtérkép és 13. szekció mappaszerkezet                 |
| Bemenet  | [`../research/2026-08-26-agent-tools.md`](../research/2026-08-26-agent-tools.md), a `packages/typeguards` bemásolt kód mappa konvenciója  |
| Kimenet  | 19 termékcsomag a `packages/` alatt, 25 workspace csomag összesen, repóra kiterjesztett `src/<téma>/` konvenció, `.spec.ts` tesztvégződés |

---

## 1. Cél és hatókör

### Amit eldönt

- A `packages/agent-tools` és a `packages/providers` csomag szétbontását önálló, egyfelelősségű csomagokra, fájlszintű leképezéssel.
- A csomagok közötti rétegzést és a megengedett függőségi irányt az új csomagokra.
- A workspace csomagok névterét.
- A csomagon belüli mappa konvenciót, **téma szerinti** csoportosítással, kötelező érvénnyel, a repo minden csomagjára.
- A teszt fájlok végződését és elhelyezését.
- Azt, hogy a képértelmezés eszköz melyik környezeti változóból veszi a kulcsot.
- A migráció lépéssorrendjét úgy, hogy a minőségi kapuk minden lépés után zöldek maradjanak.

### Amit NEM dönt el

- Nem tervez új funkciót. Egyetlen eszköz viselkedése, egyetlen `Fact` értéke és egyetlen HTTP kérés alakja sem változik. Kivétel egyetlen ponton van, a `MINIMAX_CODING_PLAN_API_KEY` megszűnése (5.6 szekció), ez a user kifejezett döntése.
- Nem nyúl a toolchain konfigurációhoz azon túl, amit a csomagszám és a fájlnevek változása kikényszerít. A `turbo.json` taskjai, az `eslint.config.ts` szabálykészlete, a `tooling/tsconfig` alapok és a `.github/workflows/ci.yml` szerkezete változatlan.
- Nem tervezi meg a `core`, `db`, `engine`, `agent`, `protocol`, `logger`, `ui` csomagok tartalmát. Azok jelenleg placeholder tartalommal állnak, rájuk a 6. szekció mappa konvenciója vonatkozik, tartalmi terv nélkül.
- Nem vezet be TypeScript projekt referenciát. A SPEC-001 D-1 döntése érvényben marad.
- Nem old fel egyetlen SPEC-000 mérési eredményt sem, és nem ír új mérést.

### A user három kifogása, amit ez a spec kezel

1. A `packages/*/src` alatt minden egy mappába került. A `packages/agent-tools/src` hét alkönyvtára összesen 75 fájlt fog össze, egy mappa átlagosan 10 fájlt, mappán belüli tagolás nélkül.
2. A segédréteg és a kész tool egy csomagban lakik. Az `agent-tools` csomag egyszerre tartalmaz HTTP réteget, MiniMax klienst, Firecrawl klienst, kép feloldót, MCP eredmény konstruktorokat és a három kész eszközt.
3. A mappanevek nem informatívak. Az `agent-tools/src/minimax` névből nem derül ki, hogy MiniMax HTTP kliens van benne, és nem MiniMax provider leíró (az utóbbi a `providers/src/minimax` mappa).

### A user két további kifogása, amit ez a spec kezel

Az első szétbontás után, a 26 csomagos állapotra a user két további kifogást emelt. Mindkettő jogos, és mindkettőre ő adta meg a döntést. A jelen spec ezt a végállapotot írja le.

4. **Túl sok csomag lett.** A kérés nem az volt, hogy minden almappa külön csomag legyen, hanem hogy a csomagokon **belül** legyenek almappákba rendezve a dolgok. A 26 csomagból 19 marad: nyolc csomag beolvad egy befogadó csomagba, tárgykör szerinti almappaként. A tárgyköri határok nem sérülnek: a segéd továbbra sem lakik egy csomagban a kész toollal, és a kliens továbbra is külön csomag a tooltól. A leképezést a 4. szekció "Az összevont csomagok" táblázata adja.
5. **A tool csomagok neve nem mondja meg a szolgáltatót.** A `tool-web-search` névből nem derül ki, hogy MiniMax keresőt hív, a `tool-web-fetch` névből, hogy Firecrawl scrape-et. Ha holnap egy második kereső is jön, a két csomag megkülönböztethetetlen lenne. A három tool csomag ezért a provider csomagoknál már jóváhagyott mintára áll át: előbb a szolgáltató, utána a funkció. Az elv a 6.9 szekcióban áll, kötelező érvénnyel az egész repóra.

## 2. Kiinduló állapot, mérve

Mérés dátuma: 2026-08-27, a `feat/spec-001-monorepo` ág git indexén.

| Amit mértem                                         | Érték | Hogyan                                                                |
| --------------------------------------------------- | ----- | --------------------------------------------------------------------- |
| `packages/agent-tools/src` fájl, `CLAUDE.md` nélkül | 75    | `git ls-files packages/agent-tools/src \| grep -v CLAUDE.md \| wc -l` |
| `packages/providers/src` fájl, `CLAUDE.md` nélkül   | 68    | ugyanígy                                                              |
| `.test.ts` fájl a repóban                           | 33    | `git ls-files '*.test.ts' \| wc -l`                                   |
| `.spec.ts` fájl a repóban                           | 18    | `git ls-files '*.spec.ts' \| wc -l`                                   |
| workspace csomag                                    | 16    | `apps` 2, `packages` 10, `tooling` 3, `tools` 1                       |
| `bun run docs:check` állapota                       | ZÖLD  | `17/17 kotelezo helyen van CLAUDE.md, 0 hianyzik`                     |

A 18 `.spec.ts` közül 17 a `packages/typeguards` csomag bemásolt kódja, 1 az `apps/web/e2e/smoke.spec.ts` Playwright teszt.

**A `packages/typeguards` mozgó cél.** A csomagon a spec írásával párhuzamosan egy másik agent dolgozik: a mérés pillanatában már megtörtént a `is-record` és a `is-non-empty-string` téma mappába vitele, a `.spec.ts` átnevezés és a 16 hiányzó `CLAUDE.md` pótlása, ezért állt zöldre a `docs:check`. A 33 és a 18 darabszám ezt az állapotot tükrözi. A végrehajtás első lépése ezért a tényleges számok újramérése, nem ennek a táblázatnak az elfogadása.

### Ami félrevezetően duplikálódik ma

| Fájlnév             | Hol fordul elő kétszer                                                             | Mi a különbség                                           |
| ------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `endpoint-path.ts`  | `agent-tools/src/minimax/`, `agent-tools/src/firecrawl/`                           | két különböző szolgáltatás útvonalai                     |
| `minimax/` mappanév | `agent-tools/src/minimax/` (HTTP kliens), `providers/src/minimax/` (képességleíró) | teljesen eltérő felelősség, azonos név                   |
| `descriptor.ts`     | `providers/src/minimax/`, `providers/src/claude-subscription/`                     | ugyanaz a szerep, ez rendben van, mert külön providerhez |

## 3. Névtér

Minden workspace csomag neve `@easter-workflow-builder/` névtér prefixet kap. Ez érinti a jelenlegi 16 csomagot is. A prefix a user döntése, és a repo nevével egyezik.

Indok, hivatalos forrással: a Turborepo dokumentációja szó szerint ezt írja a belső csomagok `name` mezőjéről: _"It's best practice to use a namespace prefix for your Internal Packages to avoid conflicts with other packages on the npm registry"_ ([structuring a repository](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository)). A jelen migráció után 25 workspace csomag van, köztük olyan nevekkel, amik az npm registryben is léteznek (`core`, `logger`, `protocol`). A prefix nélkül egy jövőbeli `bun add` vagy egy elgépelt import csendben registry csomagra oldódhat fel.

A `catalog:` hivatkozás scoped csomagnév mellett is működik, a Bun dokumentációja saját példája is scoped csomagot használ (`"name": "@monorepo/ui"`, [Bun catalogs](https://bun.com/docs/pm/catalogs)).

A `tooling/*` és a `tools/*` csomagok is megkapják a prefixet (`@easter-workflow-builder/eslint-config`, `@easter-workflow-builder/tsconfig`, `@easter-workflow-builder/scripts`, `@easter-workflow-builder/wire-probe`), mert a szabály kivétel nélküli, és a `tooling/eslint-config` mai `eslint-config` neve épp a legkockázatosabb, generikus alak.

## 4. Cél csomagtérkép

### Rétegek

```
A csomagneveket a rovid alak jeloli, a teljes nev minden esetben
@easter-workflow-builder/<rovid nev>.

L0  nincs workspace fuggosege
    typeguards        mcp-tool-kit
    core              logger

L1  csak L0-ra epul
    provider-capability  ->  nincs workspace ele
    protocol             ->  core

L2  L0 es L1 folott
    minimax-client   ->  core, typeguards
    firecrawl-client ->  core, typeguards
    provider-minimax             ->  provider-capability
    provider-claude-subscription ->  provider-capability
    db  ->  core, logger
    ui  ->  core, protocol

L3  kesz egysegek
    tool-minimax-web-search       ->  mcp-tool-kit, minimax-client, core
    tool-firecrawl-web-fetch      ->  mcp-tool-kit, firecrawl-client, core
    tool-minimax-understand-image ->  mcp-tool-kit, minimax-client, core
    provider-registry             ->  provider-minimax, provider-claude-subscription,
                                      provider-capability (devDependencies)

L4  osszeallito
    agent-tool-bundle ->  provider-capability, tool-minimax-web-search,
                          tool-firecrawl-web-fetch, tool-minimax-understand-image, core
    agent  ->  core, logger, provider-registry

L5  vegrehajto motor es a web alkalmazas
    engine ->  agent, core, db, logger
    web    ->  core, protocol, ui

L6  szerver alkalmazas
    server ->  agent, core, db, engine, logger, protocol, provider-registry
```

A gráf aciklikus és egyirányú: minden él lefelé mutat, magasabb rétegből alacsonyabb felé. A `provider-capability` L1 rétegszámot kap, noha az összevonás után egyetlen workspace éle sincs: a szám nem sorszám, hanem felső korlát a kifelé mutató éleire, és a 13. kritérium csak azt követeli meg, hogy minden él szigorúan kisebb rétegszám felé mutasson.

**A rétegbesorolási ellentmondás lezárva, user döntés, 2026-08-27.** Korábban ezen a helyen az állt, hogy az `engine` és az `agent` egyaránt L4, miközben az `engine` függ az `agent` csomagtól, ami a szigorúan csökkenő szabályt sértette (a `bun run check:graph` egyetlen eltérése, nem a csomag-összevonás következménye: a besorolás már a 26 csomagos állapotban is ilyen volt). A user döntése: az `engine` az `agent` fölött áll, mert a végrehajtó motor ütemezi a lépéseket és hívja az Agent SDK adaptert. A kód nem változott, a valós `engine -> agent` függés helyes volt már korábban is; a réteg táblázat igazodott hozzá: az `engine` L5 rétegre került, és a rá épülő `apps/server` - mert az `engine`-től függ - L6 rétegre csúszott, hogy az `engine -> agent` és a `server -> engine` él is szigorúan csökkenő rétegszám felé mutasson. A `bun run check:graph` ez után nulla eltérést ad. Részletek: [`../research/2026-08-27-spec002-migracio-zaras.md`](../research/2026-08-27-spec002-migracio-zaras.md), "Nyitva jelölt kérdés" szakasz lezárása.

### Az összevont csomagok

Nyolc csomag szűnt meg, a tartalmuk egy befogadó csomag `src/` fájában él tovább, tárgykör szerinti almappaként. Egyetlen fájl tartalma és egyetlen exportált szimbólum sem veszett el, csak a barrel neve változott, amiből a fogyasztó importál.

| Megszűnő csomag    | Befogadó csomag       | Hol áll a tartalma                                               |
| ------------------ | --------------------- | ---------------------------------------------------------------- |
| `result`           | `core`                | `core/src/result/outcome/`                                       |
| `env-reader`       | `core`                | `core/src/env-reader/environment-reader/`                        |
| `http-client`      | `core`                | `core/src/http-client/{request,error-description}/`              |
| `image-source`     | `core`                | `core/src/image-source/{media-type,data-url}/`                   |
| `evidence`         | `provider-capability` | `provider-capability/src/evidence/{evidence-reference,fact}/`    |
| `evidence-sources` | `provider-capability` | `provider-capability/src/evidence-sources/measurement-document/` |
| `agent-tool-id`    | `provider-capability` | `provider-capability/src/agent-tool-id/`                         |

**A tárgyköri határok nem sérültek.** A segéd továbbra sem lakik egy csomagban a kész toollal (a `mcp-tool-kit` váz és a három `tool-*` csomag külön áll), és a kliens továbbra is külön csomag a tooltól (`minimax-client` és `firecrawl-client`). Az összevonás kizárólag olyan csomagokat érintett, amik ugyanannak a tárgykörnek a rétegei voltak.

**A nyolcadik tervezett összevonás nem hajtható végre.** Az `agent-tool-bundle` beolvasztása a `mcp-tool-kit` csomagba **kört hoz létre**, ezért nem történt meg. Az ok szerkezeti: az összeállító a három `tool-*` csomagot hívja, a három `tool-*` csomag viszont a `mcp-tool-kit` válaszkonstruktorait (`textToolResult`, `errorToolResult`) használja. A `check-dependency-graph.ts` a szándékosan bevezetett éllel futtatva pontosan ezt jelentette: `cycle: kör a függőségi gráfban: tool-minimax-understand-image -> mcp-tool-kit -> tool-minimax-understand-image`. Ugyanezt az `import-x/no-cycle` ESLint szabály is hibaként adná, mert a `mcp-tool-kit` barrelje a `tool-*` barrelekre hivatkozna, azok pedig vissza rá. Az `agent-tool-bundle` ezért **önálló csomag marad**, ez a user végleges döntése (2026-08-27), **tudatos döntés**, nem csak a kör kényszere. Indoka: az összeállító egy réteggel a toolok fölött áll, ami logikus - ő tud a toolokról, a toolok nem tudnak róla. Egy jövőbeli olvasó ezért ne akarja jóhiszeműen összevonni a két csomagot: a szétválasztás szándékos, nem ideiglenes állapot.

### A változatlanul maradó csomagok

`@easter-workflow-builder/db`, `@easter-workflow-builder/engine`, `@easter-workflow-builder/agent`, `@easter-workflow-builder/protocol`, `@easter-workflow-builder/logger`, `@easter-workflow-builder/ui`, `@easter-workflow-builder/server`, `@easter-workflow-builder/web`, `@easter-workflow-builder/eslint-config`, `@easter-workflow-builder/tsconfig`, `@easter-workflow-builder/scripts`, `@easter-workflow-builder/wire-probe`. Ezek tartalma nem változik, és a 6. szekció mappa konvenciója rájuk is érvényes, amint valódi tartalmat kapnak. A `@easter-workflow-builder/typeguards` már ma követi a konvenciót.

### Rétegbesorolás, mind a 25 csomagra

A 13. elfogadási kritérium gépi ellenőrzéséhez minden csomagnak van rétegszáma, a most nem érintett csomagoknak is. A besorolás a `tooling/scripts/src/dependency-graph/package-layer.ts` fájlban áll, és a gráf ellenőrző bemenete. Egy újonnan felvett csomagnak kötelező itt szerepelnie, különben az ellenőrző "hiányzó réteg-hozzárendelés" hibát ad.

| Réteg  | Csomagok                                                                                                                                                  |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L0     | `typeguards`, `mcp-tool-kit`, `core`, `logger`                                                                                                            |
| L1     | `provider-capability`, `protocol`                                                                                                                         |
| L2     | `minimax-client`, `firecrawl-client`, `provider-minimax`, `provider-claude-subscription`, `db`, `ui`                                                      |
| L3     | `tool-minimax-web-search`, `tool-firecrawl-web-fetch`, `tool-minimax-understand-image`, `provider-registry`                                               |
| L4     | `agent-tool-bundle`, `agent`                                                                                                                              |
| L5     | `engine`, `web`                                                                                                                                           |
| L6     | `server`                                                                                                                                                  |
| eszköz | `eslint-config`, `tsconfig`, `scripts`, `wire-probe`, réteg nélkül, mert nem termékkód és egyetlen termékcsomag sem függhet tőlük futásidejű függőségként |

Összesen 19 termékcsomag a `packages/` alatt, 2 alkalmazás az `apps/` alatt, 3 eszköz a `tooling/` alatt és 1 mérőeszköz a `tools/` alatt: 25 workspace csomag.

A `protocol` L1, mert csak a `core` csomagtól függhet. A `db` és a `ui` L2, mert a `protocol`, a `core` és a `logger` fölött áll. Az `engine` L5, mert a végrehajtó motor ütemezi a lépéseket és hívja az Agent SDK adaptert, tehát az `agent` (L4) fölött áll; a `server` emiatt L6, mert az `engine`-től is függ. A besorolás azt a szabályt kényszeríti ki, hogy egy csomag csak nála szigorúan kisebb rétegszámú csomagtól függhet, és az eszköz csomagok csak `devDependencies` helyen jelenhetnek meg.

### A megszűnt két kiinduló csomag

| Csomag                 | Mi lett vele                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/agent-tools` | megszűnt, a tartalma a `core`, a `mcp-tool-kit`, a két kliens, a három `tool-*` és az `agent-tool-bundle` csomagba került. A könyvtár és a `package.json` törlődött, nem maradt átirányító barrel |
| `packages/providers`   | megszűnt, a tartalma a `provider-capability`, a két provider leíró és a `provider-registry` csomagba került. Ugyanígy, átirányító barrel nélkül                                                   |

Átirányító barrel csomagot szándékosan nem hagyunk: az pontosan az a "minden egy helyre" minta lenne, amit a user kifogásolt, és a fogyasztók száma jelenleg nulla (az `agent` és a `server` placeholder tartalommal áll).

### A frissített SPEC-001 függőségi tábla

A SPEC-001 3. szekció "Megengedett függőségi irány" táblája a következőképpen egészül ki és módosul:

| Csomag                            | Amitől függhet                                                             |
| --------------------------------- | -------------------------------------------------------------------------- |
| `@easter-workflow-builder/agent`  | `core`, `logger`, `provider-registry`, `agent-tool-bundle`                 |
| `@easter-workflow-builder/server` | `core`, `protocol`, `db`, `engine`, `agent`, `provider-registry`, `logger` |
| minden más termékcsomag           | a 4. szekció rétegábrája szerint                                           |

Tiltott továbbra is: bármely visszafelé mutató él, bármely kör, és az `@easter-workflow-builder/web` függése a `db`, `engine`, `agent` vagy `server` csomagtól. Új tiltás: egy `tool-*` csomag nem függhet másik `tool-*` csomagtól, és nem függhet az `agent-tool-bundle` csomagtól.

A `core` az összevonás után is L0: nincs egyetlen workspace éle sem, és nem is lehet, mert minden más termékcsomag rá épül. Ez az összevonás legfontosabb kényszere: a `core` csak olyan tárgykört fogadhat be, aminek nincs kifelé mutató éle. A `result`, az `env-reader`, a `http-client` és az `image-source` mind ilyen volt, mert egymáson kívül semmitől nem függtek.

## 5. Csomagonkénti leírás és fájlszintű leképezés

### Leképezési szabály

Minden áthelyezett fájl a 6. szekció konvenciója szerint a **témája** mappájába kerül, nem a saját nevével egyező mappába. Egy témába több fájl kerül, ez a normális eset. Például:

```
packages/agent-tools/src/http/post-json.ts       ->  packages/core/src/http-client/request/post-json.ts
packages/agent-tools/src/http/post-json.test.ts  ->  packages/core/src/http-client/request/post-json.spec.ts
packages/agent-tools/src/http/get-binary.ts      ->  packages/core/src/http-client/request/get-binary.ts
packages/agent-tools/src/http/fetch-function.ts  ->  packages/core/src/http-client/request/fetch-function.ts
```

Az alábbi táblázatokban ezért a **cél téma mappa** szerepel. A fájlnév változatlan marad, a `.test.ts` végződés `.spec.ts` alakra változik. Ahol egy fájl kettéválik vagy új fájl keletkezik, azt külön jelölöm. Minden csomagnál külön táblázat sorolja fel a témákat és a hozzájuk tartozó fájlokat, és ez a táblázat a 11. szekció 8. elfogadási kritériumának bemenete.

### Az importok átírása kötelező, a `.spec.ts` fájlokban is

A "költözik" nem azt jelenti, hogy a fájl tartalma érintetlen. Minden áthelyezett fájlban át kell írni a relatív `../` importokat: ami a cél csomagon belül marad, az relatív út, ami másik csomagba került, az csomagnév szerinti import.

Ez a **teszt fájlokra is** vonatkozik, és ott két konkrét eset kézi döntést igényel:

1. Mind a négy `create-*-tool.test.ts` és a `create-agent-tool*.test.ts` importálja a `../http/fetch-function.ts` és a `../image/read-file-function.ts` típust, mert ma a közös `AgentToolDependencies` objektumot építik fel. Az új szűk függőség interfészek mellett a `tool-minimax-web-search` és a `tool-firecrawl-web-fetch` spec fájljának **nincs szüksége** a `ReadFileFunction` típusra, tehát azt az importot törölni kell, nem áthelyezni. A `noUnusedLocals` beállítás mellett a bent hagyott import fordítási hiba.
2. A `create-image-understanding-tool.test.ts` három sorban használja az `ENV_MINIMAX_CODING_PLAN_API_KEY` konstanst (bemenet felépítés, elvárt hibaüzenet, fixture kulcs). Ez a T-002-17 lépésben `ENV_MINIMAX_API_KEY` értékre változik, és a hiányzó kulcs hibaágának lefedettsége nem csökkenhet.

---

### 5.1 A `core` csomag `result` tárgyköre

**Felelősség.** A kétállapotú `Outcome<TValue>` eredménytípus és a hozzá tartozó szűkítő typeguard, hogy a rétegek kivétel helyett hibaágat adjanak vissza.

| Jelenlegi fájl                                 | Cél                                                        |
| ---------------------------------------------- | ---------------------------------------------------------- |
| `agent-tools/src/result/outcome.ts`            | `packages/core/src/result/outcome/outcome.ts` (típus-only) |
| `agent-tools/src/result/is-ok-outcome.ts`      | `packages/core/src/result/outcome/is-ok-outcome.ts`        |
| `agent-tools/src/result/is-ok-outcome.test.ts` | `packages/core/src/result/outcome/is-ok-outcome.spec.ts`   |

**Téma.** Egy téma, `outcome`: az eredménytípus és a rá szűkítő guard. Három fájl, egy mappa, a `core/src/result/` tárgykör mappa alatt.

**Függőség.** Nincs, sem csomagon belül, sem kívül. Ez a legalsó tárgykör a repóban.

**NEM tartalmazza.** Az MCP `tools/call` válasz alakját (`ToolCallResult`) és annak konstruktorait. Azok MCP protokoll specifikusak, a helyük a `@easter-workflow-builder/mcp-tool-kit`.

---

### 5.2 A `provider-capability` csomag `evidence` tárgyköre

**Felelősség.** A provider képességleírók háromállapotú bizonyíték típusa és a hozzá tartozó typeguardok.

| Jelenlegi fájl                                   | Cél                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `providers/src/evidence/measurement-id.ts`       | `packages/provider-capability/src/evidence/evidence-reference/measurement-id.ts` (típus-only)     |
| `providers/src/evidence/evidence-reference.ts`   | `packages/provider-capability/src/evidence/evidence-reference/evidence-reference.ts` (típus-only) |
| `providers/src/evidence/evidence-list.ts`        | `packages/provider-capability/src/evidence/evidence-reference/evidence-list.ts` (típus-only)      |
| `providers/src/evidence/fact.ts`                 | `packages/provider-capability/src/evidence/fact/fact.ts` (típus-only)                             |
| `providers/src/evidence/is-known-fact.ts`        | `packages/provider-capability/src/evidence/fact/is-known-fact.ts`                                 |
| `providers/src/evidence/is-known-fact.test.ts`   | `packages/provider-capability/src/evidence/fact/is-known-fact.spec.ts`                            |
| `providers/src/evidence/is-unknown-fact.ts`      | `packages/provider-capability/src/evidence/fact/is-unknown-fact.ts`                               |
| `providers/src/evidence/is-unknown-fact.test.ts` | `packages/provider-capability/src/evidence/fact/is-unknown-fact.spec.ts`                          |

**Témák.** Kettő, a `provider-capability/src/evidence/` tárgykör mappa alatt. Az `evidence-reference` a hivatkozás oldala: mire mutat egy bizonyíték és hogyan áll listába. A `fact` a háromállapotú érték: maga a típus és a két ágát szűkítő guard a két spec fájllal.

**Függőség.** Nincs, sem csomagon belül, sem kívül.

**NEM tartalmazza.** A bizonyítékok feloldását dokumentum útvonalra. Az az `evidence-sources` tárgykör feladata (5.3). Az `evidence` csak a típusokat és az állapotot ismeri, azt nem, hogy hol olvasható el a mérés. A két tárgykör egy csomagban él, de nem keveredik: az `evidence-sources` importálhat az `evidence` tárgykörből, fordítva nem.

---

### 5.3 A `provider-capability` csomag `evidence-sources` tárgyköre

**Felelősség.** A bizonyítékok nevesített forráskatalógusa: hivatalos doksi URL-ek, research szekció azonosítók, és a `MeasurementId` feloldása `docs/` horgonyra.

| Jelenlegi fájl                                     | Cél                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `providers/src/references/document-url.ts`         | `packages/provider-capability/src/evidence-sources/measurement-document/document-url.ts`         |
| `providers/src/references/research-section.ts`     | `packages/provider-capability/src/evidence-sources/measurement-document/research-section.ts`     |
| `providers/src/references/measurement-document.ts` | `packages/provider-capability/src/evidence-sources/measurement-document/measurement-document.ts` |

**Függőség.** Nincs csomagon kívüli függősége. A `MeasurementId` típust a befogadó csomagon belülről, az `evidence` tárgykörből veszi.

**NEM tartalmazza.** A mérés prózai leírását. A SPEC-001 13. szekció szabálya változatlan: a kódban csak a stabil azonosító és a horgony áll, a próza a `docs/research/` alatt.

**Téma.** Egy téma, `measurement-document`: hol olvasható el egy hivatkozott mérés. A három fájl ugyanannak a kérdésnek a három rétege, a doksi URL szótártól (`document-url.ts`, 13 exportált konstans) a research szekció azonosítókon át a `MeasurementId` feloldásáig, ezért egy mappában áll. A 6.4 szekció szerint az azonos szótárba tartozó konstanshalmaz egyetlen fájl marad, nem bomlik fájlonként egy konstansra.

---

### 5.4 A `provider-capability` csomag `agent-tool-id` tárgyköre

**Felelősség.** Az egyetlen `AgentToolId` union típus, ami a workflow lépéshez kapcsolható in-process MCP eszközök közös szótára.

| Jelenlegi fájl                              | Cél                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| `providers/src/capability/agent-tool-id.ts` | `packages/provider-capability/src/agent-tool-id/agent-tool-id.ts` (típus-only) |

**Téma.** Egy téma, `agent-tool-id`, egyetlen fájllal. A tárgykör és a téma neve egybeesik, ezért **nincs** duplikált mappaszint (`agent-tool-id/agent-tool-id/`), a fájl közvetlenül a tárgykör mappában áll. Ez a 6.1 pont 7. szabályának kimondott kivétele. Ha a szótár később bővül (például az azonosítókhoz tartozó megjelenítendő névvel), az a fájl ugyanebbe a mappába kerül.

**Függőség.** Nincs, sem csomagon belül, sem kívül.

**Miért lett a `provider-capability` a befogadó.** Két, egymástól független fa használja: a képességleíró réteg (az `AgentToolRecommendation` miatt) és a futásidejű eszköz-összeállító (`agent-tool-bundle`). A korábbi, önálló szótár csomag azért állt fenn, hogy az összeállító ne függjön a teljes képességleíró típusrétegtől. A user döntése ezt felülírja, és a szótár a `provider-capability` csomagba került: az `agent-tool-bundle` mostantól erre a csomagra hivatkozik, kizárólag az `AgentToolId` típus miatt. Kört ez nem okoz (a `provider-capability` L1, az `agent-tool-bundle` L4), a költsége egy szélesebb, de nem használt felület.

**NEM tartalmazza.** Az eszköz teljes MCP nevét (`mcp__<szerver>__<eszköz>`). Az a szervernév ismeretét igényli, tehát az `agent-tool-bundle` csomagban van.

---

### 5.5 `@easter-workflow-builder/provider-capability`

**Felelősség.** A provider képességleíró típusai. Kizárólag típus, egyetlen futásidejű sor nélkül. Ez a csomag hat saját téma mappája; a csomag emellett három beolvadt tárgykört is hordoz (5.2, 5.3, 5.4).

A `providers/src/capability/` alatti mind a 21 fájl ide kerül, az `agent-tool-id.ts` kivételével (az az 5.4 pontba került). A témák a `ProviderCapabilityDescriptor` saját mezőcsoportjai, tehát a leíró típus szerkezete és a mappaszerkezet ugyanaz. A cél útvonalak a `packages/provider-capability/src/` alatt értendők.

| Cél téma mappa     | Fájlok                                                                                                                                                                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `descriptor/`      | `provider-capability-descriptor.ts`                                                                                                                                                                                                                                                                                  |
| `model-catalog/`   | `model-descriptor.ts`, `models-endpoint-capability.ts`                                                                                                                                                                                                                                                               |
| `environment/`     | `environment-requirement.ts`, `disallowed-environment-requirement.ts`                                                                                                                                                                                                                                                |
| `tool-support/`    | `server-tool-descriptor.ts`, `agent-tool-recommendation.ts`                                                                                                                                                                                                                                                          |
| `limits/`          | `concurrency-capability.ts`, `rate-limit-capability.ts`, `rate-limit-bucket.ts`                                                                                                                                                                                                                                      |
| `request-shaping/` | `effort-capability.ts`, `thinking-capability.ts`, `thinking-mode.ts`, `tool-choice-capability.ts`, `tool-choice-value.ts`, `structured-output-capability.ts`, `structured-output-strategy.ts`, `structured-output-strategy-id.ts`, `streaming-capability.ts`, `prompt-caching-capability.ts`, `prompt-cache-mode.ts` |

**Témák.** Hat téma, 21 fájl, közvetlenül a `src/` alatt. A `descriptor` az összefogó típus, a másik öt a leíró egy-egy mezőcsoportja: a `requiredEnv` és a `disallowedEnv` mező az `environment`, a `serverTools` és a `recommendedAgentTools` a `tool-support`, a `models` és a `modelsEndpoint` a `model-catalog`, a `rateLimits` és a `concurrency` a `limits`, a kimenő kérés alakját meghatározó hat mező (`structuredOutput`, `toolChoice`, `thinking`, `effort`, `promptCaching`, `streaming`) pedig a `request-shaping` téma. Ugyanez a hat témanév ismétlődik az 5.6 két leíró csomagjában, hogy a típus és a hozzá tartozó kitöltött érték egymás mellett legyen navigálható.

**Függőség.** Nincs workspace függősége. A `Fact`, az `EvidenceList` és az `AgentToolId` típus az összevonás óta a csomagon belül, az `evidence` és az `agent-tool-id` tárgykörben áll.

**Spec fájl.** A hat képességleíró téma egyik fájljához sem tartozik `.spec.ts`, mert mind típus-only (6.3 szekció). A beolvadt `evidence/fact/` és `evidence-sources/` tárgykörnek van futásidejű sora, azoknak van.

**NEM tartalmazza.** Egyetlen konkrét provider egyetlen konkrét értékét sem. A típus mondja meg, milyen mezők vannak, az érték a két leíró csomagban áll.

---

### 5.6 `@easter-workflow-builder/provider-minimax` és `@easter-workflow-builder/provider-claude-subscription`

**Felelősség.** Egy-egy provider kitöltött képességleírója, mérési és dokumentációs bizonyítékokkal.

Mindkét csomag ugyanazt a 16 fájlt kapja meg a saját forrásmappájából, és mindkettőben ugyanaz a hat téma áll, ugyanazokkal a nevekkel, mint az 5.5 típuscsomagban:

| Cél téma mappa     | Fájlok                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `descriptor/`      | `descriptor.ts`                                                                                           |
| `model-catalog/`   | `family-id.ts`, `model-id.ts`, `models.ts`                                                                |
| `environment/`     | `required-environment.ts`, `disallowed-environment.ts`                                                    |
| `tool-support/`    | `server-tools.ts`, `recommended-agent-tools.ts`                                                           |
| `limits/`          | `concurrency.ts`, `rate-limits.ts`                                                                        |
| `request-shaping/` | `effort.ts`, `thinking.ts`, `structured-output.ts`, `tool-choice.ts`, `streaming.ts`, `prompt-caching.ts` |

| Forrás                                     | Cél                                                       |
| ------------------------------------------ | --------------------------------------------------------- |
| `providers/src/minimax/<fájl>`             | `packages/provider-minimax/src/<téma>/<fájl>`             |
| `providers/src/claude-subscription/<fájl>` | `packages/provider-claude-subscription/src/<téma>/<fájl>` |

A `descriptor` téma azért áll külön, mert az a fájl fogja össze a másik ötöt: minden mezője a többi téma egy-egy exportjára hivatkozik. Egyetlen fájl van benne, és ez nem a régi konvenció maradványa.

**Függőség.** `@easter-workflow-builder/provider-capability`, egyedül. A leíró típusok, a `Fact` és a bizonyítékok forráskatalógusa mind ott áll.

**Tartalmi változás nincs.** Minden `Fact` `state`, `value` és `evidence` értéke bitre azonos marad, ahogy a SPEC-001 34. kritériuma előírta a korábbi migrációra.

**NEM tartalmazzák.** A két leíró összekapcsolását egyetlen rekordba. Az a `@easter-workflow-builder/provider-registry`.

---

### 5.7 `@easter-workflow-builder/provider-registry`

**Felelősség.** A két leíró egyetlen, kulcs szerint elérhető readonly rekordban, plusz a leíró invariánsokat kikényszerítő bejáró regressziós teszt.

| Jelenlegi fájl                   | Cél                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `providers/src/registry.ts`      | `packages/provider-registry/src/provider-registry/provider-registry.ts`      |
| `providers/src/registry.test.ts` | `packages/provider-registry/src/provider-registry/provider-registry.spec.ts` |

**Téma.** Egy téma, `provider-registry`, két fájllal: a rekord és a rá épülő bejáró regressziós teszt.

**Függőség.** `@easter-workflow-builder/provider-minimax`, `@easter-workflow-builder/provider-claude-subscription`. A `.spec.ts` további dev függősége `@easter-workflow-builder/provider-capability`, mert a bejárás a `Fact` invariánsokat és a `MeasurementId` feloldhatóságot ellenőrzi.

**Átnevezés.** A `registry` név `provider-registry`-re változik, mert a csomagon belül a `registry` szó önmagában nem mondja meg, minek a regisztere, és az exportált típus neve is `ProviderRegistry`.

**NEM tartalmazza.** A provider kiválasztás logikáját (globális, workflow és lépés szintű felülírás). Az a `@easter-workflow-builder/engine` és a `@easter-workflow-builder/server` hatóköre, külön specifikáció tárgya.

---

### 5.8 A `core` csomag `env-reader` tárgyköre

**Felelősség.** Környezeti változó olvasás típusos, alapértelmezéssel és hibaággal. Nem tud egyetlen konkrét szolgáltatásról sem.

| Jelenlegi fájl                                   | Cél                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `agent-tools/src/config/environment-reader.ts`   | `packages/core/src/env-reader/environment-reader/environment-reader.ts` (típus-only) |
| `agent-tools/src/config/read-base-url.ts`        | `packages/core/src/env-reader/environment-reader/read-base-url.ts`                   |
| `agent-tools/src/config/read-base-url.test.ts`   | ugyanoda, `read-base-url.spec.ts` néven                                              |
| `agent-tools/src/config/read-timeout-ms.ts`      | `packages/core/src/env-reader/environment-reader/read-timeout-ms.ts`                 |
| `agent-tools/src/config/read-timeout-ms.test.ts` | ugyanoda, `read-timeout-ms.spec.ts` néven                                            |

**Téma.** Egy téma, `environment-reader`: a beolvasó függvény típusa és a rá épülő két olvasó, a két spec fájllal. Öt fájl, egy mappa.

**Függőség.** Nincs csomagon kívüli függősége. Az `Outcome` típust, amit a `readTimeoutMs` visszaad, a befogadó csomagon belülről, a `result` tárgykörből veszi.

**NEM tartalmazza.** A konkrét változóneveket (`MINIMAX_API_KEY`, `FIRECRAWL_BASE_URL`) és a konkrét alapértelmezéseket. Azok annál a kliensnél vannak, amelyik használja őket. Ez a lényegi különbség a mai `agent-tools/src/config` mappához képest, ami egyszerre tartalmazta a generikus olvasót és a két szolgáltatás konkrét beállításait.

---

### 5.9 A `core` csomag `http-client` tárgyköre

**Felelősség.** Vékony HTTP réteg a Node beépített `fetch` fölött: JSON POST, bináris GET, hibaleírás. Nem dob, nem próbálkozik újra.

| Jelenlegi fájl                                | Cél                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `agent-tools/src/http/fetch-function.ts`      | `packages/core/src/http-client/request/fetch-function.ts` (típus-only) |
| `agent-tools/src/http/binary-payload.ts`      | `packages/core/src/http-client/request/binary-payload.ts` (típus-only) |
| `agent-tools/src/http/post-json.ts`           | `packages/core/src/http-client/request/post-json.ts`                   |
| `agent-tools/src/http/post-json.test.ts`      | ugyanoda, `post-json.spec.ts` néven                                    |
| `agent-tools/src/http/get-binary.ts`          | `packages/core/src/http-client/request/get-binary.ts`                  |
| `agent-tools/src/http/get-binary.test.ts`     | ugyanoda, `get-binary.spec.ts` néven                                   |
| `agent-tools/src/http/describe-error.ts`      | `packages/core/src/http-client/error-description/describe-error.ts`    |
| `agent-tools/src/http/describe-error.test.ts` | ugyanoda, `describe-error.spec.ts` néven                               |

**Témák.** Kettő. A `request` a kérésküldés: a befecskendezett `fetch` típusa, a JSON POST, a bináris GET és a bináris válasz alakja, hat fájl. Az `error-description` a hibaüzenet előállítása egy elbukott hívásból, két fájl. A kettő azért válik el, mert a hibaleírót a hívó akkor is használja, amikor nem ez a réteg küldte a kérést.

**Függőség.** Nincs csomagon kívüli függősége. Az `Outcome` típust a befogadó csomagon belülről, a `result` tárgykörből veszi.

**NEM tartalmazza.** Egyetlen konkrét szolgáltatás egyetlen végpontját sem. A `PATH_SEARCH`, `PATH_VLM`, `PATH_SCRAPE` konstansok a megfelelő kliens csomagokban vannak. Nincs benne `axios` és nincs `dotenv`, a SPEC-001 alatt hozott szabály változatlan.

---

### 5.10 `@easter-workflow-builder/minimax-client`

**Felelősség.** MiniMax HTTP kliens: konfiguráció feloldás, a `base_resp` burkoló kezelése, a kereső és a képértelmező válaszok szűkítése és formázása.

| Jelenlegi fájl                                           | Cél                                                                         |
| -------------------------------------------------------- | --------------------------------------------------------------------------- |
| `agent-tools/src/config/minimax-config.ts`               | `packages/minimax-client/src/minimax-config/minimax-config.ts` (típus-only) |
| `agent-tools/src/config/resolve-minimax-config.ts`       | `packages/minimax-client/src/minimax-config/resolve-minimax-config.ts`      |
| `agent-tools/src/config/resolve-minimax-config.test.ts`  | ugyanoda, `resolve-minimax-config.spec.ts` néven                            |
| `agent-tools/src/minimax/base-response.ts`               | `packages/minimax-client/src/envelope/base-response.ts` (típus-only)        |
| `agent-tools/src/minimax/is-minimax-envelope.ts`         | `packages/minimax-client/src/envelope/is-minimax-envelope.ts`               |
| `agent-tools/src/minimax/is-minimax-envelope.test.ts`    | ugyanoda, `is-minimax-envelope.spec.ts` néven                               |
| `agent-tools/src/minimax/endpoint-path.ts`               | `packages/minimax-client/src/call-minimax/endpoint-path.ts`                 |
| `agent-tools/src/minimax/call-minimax.ts`                | `packages/minimax-client/src/call-minimax/call-minimax.ts`                  |
| `agent-tools/src/minimax/call-minimax.test.ts`           | ugyanoda, `call-minimax.spec.ts` néven                                      |
| `agent-tools/src/minimax/search-response.ts`             | `packages/minimax-client/src/search/search-response.ts` (típus-only)        |
| `agent-tools/src/minimax/is-search-response.ts`          | `packages/minimax-client/src/search/is-search-response.ts`                  |
| `agent-tools/src/minimax/is-search-response.test.ts`     | ugyanoda, `is-search-response.spec.ts` néven                                |
| `agent-tools/src/minimax/format-search-response.ts`      | `packages/minimax-client/src/search/format-search-response.ts`              |
| `agent-tools/src/minimax/format-search-response.test.ts` | ugyanoda, `format-search-response.spec.ts` néven                            |
| `agent-tools/src/minimax/vlm-response.ts`                | `packages/minimax-client/src/vlm/vlm-response.ts` (típus-only)              |
| `agent-tools/src/minimax/is-vlm-response.ts`             | `packages/minimax-client/src/vlm/is-vlm-response.ts`                        |
| `agent-tools/src/minimax/is-vlm-response.test.ts`        | ugyanoda, `is-vlm-response.spec.ts` néven                                   |

Ezen felül két fájl **kettéválik**, a MiniMax része ide kerül:

| Jelenlegi fájl                                        | Ami ide kerül                                                           | Cél                                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `agent-tools/src/config/environment-variable-name.ts` | `ENV_MINIMAX_API_KEY`, `ENV_MINIMAX_BASE_URL`, `ENV_MINIMAX_TIMEOUT_MS` | `packages/minimax-client/src/minimax-config/environment-variable-name.ts` |
| `agent-tools/src/config/default-config-value.ts`      | `DEFAULT_MINIMAX_BASE_URL`, `DEFAULT_MINIMAX_TIMEOUT_MS`                | `packages/minimax-client/src/minimax-config/default-config-value.ts`      |

**Témák.** Öt, 19 fájllal. A `minimax-config` a beállítás feloldása: a konfiguráció típusa, a feloldó, a változónevek és az alapértelmezések. Az `envelope` a MiniMax `base_resp` burkolója és a rá szűkítő guard. A `call-minimax` maga a hívás, a két végpont útvonalával együtt. A `search` a kereső válasz alakja, szűkítése és formázása. A `vlm` ugyanez a képértelmező válaszra. Ez a csomag a példa arra, amiért a régi `agent-tools/src/minimax` mappanév rossz volt: abból nem derült ki, mi van benne, a `search`, a `vlm` és az `envelope` névből viszont igen.

**Függőség.** `@easter-workflow-builder/core` (HTTP réteg, környezeti változó olvasás, `Outcome`) és `@easter-workflow-builder/typeguards`.

**Tartalmi változás, a user döntése.** Az `ENV_MINIMAX_CODING_PLAN_API_KEY` konstans **megszűnik**. Ennek következményei:

1. A `resolveMiniMaxConfig` `apiKeyVariableName` paramétere feleslegessé válik, mert mindkét hívó ugyanazt a változót adná át. A függvény közvetlenül az `ENV_MINIMAX_API_KEY` változót olvassa, a paraméter törlendő.
2. A `resolve-minimax-config.spec.ts` a paraméter nélküli alakhoz igazítandó, a hiányzó kulcs hibaágának lefedettsége nem csökkenhet.
3. A `turbo.json` `globalPassThroughEnv` listájából a `MINIMAX_CODING_PLAN_API_KEY` sor törlendő.
4. A `docs/research/2026-08-26-agent-tools.md` 4. szekciója ("Nyitott kérdés: kell-e külön Coding Plan token") lezárandó: a saját mérés szerint ugyanaz a pay-as-you-go platform kulcs mindkét végponton `status_code: 0` értéket adott, tehát a mérés a külön kulcsot nem igazolta, és a user ennek megfelelően döntött. A szekció szövege ezt rögzíti, a mérési tábla nem változik.
5. A SPEC-001 55. elfogadási kritériuma ("hat környezeti változó") ezzel **öt** környezeti változóra módosul. Ezt a jelen spec 11. szekció 27. kritériuma váltja ki.

**NEM tartalmazza.** Az MCP eszköz definíciót. A `web_search` és az `understand_image` eszköz külön csomagokban áll.

---

### 5.11 `@easter-workflow-builder/firecrawl-client`

**Felelősség.** Firecrawl HTTP kliens: konfiguráció feloldás, scrape hívás, a válasz szűkítése és markdownná formázása.

| Jelenlegi fájl                                                | Cél                                                                                |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `agent-tools/src/config/firecrawl-config.ts`                  | `packages/firecrawl-client/src/firecrawl-config/firecrawl-config.ts` (típus-only)  |
| `agent-tools/src/config/resolve-firecrawl-config.ts`          | `packages/firecrawl-client/src/firecrawl-config/resolve-firecrawl-config.ts`       |
| `agent-tools/src/config/resolve-firecrawl-config.test.ts`     | ugyanoda, `resolve-firecrawl-config.spec.ts` néven                                 |
| `agent-tools/src/firecrawl/endpoint-path.ts`                  | `packages/firecrawl-client/src/scrape-call/endpoint-path.ts`                       |
| `agent-tools/src/firecrawl/firecrawl-document.ts`             | `packages/firecrawl-client/src/scrape-document/firecrawl-document.ts` (típus-only) |
| `agent-tools/src/firecrawl/interpret-scrape-response.ts`      | `packages/firecrawl-client/src/scrape-document/interpret-scrape-response.ts`       |
| `agent-tools/src/firecrawl/interpret-scrape-response.test.ts` | ugyanoda, `interpret-scrape-response.spec.ts` néven                                |
| `agent-tools/src/firecrawl/format-firecrawl-document.ts`      | `packages/firecrawl-client/src/scrape-document/format-firecrawl-document.ts`       |
| `agent-tools/src/firecrawl/format-firecrawl-document.test.ts` | ugyanoda, `format-firecrawl-document.spec.ts` néven                                |

Kettéváló fájlok Firecrawl része:

| Jelenlegi fájl                                        | Ami ide kerül                                                | Cél                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `agent-tools/src/config/environment-variable-name.ts` | `ENV_FIRECRAWL_BASE_URL`, `ENV_FIRECRAWL_TIMEOUT_MS`         | `packages/firecrawl-client/src/firecrawl-config/environment-variable-name.ts` |
| `agent-tools/src/config/default-config-value.ts`      | `DEFAULT_FIRECRAWL_BASE_URL`, `DEFAULT_FIRECRAWL_TIMEOUT_MS` | `packages/firecrawl-client/src/firecrawl-config/default-config-value.ts`      |

**Témák.** Három, 13 fájllal. A `firecrawl-config` a beállítás feloldása, a `scrape-call` a hívás (a végpont útvonala és a `scrapePage`), a `scrape-document` a visszakapott dokumentum értelmezése és markdownná formázása.

**ÚJ fájl, áthelyezett kóddal.** `packages/firecrawl-client/src/scrape-call/scrape-page.ts` és `scrape-page.spec.ts`.

Ez az egyetlen új logika fájl a teljes migrációban, és nem új viselkedés: a mai `create-web-fetch-tool.ts` fájlban álló `postJson` hívást (URL összerakás a `PATH_SCRAPE` konstansból, `{ url, formats: ['markdown'] }` törzs, `timeoutMs`) emeli át. Indok: a user "Firecrawl kliens" csomagot kért, egy kliens pedig hív, nem csak válaszalakot értelmez. Enélkül a `tool-firecrawl-web-fetch` csomagnak közvetlenül a `@easter-workflow-builder/http-client` csomagtól kellene függnie, és a Firecrawl kliens felelőssége két csomag között oszlana meg.

A szerződése szándékosan azonos a `callMiniMax` szerződésével: `Promise<Outcome<unknown>>`, azaz a nyers JSON választ adja vissza, a szűkítést az `interpretScrapeResponse` végzi a hívó oldalon. Így a jelenlegi két, egymástól elkülönülő hibaág (elérhetetlen szolgáltatás, illetve értelmezhetetlen válasz) és a hozzájuk tartozó két külön hibaüzenet változatlan marad, tehát a `create-web-fetch-tool` tesztjeinek elvárásai nem módosulnak.

**Aszimmetria a MiniMax klienssel, szándékosan.** A `callMiniMax` paraméterként kapja az útvonalat, mert két végpontot szolgál ki, ezért a `PATH_SEARCH` és a `PATH_VLM` a csomag publikus felületén van. A Firecrawlnak egy végpontja van, ezért a `PATH_SCRAPE` a `scrape-call` témán belül marad, a `scrapePage` saját használatára, és **nincs** a barrelben.

**Függőség.** `@easter-workflow-builder/http-client`, `@easter-workflow-builder/env-reader`, `@easter-workflow-builder/result`, `@easter-workflow-builder/typeguards`.

---

### 5.12 A `core` csomag `image-source` tárgyköre

**Felelősség.** Kép feloldása base64 data URL alakra `https` címről, helyi fájlból vagy már kész data URL-ből, plusz a média típus megállapítása.

| Jelenlegi fájl                                               | Cél                                                                          |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `agent-tools/src/image/image-media-type.ts`                  | `packages/core/src/image-source/media-type/image-media-type.ts` (típus-only) |
| `agent-tools/src/image/media-type-from-content-type.ts`      | `packages/core/src/image-source/media-type/media-type-from-content-type.ts`  |
| `agent-tools/src/image/media-type-from-content-type.test.ts` | ugyanoda, `media-type-from-content-type.spec.ts` néven                       |
| `agent-tools/src/image/media-type-from-extension.ts`         | `packages/core/src/image-source/media-type/media-type-from-extension.ts`     |
| `agent-tools/src/image/media-type-from-extension.test.ts`    | ugyanoda, `media-type-from-extension.spec.ts` néven                          |
| `agent-tools/src/image/read-file-function.ts`                | `packages/core/src/image-source/data-url/read-file-function.ts` (típus-only) |
| `agent-tools/src/image/resolve-image-data-url.ts`            | `packages/core/src/image-source/data-url/resolve-image-data-url.ts`          |
| `agent-tools/src/image/resolve-image-data-url.test.ts`       | ugyanoda, `resolve-image-data-url.spec.ts` néven                             |

**Témák.** Kettő. A `media-type` a média típus megállapítása: a típus maga és a két megállapító, `Content-Type` fejlécből és fájlkiterjesztésből. A `data-url` a kép beolvasása és data URL alakra hozása, a befecskendezett fájlolvasó típusával együtt.

**Függőség.** Nincs csomagon kívüli függősége. A HTTP réteget és az `Outcome` típust a befogadó csomagon belülről, a `http-client` és a `result` tárgykörből veszi.

**NEM tartalmazza.** A MiniMax képértelmező hívást. A kép előkészítése és a modell hívása két különböző dolog: az előbbi bármelyik képes providerrel használható, az utóbbi MiniMax specifikus.

---

### 5.13 `@easter-workflow-builder/mcp-tool-kit`

**Felelősség.** Az MCP eszköz építő váz: a `tools/call` válasz alakja és a két válasz konstruktor, amit minden eszköz csomag használ.

| Jelenlegi fájl                                     | Cél                                                                           |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `agent-tools/src/result/tool-call-result.ts`       | `packages/mcp-tool-kit/src/tool-call-result/tool-call-result.ts` (típus-only) |
| `agent-tools/src/result/text-tool-result.ts`       | `packages/mcp-tool-kit/src/tool-call-result/text-tool-result.ts`              |
| `agent-tools/src/result/text-tool-result.test.ts`  | ugyanoda, `text-tool-result.spec.ts` néven                                    |
| `agent-tools/src/result/error-tool-result.ts`      | `packages/mcp-tool-kit/src/tool-call-result/error-tool-result.ts`             |
| `agent-tools/src/result/error-tool-result.test.ts` | ugyanoda, `error-tool-result.spec.ts` néven                                   |

**Téma.** Egy téma, `tool-call-result`: a válasz alakja és a két konstruktora, öt fájl. A siker és a hiba ág ugyanannak a válaszalaknak a két esete, ezért nem válik szét.

**Függőség.** Nincs workspace függősége, L0.

**NEM tartalmazza.** Egyetlen kész eszközt sem, és nem tartalmazza az in-process MCP szerver nevét sem. A user kifogása pontosan erre vonatkozott: a váz és a kész tool nem lakhat egy csomagban.

**Az `agent-tool-bundle` NEM olvadt be ide.** A tervezett összevonás kört hozott volna létre, a 4. szekció "Az összevont csomagok" pontjában bizonyított módon: az összeállító a három `tool-*` csomagot hívja, azok pedig ennek a csomagnak a válaszkonstruktorait. Az összeállító ezért önálló csomag maradt (5.17).

---

### 5.14 `@easter-workflow-builder/tool-minimax-web-search`

**Felelősség.** A `web_search` MCP eszköz definíciója: Zod séma, leírás, és a MiniMax kereső hívása.

| Jelenlegi fájl                                         | Cél                                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `agent-tools/src/tools/create-web-search-tool.ts`      | `packages/tool-minimax-web-search/src/web-search-tool/create-web-search-tool.ts` |
| `agent-tools/src/tools/create-web-search-tool.test.ts` | ugyanoda, `create-web-search-tool.spec.ts` néven                                 |

**ÚJ fájl.** `packages/tool-minimax-web-search/src/web-search-tool/web-search-tool-dependencies.ts`, típus-only.

**Téma.** Egy téma, `web-search-tool`, három fájllal: a gyártófüggvény, a spec fájlja, és a szűk függőség interfész. A mappa neve nem a gyártófüggvény neve, hanem azé az eszközé, amit előállít.

A mai közös `AgentToolDependencies` három mezőt fog össze (`fetchFunction`, `environment`, `readFileFunction`), de a `web_search` eszköznek csak kettő kell. Ha a közös típus egy alacsonyabb csomagba kerülne, minden eszköz csomag függene tőle, és az összeállító csomagtól való függés kört okozna. Ezért minden eszköz csomag a saját, szűk függőség interfészét deklarálja, és az összeállító adja át a megfelelő mezőket. Ez a "a segéd soha nem lakik egy csomagban a kész toollal" elv következménye a függőség objektumra is.

**Függőség.** `@easter-workflow-builder/mcp-tool-kit`, `@easter-workflow-builder/minimax-client`, `@easter-workflow-builder/core` (az `isOkOutcome` guard miatt), plusz `@anthropic-ai/claude-agent-sdk` és `zod`. A `FetchFunction` és az `EnvironmentReader` típust a `@easter-workflow-builder/minimax-client` barreljéből veszi, **nem** közvetlenül a `core` csomagból, a 6.6 pont 7. szabálya szerint: a tool nem hív HTTP réteget, csak átadja a befecskendezett függvényt a kliensnek.

**NEM tartalmazza.** A MiniMax HTTP hívást, a válasz szűkítést és formázást. Azok a kliens csomagban vannak, ez a csomag csak séma, leírás és a hibaágak megfogalmazása az agent felé.

---

### 5.15 `@easter-workflow-builder/tool-firecrawl-web-fetch`

**Felelősség.** A `web_fetch` MCP eszköz definíciója: Zod séma, leírás, és a Firecrawl scrape hívása.

| Jelenlegi fájl                                        | Cél                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| `agent-tools/src/tools/create-web-fetch-tool.ts`      | `packages/tool-firecrawl-web-fetch/src/web-fetch-tool/create-web-fetch-tool.ts` |
| `agent-tools/src/tools/create-web-fetch-tool.test.ts` | ugyanoda, `create-web-fetch-tool.spec.ts` néven                                 |

**ÚJ fájl.** `packages/tool-firecrawl-web-fetch/src/web-fetch-tool/web-fetch-tool-dependencies.ts`, típus-only, `fetchFunction` és `environment` mezővel.

**Téma.** Egy téma, `web-fetch-tool`, három fájllal.

**Függőség.** `@easter-workflow-builder/mcp-tool-kit`, `@easter-workflow-builder/firecrawl-client`, `@easter-workflow-builder/core` (az `isOkOutcome` guard miatt), plusz `@anthropic-ai/claude-agent-sdk` és `zod`. A `FetchFunction` és az `EnvironmentReader` típust a `@easter-workflow-builder/firecrawl-client` barreljéből veszi, **nem** közvetlenül a `core` csomagból, a 6.6 pont 7. szabálya szerint.

**Változás a mai kódhoz képest.** A `postJson` hívás átkerül a `scrape-call` téma `scrapePage` fájljába (5.11), tehát ez a fájl megszűnik közvetlenül HTTP réteget használni. A `@easter-workflow-builder/http-client` és a `@easter-workflow-builder/env-reader` **nem** szerepel a csomag függőségei között.

---

### 5.16 `@easter-workflow-builder/tool-minimax-understand-image`

**Felelősség.** Az `understand_image` MCP eszköz definíciója: Zod séma, leírás, a kép feloldása és a MiniMax képértelmező hívása.

| Jelenlegi fájl                                                  | Cél                                                                                                   |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `agent-tools/src/tools/create-image-understanding-tool.ts`      | `packages/tool-minimax-understand-image/src/understand-image-tool/create-image-understanding-tool.ts` |
| `agent-tools/src/tools/create-image-understanding-tool.test.ts` | ugyanoda, `create-image-understanding-tool.spec.ts` néven                                             |

**ÚJ fájl.** `packages/tool-minimax-understand-image/src/understand-image-tool/understand-image-tool-dependencies.ts`, típus-only, mindhárom mezővel (`fetchFunction`, `environment`, `readFileFunction`).

**Téma.** Egy téma, `understand-image-tool`, három fájllal. A mappa neve az eszköz neve (`understand_image`), nem a benne álló gyártófüggvényé (`createImageUnderstandingTool`): a téma konvenció nem követeli meg a névazonosságot, és itt az eszköz neve a felismerhető.

**Függőség.** `@easter-workflow-builder/mcp-tool-kit`, `@easter-workflow-builder/minimax-client`, `@easter-workflow-builder/core`, plusz `@anthropic-ai/claude-agent-sdk` és `zod`. A `FetchFunction` és az `EnvironmentReader` típust a `@easter-workflow-builder/minimax-client` barreljéből veszi, a 6.6 pont 7. szabálya szerint. A `resolveImageDataUrl` függvényt és a `ReadFileFunction` típust viszont közvetlenül a `core` csomagból, mert a kép feloldását maga hívja.

**Változás a mai kódhoz képest.** Az `ENV_MINIMAX_CODING_PLAN_API_KEY` helyett nincs változónév paraméter: a `resolveMiniMaxConfig` hívás argumentum nélkül történik, és az `ENV_MINIMAX_API_KEY` változóból dolgozik (5.10).

---

### 5.17 `@easter-workflow-builder/agent-tool-bundle`

**Önálló csomag marad.** Az `mcp-tool-kit` csomagba való beolvasztása kört hozna létre, mert az itt álló `createAgentTool` a három `tool-*` csomagot hívja, azok pedig az `mcp-tool-kit` válaszkonstruktorait. A bizonyítás a 4. szekció "Az összevont csomagok" pontjában áll, futtatott ellenőrzővel.

**Felelősség.** A lépésenként kapcsolható eszközkészlet összeállítása: az azonosítókból in-process MCP szerver konfiguráció és `allowedTools` lista.

| Jelenlegi fájl                                                  | Cél                                                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `agent-tools/src/tools/agent-tools-server-name.ts`              | `packages/agent-tool-bundle/src/tool-reference/agent-tools-server-name.ts`                 |
| `agent-tools/src/tools/agent-tool-reference.ts`                 | `packages/agent-tool-bundle/src/tool-reference/agent-tool-reference.ts`                    |
| `agent-tools/src/tools/agent-tool-reference.test.ts`            | ugyanoda, `agent-tool-reference.spec.ts` néven                                             |
| `agent-tools/src/tools/agent-tool-dependencies.ts`              | `packages/agent-tool-bundle/src/tool-dependencies/agent-tool-dependencies.ts` (típus-only) |
| `agent-tools/src/tools/default-agent-tool-dependencies.ts`      | `packages/agent-tool-bundle/src/tool-dependencies/default-agent-tool-dependencies.ts`      |
| `agent-tools/src/tools/default-agent-tool-dependencies.test.ts` | ugyanoda, `default-agent-tool-dependencies.spec.ts` néven                                  |
| `agent-tools/src/tools/create-agent-tool.ts`                    | `packages/agent-tool-bundle/src/tool-factory/create-agent-tool.ts`                         |
| `agent-tools/src/tools/create-agent-tool.test.ts`               | ugyanoda, `create-agent-tool.spec.ts` néven                                                |
| `agent-tools/src/tools/agent-tool-bundle.ts`                    | `packages/agent-tool-bundle/src/tool-bundle/agent-tool-bundle.ts` (típus-only)             |
| `agent-tools/src/tools/create-agent-tool-bundle.ts`             | `packages/agent-tool-bundle/src/tool-bundle/create-agent-tool-bundle.ts`                   |
| `agent-tools/src/tools/create-agent-tool-bundle.test.ts`        | ugyanoda, `create-agent-tool-bundle.spec.ts` néven                                         |

**Témák.** Négy, 11 fájllal. A `tool-reference` az MCP név összerakása a szervernévből és az eszköz azonosítóból. A `tool-dependencies` a futásidejű függőség objektum típusa és az alapértelmezett példánya. A `tool-factory` az egyetlen hely, ami tudja, melyik azonosítóhoz melyik gyártófüggvény tartozik. A `tool-bundle` a kész készlet alakja és összeállítása.

**Függőség.** `@easter-workflow-builder/provider-capability` (kizárólag az `AgentToolId` szótár miatt), `@easter-workflow-builder/tool-minimax-web-search`, `@easter-workflow-builder/tool-firecrawl-web-fetch`, `@easter-workflow-builder/tool-minimax-understand-image`, `@easter-workflow-builder/core` (az `EnvironmentReader`, a `FetchFunction` és a `ReadFileFunction` típus), plusz `@anthropic-ai/claude-agent-sdk`.

**Az `AgentToolDependencies` szerepe itt.** Ez a csomag az egyetlen hely, ahol a három futásidejű függőség egy objektumban áll, mert ez az egyetlen hely, ami mindhárom eszközt ismeri. A `createAgentTool` switch ágai a teljes objektumból választják ki az adott eszköz szűk függőség interfészének megfelelő mezőket.

**NEM tartalmazza.** Egyetlen eszköz sémáját, leírását vagy hibaüzenetét sem. Ez a csomag nem tud arról, mit csinál egy eszköz, csak arról, hogy melyik azonosítóhoz melyik gyártófüggvény tartozik.

---

### 5.18 Mit veszít a `packages/agent-tools/src/index.ts` és a `packages/providers/src/index.ts`

Mindkét barrel törlődik. A jelenleg belőlük exportált szimbólumok az alábbi csomagok barreljébe kerülnek:

| Ma exportált szimbólum                                                                                                                               | Új csomag                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `EnvironmentReader`                                                                                                                                  | `@easter-workflow-builder/core`                         |
| `ENV_MINIMAX_API_KEY`, `ENV_MINIMAX_BASE_URL`, `ENV_MINIMAX_TIMEOUT_MS`                                                                              | `@easter-workflow-builder/minimax-client`               |
| `mediaTypeFromContentType`, `mediaTypeFromExtension`, `resolveImageDataUrl`, `ImageMediaType`, `ReadFileFunction`                                    | `@easter-workflow-builder/core`                         |
| `postJson`, `getBinary`, `describeError`, `FetchFunction`, `BinaryPayload`, `PostJsonRequest`                                                        | `@easter-workflow-builder/core`                         |
| `readBaseUrl`, `readTimeoutMs`                                                                                                                       | `@easter-workflow-builder/core`                         |
| `DOC_*`, `RESEARCH_*`, `measurementDocument`, `MeasurementDocumentAnchor`                                                                            | `@easter-workflow-builder/provider-capability`          |
| `ENV_MINIMAX_CODING_PLAN_API_KEY`                                                                                                                    | megszűnik (5.10)                                        |
| `ENV_FIRECRAWL_BASE_URL`, `ENV_FIRECRAWL_TIMEOUT_MS`                                                                                                 | `@easter-workflow-builder/firecrawl-client`             |
| `Outcome`, `isOkOutcome`                                                                                                                             | `@easter-workflow-builder/core`                         |
| `ToolCallResult`                                                                                                                                     | `@easter-workflow-builder/mcp-tool-kit`                 |
| `AgentToolDependencies`, `defaultAgentToolDependencies`, `AGENT_TOOLS_SERVER_NAME`, `agentToolReference`, `AgentToolBundle`, `createAgentToolBundle` | `@easter-workflow-builder/agent-tool-bundle`            |
| `MeasurementId`, `EvidenceReference`, `EvidenceList`, `Fact`, `isKnownFact`, `isUnknownFact`                                                         | `@easter-workflow-builder/provider-capability`          |
| `ProviderCapabilityDescriptor`, `AgentToolRecommendation`                                                                                            | `@easter-workflow-builder/provider-capability`          |
| `AgentToolId`                                                                                                                                        | `@easter-workflow-builder/provider-capability`          |
| `MiniMaxModelId`, `MiniMaxFamilyId`                                                                                                                  | `@easter-workflow-builder/provider-minimax`             |
| `ClaudeModelId`, `ClaudeFamilyId`                                                                                                                    | `@easter-workflow-builder/provider-claude-subscription` |
| `ProviderRegistry`, `providerRegistry`                                                                                                               | `@easter-workflow-builder/provider-registry`            |

### 5.19 Megfigyelés, nem ennek a specnek a hatóköre

A `packages/providers/package.json` `dependencies` mezője tartalmazza a `core` csomagot, de a `packages/providers/src` alatt egyetlen fájl sem importál a `core` csomagból (`grep -rn "from 'core'" packages/providers/src` nulla találat). Ez holt függőség. A csomag megszűnésével magától eltűnik, egyik utódcsomag sem veszi át.

## 6. A belső mappa konvenció

Ez a szekció kötelező érvényű, és a repo **minden** csomagjára vonatkozik, nem csak a most létrejövőkre.

### 6.1 Téma szerinti mappák

```
packages/<csomag>/
  package.json
  tsconfig.json
  CLAUDE.md
  src/
    index.ts               barrel, csak nevesitett ujraexport
    <tema-neve>/
      <fajl>.ts            a tema egyik fajlja
      <fajl>.spec.ts       a hozza tartozo teszt, ha van futasideju sor
      <masik-fajl>.ts      ugyanannak a temanak a masik fajlja
      <masik-fajl>.spec.ts
```

Szabályok:

1. A csoportosítás alapja a **téma**, nem a fájlok száma. A téma a domain fogalomból jön: az a dolog, amiről a benne álló fájlok szólnak. A `minimax-client` csomagban a téma a `search`, a `vlm` és az `envelope`, nem az, hogy `is-search-response`.
2. **Egy témába több fájl kerül, ez a normális eset.** Egy fájl akkor áll egyedül egy téma mappában, ha a témának ténylegesen egy fájlja van, nem azért, mert minden fájl saját mappát kapna.
3. Egy téma akkor kap külön mappát, ha van neve, amit egy fejlesztő felismer. Ha a névhez magyarázat kell, az nem téma. Ha két témára ugyanaz a név illik, az egy téma.
4. A téma mappa neve kebab-case, és a domain fogalmat nevezi meg, nem feltétlenül a benne álló valamelyik fájlt. Az `understand-image-tool` mappában a `create-image-understanding-tool.ts` áll, és ez rendben van.
5. A fájlnevek változatlanok maradnak: egy fájl egy exportált egység, ahogy eddig is. A téma konvenció a mappákról szól, nem a fájlok felbontásáról.
6. Egyetlen fájl sem állhat közvetlenül a `src/` alatt, az `index.ts` barrel kivételével.
7. Nincs téma mappán belüli `index.ts`. A csomagnak egyetlen belépési pontja van.
8. **A `src/` alatti mappaszerkezet alapesetben egy szint mély, és kétszintű két okból lehet.** A tárgykör a témánál egy szinttel tágabb fogalom: az a terület, ami korábban önálló csomag volt, vagy önálló csomag lehetne. Az első ok: a csomag több tárgykört fog össze. Ha egy csomagban egyetlen tárgykör van, a téma mappák közvetlenül a `src/` alatt állnak (ez az eset a `minimax-client`, a `firecrawl-client`, a `mcp-tool-kit`, a három `tool-*` és a `provider-registry` csomagban). Ha több, akkor minden ilyen tárgykör kap egy `src/<tárgykör>/` mappát, és a téma mappái az alatt állnak. A második ok: egy tárgykörön belül egyetlen téma mappa maga több, önállóan megnevezhető fogalmat hordoz, és ez a fájlnevekből nem derül ki (a bontási próbát a PLAN-004 3. szekciója rögzíti). Ilyenkor kizárólag az érintett téma mappa bomlik `src/<tárgykör>/<téma>/` alakra, a csomag többi téma mappája lapos marad a `src/` alatt közvetlenül: ez a **vegyes alak**, és megengedett. Kettőnél mélyebb szerkezet mindkét esetben tilos.
9. **Ha egy tárgykörnek egyetlen témája van, és a kettő neve megegyezik, a mappaszint nem duplázódik.** A `provider-capability/src/agent-tool-id/agent-tool-id.ts` az egyetlen ilyen eset a repóban; az `agent-tool-id/agent-tool-id/` alak tilos, mert nulla információt hordoz.

A 8. szabály alá eső három csomag, tételesen:

```
packages/core/src/
  result/outcome/
  env-reader/environment-reader/
  http-client/request/
  http-client/error-description/
  image-source/media-type/
  image-source/data-url/

packages/provider-capability/src/
  descriptor/            model-catalog/       environment/
  tool-support/          limits/              request-shaping/
  evidence/evidence-reference/
  evidence/fact/
  evidence-sources/measurement-document/
  agent-tool-id/

packages/db/src/
  database-file/          sqlite-connection/      migration/
  workflow-run/           step-run/               human-approval/
  app-setting/            provider-concurrency/    run-recovery/
  workflow-graph/
    workflow/            node-type/          node-config/          agent-step-config/
  graph-snapshot/
    stored-snapshot/     snapshot-document/  snapshot-hash/
  run-event/
    event-record/        event-kind/         sdk-message/
```

A `provider-capability` a vegyes eset: hat téma mappája közvetlenül a `src/` alatt áll (ez a csomag saját tárgyköre, a képességleíró típusok), és három beolvadt tárgykör mappája mellettük. Ez megengedett, mert a saját tárgykörnek nincs külön neve: az maga a csomag.

A `db` a második ok, kizárólagosan: a csomag egy tárgykörű marad (SPEC-003 8. szekció), nem fog össze több, korábban önálló tárgykört. Három téma mappája (`workflow-graph`, `graph-snapshot`, `run-event`) önmaga több, önállóan megnevezhető fogalmat hordozott, ezért tárgykör mappává vált, a témái alá kerültek. A másik kilenc téma mappa lapos maradt a `src/` alatt. A fájlszintű leképezést és a döntés indoklását a [`../plan/PLAN-004-csomag-belso-szerkezet.md`](../plan/PLAN-004-csomag-belso-szerkezet.md) 4. szekciója adja.

**A `packages/typeguards` jelenlegi szerkezete helyes és marad.** Ott azért áll 17 mappa 17 guardhoz, mert **egy adott typeguard típus maga egy téma**: az `is-string` téma az, hogy mi számít stringnek. Ugyanezt mutatja az `is-function/` mappa, amiben két fájl áll (`is-function.ts` és `is-function-return-any.ts`) a két saját spec fájljával: egy téma, több fájl. Ez a szerkezet nem sablon a többi csomagra, mert máshol a téma nem esik egybe egyetlen fájllal.

### 6.2 A spec fájl

1. A teszt a megvalósítás **mellett** áll, ugyanabban a mappában, nem külön `__tests__` vagy `test/` fa alatt.
2. A kiterjesztés `.spec.ts`, nem `.test.ts`. A repo minden meglévő `.test.ts` fájlja átnevezendő.
3. A neve pontosan a megvalósítás fájl neve plusz `.spec.ts`.
4. A Playwright end to end tesztek maradnak az `apps/web/e2e/` fa alatt, `.spec.ts` végződéssel, ahogy ma is. Az `apps/web/vitest.config.ts` már ma kizárja az `e2e/**` mintát, tehát a Vitest nem szedi fel őket.
5. **Megvalósítás fájl nélküli regressziós teszt.** Van olyan teszt, ami nem egy egységet fed le, hanem egy konfigurációs invariánst őriz. A repóban kettő ilyen van: `tooling/scripts/src/turbo-e2e-coverage-outputs.test.ts` (a `turbo.json` `test:e2e` task `outputs` mezőjét őrzi) és `tools/wire-probe/src/no-shadowed-path-import.test.ts` (árnyékolt relatív importot őriz). Az ilyen teszt is téma mappába kerül, a mappa neve pedig **annak a dolognak a neve, amit őriz**. A mappában egyetlen fájl áll, a `.spec.ts`, és a csomag gyökerének `CLAUDE.md`-je jelöli a `## Fájlok` táblázatban, hogy ennek a témának nincs megvalósítás párja. Ez nem kivétel a 6.1 alól: a téma megvan, csak egy fájlból áll. A `tools/wire-probe` esetén a 6.8 pont szerint csak az átnevezés kötelező, a mappába vitel nem.

### 6.3 Típus-only fájlok

1. A típus-only fájl (`export type`, `export interface`, futásidejű utasítás nélkül) **ugyanabba a téma mappába kerül**, mint a témájához tartozó többi fájl. Nem gyűlik külön mappába attól, hogy típus.
2. Hozzá **nem** készül `.spec.ts`. Indok: nincs futásidejű sor, amit lefedni lehetne, a v8 coverage nulla utasítással veszi fel, tehát sem nem javítja, sem nem rontja a százalékot. Ezt a SPEC-001 9. szekciója már rögzítette a `capability/**` fájlokra.
3. A típus-only voltát a csomag gyökerének `CLAUDE.md` fájlja jelöli a `## Fájlok` táblázatban, hogy az olvasó ne hiányolja a tesztet.
4. Tilos a típus-only fájlokat egy közös `types/` mappába gyűjteni. Az a technikai réteg szerinti csoportosítás, amit a 6.5 pont tilt.

### 6.4 Konstans gyűjtő fájlok

Egy fájl akkor is egyetlen fájl marad, ha több exportált konstanst tartalmaz, feltéve hogy a konstansok **ugyanannak a szótárnak** a tagjai, azonos prefixszel vagy azonos szereppel. Precedens: `document-url.ts` 13 doksi URL-lel, `environment-variable-name.ts` a saját szolgáltatása változóneveivel. Nem bomlik fájlonként egy konstansra.

Nem elfogadható gyűjtő: egymással nem összefüggő konstansok egy fájlban, illetve két szolgáltatás konstansai egy fájlban. Pontosan ezért válik ketté az `environment-variable-name.ts` és a `default-config-value.ts` a MiniMax és a Firecrawl csomag között (5.10, 5.11).

### 6.5 Tiltott mappanevek

A téma mappa neve domain fogalmat nevez meg. Az alábbi nevek soha nem azt teszik, ezért tiltottak:

| Tiltott mappanév                                   | Miért                                                                                                                                                |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types/`, `interfaces/`, `models/`                 | technikai réteg szerinti csoportosítás, nem téma szerinti                                                                                            |
| `utils/`, `helpers/`, `lib/`, `common/`, `shared/` | gyűjtőmappa, definíció szerint nincs témája                                                                                                          |
| `internal/`, `private/`                            | a láthatóságot a barrel szabályozza, nem a mappaszerkezet                                                                                            |
| `config/`                                          | önmagában nem mondja meg, minek a beállítása. A mai `agent-tools/src/config` pont ezért keverte a generikus olvasót és két szolgáltatás beállításait |

A `config` tiltása a **puszta** névre vonatkozik. A `minimax-config/` és a `firecrawl-config/` téma mappa megengedett és helyes: megnevezi, melyik szolgáltatás beállításáról van szó, és pontosan azt a keveredést zárja ki, ami miatt a `config/` tiltott.

**Fő szabály.** A csoportosítás legfeljebb kétszintű: `src/<téma>/` egy tárgykörű csomagban, `src/<tárgykör>/<téma>/` több tárgykörűben (6.1 pont 8. szabálya). Harmadik szint nincs. Ha egy csomagban a tárgykörök fölé is csoportosítani kellene, az azt jelenti, hogy a csomag két csomag, és a szétbontást kell mérlegelni.

A 19 termékcsomagból 16 egy tárgykörű, tehát lapos, `src/<téma>/` szintű. Három kétszintű: a `core` és a `provider-capability`, mert a user döntése szerint több, korábban önálló tárgykört fognak össze, és a `db`, mert három téma mappája (`workflow-graph`, `graph-snapshot`, `run-event`) önmaga több fogalmat hordozott, és a 6.1 pont 8. szabályának második oka szerint tárgykör mappává vált ([`../plan/PLAN-004-csomag-belso-szerkezet.md`](../plan/PLAN-004-csomag-belso-szerkezet.md)).

### 6.6 A csomag publikus felülete

1. A publikus felület kizárólag a `src/index.ts` barrel.
2. A barrel csak **nevesített** újraexportot tartalmaz, `export { x } from './<téma>/x.ts'` és `export type { X } from './<téma>/x.ts'` alakban. `export *` tilos, mert nem látszik belőle, mi a felület, és a `verbatimModuleSyntax` mellett a típus és az érték export sem különül el.
3. A `package.json` `exports` mezője a `./src/index.ts` fájlra mutat, a SPEC-001 V-1 döntése szerint (forrás fogyasztás, nincs build lépés).
4. A barrel a coverage `exclude` listáján van (`**/index.ts`), tehát nem tartalmazhat futásidejű elágazást, csak újraexportot.
5. Ami nincs a barrelben, az a csomagon kívülről nem használható. Csomagon belül a hivatkozás relatív, `.ts` kiterjesztéssel, a `allowImportingTsExtensions` beállítás szerint: témán belül `./<fájl>.ts`, témák között `../<téma>/<fájl>.ts`.
6. Placeholder export (`IS_<CSOMAG>_PLACEHOLDER`) csak addig maradhat egy barrelben, amíg a csomagnak nincs valódi tartalma. Az első valódi export felvételekor törlendő.
7. **A barrel újraexportálja azokat az idegen csomagból származó típusokat, amik a csomag saját publikus szignatúráiban megjelennek.** Ha a `@easter-workflow-builder/minimax-client` `resolveMiniMaxConfig` függvénye `EnvironmentReader` paramétert vár, akkor az `EnvironmentReader` típus a `minimax-client` barreljében is szerepel, `export type { EnvironmentReader } from '@easter-workflow-builder/env-reader';` alakban.

Az utolsó szabály indoka: enélkül minden hívónak deklarálnia kellene a hívott csomag függőségeit is, hogy a saját függvényszignatúráit le tudja írni. Konkrétan a három `tool-*` csomagnak fel kellene vennie a `@easter-workflow-builder/http-client` és a `@easter-workflow-builder/env-reader` csomagot pusztán a `FetchFunction` és az `EnvironmentReader` típus miatt, ami hamis függést mutatna: a tool nem hív HTTP réteget, csak átadja a befecskendezett függvényt a kliensnek. A szabály hatálya alá eső három csomag és a re-exportált típusok:

| Csomag                                      | Re-exportált típus                   | Miért van a szignatúrában                         |
| ------------------------------------------- | ------------------------------------ | ------------------------------------------------- |
| `@easter-workflow-builder/minimax-client`   | `EnvironmentReader`, `FetchFunction` | `resolveMiniMaxConfig`, `callMiniMax` paramétere  |
| `@easter-workflow-builder/firecrawl-client` | `EnvironmentReader`, `FetchFunction` | `resolveFirecrawlConfig`, `scrapePage` paramétere |
| `@easter-workflow-builder/image-source`     | `FetchFunction`, `ReadFileFunction`  | `resolveImageDataUrl` paramétere                  |

A `ReadFileFunction` a `@easter-workflow-builder/image-source` saját típusa, tehát ott nem re-export, hanem eredeti export.

### 6.7 `CLAUDE.md` a csomag gyökerében

A gyökér `CLAUDE.md` szabálya - "CLAUDE.md kizárólag a csomag gyökerében kell, arról hogy miről szól a csomag; alkönyvtárakba nem kell" - és a `tooling/scripts/claude-md.sh` ellenőrzés együtt azt jelenti, hogy **a téma mappák NEM kapnak saját `CLAUDE.md` fájlt**, kizárólag a csomag gyökere. Minden csomag gyökere egy `CLAUDE.md`-t kap. Mélyebbre nincs mit tenni: sem a tárgykör mappa, sem a téma mappa nem kap fájlt. A `bun run docs:check` pontosan ezt kényszeríti ki: a `git ls-files '*/package.json'` kimenetéből képzett csomaggyökér lista minden elemében kell legyen `CLAUDE.md`, alkönyvtárban nem.

A csomag szintű `CLAUDE.md` a SPEC-001 14. szekció mind a hat kötelező szekcióját tartalmazza, és a `## Fájlok` táblázata a **téma mappákat** sorolja fel (kétszintű csomagban a tárgykörrel együtt, `<tárgykör>/<téma>/` alakban), mappánként egy-két mondatos felelősség leírással, nem az egyes fájlokat. Az 5. szekció csomagonkénti táblázatai adják a téma -> fájl leképezést, ez a forrás, nem a `CLAUDE.md`.

### 6.8 Két kivétel a hatókör alól

#### `apps/web/src/main.ts`

Ez a fájl a Vite belépési pontja, és a helyét három, egymástól független dolog rögzíti: az `apps/web/index.html` `<script src="/src/main.ts">` hivatkozása, a `vitest.config.ts` `coverage.exclude` listájának `apps/web/src/main.ts` sora, és az e2e nyc riport, ami erre a fájlútra jelent lefedettséget. Egy téma mappába vitel (`src/<téma>/main.ts`) mindhármat elrontaná, nulla haszonért, ráadásul a SPEC-002 22. elfogadási kritériuma tiltja a `coverage.exclude` lista módosítását.

A fájl ezért a `src/` tetején marad. Amikor egy későbbi specifikáció a valódi UI belépési pontot felállítja, akkor kell újra megvizsgálni, a `coverage.exclude` sor megszüntetésével együtt (SPEC-001 9. szekció, "SZIGORITANI KELL").

#### `tools/wire-probe`

A konvenció **nem** vonatkozik a `tools/wire-probe` csomagra. A csomag szerkezete változatlan marad, beleértve a `src/cases/` alatti 37 mérési eset fájlt, a `src/harness/` és a `src/proxy/` mappát, valamint a `src/probe.ts`, `src/proxy.ts`, `src/summary.ts` fájlokat.

Indok, négy pontban:

1. **Nem termékkód.** A SPEC-001 13. szekciója szerint mérőeszköz, a SPEC-000 lezárt hatóköre. A coverage `exclude` listája teljes egészében kizárja, és a csomagnak nincs `test` npm scriptje.
2. **A mérés reprodukálhatósága a tét.** A `probe`, `proxy` és `summary` npm scriptek konkrét fájlutakat hívnak, és a `src/cases/index.ts` mind a 36 esetfájlt behúzza. Egy átszervezés a SPEC-000 mérések megismételhetőségét kockáztatná, nulla termékoldali haszonért.
3. **A meglévő szerkezet nagyrészt már téma szerinti.** A `src/cases/`, a `src/harness/` és a `src/proxy/` mappa a téma konvenció mércéjével helyes: a 37 mérési eset egy téma, egy mappában. Ami eltér, az a `src/probe.ts`, a `src/proxy.ts` és a `src/summary.ts` a `src/` tetején, és pontosan ezeket védi a 2. pont: a három npm script ezekre a fájlutakra hivatkozik.
4. **A `src/proxy.ts` és a `src/proxy/` mappa együtt él.** A konvenció szerinti `proxy/proxy.ts` alak ütközne a meglévő mappával, és pontosan azt az árnyékolt útvonal hibát hozná vissza, amit a `no-shadowed-path-import.spec.ts` regressziós teszt őriz.

Ami a `tools/wire-probe` csomagra **mégis** vonatkozik: a `@easter-workflow-builder/` névtér (3. szekció) és a `.spec.ts` végződés a `no-shadowed-path-import` regressziós tesztre (6.2 pont 5. szabálya, mappába vitel nélkül). A `CLAUDE.md` kötelezettség a 6.7 pont szerinti általános szabályra szűkül: csak a csomag gyökerében kell, a `src/cases/`, a `src/harness/` és a `src/proxy/` mappa nem kap saját fájlt. A csomagnak nincs `src/index.ts` fájlja és nincs `exports` mezője, mert soha senki nem importálja csomagnév szerint; ez így marad.

### 6.9 Csomagnév konvenció: a szolgáltatót meg kell nevezni

**Ami egy konkrét külső szolgáltatóhoz köthető, azt a csomag nevében meg kell nevezni, előbb a szolgáltató, utána a funkció.** A név akkor jó, ha a csomaglistából, a fájl megnyitása nélkül el lehet dönteni, melyik szolgáltatással beszél.

Ez a user döntése, és a provider csomagoknál már alkalmazott, jóváhagyott mintát terjeszti ki a repo egészére:

| Csomagnév                       | Szolgáltató | Funkció                   |
| ------------------------------- | ----------- | ------------------------- |
| `provider-minimax`              | MiniMax     | provider képességleíró    |
| `provider-claude-subscription`  | Claude      | provider képességleíró    |
| `minimax-client`                | MiniMax     | HTTP kliens               |
| `firecrawl-client`              | Firecrawl   | HTTP kliens               |
| `tool-minimax-web-search`       | MiniMax     | `web_search` MCP eszköz   |
| `tool-minimax-understand-image` | MiniMax     | `understand_image` eszköz |
| `tool-firecrawl-web-fetch`      | Firecrawl   | `web_fetch` MCP eszköz    |

A három tool csomag korábbi neve (`tool-web-search`, `tool-understand-image`, `tool-web-fetch`) ezt a szabályt sértette: a névből nem derült ki, hogy a keresést a MiniMax, a lekérést a Firecrawl adja. A próba, ami ezt kimutatja: **ha holnap egy második implementáció érkezik ugyanarra a funkcióra, megkülönböztethető marad-e a kettő.** Egy Brave alapú kereső csomagja `tool-brave-web-search` lenne, és a listában egymás mellett állna a `tool-minimax-web-search` mellett. A régi névvel a második csomagnak nem lett volna neve.

Amit **nem** kell megnevezni: a szolgáltatófüggetlen csomagokat (`core`, `typeguards`, `mcp-tool-kit`, `protocol`, `logger`, `db`, `engine`, `ui`) és azokat, amik a saját domain fogalmukról szólnak (`provider-capability`, `provider-registry`, `agent-tool-bundle`). Ha egy ilyen csomag egyszer mégis egyetlen szolgáltatóhoz kötődne, az azt jelentené, hogy rossz helyre került a tartalma.

**Az MCP eszköznevek nem változnak.** A `web_search`, a `web_fetch` és az `understand_image` az agent felé kimenő szerződés, ahogy a `createWebSearchTool` és társai a gyártófüggvények neve, és a `web-search-tool/` a téma mappa neve. A konvenció a **csomagnévről** szól, ami a repo belső dolga; az eszköz neve az agentnek szól, és annak egy szolgáltatóváltás nem látszódhat.

## 7. Amit a migráció NEM változtat meg

| Fájl vagy beállítás                           | Miért nem kell hozzányúlni                                                                                                                                                                                                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `turbo.json` taskok                           | a taskok csomagfüggetlenek, az `inputs` mintái `packages/*/src/**` alakúak, az új csomagokat automatikusan felveszik                                                                                                                                                         |
| `.github/workflows/ci.yml`                    | a jobok gyökér npm scripteket hívnak, csomagnevet sehol nem neveznek meg                                                                                                                                                                                                     |
| `.github/actions/setup/action.yml`            | ugyanez                                                                                                                                                                                                                                                                      |
| `eslint.config.ts` és `tooling/eslint-config` | a `**/*.test.ts` és a `**/*.spec.ts` minta már ma is együtt szerepel a `test-files.ts` fájlban                                                                                                                                                                               |
| `vitest.config.ts` `projects`                 | a `packages/*` glob minden új csomagot felvesz, a Vitest dokumentáltan minden mappát külön projektnek tekint                                                                                                                                                                 |
| `vitest.config.ts` `coverage.include`         | `packages/*/src/**/*.{ts,tsx}`, az új csomagokra is illeszkedik                                                                                                                                                                                                              |
| `vitest.config.ts` `coverage.exclude`         | a `**/*.test.ts` és a `**/*.spec.ts` minta már ma is együtt szerepel                                                                                                                                                                                                         |
| `tooling/tsconfig/*.json`                     | csomagfüggetlen                                                                                                                                                                                                                                                              |
| `tooling/scripts/*.sh`                        | a nyolc wrapper és a `_lib.sh` csomagfüggetlen. Egy dokumentált kivétel van: egy új wrapper a gráf ellenőrzőhöz. A `casing.sh` fájlban álló `check-casing.ts` útvonal **nem** változik, mert a `tooling/scripts/src/casing/` a téma konvenció szerint helyes mappa, és marad |

**A `.test.ts` átnevezés nem igényel Vitest config módosítást.** A Vitest 4 dokumentált `test.include` alapértelmezése `['**/*.{test,spec}.?(c|m)[jt]s?(x)']` ([include](https://vitest.dev/config/include)), és ugyanez olvasható a telepített forrásban is (`node_modules/vitest/dist/chunks/defaults.9aQKnqFk.js`, `const defaultInclude = ["**/*.{test,spec}.?(c|m)[jt]s?(x)"]`). A gyökér `vitest.config.ts` két explicit projektje (`wire-probe-regression`, `tooling-scripts`) már ma `**/*.{test,spec}.ts` mintát használ.

**Amihez hozzá kell nyúlni:**

| Fájl                                      | Mit                                                                                      |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| gyökér `package.json` `workspaces`        | változatlan glob, de a `catalog` bejegyzések változatlanok maradnak                      |
| `turbo.json` `globalPassThroughEnv`       | a `MINIMAX_CODING_PLAN_API_KEY` sor törlendő (5.10)                                      |
| minden új csomag `package.json`           | `@easter-workflow-builder/` név, `workspace:*` függőségek, `catalog:` a közös devDeps-re |
| minden meglévő csomag `package.json`      | `@easter-workflow-builder/` név és a hivatkozó `dependencies` kulcsok átírása            |
| `docs/research/2026-08-26-agent-tools.md` | a 4. szekció lezárása (5.10)                                                             |
| gyökér `CLAUDE.md`                        | a 6. szekció konvenciója rövid hivatkozásként, a spec linkjével                          |

## 8. Bun catalog és workspace deklarációk

1. Minden új csomag `devDependencies` mezője a közös eszközöket `catalog:` hivatkozással veszi át: `typescript`, `vitest`, `@types/node`. Literál verzió egyik új csomagba sem kerülhet, ez a SPEC-001 3. elfogadási kritériuma.
2. Minden workspace közötti függőség `"workspace:*"` alakban áll a `dependencies` mezőben. Ami nincs deklarálva, azt az `import-x/no-extraneous-dependencies` szabály hibaként jelzi.
3. Az `@anthropic-ai/claude-agent-sdk` verziója **pinelve** marad, és csak azokban a csomagokban szerepel, amik ténylegesen importálják: `@easter-workflow-builder/tool-minimax-web-search`, `@easter-workflow-builder/tool-firecrawl-web-fetch`, `@easter-workflow-builder/tool-minimax-understand-image`, `@easter-workflow-builder/agent-tool-bundle`. A SPEC-001 döntése szerint nem kerül katalógusba.
4. A `zod` szintén csak a három tool csomagban szerepel.
5. A `bun.lock` egyetlen fájl marad a gyökérben, és a `bun install --frozen-lockfile` minden lépés után hibátlanul lefut.

## 9. Coverage

1. A 100 százalékos küszöb minden új csomagra vonatkozik, **kizárás nélkül**. A `vitest.config.ts` `coverage.exclude` listája egyetlen új sorral sem bővülhet.
2. Az `apps/web/src/main.ts` ideiglenes kizárása változatlanul marad, mert nem ennek a specnek a hatóköre.
3. A típus-only fájlok nulla utasítással szerepelnek a riportban, tehát nem igényelnek sem tesztet, sem kizárást.
4. A `**/index.ts` kizárás miatt a barrel fájlok nem számítanak. Ez a 6.6 pont 4. szabályának az oka: a barrelben nem lehet lefedetlenül maradó elágazás.
5. Az ÚJ `scrape-page.ts` fájl (5.11) és a három `*-tool-dependencies.ts` típus-only fájl (5.14, 5.15, 5.16) sem kap kizárást. A `scrape-page` mindkét ágát (sikeres hívás, hibás hívás) a saját `.spec.ts` fedi, befecskendezett `fetch` függvénnyel, élő hálózat nélkül.

## 10. Kockázatok

| Kockázat                                                                                                   | Hatás                                                                             | Védelem                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A `.test.ts` átnevezés a git indexben más betűzéssel landol, mint a lemezen                                | a CI kis-nagybetű érzékeny checkoutján `TS2307 Cannot find module`, helyben semmi | `bun run check:casing` minden lépés végén, és `git mv` használata kézi törlés helyett                                                                                                                                                                                                                                       |
| Egy `Fact` érték elmozdul vagy elveszik a provider szétbontás során                                        | a mérési eredmény csendben elromlik                                               | a `provider-registry.spec.ts` bejáró tesztje minden lépés után zöld, plusz a szétbontás előtti és utáni normalizált JSON összehasonlítás, a SPEC-001 34. kritériumának mintájára                                                                                                                                            |
| A `MINIMAX_CODING_PLAN_API_KEY` megszüntetése után a képértelmezés kulcs nélkül marad                      | az eszköz minden hívásra hibaágat ad                                              | a `resolve-minimax-config.spec.ts` a hiányzó kulcs hibaágát változatlanul fedi, és a hibaüzenet megnevezi a beállítandó `MINIMAX_API_KEY` változót                                                                                                                                                                          |
| A `scrapePage` kiemelése megváltoztatja a `web_fetch` hibaüzeneteit                                        | az agent más szöveget kap, a teszt elvárások elcsúsznak                           | a `scrapePage` szerződése `Outcome<unknown>`, a szűkítés a hívónál marad, tehát a két hibaág és a két üzenet változatlan (5.11)                                                                                                                                                                                             |
| A `docs:check` egy új csomag gyökerének hiányzó `CLAUDE.md`-je miatt pirosra vált                          | a kapu elbukik, a lépés nem zárható le                                            | a `CLAUDE.md` a csomag gyökerével **együtt**, ugyanabban a lépésben keletkezik, nem utólag                                                                                                                                                                                                                                  |
| A `@easter-workflow-builder/` névtér átírása kimarad egy `dependencies` kulcsból                           | `bun install` hibázik, vagy egy import registry csomagra oldódik fel              | a névtér átírás önálló, atomi lépés, a végén `bun install --frozen-lockfile` plusz mind a hét kapu                                                                                                                                                                                                                          |
| A 25 csomagos gráf lelassítja a Turborepo futást                                                           | lassabb helyi és CI futás                                                         | dokumentált felső korlát vagy teljesítmény-figyelmeztetés a csomagszámra a Turborepo dokumentációjában **nincs**, ezért számot itt nem rögzítünk; a lépések végén mért `turbo run typecheck` idő a tény                                                                                                                     |
| A `packages/typeguards` csomagon párhuzamosan dolgozik egy másik agent                                     | ütköző szerkesztés                                                                | a typeguards érintő lépés a terv legvégén áll, és csak akkor indul, ha a párhuzamos munka lezárult                                                                                                                                                                                                                          |
| A tisztán típus-only csomagok (`agent-tool-id`, `provider-capability`) barrelje futásidőben üres modult ad | a Vitest projekt vagy a Node type stripping nem tudja betölteni a csomagot        | a `verbatimModuleSyntax` mellett az `export type { X } from '...'` alak érvényes modult képez, tehát nem üres fájl. A `passWithNoTests: true` már ma be van állítva a gyökér configban, tehát a teszt nélküli projekt nem bukik el. Ha a betöltés mégis hibázna, a barrelbe egyetlen `export {}` sor kerül, kizárás helyett |

## 11. Elfogadási kritériumok

1. A `packages/agent-tools` és a `packages/providers` könyvtár nem létezik, és a repóban nincs rájuk mutató import a `docs/` alatti historikus szövegeken kívül.
2. A `packages/` alatt pontosan 19 csomag áll, névre a 4. szekció rétegbesorolási táblázata szerint, mindegyiknek van `package.json`, `tsconfig.json`, `src/index.ts` és `CLAUDE.md` fájlja. A workspace összesen 25 csomagból áll (19 `packages`, 2 `apps`, 3 `tooling`, 1 `tools`).
3. Minden workspace csomag neve `@easter-workflow-builder/` prefixszel kezdődik, kivétel nélkül, a `tooling/*` és a `tools/*` csomagokat is beleértve.
4. Az 5. szekció mind a 143 leképezett fájlja (75 az `agent-tools`, 68 a `providers` csomagból) elszámolt: 139 fájl a megadott cél mappában, a megadott fájlnéven áll, 2 fájl (`environment-variable-name.ts`, `default-config-value.ts`) szolgáltatásonként kettévált és mind a négy fele megvan, 2 fájl (a két `src/index.ts` barrel) szándékosan törölve. Egyetlen fájl sem maradt le, és egyetlen exportált szimbólum sem veszett el, az 5.18 táblázat szerint. Az összevonás egyetlen fájlt sem szüntetett meg és egyetlen fájl tartalmát sem írta át a benne álló import specifikátorokon túl.
5. A repóban nincs `.test.ts` végződésű fájl. A `git ls-files '*.test.ts'` kimenete üres.
6. Minden Vitest teszt fájl a megvalósítás mellett, azonos téma mappában áll, a megvalósítás fájlnevével plusz `.spec.ts` végződéssel. Három kivétel: az `apps/web/e2e/` fa (Playwright tesztek), a 6.2 pont 5. szabálya szerinti, megvalósítás nélküli regressziós teszt, és a `tools/wire-probe` a 6.8 pont szerint.
7. A `src/` közvetlen gyermekei minden csomagban kizárólag az `index.ts` fájl és mappák (téma vagy tárgykör), a 6.8 pont két kivételével. Ezt a következő parancs igazolja, aminek üres eredményt kell adnia:

   ```
   find packages apps tooling -path '*/src/*' -maxdepth 3 -type f -name '*.ts' \
     -not -name 'index.ts' -not -path 'apps/web/src/main.ts' -not -path '*/node_modules/*'
   ```

8. A keletkezett téma mappák halmaza névre és tartalomra pontosan megegyezik az 5. szekció táblázataiban felsorolt 45 téma mappával: nincs olyan téma mappa, ami az 5. szekcióban nem szerepel, nincs olyan felsorolt téma, aminek a mappája hiányzik, és egyetlen mappa tartalma sem tér el a felsorolttól. Az összevonás a téma mappák nevét és tartalmát nem változtatta meg, csak egy tárgykör mappát fűzött eléjük a 6.1 pont 8. szabálya szerint. Egyetlen téma mappa sem tartalmaz egyetlen fájlt pusztán azért, mert az a fájl máshova nem fért be; az 5. szekció minden egy fájlos témát külön megindokol (`agent-tool-id`, `descriptor`).
9. Egyetlen csomagban sincs `types/`, `utils/`, `helpers/`, `lib/`, `common/`, `shared/`, `internal/` vagy `config/` nevű alkönyvtár, a 6.8 pont szerinti `tools/wire-probe` kivételével. A tiltás a puszta nevekre vonatkozik: a `minimax-config/` és a `firecrawl-config/` téma mappa a 6.5 pont szerint megengedett.
10. A `packages/*` és az `apps/*` csomagokban a `src/` alatti mappaszerkezet legfeljebb kétszintű, és egyetlen téma mappában sincs további alkönyvtár. Kétszintű pontosan három csomag: a `core` és a `provider-capability`, a 6.1 pont 8. szabálya szerinti első ok (tárgykör-összevonás) miatt, és a `db`, ugyanennek a szabálynak a második oka miatt, ahol egy egyébként egy tárgykörű csomag három téma mappája (`workflow-graph`, `graph-snapshot`, `run-event`) vált tárgykör mappává, mert önmaga több fogalmat hordozott (PLAN-004 4. szekció); a maradék 16 termékcsomag lapos. Duplikált mappaszint (`<x>/<x>/`) sehol nincs, a 6.1 pont 9. szabálya szerint. A `tooling/*` csomagokra ugyanez érvényes, a `tools/wire-probe` a 6.8 pont szerint kivétel.
11. Minden csomag `src/index.ts` fájlja csak nevesített újraexportot tartalmaz. `export *` egyetlen barrelben sem szerepel.
12. Minden `packages/*` alatti könyvtárcsomag `package.json` `exports` mezője a `./src/index.ts` fájlra mutat. Az `apps/server`, az `apps/web`, a `tooling/scripts`, a `tooling/tsconfig` és a `tools/wire-probe` csomagnak nincs `exports` mezője, és nem is kap: ezeket egyetlen másik csomag sem importálja csomagnév szerint, ez a migráció előtti állapot, és nem változik.
13. A függőségi gráf aciklikus, és minden él szigorúan csökkenő rétegszám felé mutat, a 4. szekció "Rétegbesorolás, mind a 25 csomagra" táblázata szerint. Az eszköz csomagok (`eslint-config`, `tsconfig`, `scripts`, `wire-probe`) kizárólag `devDependencies` helyen jelenhetnek meg. Ezt az `import-x/no-cycle` szabály, a `package.json` `dependencies` mezők, és a `bun run check:graph` együtt igazolja. **Teljesül.** A korábban itt jelzett `engine` (L4) -> `agent` (L4) eltérést a user döntése zárta le (2026-08-27, 4. szekció): az `engine` L5 rétegre, a rá épülő `server` L6 rétegre került, a `bun run check:graph` nulla eltérést ad.
14. Egyetlen `tool-*` csomag `dependencies` mezőjében sem szerepel másik `tool-*` csomag vagy a `@easter-workflow-builder/agent-tool-bundle`.
15. A `@easter-workflow-builder/core` csomag `dependencies` mezője üres: nem szerepel benne `@easter-workflow-builder/minimax-client`, `@easter-workflow-builder/firecrawl-client`, `@easter-workflow-builder/provider-capability` vagy bármely `tool-*` csomag. A `core` `http-client` tárgyköre egyetlen konkrét szolgáltatás egyetlen végpontját sem ismeri.
16. A `@easter-workflow-builder/mcp-tool-kit` csomagban nincs egyetlen kész MCP eszköz definíció sem, és nem hivatkozik egyetlen `tool-*` csomagra sem.
17. A `@easter-workflow-builder/provider-capability` nem hivatkozik egyetlen konkrét provider csomagra sem, és `dependencies` mezője üres. A csomagon belül az `evidence` tárgykör nem importál az `evidence-sources` tárgykörből (az irány csak fordítva megengedett), és a hat képességleíró téma nem importál egymásba a `descriptor/` összefogó típuson kívül.
18. Egyetlen téma vagy tárgykör mappában sincs `CLAUDE.md`, a 6.7 pont szerint. Minden csomag gyökerében van `CLAUDE.md`. A `bun run docs:check` nulla kilépési kóddal fut a teljes repón, `26/26 kotelezo helyen van CLAUDE.md, 0 hianyzik` kimenettel (25 csomaggyökér plusz a repo gyökere).
19. Minden csomag szintű `CLAUDE.md` tartalmazza a SPEC-001 14. szekció mind a hat kötelező szekcióját, és a `## Fájlok` táblázata a téma mappákat sorolja fel, kétszintű csomagban a tárgykörrel együtt.
20. A `bun run check:casing` nulla kilépési kóddal fut, tehát a git indexben tárolt fájlnevek betűzése megegyezik a rájuk hivatkozó relatív importokéval.
21. A `bun run test` nulla kilépési kóddal fut, és a lefedettség mind a négy metrikán 100 százalék.
22. A `vitest.config.ts` `coverage.exclude` listája nem bővült egyetlen sorral sem a migráció során. Az összehasonlítás alapja a migráció előtti fájl.
23. A `bun run typecheck`, a `bun run lint` és a `bun run format:check` nulla kilépési kóddal fut a teljes workspace-en, mind a 25 csomagra.
24. A `bun run build` nulla kilépési kóddal fut.
25. A `bun install --frozen-lockfile` hibátlanul lefut, és a `bun.lock` egyetlen fájl a gyökérben.
26. Egyetlen csomag `package.json` fájljában sincs literál verzió a `typescript`, a `vitest` és a `@types/node` csomagra: ahol szerepelnek, `catalog:` hivatkozással állnak. Hat placeholder csomagnak (`server`, `agent`, `db`, `engine`, `logger`, `protocol`) egyáltalán nincs `devDependencies` mezője, mert nincs sem tesztje, sem saját `tsc` futása a `turbo` taskon kívül; ez a migráció előtti állapot, és nem változott.
27. A `MINIMAX_CODING_PLAN_API_KEY` név nem fordul elő sem a kódban, sem a `turbo.json` fájlban, sem egyetlen `CLAUDE.md` fájlban. A migráció kiindulópontján hét helyen fordul elő: `environment-variable-name.ts`, `index.ts`, `create-image-understanding-tool.ts` (két sor), `create-image-understanding-tool.test.ts` (három sor), `packages/agent-tools/CLAUDE.md:38` és `turbo.json:17`. Az `agent-tools` csomagok által használt környezeti változók száma öt, és mind az öt szerepel a `turbo.json` `globalPassThroughEnv` listájában. Ez a SPEC-001 55. kritériumát váltja ki.
28. A `resolveMiniMaxConfig` függvénynek nincs változónév paramétere, és a `@easter-workflow-builder/tool-minimax-understand-image` valamint a `@easter-workflow-builder/tool-minimax-web-search` ugyanabból a környezeti változóból dolgozik.
29. A `docs/research/2026-08-26-agent-tools.md` 4. szekciója lezárt állapotú: rögzíti a saját mérés eredményét, a user döntését, és azt, hogy a külön változó megszűnt. A mérési táblázat sorai változatlanok.
30. Minden `Fact` mező `state`, `value` és `evidence` értéke bitre azonos a migráció előttivel. Ezt egy normalizált JSON összehasonlítás igazolja a migráció előtti és utáni `providerRegistry` fán.
31. A `provider-registry` csomag bejáró regressziós tesztje (`provider-registry.spec.ts`) változatlan invariánsokkal fut le: minden `Fact` pontosan az egyik ágon áll, a `known` ág nem üres bizonyítéklistát hordoz, az `unknown` ág indoklást és blokkoló mérést, egyetlen `purpose` vagy `reason` string sem tartalmaz `M-` mintájú azonosítót, és minden hivatkozott `MeasurementId` feloldható `docs/` horgonyra.
32. Az `@easter-workflow-builder/firecrawl-client` `scrape-call` témájában álló `scrapePage` `Outcome<unknown>` típussal tér vissza, és a `PATH_SCRAPE` konstans nem szerepel a csomag `src/index.ts` barreljében.
33. Egyetlen `tool-*` csomag forrásában sem szerepel a `FetchFunction` vagy az `EnvironmentReader` típus `@easter-workflow-builder/core` csomagból importálva: mindhárom tool a hívott kliens csomag barreljéből veszi, a 6.6 pont 7. szabálya szerint, és a két kliens csomag barrelje tartalmazza a szabály táblázatában felsorolt re-exportokat. A `@easter-workflow-builder/core` a három tool `dependencies` mezőjében szerepel, de kizárólag az `isOkOutcome` guard, illetve a `tool-minimax-understand-image` esetén a `resolveImageDataUrl` és a `ReadFileFunction` miatt.
34. A `turbo run typecheck` kétszer futtatva másodszorra teljes cache találatot ad, és egy `@easter-workflow-builder/core` fájl módosítása után csak a `core` csomagtól függő csomagok taskja fut újra.
35. A `.github/workflows/ci.yml`, a `.github/actions/setup/action.yml` és a `tooling/tsconfig/*.json` fájlok **nem** változtak a migráció során. A `tooling/scripts/*.sh` fájlokban pontosan egy, előre dokumentált változás történt: egy új wrapper a gráf ellenőrzőhöz (T-002-24). A `casing.sh` **változatlan**, mert a `tooling/scripts/src/casing/` mappa a téma konvenció szerint helyes és marad. Az összehasonlítás alapja a migráció előtti fájl.
36. A gyökér `CLAUDE.md` hivatkozik erre a specre a mappa konvenció és a csomagnév konvenció forrásaként, és nem ismétli meg a 6. szekció tartalmát.
37. A `packages/result`, a `packages/env-reader`, a `packages/http-client`, a `packages/image-source`, a `packages/evidence`, a `packages/evidence-sources` és a `packages/agent-tool-id` könyvtár nem létezik, és a repóban nincs rájuk mutató import vagy `dependencies` kulcs. Nem maradt átirányító barrel csomag sem.
38. A `packages/tool-web-search`, a `packages/tool-understand-image` és a `packages/tool-web-fetch` könyvtár nem létezik; a három csomag neve `@easter-workflow-builder/tool-minimax-web-search`, `@easter-workflow-builder/tool-minimax-understand-image` és `@easter-workflow-builder/tool-firecrawl-web-fetch`. Az általuk kiadott MCP eszköznevek (`web_search`, `understand_image`, `web_fetch`), a gyártófüggvények neve és a téma mappák neve **változatlan**, a 6.9 szekció utolsó bekezdése szerint.
39. Minden olyan csomag neve, ami egy konkrét külső szolgáltatóhoz köthető, megnevezi a szolgáltatót, a 6.9 szekció táblázata szerint. Egyetlen csomagnév sem hagyja el a szolgáltatót ott, ahol egy második implementáció ütközne vele.
40. Az összevonás nem változtatta meg a viselkedést: a `bun run test` ugyanannyi teszt fájlt (52) és ugyanannyi tesztet (367) futtat le, mint az összevonás előtt, mind a négy lefedettségi metrikán 100 százalékkal, és a `vitest.config.ts` `coverage.exclude` listája változatlan.
41. A `@easter-workflow-builder/agent-tool-bundle` **önálló csomag**, nem olvadt be a `@easter-workflow-builder/mcp-tool-kit` csomagba, és az `mcp-tool-kit` `dependencies` mezője üres. Az ok a 4. szekcióban dokumentált kör, futtatott ellenőrzővel bizonyítva. **Lezárva:** a user végleges döntése (2026-08-27) is ezt tartja meg, tudatos döntésként, nem csak a kör kényszereként.

## 12. Kapcsolódó dokumentumok

- [`SPEC-001-monorepo-toolchain.md`](SPEC-001-monorepo-toolchain.md): a monorepo, a toolchain és a minőségi kapuk
- [`SPEC-000-provider-wire-measurement.md`](SPEC-000-provider-wire-measurement.md): a provider drótszintű mérés, ami a leírók tartalmát adja
- [`../plan/PLAN-002-csomag-architektura.md`](../plan/PLAN-002-csomag-architektura.md): a végrehajtási terv
- [`../research/2026-08-26-agent-tools.md`](../research/2026-08-26-agent-tools.md): a MiniMax és a Firecrawl végpontok saját mérése
