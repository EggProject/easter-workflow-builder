# PLAN-002: Csomag architektúra és mappa konvenció, végrehajtás

|              |                                                                                      |
| ------------ | ------------------------------------------------------------------------------------ |
| Specifikáció | [`../spec/SPEC-002-csomag-architektura.md`](../spec/SPEC-002-csomag-architektura.md) |
| Előzmény     | [`../spec/SPEC-001-monorepo-toolchain.md`](../spec/SPEC-001-monorepo-toolchain.md)   |
| Branch       | `feat/spec-002-csomag-architektura`, a `main` védett                                 |
| Lépések      | 29, kilenc fázisban                                                                  |

---

## A hét minőségi kapu

Minden lépés végén, kivétel nélkül, mind a hét parancsnak nulla kilépési kóddal kell futnia:

| #   | Parancs                | Mit véd                                            |
| --- | ---------------------- | -------------------------------------------------- |
| 1   | `bun run format:check` | Prettier formázás, `printWidth: 120`               |
| 2   | `bun run typecheck`    | TypeScript 6.0.3, teljes workspace                 |
| 3   | `bun run lint`         | ESLint 10, típusinformációval                      |
| 4   | `bun run docs:check`   | `CLAUDE.md` minden kötelező helyen                 |
| 5   | `bun run check:casing` | git index fájlnevek és relatív importok betűzése   |
| 6   | `bun run test`         | Vitest, 100 százalékos lefedettség, kizárás nélkül |
| 7   | `bun run build`        | Vite build                                         |

A `bun run test:e2e` nyolcadik kapu, de ez a migráció az `apps/web` csomagot nem érinti, ezért a fázisonkénti futtatása nem kötelező. A záró fázisban egyszer le kell futnia.

**Ez a lista a "zöld" definíciója minden lépés elfogadási kritériumában.** Ahol egy lépés elfogadási kritériuma azt mondja, hogy "mind a hét kapu zöld", ott ezt a hét parancsot kell érteni.

**Történeti állapot.** Ez a felsorolás a SPEC-002 végrehajtásakor érvényes kapukészletet rögzíti; a `check:graph` ekkor még nem volt kapu (az F7 fázisban került be), a `check:db-drift` pedig csak a SPEC-003-mal jött létre. A jelenlegi, mérvadó kapulista a `.claude/CLAUDE.md` 8. szekciója, ma kilenc parancs.

**Commit lépésenként.** Minden lépés önálló, zöld commit. Kézi fájltörlés és újralétrehozás helyett `git mv`, hogy a git az átnevezést átnevezésként lássa, és a `check:casing` kapu ne bukjon el egy indexben maradt régi betűzésen.

**Pusholni a végrehajtó agent nem tud.** Minden fázis végén szólni kell a usernek, hogy pusholjon, és megadni a branch nevét.

---

## F0 fázis: kiindulás

### T-002-1

**Leírás.** Alapállapot rögzítése méréssel, mielőtt bármi mozdul. A SPEC-002 2. szekció táblázatának minden számát újra kell mérni, mert a `packages/typeguards` csomagon a spec írásával párhuzamosan egy másik agent dolgozott, és a számok azóta változhattak. A mért értékeket a SPEC-002 2. szekciójába kell visszavezetni, ha eltérnek.

Mérendő: `git ls-files packages/agent-tools/src | grep -v CLAUDE.md | wc -l`, ugyanez a `providers` csomagra, `git ls-files '*.test.ts' | wc -l`, `git ls-files '*.spec.ts' | wc -l`, `git ls-files '*/package.json' | wc -l`, és mind a hét kapu kilépési kódja.

**Függőség.** Nincs, de **koordinációt igényel**: a `packages/typeguards` csomagon egy másik agent dolgozott. Ez a lépés csak akkor indul, ha az a munka lezárult és commitolva van. Ha a `docs:check` piros, ebben a lépésben kell zöldre állítani.

**Model.** `sonnet`

**Elfogadási kritérium.** Mind a hét kapu zöld, és a SPEC-002 2. szekciójának minden száma megegyezik a most mért értékkel. A `bun run docs:check` kimenete `N/N kotelezo helyen van CLAUDE.md, 0 hianyzik` alakú.

### T-002-2

**Leírás.** A gyökér `CLAUDE.md` kiegészítése egy rövid, hivatkozó bekezdéssel a mappa konvencióról, a SPEC-002 6. szekciójára mutató relatív linkkel, a tartalom megismétlése nélkül.

**Függőség.** T-002-1

**Model.** `sonnet`

**Elfogadási kritérium.** A gyökér `CLAUDE.md` tartalmaz linket a `docs/spec/SPEC-002-csomag-architektura.md` fájlra, és nem ismétli meg a 6. szekció szabályait. Mind a hét kapu zöld.

---

## F1 fázis: konvenció, kockázatmentes rész

### T-002-3

**Leírás.** A T-002-1 lépésben mért összes `.test.ts` fájl (a mérés pillanatában 33 darab) átnevezése `.spec.ts` alakra, `git mv` paranccsal, változatlan tartalommal.

**Függőség.** T-002-2

**Model.** `sonnet`

**Elfogadási kritérium.** `git ls-files '*.test.ts'` üres kimenetet ad. A `bun run test` ugyanannyi tesztet futtat le, mint előtte, és a lefedettség változatlanul 100 százalék. A `vitest.config.ts`, az `eslint.config.ts` és a `tooling/eslint-config/src/test-files.ts` **nem** módosult. Mind a hét kapu zöld.

### T-002-4

**Leírás.** A `tooling/eslint-config` és a `tooling/scripts` csomag `src/` fája a SPEC-002 6. szekció téma konvenciójára állítva.

A `tooling/eslint-config/src/{base,react,relaxed,test-files}.ts` négy fájlja **egy** témát alkot (`eslint-preset`): mind a négy ugyanannak a flat confignak a rétege, a `test-files.ts` pedig a másik három által használt fájlmintákat adja. A négy fájl az `eslint-preset/` mappába kerül, a téma mappa a SPEC-002 6.7 pontja szerint nem kap saját `CLAUDE.md`-t, és az `src/index.ts` barrel négy importja ennek megfelelően frissül.

A `tooling/scripts/src/casing/` mappa **változatlan marad**. A téma konvenció mércéjével már ma helyes: a három fájl és a spec ugyanarról szól, a fájlnevek betűzésének ellenőrzéséről. Ezért a `tooling/scripts/casing.sh` fájlban álló `check-casing.ts` útvonalhoz **nem** kell hozzányúlni, és a SPEC-002 35. kritériuma szerint a `tooling/scripts/*.sh` fájlokban ebben a lépésben nincs változás.

Ami mozdul a `tooling/scripts` csomagban: a `tooling/scripts/src/turbo-e2e-coverage-outputs.spec.ts` a `src/` tetejéről a `turbo-e2e-coverage-outputs/` téma mappába kerül. Ez **megvalósítás fájl nélküli** regressziós teszt, tehát a SPEC-002 6.2 pont 5. szabálya vonatkozik rá: a mappa neve annak a dolognak a neve, amit őriz, a mappában egyetlen fájl áll, és a csomag gyökerének `CLAUDE.md`-je jelöli a `## Fájlok` táblázatban, hogy nincs megvalósítás párja.

**Függőség.** T-002-3

**Model.** `sonnet`

**Elfogadási kritérium.** A `tooling/eslint-config/src` közvetlen gyermekei kizárólag az `index.ts` és az `eslint-preset/` mappa. A `tooling/scripts/src` közvetlen gyermekei kizárólag az `index.ts`, a `casing/` és a `turbo-e2e-coverage-outputs/` mappa. Egyik új mappa sem kapott saját `CLAUDE.md`-t, a `tooling/eslint-config/CLAUDE.md` és a `tooling/scripts/CLAUDE.md` `## Fájlok` táblázata sorolja fel őket. A `tooling/scripts/casing.sh` a `git diff` szerint változatlan. A `bun run check:casing` ugyanazt a `0 eltérés` üzenetet adja, mint előtte. Mind a hét kapu zöld.

### T-002-5

**Leírás.** A `@easter-workflow-builder/` névtér bevezetése mind a 16 meglévő workspace csomagra: a `package.json` `name` mező átírása, minden hivatkozó `dependencies` és `devDependencies` kulcs átírása, és minden import specifikátor frissítése a forrásban.

A csomagnevek változása miatt a `bun.lock` újragenerálódik. A regenerált lockfile **ugyanabba a commitba** kerül, mint a `package.json` változások, különben a `bun install --frozen-lockfile` és vele a CI elbukna.

**Függőség.** T-002-4

**Model.** `sonnet`

**Elfogadási kritérium.** Minden `package.json` `name` mezője `@easter-workflow-builder/` prefixszel kezdődik. A `bun.lock` a commit része, és a `bun install --frozen-lockfile` hibátlanul lefut. `grep -rn "from 'providers'\|from 'typeguards'\|from 'eslint-config'"` a forrásfájlokban nulla találatot ad. Mind a hét kapu zöld.

---

## F2 fázis: a `providers` csomag szétbontása

Minden lépés ugyanazt a mintát követi: az új csomag létrejön, a `packages/providers` a kikerült fájlok helyett az új csomagra hivatkozik `workspace:*` függőséggel, és a `packages/providers/src` alól az érintett mappa törlődik. Így a lépés végén a `providerRegistry` fa változatlanul összeáll, és a kapuk zöldek.

### T-002-6

**Leírás.** `@easter-workflow-builder/evidence` csomag létrehozása a `packages/providers/src/evidence/` alatti 8 fájlból (SPEC-002 5.2), és a `packages/providers` átállítása rá.

**Függőség.** T-002-5

**Model.** `sonnet`

**Elfogadási kritérium.** `packages/evidence/` létezik `package.json`, `tsconfig.json`, `src/index.ts` és `CLAUDE.md` fájllal, két téma mappával (`evidence-reference`, `fact`), mindkettőben `CLAUDE.md`. A `packages/providers/src/evidence/` nem létezik. A `packages/providers/package.json` `dependencies` mezőjében szerepel az `@easter-workflow-builder/evidence": "workspace:*"`. Mind a hét kapu zöld, a lefedettség 100 százalék, a `vitest.config.ts` `coverage.exclude` listája változatlan.

### T-002-7

**Leírás.** `@easter-workflow-builder/evidence-sources` csomag létrehozása a `packages/providers/src/references/` alatti 3 fájlból (SPEC-002 5.3), és a `packages/providers` átállítása rá.

**Függőség.** T-002-6

**Model.** `sonnet`

**Elfogadási kritérium.** `packages/evidence-sources/` létezik egy téma mappával (`measurement-document`), benne mind a három fájllal. A `packages/providers/src/references/` nem létezik. A `measurementDocument` leképezés minden bejegyzése változatlan. Mind a hét kapu zöld.

### T-002-8

**Leírás.** `@easter-workflow-builder/agent-tool-id` és `@easter-workflow-builder/provider-capability` csomag létrehozása a `packages/providers/src/capability/` alatti 22 fájlból (SPEC-002 5.4 és 5.5), és a `packages/providers` valamint a `packages/agent-tools` átállítása rájuk. Az `agent-tools` mostantól az `@easter-workflow-builder/agent-tool-id` csomagból veszi az `AgentToolId` típust, nem a `providers` barrelből.

**Függőség.** T-002-7

**Model.** `sonnet`

**Elfogadási kritérium.** `packages/agent-tool-id/` egyetlen téma mappával, `packages/provider-capability/` hat téma mappával (`descriptor`, `model-catalog`, `environment`, `tool-support`, `limits`, `request-shaping`) létezik, a SPEC-002 5.5 táblázata szerinti fájlelosztással. Egyik `provider-capability` fájlhoz sincs `.spec.ts`, mert mind típus-only. A `packages/providers/src/capability/` nem létezik. A `packages/agent-tools` forrásában nincs `from '@easter-workflow-builder/providers'` import. Mind a hét kapu zöld.

### T-002-9

**Leírás.** `@easter-workflow-builder/provider-minimax` és `@easter-workflow-builder/provider-claude-subscription` csomag létrehozása a `packages/providers/src/minimax/` és `packages/providers/src/claude-subscription/` alatti 16 plusz 16 fájlból (SPEC-002 5.6), és a `packages/providers/src/registry.ts` átállítása rájuk.

**Függőség.** T-002-8

**Model.** `sonnet`

**Elfogadási kritérium.** Mindkét csomag hat téma mappával létezik, ugyanazokkal a nevekkel, mint a `provider-capability` csomag, a SPEC-002 5.6 táblázata szerinti fájlelosztással. A `packages/providers/src` alatt már csak az `index.ts`, a `registry.ts` és a `registry.spec.ts` áll. A `registry.spec.ts` bejáró tesztje változatlan invariánsokkal zöld. Mind a hét kapu zöld.

### T-002-10

**Leírás.** `@easter-workflow-builder/provider-registry` csomag létrehozása a `registry.ts` és `registry.spec.ts` fájlból, `provider-registry` néven (SPEC-002 5.7), a `packages/providers` könyvtár teljes törlése, és a migráció tartalmi azonosságának igazolása: a szétbontás előtti és utáni `providerRegistry` fa normalizált JSON alakja bitre azonos.

**Függőség.** T-002-9

**Model.** `opus`, mert a bizonyítás módját ki kell találni: a szétbontás előtti állapot már csak a git történetből érhető el, és a normalizált szerializálás sorrendfüggetlenségét is meg kell oldani.

**Elfogadási kritérium.** A `packages/providers` könyvtár nem létezik. A `packages/provider-registry/src/provider-registry/` tartalmazza a megvalósítást és a `.spec.ts` fájlt. A normalizált JSON összehasonlítás eredménye üres diff, és a diff futtatás módja dokumentálva van a `docs/research/` alatt. Mind a hét kapu zöld, a lefedettség 100 százalék.

---

## F3 fázis: az `agent-tools` alaprétegei

### T-002-11

**Leírás.** `@easter-workflow-builder/result` csomag létrehozása az `agent-tools/src/result/` alatti `outcome.ts`, `is-ok-outcome.ts` és `is-ok-outcome.spec.ts` fájlból (SPEC-002 5.1), és az `agent-tools` átállítása rá.

**Függőség.** T-002-10

**Model.** `sonnet`

**Elfogadási kritérium.** `packages/result/` egy téma mappával (`outcome`) létezik, benne mind a három fájllal. Az `agent-tools/src/result/` alatt már csak a `tool-call-result.ts`, a `text-tool-result.*` és az `error-tool-result.*` áll. Mind a hét kapu zöld.

### T-002-12

**Leírás.** `@easter-workflow-builder/mcp-tool-kit` csomag létrehozása az `agent-tools/src/result/` maradék öt fájljából (SPEC-002 5.13), és az `agent-tools` átállítása rá. Az `agent-tools/src/result/` könyvtár megszűnik.

**Függőség.** T-002-11

**Model.** `sonnet`

**Elfogadási kritérium.** `packages/mcp-tool-kit/` egy téma mappával (`tool-call-result`) létezik, benne mind az öt fájllal. Az `agent-tools/src/result/` nem létezik. A `mcp-tool-kit` csomag `dependencies` mezője üres a workspace csomagok tekintetében. Mind a hét kapu zöld.

### T-002-13

**Leírás.** `@easter-workflow-builder/http-client` és `@easter-workflow-builder/env-reader` csomag létrehozása az `agent-tools/src/http/` alatti 8 fájlból és az `agent-tools/src/config/` alatti 5 generikus fájlból (SPEC-002 5.8 és 5.9), és az `agent-tools` átállítása rájuk. Az `agent-tools/src/http/` könyvtár megszűnik, a `config/` megmarad a szolgáltatás specifikus fájlokkal.

**Függőség.** T-002-12

**Model.** `sonnet`

**Elfogadási kritérium.** `packages/http-client/` két téma mappával (`request`, `error-description`), `packages/env-reader/` egy téma mappával (`environment-reader`) létezik, a SPEC-002 5.8 és 5.9 táblázata szerinti fájlelosztással. Az `agent-tools/src/http/` nem létezik. Egyik új csomag `dependencies` mezőjében sem szerepel a másik. Mind a hét kapu zöld.

### T-002-14

**Leírás.** `@easter-workflow-builder/image-source` csomag létrehozása az `agent-tools/src/image/` alatti 8 fájlból (SPEC-002 5.12), és az `agent-tools` átállítása rá.

**Függőség.** T-002-13

**Model.** `sonnet`

**Elfogadási kritérium.** `packages/image-source/` két téma mappával (`media-type`, `data-url`) létezik, a SPEC-002 5.12 táblázata szerinti fájlelosztással. Az `agent-tools/src/image/` nem létezik. A csomag `dependencies` mezője `@easter-workflow-builder/http-client` és `@easter-workflow-builder/result`, más workspace csomag nem. Mind a hét kapu zöld.

---

## F4 fázis: a kliens csomagok

### T-002-15

**Leírás.** `@easter-workflow-builder/minimax-client` csomag létrehozása az `agent-tools/src/minimax/` alatti 14 fájlból, az `agent-tools/src/config/` MiniMax specifikus 3 fájljából, valamint az `environment-variable-name.ts` és a `default-config-value.ts` MiniMax feléből (SPEC-002 5.10), és az `agent-tools` átállítása rá. A `resolveMiniMaxConfig` **változatlan szignatúrával**, az `apiKeyVariableName` paraméterrel költözik: a paraméter megszüntetése külön lépés (T-002-17).

**Függőség.** T-002-14

**Model.** `sonnet`

**Elfogadási kritérium.** `packages/minimax-client/` létezik, benne öt téma mappa: `minimax-config`, `envelope`, `call-minimax`, `search`, `vlm`, a SPEC-002 5.10 táblázata szerinti fájlelosztással, összesen 19 fájllal. Az `agent-tools/src/minimax/` nem létezik. Mind a hét kapu zöld.

### T-002-16

**Leírás.** `@easter-workflow-builder/firecrawl-client` csomag létrehozása az `agent-tools/src/firecrawl/` alatti 6 fájlból, az `agent-tools/src/config/` Firecrawl specifikus 3 fájljából, valamint a kettéváló két konstans fájl Firecrawl feléből (SPEC-002 5.11). Ezen felül létrejön az ÚJ `scrape-page.ts` fájl a `scrape-call` témában: a `create-web-fetch-tool.ts` fájlban álló `postJson` hívás átkerül ide, `Promise<Outcome<unknown>>` szerződéssel, és a `PATH_SCRAPE` konstans kikerül a barrelből. Az `agent-tools/src/config/` és az `agent-tools/src/firecrawl/` könyvtár megszűnik.

**Függőség.** T-002-15

**Model.** `sonnet`

**Elfogadási kritérium.** `packages/firecrawl-client/` három téma mappával létezik (`firecrawl-config`, `scrape-call`, `scrape-document`), a SPEC-002 5.11 táblázata szerinti fájlelosztással, és a `scrape-call` mappában áll a `scrape-page.ts` és a `scrape-page.spec.ts`. A `scrapePage` mindkét ágát (sikeres hívás, elérhetetlen szolgáltatás) befecskendezett `fetch` függvénnyel fedi teszt, élő hálózat nélkül. A `PATH_SCRAPE` nem szerepel a `src/index.ts` barrelben. A `create-web-fetch-tool.spec.ts` elvárt hibaüzenetei **változatlanok**. Az `agent-tools/src/config/` és `agent-tools/src/firecrawl/` nem létezik. Mind a hét kapu zöld, a lefedettség 100 százalék.

### T-002-17

**Leírás.** A `MINIMAX_CODING_PLAN_API_KEY` környezeti változó megszüntetése (SPEC-002 5.10). A név a migráció kiindulópontján hét helyen fordul elő, mindegyiket kezelni kell:

| Hely                                                 | Mit                                                   |
| ---------------------------------------------------- | ----------------------------------------------------- |
| `environment-variable-name.ts`                       | az `ENV_MINIMAX_CODING_PLAN_API_KEY` konstans törlése |
| `packages/agent-tools/src/index.ts`                  | a barrel export törlése                               |
| `create-image-understanding-tool.ts`, két sor        | átállítás az `ENV_MINIMAX_API_KEY` változóra          |
| `create-image-understanding-tool.spec.ts`, három sor | fixture kulcs, bemenet és elvárt hibaüzenet átírása   |
| `packages/agent-tools/CLAUDE.md:47`                  | az env táblázat sorának törlése                       |
| `turbo.json:17`                                      | a `globalPassThroughEnv` lista sorának törlése        |

Ezen felül: a `resolveMiniMaxConfig` `apiKeyVariableName` paraméterének törlése, és a `docs/research/2026-08-26-agent-tools.md` 4. szekciójának lezárása.

**Figyelem.** A `packages/agent-tools/CLAUDE.md` fájl csak a T-002-21 lépésben törlődik a csomaggal együtt, ezért ha ez a lépés nem javítja, a saját elfogadási kritériuma bukik el.

**Függőség.** T-002-16

**Model.** `sonnet`

**Elfogadási kritérium.** `grep -rn "MINIMAX_CODING_PLAN_API_KEY"` a `docs/` fán kívül nulla találatot ad, és a `docs/` fán belül csak lezárt, historikus kontextusban fordul elő. A `resolveMiniMaxConfig` nulla paraméterrel hívható a környezeti olvasón kívül. A hiányzó kulcs hibaága továbbra is fedve van, és a hibaüzenet a `MINIMAX_API_KEY` változót nevezi meg. A `turbo.json` `globalPassThroughEnv` listája öt `MINIMAX_`/`FIRECRAWL_` változót tartalmaz. Mind a hét kapu zöld.

---

## F5 fázis: a tool csomagok és az összeállító

### T-002-18

**Leírás.** `@easter-workflow-builder/tool-minimax-web-search` csomag létrehozása (SPEC-002 5.14): a `create-web-search-tool.ts` és `.spec.ts` költöztetése, plusz az ÚJ, típus-only `web-search-tool-dependencies.ts` fájl, ami csak a `fetchFunction` és az `environment` mezőt tartalmazza. Mindhárom fájl egy téma mappában áll (`web-search-tool`). Az `agent-tools/src/tools/create-web-search-tool.*` fájlok megszűnnek, a `create-agent-tool.ts` az új csomagból importál.

**A `.spec.ts` tartalmi igazítása kötelező** (SPEC-002 5. szekció, "Az importok átírása kötelező"): a `create-web-search-tool.spec.ts` ma importálja a `../image/read-file-function.ts` típust a közös függőség objektum miatt. Az új, szűk interfész mellett ez a típus nem kell, tehát az importot **törölni** kell, nem áthelyezni. A bent hagyott import a `noUnusedLocals` beállítás miatt fordítási hiba.

**Függőség.** T-002-17

**Model.** `sonnet`

**Elfogadási kritérium.** `packages/tool-minimax-web-search/` egy téma mappával (`web-search-tool`) létezik, benne három fájllal. A csomag `dependencies` mezőjében nem szerepel `@easter-workflow-builder/http-client`, `@easter-workflow-builder/firecrawl-client`, `@easter-workflow-builder/image-source`, másik `tool-*` csomag vagy `@easter-workflow-builder/agent-tool-bundle`. A tool minden hibaága változatlan üzenettel, `isError: true` jelzéssel tér vissza. Mind a hét kapu zöld.

### T-002-19

**Leírás.** `@easter-workflow-builder/tool-firecrawl-web-fetch` csomag létrehozása (SPEC-002 5.15), ugyanezzel a mintával, a `scrape-call` téma `scrapePage` függvényét használva, egy téma mappával (`web-fetch-tool`). A `create-web-fetch-tool.spec.ts` fájlból ugyanúgy törlendő a `ReadFileFunction` import, mint a T-002-18 lépésben.

**Függőség.** T-002-18

**Model.** `sonnet`

**Elfogadási kritérium.** `packages/tool-firecrawl-web-fetch/` egy téma mappával (`web-fetch-tool`) létezik, benne három fájllal. A csomag `dependencies` mezőjében **nem** szerepel a `@easter-workflow-builder/http-client`. A tool hibaágai és üzenetei változatlanok. Mind a hét kapu zöld.

### T-002-20

**Leírás.** `@easter-workflow-builder/tool-minimax-understand-image` csomag létrehozása (SPEC-002 5.16), az `understand-image-tool-dependencies.ts` típus-only fájllal, ami mindhárom függőség mezőt tartalmazza. Mindhárom fájl egy téma mappában áll (`understand-image-tool`), a mappa neve az eszköz neve, nem a gyártófüggvényé. Az `agent-tools/src/tools/` alatt már csak az összeállító fájlok maradnak.

**Függőség.** T-002-19

**Model.** `sonnet`

**Elfogadási kritérium.** `packages/tool-minimax-understand-image/` egy téma mappával (`understand-image-tool`) létezik, benne három fájllal. A tool a `resolveMiniMaxConfig` paraméter nélküli alakját hívja. Minden hibaág (üres bemenet, hiányzó kulcs, feloldhatatlan kép, elérhetetlen szolgáltatás, ismeretlen válasz alak) fedve van. Mind a hét kapu zöld.

### T-002-21

**Leírás.** `@easter-workflow-builder/agent-tool-bundle` csomag létrehozása az `agent-tools/src/tools/` maradék 11 fájljából (SPEC-002 5.17), a `createAgentTool` switch átkötése a három tool csomagra és a szűk függőség interfészekre, majd a `packages/agent-tools` könyvtár teljes törlése.

**Függőség.** T-002-20

**Model.** `opus`, mert a közös `AgentToolDependencies` objektum szétosztása három, egymástól eltérő szűk interfészre a `exactOptionalPropertyTypes` és a `strictTypeChecked` beállítás mellett nem mechanikus, és a `createAgentTool` teljes switch visszatérési uniója is átalakul.

**Elfogadási kritérium.** A `packages/agent-tools` könyvtár nem létezik. A `packages/agent-tool-bundle/` négy téma mappával (`tool-reference`, `tool-dependencies`, `tool-factory`, `tool-bundle`) létezik, a SPEC-002 5.17 táblázata szerinti fájlelosztással. A `createAgentToolBundle` ismétlődő azonosítóra nem duplikálja az eszközt, ezt teszt igazolja. Egyetlen `as` és egyetlen `any` sem került a kódba. Mind a hét kapu zöld, a lefedettség 100 százalék, a `vitest.config.ts` `coverage.exclude` listája a migráció eleje óta változatlan.

---

## F6 fázis: a többi csomag átvizsgálása

### T-002-22

**Leírás.** A placeholder csomagok (`core`, `db`, `engine`, `agent`, `protocol`, `logger`, `ui`, `server`, `web`) `CLAUDE.md` fájljainak frissítése: a mappa konvenció rögzítése hivatkozásként, a függőségi irány tábla igazítása a SPEC-002 4. szekciójához, és annak kimondása, hogy az első valódi export felvételekor a `IS_<CSOMAG>_PLACEHOLDER` konstans törlendő.

**Függőség.** T-002-21

**Model.** `sonnet`

**Elfogadási kritérium.** Mind a kilenc csomag `CLAUDE.md` fájlja tartalmazza a SPEC-002 relatív linkjét és a frissített függőségi irány táblát. Egyetlen `src/index.ts` sem változott. Mind a hét kapu zöld.

### T-002-23

**Leírás.** A `@easter-workflow-builder/typeguards` csomag **17 guard mappája helyes és marad**, mert ott egy adott typeguard típus maga egy téma (SPEC-002 6.1). Ez a lépés nem szervezi át őket, és nem nevez át egyetlen guard mappát sem.

Két fájl áll a `src/` tetején, ez a kettő mozdul:

- `packages/typeguards/src/types.ts` két, egymással nem összefüggő típust exportál, tehát a témái szerint kettéválik. A `Constructor<T>` az `is-constructor` téma fogalma (az `is-constructor.ts` és az `is-instanceof.ts` használja), ezért `is-constructor/constructor.ts` lesz. A `StringResolver<T>` az `is-string-resolver` témáé, ezért `is-string-resolver/string-resolver.ts` lesz. A három hivatkozó import (`is-constructor.ts`, `is-instanceof.ts`, `is-string-resolver.ts`) ennek megfelelően frissül. Egyik típus sincs a barrelben, tehát a publikus felület nem változik.
- `packages/typeguards/src/test-constants.ts` a 15 spec fájl megosztott fixture-je, és egyetlen guard témájához sem tartozik, ezért saját téma mappát kap (`test-constants/`), saját `CLAUDE.md` nélkül (SPEC-002 6.7 pont). A `packages/typeguards/CLAUDE.md` `## Fájlok` táblázata jelöli, hogy megosztott teszt fixture, és nincs megvalósítás párja. A neve nem `.spec.ts`, tehát a coverage hatókörében van, és a lefedettségét a rá hivatkozó `.spec.ts` fájloknak kell adniuk. A 15 `../test-constants` import mindegyike frissül.

**Függőség.** T-002-22, és a `packages/typeguards` csomagon dolgozó párhuzamos munka lezárása.

**Model.** `sonnet`

**Elfogadási kritérium.** A `packages/typeguards/src` közvetlen gyermekei kizárólag az `index.ts` és téma mappák, tehát sem a `types.ts`, sem a `test-constants.ts` nem áll a `src/` tetején. A 17 guard mappa **nem szerveződött át**: egyetlen guard fájl sem került másik mappába, és egyetlen guard mappa neve sem változott; a `git diff --name-status` szerint az `is-constructor/` és az `is-string-resolver/` mappa egy-egy új típusfájllal bővült, a többi guard mappában csak import sor módosult. A barrelben nincs `IS_TYPEGUARDS_PLACEHOLDER` konstans. Minden futásidejű sort tartalmazó guardhoz tartozik `.spec.ts`. Mind a hét kapu zöld, a lefedettség 100 százalék.

---

## F7 fázis: zárás

### T-002-24

**Leírás.** Függőségi gráf ellenőrző készítése a `tooling/scripts` alá: a workspace `package.json` fájlok `dependencies` mezőiből felépíti a gráfot, kimutatja hogy aciklikus, és ellenőrzi, hogy minden él a SPEC-002 4. szekció rétegábrája szerinti irányba mutat. Token takarékos bash wrapper a `tooling/scripts` alatt, a SPEC-001 11. szekció három blokkos kimeneti szerződésével, plusz gyökér npm script.

**Függőség.** T-002-23

**Model.** `opus`, mert a rétegzés gépi ellenőrzéséhez ki kell találni, hogyan tárolódik a réteg-hozzárendelés úgy, hogy egy új csomag felvételekor ne lehessen elfelejteni.

**Elfogadási kritérium.** A script a jelenlegi gráfra nulla kilépési kóddal fut, egy szándékosan bevezetett kör vagy visszafelé mutató él esetén nem nulla kilépési kóddal, és a hibát egy sorban nevezi meg. A hozzá tartozó Vitest regressziós teszt a `tooling/scripts` projektben fut. Mind a hét kapu zöld.

### T-002-25

**Leírás.** Dokumentáció zárás: a SPEC-001 érintett elfogadási kritériumainak (4., 51., 54., 55.) megjelölése azzal, hogy a SPEC-002 melyik kritériuma váltja ki őket; a SPEC-001 3. szekció csomagtérképének hivatkozása a SPEC-002 4. szekciójára; a `docs/research/` alá egy új fájl a migráció során mért tényekkel (csomagszám, `turbo run typecheck` idő hideg és meleg cache mellett, a normalizált JSON diff eredménye).

**Függőség.** T-002-24

**Model.** `sonnet`

**Elfogadási kritérium.** A SPEC-001 nem tartalmaz olyan kritériumot, ami ellentmond a SPEC-002 állapotának, jelölés nélkül. Az új research fájl minden számadata saját, most futtatott mérésből származik, becslés nincs benne. Mind a hét kapu zöld.

### T-002-26

**Leírás.** Adverzariális záró audit a SPEC-002 elfogadási kritériumai ellen, tételesen, bizonyítékkal. Aki auditál, ne az legyen, aki a migrációt végezte.

**Függőség.** T-002-25

**Model.** `opus`

**Elfogadási kritérium.** Minden kritériumhoz tartozik vagy egy most futtatott parancs kimenete, vagy egy konkrét fájl és sor hivatkozás. Feltételezéssel lezárt kritérium nincs. Ha valamelyik nem teljesül, az javító lépésként rögzül, nem magyarázatként. A `bun run test:e2e` egyszer, ebben a lépésben lefut, nulla kilépési kóddal.

---

---

## F8 fázis: a csomagok összevonása és a tool csomagok átnevezése

A user a 26 csomagos állapotra két kifogást emelt (SPEC-002 1. szekció, 4. és 5. pont), és mindkettőre megadta a döntést. Ez a fázis azt hajtja végre. A fázis nem ír át egyetlen sor viselkedést sem: fájlokat mozgat, csomagokat nevez át, és importokat vezet át.

### T-002-27

**Leírás.** A `result`, az `env-reader`, a `http-client` és az `image-source` csomag beolvasztása a `@easter-workflow-builder/core` csomagba, tárgykör szerinti almappaként, a téma mappák megtartásával (SPEC-002 4. szekció "Az összevont csomagok", 5.1, 5.8, 5.9, 5.12 és 6.1 pont 8. szabálya). A négy megszűnő csomag könyvtára és `package.json` fájlja törlődik, átirányító barrel nélkül. A `core` barrelje felveszi mind a négy tárgykör exportjait, és a `IS_CORE_PLACEHOLDER` konstans törlődik (SPEC-002 6.6 pont 6. szabálya). Minden fogyasztó `dependencies` kulcsa és import specifikátora `@easter-workflow-builder/core` alakra vált; ahol egy fájl korábban két megszűnő csomagból importált, a két import egy sorrá vonódik össze.

**Függőség.** T-002-26

**Model.** `opus`, mert a beolvasztás iránya nem mechanikus: azt kell eldönteni, mely tárgykör vihető be a `core` csomagba anélkül, hogy a `core` L0 besorolása sérülne, és a barrel névütközéseit is fel kell oldani.

**Elfogadási kritérium.** A `packages/result`, `packages/env-reader`, `packages/http-client` és `packages/image-source` könyvtár nem létezik. A `packages/core/src` alatt hat téma mappa áll négy tárgykörben, a SPEC-002 4. szekció táblázata szerint. A `packages/core/package.json` `dependencies` mezője nem létezik, tehát a `core` L0 marad. A `bun run test` ugyanannyi teszt fájlt és tesztet futtat le, mint a lépés előtt, 100 százalékos lefedettséggel. Mind a hét kapu zöld.

### T-002-28

**Leírás.** Az `evidence`, az `evidence-sources` és az `agent-tool-id` csomag beolvasztása a `@easter-workflow-builder/provider-capability` csomagba, ugyanezzel a mintával (SPEC-002 5.2, 5.3, 5.4). Az `agent-tool-id` tárgykör esetén a mappaszint nem duplázódik, mert a tárgykör és a téma neve megegyezik (SPEC-002 6.1 pont 9. szabálya). A `provider-minimax`, a `provider-claude-subscription`, a `provider-registry` és az `agent-tool-bundle` a `@easter-workflow-builder/provider-capability` csomagra vált.

**Függőség.** T-002-27

**Model.** `sonnet`, mert a leképezés az előző lépés mintáját követi, és a döntések már megszülettek.

**Elfogadási kritérium.** A `packages/evidence`, `packages/evidence-sources` és `packages/agent-tool-id` könyvtár nem létezik. A `packages/provider-capability/src` alatt hat saját téma mappa és három beolvadt tárgykör áll. A `packages/provider-capability/package.json` `dependencies` mezője nem létezik. A `provider-registry.spec.ts` bejáró tesztje változatlan invariánsokkal zöld, tehát egyetlen `Fact` érték sem mozdult el. Mind a hét kapu zöld.

### T-002-29

**Leírás.** A három tool csomag átnevezése a SPEC-002 6.9 szekció konvenciója szerint: `tool-web-search` -> `tool-minimax-web-search`, `tool-understand-image` -> `tool-minimax-understand-image`, `tool-web-fetch` -> `tool-firecrawl-web-fetch`. `git mv` a könyvtárra, `name` mező, minden hivatkozó `dependencies` kulcs, minden import specifikátor, a `CLAUDE.md` címsora és a `package-layer.ts` bejegyzése.

**Az MCP eszköznevek nem változnak.** A `web_search`, a `web_fetch` és az `understand_image` az agent felé kimenő szerződés, ahogy a gyártófüggvények és a téma mappák neve is. A `git mv` kötelező, és a lépés végén a `bun run check:casing` futtatása is, mert a fájlrendszer nem kis- és nagybetű érzékeny.

**Függőség.** T-002-28

**Model.** `sonnet`

**Elfogadási kritérium.** A három régi könyvtárnév nem létezik, a három új igen. A `git ls-files` egyetlen `tool-web-search`, `tool-understand-image` vagy `tool-web-fetch` útvonalat sem ad. A `web_search`, a `web_fetch` és az `understand_image` eszköznév, a három gyártófüggvény neve és a három téma mappa neve a `git diff` szerint változatlan. Mind a hét kapu zöld.

---

## Fázis összefoglaló

| Fázis | Lépések          | Mit ad                                                                                                                            |
| ----- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| F0    | T-002-1, 2       | zöld kiindulópont, a konvenció rögzítve a gyökér `CLAUDE.md`-ben                                                                  |
| F1    | T-002-3, 4, 5    | `.spec.ts` végződés, a `tooling/*` csomagok konvención, `@easter-workflow-builder/` névtér                                        |
| F2    | T-002-6 ... 10   | a `providers` hét csomagra bomlik, a tartalmi azonosság igazolva                                                                  |
| F3    | T-002-11 ... 14  | az alaprétegek (`result`, `mcp-tool-kit`, `http-client`, `env-reader`, `image-source`)                                            |
| F4    | T-002-15, 16, 17 | a két kliens csomag, a Coding Plan env megszűnése                                                                                 |
| F5    | T-002-18 ... 21  | három tool csomag plusz az összeállító, az `agent-tools` megszűnik                                                                |
| F6    | T-002-22, 23     | a többi csomag átvizsgálva a konvenció ellen                                                                                      |
| F7    | T-002-24, 25, 26 | gépi gráf ellenőrzés, dokumentáció zárás, adverzariális audit                                                                     |
| F8    | T-002-27, 28, 29 | 26 csomagból 19: a `core` és a `provider-capability` befogadja a beolvadó tárgyköröket, a tool csomagok megnevezik a szolgáltatót |

## Definition of Done

1. A SPEC-002 minden elfogadási kritériuma teljesül, mindegyikhez tartozik most futtatott parancs kimenete vagy konkrét fájl és sor hivatkozás. A 13. kritérium `engine` -> `agent` éle, ami korábban a spec 4. szekciójában nyitva jelölt, a userre váró besorolási ellentmondás volt, a user döntésével (2026-08-27) lezárult: az `engine` L5, a `server` L6 rétegre került, a `bun run check:graph` nulla eltérést ad.
2. Mind a nyolc kapu zöld: a hét fázisonkénti kapu, plusz a `bun run test:e2e` (a SPEC-002 végrehajtásakor érvényes kapukészlet; a mai, mérvadó kapulista a `.claude/CLAUDE.md` 8. szekciója, kilenc parancs).
3. A workspace 25 csomagból áll (19 `packages`, 2 `apps`, 3 `tooling`, 1 `tools`), mindegyik neve `@easter-workflow-builder/` prefixszel kezdődik, és mindegyiknek van `package.json`, `tsconfig.json` és `CLAUDE.md` fájlja. `src/index.ts` és `exports` mező minden `packages/*` alatti könyvtárcsomagban van; az `apps/server`, az `apps/web`, a `tooling/scripts`, a `tooling/tsconfig` és a `tools/wire-probe` csomagban ez a migráció előtti állapotnak megfelelően nem kötelező, a SPEC-002 12. kritériuma szerint.
4. A `packages/agent-tools` és a `packages/providers` könyvtár nem létezik, és nincs helyettük átirányító barrel csomag.
5. A lefedettség mind a négy metrikán 100 százalék, és a `vitest.config.ts` `coverage.exclude` listája a migráció eleje óta egyetlen sorral sem bővült.
6. A `.github/workflows/ci.yml`, a `.github/actions/setup/action.yml`, a `tooling/tsconfig/*.json` és a `tooling/scripts/*.sh` fájlokban a migráció miatt csak a T-002-24 lépésben leírt, indokolt változás történt: egy új wrapper a gráf ellenőrzőhöz. A `casing.sh` változatlan.
7. Minden lépés önálló, zöld commiton áll, és minden fázis után szólt a végrehajtó a usernek, hogy pusholjon.
8. Nyitva maradt kérdés nincs, vagy ha van, az explicit, indokolt nyitva jelöléssel áll a `docs/research/` alatt, a végrehajtási környezet igazolt korlátjára hivatkozva.
9. A migrált csomagokban pontosan 45 téma mappa áll, névre és tartalomra a SPEC-002 5. szekció táblázatai szerint (a `typeguards` 17 guard mappájával együtt 62 a repóban), egyikben sincs saját `CLAUDE.md` (SPEC-002 6.7 pont). Minden csomag gyökerében van `CLAUDE.md`. Egyetlen téma mappában sincs további alkönyvtár, és egyetlen fájl sem áll a `src/` tetején az `index.ts` barrelen kívül.
10. A `src/` alatti szerkezet legfeljebb kétszintű, és pontosan két csomagban kétszintű: a `core` négy, a `provider-capability` három beolvadt tárgykört hordoz (SPEC-002 6.1 pont 8. szabálya). Duplikált mappaszint (`<x>/<x>/`) sehol nincs.
11. Minden szolgáltatóhoz köthető csomag neve megnevezi a szolgáltatót (SPEC-002 6.9), és az MCP eszköznevek változatlanok.
12. Az `agent-tool-bundle` önálló csomag, nem olvadt be az `mcp-tool-kit` csomagba: a beolvasztás kört hozna létre, ez futtatott ellenőrzővel bizonyított (SPEC-002 4. szekció). Lezárva: a user végleges döntése (2026-08-27) is az önálló csomagot tartja meg, tudatos döntésként.
