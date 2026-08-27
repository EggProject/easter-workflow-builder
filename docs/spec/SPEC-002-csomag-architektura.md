# SPEC-002: Csomag architektúra és mappa konvenció

|          |                                                                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz  | tervezet                                                                                                                                 |
| Dátum    | 2026-08-27                                                                                                                               |
| Előzmény | [`SPEC-001-monorepo-toolchain.md`](SPEC-001-monorepo-toolchain.md), 3. szekció csomagtérkép és 13. szekció mappaszerkezet                |
| Bemenet  | [`../research/2026-08-26-agent-tools.md`](../research/2026-08-26-agent-tools.md), a `packages/typeguards` bemásolt kód mappa konvenciója |
| Kimenet  | 18 új csomag, 2 megszűnő csomag, repóra kiterjesztett `src/<egység>/<egység>.ts` konvenció, `.spec.ts` tesztvégződés                     |

---

## 1. Cél és hatókör

### Amit eldönt

- A `packages/agent-tools` és a `packages/providers` csomag szétbontását önálló, egyfelelősségű csomagokra, fájlszintű leképezéssel.
- A csomagok közötti rétegzést és a megengedett függőségi irányt az új csomagokra.
- A workspace csomagok névterét.
- A csomagon belüli mappa konvenciót, kötelező érvénnyel, a repo minden csomagjára.
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

## 2. Kiinduló állapot, mérve

Mérés dátuma: 2026-08-27, a `feat/spec-001-monorepo` ág git indexén.

| Amit mértem                                         | Érték | Hogyan                                                                |
| --------------------------------------------------- | ----- | --------------------------------------------------------------------- |
| `packages/agent-tools/src` fájl, `CLAUDE.md` nélkül | 75    | `git ls-files packages/agent-tools/src \| grep -v CLAUDE.md \| wc -l` |
| `packages/providers/src` fájl, `CLAUDE.md` nélkül   | 68    | ugyanígy                                                              |
| `.test.ts` fájl a repóban                           | 33    | `git ls-files '*.test.ts' \| wc -l`                                   |
| `.spec.ts` fájl a repóban                           | 18    | `git ls-files '*.spec.ts' \| wc -l`                                   |
| workspace csomag                                    | 16    | `apps` 2, `packages` 10, `tooling` 3, `tools` 1                       |
| `bun run docs:check` állapota                       | ZÖLD  | `50/50 kotelezo helyen van CLAUDE.md, 0 hianyzik`                     |

A 18 `.spec.ts` közül 17 a `packages/typeguards` csomag bemásolt kódja, 1 az `apps/web/e2e/smoke.spec.ts` Playwright teszt.

**A `packages/typeguards` mozgó cél.** A csomagon a spec írásával párhuzamosan egy másik agent dolgozik: a mérés pillanatában már megtörtént a `is-record` és a `is-non-empty-string` egység mappába vitele, a `.spec.ts` átnevezés és a 16 hiányzó `CLAUDE.md` pótlása, ezért állt zöldre a `docs:check`. A 33 és a 18 darabszám ezt az állapotot tükrözi. A végrehajtás első lépése ezért a tényleges számok újramérése, nem ennek a táblázatnak az elfogadása.

### Ami félrevezetően duplikálódik ma

| Fájlnév             | Hol fordul elő kétszer                                                             | Mi a különbség                                           |
| ------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `endpoint-path.ts`  | `agent-tools/src/minimax/`, `agent-tools/src/firecrawl/`                           | két különböző szolgáltatás útvonalai                     |
| `minimax/` mappanév | `agent-tools/src/minimax/` (HTTP kliens), `providers/src/minimax/` (képességleíró) | teljesen eltérő felelősség, azonos név                   |
| `descriptor.ts`     | `providers/src/minimax/`, `providers/src/claude-subscription/`                     | ugyanaz a szerep, ez rendben van, mert külön providerhez |

## 3. Névtér

Minden workspace csomag neve `@easter/` névtér prefixet kap. Ez érinti a jelenlegi 16 csomagot is.

Indok, hivatalos forrással: a Turborepo dokumentációja szó szerint ezt írja a belső csomagok `name` mezőjéről: _"It's best practice to use a namespace prefix for your Internal Packages to avoid conflicts with other packages on the npm registry"_ ([structuring a repository](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository)). A jelen migráció után 32 workspace csomag lesz, köztük olyan nevekkel, amik az npm registryben is léteznek (`result`, `evidence`, `http-client`). A prefix nélkül egy jövőbeli `bun add` vagy egy elgépelt import csendben registry csomagra oldódhat fel.

A `catalog:` hivatkozás scoped csomagnév mellett is működik, a Bun dokumentációja saját példája is scoped csomagot használ (`"name": "@monorepo/ui"`, [Bun catalogs](https://bun.com/docs/pm/catalogs)).

A `tooling/*` és a `tools/*` csomagok is megkapják a prefixet (`@easter/eslint-config`, `@easter/tsconfig`, `@easter/scripts`, `@easter/wire-probe`), mert a szabály kivétel nélküli, és a `tooling/eslint-config` mai `eslint-config` neve épp a legkockázatosabb, generikus alak.

## 4. Cél csomagtérkép

### Rétegek

```
L0  nincs workspace fuggosege
    @easter/typeguards        @easter/result        @easter/evidence
    @easter/agent-tool-id     @easter/mcp-tool-kit
    @easter/core              @easter/logger

L1  csak L0-ra epul
    @easter/env-reader  ->  result
    @easter/http-client ->  result
    @easter/evidence-sources     ->  evidence
    @easter/provider-capability  ->  evidence, agent-tool-id

L2  L0 es L1 folott
    @easter/minimax-client   ->  http-client, env-reader, result, typeguards
    @easter/firecrawl-client ->  http-client, env-reader, result, typeguards
    @easter/image-source     ->  http-client, result
    @easter/provider-minimax             ->  provider-capability, evidence, evidence-sources
    @easter/provider-claude-subscription ->  provider-capability, evidence, evidence-sources

L3  kesz egysegek
    @easter/tool-web-search       ->  mcp-tool-kit, minimax-client, result
    @easter/tool-web-fetch        ->  mcp-tool-kit, firecrawl-client, result
    @easter/tool-understand-image ->  mcp-tool-kit, minimax-client, image-source, result
    @easter/provider-registry     ->  provider-minimax, provider-claude-subscription,
                                      evidence, evidence-sources

L4  osszeallito
    @easter/agent-tool-bundle ->  agent-tool-id, tool-web-search, tool-web-fetch,
                                  tool-understand-image, env-reader, http-client, image-source
```

A gráf aciklikus és egyirányú: minden él lefelé mutat, magasabb rétegből alacsonyabb felé. Rétegen belüli él nincs.

A `provider-registry` `evidence` és `evidence-sources` éle a `provider-registry.spec.ts` bejáró tesztjéből ered: a teszt a `Fact` invariánsokat és a `MeasurementId` feloldhatóságot ellenőrzi, tehát mindkét csomagra szüksége van. A `package.json` `devDependencies` mezőjében áll, nem a `dependencies` mezőben.

### Rétegbesorolás, mind a 32 csomagra

A 13. elfogadási kritérium gépi ellenőrzéséhez minden csomagnak van rétegszáma, a most nem érintett csomagoknak is. A besorolás a `tooling/scripts` alatti gráf ellenőrző bemenete.

| Réteg  | Csomagok                                                                                                                                                  |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L0     | `typeguards`, `result`, `evidence`, `agent-tool-id`, `mcp-tool-kit`, `core`, `logger`                                                                     |
| L1     | `env-reader`, `http-client`, `evidence-sources`, `provider-capability`, `protocol`                                                                        |
| L2     | `minimax-client`, `firecrawl-client`, `image-source`, `provider-minimax`, `provider-claude-subscription`, `db`, `ui`                                      |
| L3     | `tool-web-search`, `tool-web-fetch`, `tool-understand-image`, `provider-registry`                                                                         |
| L4     | `agent-tool-bundle`, `agent`, `engine`                                                                                                                    |
| L5     | `server`, `web`                                                                                                                                           |
| eszköz | `eslint-config`, `tsconfig`, `scripts`, `wire-probe`, réteg nélkül, mert nem termékkód és egyetlen termékcsomag sem függhet tőlük futásidejű függőségként |

A `protocol` L1, mert csak a `core` csomagtól függhet. A `db` és a `ui` L2, mert a `protocol`, a `core` és a `logger` fölött áll. Az `engine` L4, mert a `db` és az `agent` fölött áll. A besorolás azt a szabályt kényszeríti ki, hogy egy csomag csak nála szigorúan kisebb rétegszámú csomagtól függhet, és az eszköz csomagok csak `devDependencies` helyen jelenhetnek meg.

### A megszűnő két csomag

| Csomag                 | Mi lesz vele                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| `packages/agent-tools` | megszűnik, 11 csomagra bomlik. A könyvtár és a `package.json` törlődik, nem marad átirányító barrel |
| `packages/providers`   | megszűnik, 7 csomagra bomlik. Ugyanígy, átirányító barrel nélkül                                    |

Átirányító barrel csomagot szándékosan nem hagyunk: az pontosan az a "minden egy helyre" minta lenne, amit a user kifogásolt, és a fogyasztók száma jelenleg nulla (a `core`, `agent`, `server` placeholder tartalommal áll).

### A változatlanul maradó csomagok

`@easter/core`, `@easter/db`, `@easter/engine`, `@easter/agent`, `@easter/protocol`, `@easter/logger`, `@easter/ui`, `@easter/server`, `@easter/web`, `@easter/eslint-config`, `@easter/tsconfig`, `@easter/scripts`, `@easter/wire-probe`. Ezek tartalma nem változik, csak a nevük kap prefixet, és a 6. szekció mappa konvenciója rájuk is érvényes, amint valódi tartalmat kapnak. A `@easter/typeguards` már ma követi a konvenciót.

### A frissített SPEC-001 függőségi tábla

A SPEC-001 3. szekció "Megengedett függőségi irány" táblája a következőképpen egészül ki és módosul:

| Csomag                  | Amitől függhet                                                             |
| ----------------------- | -------------------------------------------------------------------------- |
| `@easter/agent`         | `core`, `logger`, `provider-registry`, `agent-tool-bundle`                 |
| `@easter/server`        | `core`, `protocol`, `db`, `engine`, `agent`, `provider-registry`, `logger` |
| minden más termékcsomag | a 4. szekció rétegábrája szerint                                           |

Tiltott továbbra is: bármely visszafelé mutató él, bármely kör, és az `@easter/web` függése a `db`, `engine`, `agent` vagy `server` csomagtól. Új tiltás: egy `tool-*` csomag nem függhet másik `tool-*` csomagtól, és nem függhet az `agent-tool-bundle` csomagtól.

## 5. Csomagonkénti leírás és fájlszintű leképezés

### Leképezési szabály

Minden áthelyezett fájl a 6. szekció konvenciója szerint saját, a fájl nevével egyező mappába kerül. Például:

```
packages/agent-tools/src/http/post-json.ts       ->  packages/http-client/src/post-json/post-json.ts
packages/agent-tools/src/http/post-json.test.ts  ->  packages/http-client/src/post-json/post-json.spec.ts
```

Az alábbi táblázatokban ezért a **cél mappa** szerepel, a fájlnév és a `.spec.ts` átnevezés a fenti szabályból következik. Ahol egy fájl kettéválik vagy új fájl keletkezik, azt külön jelölöm.

### Az importok átírása kötelező, a `.spec.ts` fájlokban is

A "költözik" nem azt jelenti, hogy a fájl tartalma érintetlen. Minden áthelyezett fájlban át kell írni a relatív `../` importokat: ami a cél csomagon belül marad, az relatív út, ami másik csomagba került, az csomagnév szerinti import.

Ez a **teszt fájlokra is** vonatkozik, és ott két konkrét eset kézi döntést igényel:

1. Mind a négy `create-*-tool.test.ts` és a `create-agent-tool*.test.ts` importálja a `../http/fetch-function.ts` és a `../image/read-file-function.ts` típust, mert ma a közös `AgentToolDependencies` objektumot építik fel. Az új szűk függőség interfészek mellett a `tool-web-search` és a `tool-web-fetch` spec fájljának **nincs szüksége** a `ReadFileFunction` típusra, tehát azt az importot törölni kell, nem áthelyezni. A `noUnusedLocals` beállítás mellett a bent hagyott import fordítási hiba.
2. A `create-image-understanding-tool.test.ts` három sorban használja az `ENV_MINIMAX_CODING_PLAN_API_KEY` konstanst (bemenet felépítés, elvárt hibaüzenet, fixture kulcs). Ez a T-002-17 lépésben `ENV_MINIMAX_API_KEY` értékre változik, és a hiányzó kulcs hibaágának lefedettsége nem csökkenhet.

---

### 5.1 `@easter/result`

**Felelősség.** A kétállapotú `Outcome<TValue>` eredménytípus és a hozzá tartozó szűkítő typeguard, hogy a rétegek kivétel helyett hibaágat adjanak vissza.

| Jelenlegi fájl                                 | Cél                                                       |
| ---------------------------------------------- | --------------------------------------------------------- |
| `agent-tools/src/result/outcome.ts`            | `packages/result/src/outcome/outcome.ts` (típus-only)     |
| `agent-tools/src/result/is-ok-outcome.ts`      | `packages/result/src/is-ok-outcome/is-ok-outcome.ts`      |
| `agent-tools/src/result/is-ok-outcome.test.ts` | `packages/result/src/is-ok-outcome/is-ok-outcome.spec.ts` |

**Függőség.** Nincs workspace függősége, L0.

**NEM tartalmazza.** Az MCP `tools/call` válasz alakját (`ToolCallResult`) és annak konstruktorait. Azok MCP protokoll specifikusak, a helyük a `@easter/mcp-tool-kit`.

---

### 5.2 `@easter/evidence`

**Felelősség.** A provider képességleírók háromállapotú bizonyíték típusa és a hozzá tartozó typeguardok.

| Jelenlegi fájl                                   | Cél                                                             |
| ------------------------------------------------ | --------------------------------------------------------------- |
| `providers/src/evidence/measurement-id.ts`       | `packages/evidence/src/measurement-id/` (típus-only)            |
| `providers/src/evidence/evidence-reference.ts`   | `packages/evidence/src/evidence-reference/` (típus-only)        |
| `providers/src/evidence/evidence-list.ts`        | `packages/evidence/src/evidence-list/` (típus-only)             |
| `providers/src/evidence/fact.ts`                 | `packages/evidence/src/fact/` (típus-only)                      |
| `providers/src/evidence/is-known-fact.ts`        | `packages/evidence/src/is-known-fact/is-known-fact.ts`          |
| `providers/src/evidence/is-known-fact.test.ts`   | `packages/evidence/src/is-known-fact/is-known-fact.spec.ts`     |
| `providers/src/evidence/is-unknown-fact.ts`      | `packages/evidence/src/is-unknown-fact/is-unknown-fact.ts`      |
| `providers/src/evidence/is-unknown-fact.test.ts` | `packages/evidence/src/is-unknown-fact/is-unknown-fact.spec.ts` |

**Függőség.** Nincs workspace függősége, L0.

**NEM tartalmazza.** A bizonyítékok feloldását dokumentum útvonalra. Az a `@easter/evidence-sources` feladata. Az `evidence` csak a típusokat és az állapotot ismeri, azt nem, hogy hol olvasható el a mérés.

---

### 5.3 `@easter/evidence-sources`

**Felelősség.** A bizonyítékok nevesített forráskatalógusa: hivatalos doksi URL-ek, research szekció azonosítók, és a `MeasurementId` feloldása `docs/` horgonyra.

| Jelenlegi fájl                                     | Cél                                                                          |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `providers/src/references/document-url.ts`         | `packages/evidence-sources/src/document-url/document-url.ts`                 |
| `providers/src/references/research-section.ts`     | `packages/evidence-sources/src/research-section/research-section.ts`         |
| `providers/src/references/measurement-document.ts` | `packages/evidence-sources/src/measurement-document/measurement-document.ts` |

**Függőség.** `@easter/evidence` (a `MeasurementId` típus miatt).

**NEM tartalmazza.** A mérés prózai leírását. A SPEC-001 13. szekció szabálya változatlan: a kódban csak a stabil azonosító és a horgony áll, a próza a `docs/research/` alatt.

**Megjegyzés a konvencióhoz.** Ez a három fájl nevesített konstansok gyűjtője (a `document-url.ts` 13 exportált konstanst tartalmaz). A 6.4 szekció szerint egy azonos szótárba tartozó konstanshalmaz egyetlen egységnek számít, tehát nem bomlik tovább fájlonként egy konstansra.

---

### 5.4 `@easter/agent-tool-id`

**Felelősség.** Az egyetlen `AgentToolId` union típus, ami a workflow lépéshez kapcsolható in-process MCP eszközök közös szótára.

| Jelenlegi fájl                              | Cél                                                      |
| ------------------------------------------- | -------------------------------------------------------- |
| `providers/src/capability/agent-tool-id.ts` | `packages/agent-tool-id/src/agent-tool-id/` (típus-only) |

**Függőség.** Nincs, L0.

**Miért önálló csomag.** Két, egymástól független fa használja: a képességleíró réteg (`provider-capability`, az `AgentToolRecommendation` miatt) és a futásidejű eszköz-összeállító (`agent-tool-bundle`). Ha a szótár a `provider-capability` csomagban maradna, az eszköz-összeállítónak a teljes képességleíró típusrétegtől kellene függnie, ami rossz irányú függés: a futásidejű összeállítás nem a leíró metaadatra épül. Egy közös, tartalom nélküli szótár csomag ezt megszünteti anélkül, hogy kört okozna.

**NEM tartalmazza.** Az eszköz teljes MCP nevét (`mcp__<szerver>__<eszköz>`). Az a szervernév ismeretét igényli, tehát az `agent-tool-bundle` csomagban van.

---

### 5.5 `@easter/provider-capability`

**Felelősség.** A provider képességleíró típusai. Kizárólag típus, egyetlen futásidejű sor nélkül.

Cél: `packages/provider-capability/src/<fájlnév>/<fájlnév>.ts`, a `providers/src/capability/` alatti mind a 21 fájlra, az `agent-tool-id.ts` kivételével (az az 5.4 pontba került).

| Jelenlegi fájl a `providers/src/capability/` alatt | Jelenlegi fájl a `providers/src/capability/` alatt |
| -------------------------------------------------- | -------------------------------------------------- |
| `agent-tool-recommendation.ts`                     | `provider-capability-descriptor.ts`                |
| `concurrency-capability.ts`                        | `rate-limit-bucket.ts`                             |
| `disallowed-environment-requirement.ts`            | `rate-limit-capability.ts`                         |
| `effort-capability.ts`                             | `server-tool-descriptor.ts`                        |
| `environment-requirement.ts`                       | `streaming-capability.ts`                          |
| `model-descriptor.ts`                              | `structured-output-capability.ts`                  |
| `models-endpoint-capability.ts`                    | `structured-output-strategy-id.ts`                 |
| `prompt-cache-mode.ts`                             | `structured-output-strategy.ts`                    |
| `prompt-caching-capability.ts`                     | `thinking-capability.ts`                           |
| `thinking-mode.ts`                                 | `tool-choice-capability.ts`                        |
| `tool-choice-value.ts`                             |                                                    |

**Függőség.** `@easter/evidence`, `@easter/agent-tool-id`.

**Spec fájl.** Egyik egységhez sem tartozik `.spec.ts`, mert mind típus-only (6.3 szekció).

**NEM tartalmazza.** Egyetlen konkrét provider egyetlen konkrét értékét sem. A típus mondja meg, milyen mezők vannak, az érték a két leíró csomagban áll.

---

### 5.6 `@easter/provider-minimax` és `@easter/provider-claude-subscription`

**Felelősség.** Egy-egy provider kitöltött képességleírója, mérési és dokumentációs bizonyítékokkal.

Mindkét csomag ugyanazt a 16 fájlt kapja meg a saját forrásmappájából, egységenként saját mappába:

`concurrency.ts`, `descriptor.ts`, `disallowed-environment.ts`, `effort.ts`, `family-id.ts`, `model-id.ts`, `models.ts`, `prompt-caching.ts`, `rate-limits.ts`, `recommended-agent-tools.ts`, `required-environment.ts`, `server-tools.ts`, `streaming.ts`, `structured-output.ts`, `thinking.ts`, `tool-choice.ts`.

| Forrás                                | Cél                                            |
| ------------------------------------- | ---------------------------------------------- |
| `providers/src/minimax/*`             | `packages/provider-minimax/src/*/`             |
| `providers/src/claude-subscription/*` | `packages/provider-claude-subscription/src/*/` |

**Függőség.** `@easter/provider-capability`, `@easter/evidence`, `@easter/evidence-sources`.

**Tartalmi változás nincs.** Minden `Fact` `state`, `value` és `evidence` értéke bitre azonos marad, ahogy a SPEC-001 34. kritériuma előírta a korábbi migrációra.

**NEM tartalmazzák.** A két leíró összekapcsolását egyetlen rekordba. Az a `@easter/provider-registry`.

---

### 5.7 `@easter/provider-registry`

**Felelősség.** A két leíró egyetlen, kulcs szerint elérhető readonly rekordban, plusz a leíró invariánsokat kikényszerítő bejáró regressziós teszt.

| Jelenlegi fájl                   | Cél                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `providers/src/registry.ts`      | `packages/provider-registry/src/provider-registry/provider-registry.ts`      |
| `providers/src/registry.test.ts` | `packages/provider-registry/src/provider-registry/provider-registry.spec.ts` |

**Függőség.** `@easter/provider-minimax`, `@easter/provider-claude-subscription`. A `.spec.ts` további dev függősége `@easter/evidence` és `@easter/evidence-sources`, mert a bejárás a `Fact` invariánsokat és a `MeasurementId` feloldhatóságot ellenőrzi.

**Átnevezés.** A `registry` név `provider-registry`-re változik, mert a csomagon belül a `registry` szó önmagában nem mondja meg, minek a regisztere, és az exportált típus neve is `ProviderRegistry`.

**NEM tartalmazza.** A provider kiválasztás logikáját (globális, workflow és lépés szintű felülírás). Az a `@easter/engine` és a `@easter/server` hatóköre, külön specifikáció tárgya.

---

### 5.8 `@easter/env-reader`

**Felelősség.** Környezeti változó olvasás típusos, alapértelmezéssel és hibaággal. Nem tud egyetlen konkrét szolgáltatásról sem.

| Jelenlegi fájl                                   | Cél                                                        |
| ------------------------------------------------ | ---------------------------------------------------------- |
| `agent-tools/src/config/environment-reader.ts`   | `packages/env-reader/src/environment-reader/` (típus-only) |
| `agent-tools/src/config/read-base-url.ts`        | `packages/env-reader/src/read-base-url/`                   |
| `agent-tools/src/config/read-base-url.test.ts`   | ugyanoda, `.spec.ts` néven                                 |
| `agent-tools/src/config/read-timeout-ms.ts`      | `packages/env-reader/src/read-timeout-ms/`                 |
| `agent-tools/src/config/read-timeout-ms.test.ts` | ugyanoda, `.spec.ts` néven                                 |

**Függőség.** `@easter/result` (a `readTimeoutMs` `Outcome`-ot ad).

**NEM tartalmazza.** A konkrét változóneveket (`MINIMAX_API_KEY`, `FIRECRAWL_BASE_URL`) és a konkrét alapértelmezéseket. Azok annál a kliensnél vannak, amelyik használja őket. Ez a lényegi különbség a mai `agent-tools/src/config` mappához képest, ami egyszerre tartalmazta a generikus olvasót és a két szolgáltatás konkrét beállításait.

---

### 5.9 `@easter/http-client`

**Felelősség.** Vékony HTTP réteg a Node beépített `fetch` fölött: JSON POST, bináris GET, hibaleírás. Nem dob, nem próbálkozik újra.

| Jelenlegi fájl                                | Cél                                                     |
| --------------------------------------------- | ------------------------------------------------------- |
| `agent-tools/src/http/fetch-function.ts`      | `packages/http-client/src/fetch-function/` (típus-only) |
| `agent-tools/src/http/binary-payload.ts`      | `packages/http-client/src/binary-payload/` (típus-only) |
| `agent-tools/src/http/post-json.ts`           | `packages/http-client/src/post-json/`                   |
| `agent-tools/src/http/post-json.test.ts`      | ugyanoda, `.spec.ts` néven                              |
| `agent-tools/src/http/get-binary.ts`          | `packages/http-client/src/get-binary/`                  |
| `agent-tools/src/http/get-binary.test.ts`     | ugyanoda, `.spec.ts` néven                              |
| `agent-tools/src/http/describe-error.ts`      | `packages/http-client/src/describe-error/`              |
| `agent-tools/src/http/describe-error.test.ts` | ugyanoda, `.spec.ts` néven                              |

**Függőség.** `@easter/result`.

**NEM tartalmazza.** Egyetlen konkrét szolgáltatás egyetlen végpontját sem. A `PATH_SEARCH`, `PATH_VLM`, `PATH_SCRAPE` konstansok a megfelelő kliens csomagokban vannak. Nincs benne `axios` és nincs `dotenv`, a SPEC-001 alatt hozott szabály változatlan.

---

### 5.10 `@easter/minimax-client`

**Felelősség.** MiniMax HTTP kliens: konfiguráció feloldás, a `base_resp` burkoló kezelése, a kereső és a képértelmező válaszok szűkítése és formázása.

| Jelenlegi fájl                                           | Cél                                                         |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| `agent-tools/src/config/minimax-config.ts`               | `packages/minimax-client/src/minimax-config/` (típus-only)  |
| `agent-tools/src/config/resolve-minimax-config.ts`       | `packages/minimax-client/src/resolve-minimax-config/`       |
| `agent-tools/src/config/resolve-minimax-config.test.ts`  | ugyanoda, `.spec.ts` néven                                  |
| `agent-tools/src/minimax/base-response.ts`               | `packages/minimax-client/src/base-response/` (típus-only)   |
| `agent-tools/src/minimax/endpoint-path.ts`               | `packages/minimax-client/src/endpoint-path/`                |
| `agent-tools/src/minimax/is-minimax-envelope.ts`         | `packages/minimax-client/src/is-minimax-envelope/`          |
| `agent-tools/src/minimax/is-minimax-envelope.test.ts`    | ugyanoda, `.spec.ts` néven                                  |
| `agent-tools/src/minimax/call-minimax.ts`                | `packages/minimax-client/src/call-minimax/`                 |
| `agent-tools/src/minimax/call-minimax.test.ts`           | ugyanoda, `.spec.ts` néven                                  |
| `agent-tools/src/minimax/search-response.ts`             | `packages/minimax-client/src/search-response/` (típus-only) |
| `agent-tools/src/minimax/is-search-response.ts`          | `packages/minimax-client/src/is-search-response/`           |
| `agent-tools/src/minimax/is-search-response.test.ts`     | ugyanoda, `.spec.ts` néven                                  |
| `agent-tools/src/minimax/format-search-response.ts`      | `packages/minimax-client/src/format-search-response/`       |
| `agent-tools/src/minimax/format-search-response.test.ts` | ugyanoda, `.spec.ts` néven                                  |
| `agent-tools/src/minimax/vlm-response.ts`                | `packages/minimax-client/src/vlm-response/` (típus-only)    |
| `agent-tools/src/minimax/is-vlm-response.ts`             | `packages/minimax-client/src/is-vlm-response/`              |
| `agent-tools/src/minimax/is-vlm-response.test.ts`        | ugyanoda, `.spec.ts` néven                                  |

Ezen felül két fájl **kettéválik**, a MiniMax része ide kerül:

| Jelenlegi fájl                                        | Ami ide kerül                                                           | Cél                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| `agent-tools/src/config/environment-variable-name.ts` | `ENV_MINIMAX_API_KEY`, `ENV_MINIMAX_BASE_URL`, `ENV_MINIMAX_TIMEOUT_MS` | `packages/minimax-client/src/environment-variable-name/` |
| `agent-tools/src/config/default-config-value.ts`      | `DEFAULT_MINIMAX_BASE_URL`, `DEFAULT_MINIMAX_TIMEOUT_MS`                | `packages/minimax-client/src/default-config-value/`      |

**Függőség.** `@easter/http-client`, `@easter/env-reader`, `@easter/result`, `@easter/typeguards`.

**Tartalmi változás, a user döntése.** Az `ENV_MINIMAX_CODING_PLAN_API_KEY` konstans **megszűnik**. Ennek következményei:

1. A `resolveMiniMaxConfig` `apiKeyVariableName` paramétere feleslegessé válik, mert mindkét hívó ugyanazt a változót adná át. A függvény közvetlenül az `ENV_MINIMAX_API_KEY` változót olvassa, a paraméter törlendő.
2. A `resolve-minimax-config.spec.ts` a paraméter nélküli alakhoz igazítandó, a hiányzó kulcs hibaágának lefedettsége nem csökkenhet.
3. A `turbo.json` `globalPassThroughEnv` listájából a `MINIMAX_CODING_PLAN_API_KEY` sor törlendő.
4. A `docs/research/2026-08-26-agent-tools.md` 4. szekciója ("Nyitott kérdés: kell-e külön Coding Plan token") lezárandó: a saját mérés szerint ugyanaz a pay-as-you-go platform kulcs mindkét végponton `status_code: 0` értéket adott, tehát a mérés a külön kulcsot nem igazolta, és a user ennek megfelelően döntött. A szekció szövege ezt rögzíti, a mérési tábla nem változik.
5. A SPEC-001 55. elfogadási kritériuma ("hat környezeti változó") ezzel **öt** környezeti változóra módosul. Ezt a jelen spec 11. szekció 27. kritériuma váltja ki.

**NEM tartalmazza.** Az MCP eszköz definíciót. A `web_search` és az `understand_image` eszköz külön csomagokban áll.

---

### 5.11 `@easter/firecrawl-client`

**Felelősség.** Firecrawl HTTP kliens: konfiguráció feloldás, scrape hívás, a válasz szűkítése és markdownná formázása.

| Jelenlegi fájl                                                | Cél                                                              |
| ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `agent-tools/src/config/firecrawl-config.ts`                  | `packages/firecrawl-client/src/firecrawl-config/` (típus-only)   |
| `agent-tools/src/config/resolve-firecrawl-config.ts`          | `packages/firecrawl-client/src/resolve-firecrawl-config/`        |
| `agent-tools/src/config/resolve-firecrawl-config.test.ts`     | ugyanoda, `.spec.ts` néven                                       |
| `agent-tools/src/firecrawl/endpoint-path.ts`                  | `packages/firecrawl-client/src/endpoint-path/`                   |
| `agent-tools/src/firecrawl/firecrawl-document.ts`             | `packages/firecrawl-client/src/firecrawl-document/` (típus-only) |
| `agent-tools/src/firecrawl/interpret-scrape-response.ts`      | `packages/firecrawl-client/src/interpret-scrape-response/`       |
| `agent-tools/src/firecrawl/interpret-scrape-response.test.ts` | ugyanoda, `.spec.ts` néven                                       |
| `agent-tools/src/firecrawl/format-firecrawl-document.ts`      | `packages/firecrawl-client/src/format-firecrawl-document/`       |
| `agent-tools/src/firecrawl/format-firecrawl-document.test.ts` | ugyanoda, `.spec.ts` néven                                       |

Kettéváló fájlok Firecrawl része:

| Jelenlegi fájl                                        | Ami ide kerül                                                | Cél                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| `agent-tools/src/config/environment-variable-name.ts` | `ENV_FIRECRAWL_BASE_URL`, `ENV_FIRECRAWL_TIMEOUT_MS`         | `packages/firecrawl-client/src/environment-variable-name/` |
| `agent-tools/src/config/default-config-value.ts`      | `DEFAULT_FIRECRAWL_BASE_URL`, `DEFAULT_FIRECRAWL_TIMEOUT_MS` | `packages/firecrawl-client/src/default-config-value/`      |

**ÚJ egység, áthelyezett kóddal.** `packages/firecrawl-client/src/scrape-page/scrape-page.ts` és `scrape-page.spec.ts`.

Ez az egyetlen új logika fájl a teljes migrációban, és nem új viselkedés: a mai `create-web-fetch-tool.ts` fájlban álló `postJson` hívást (URL összerakás a `PATH_SCRAPE` konstansból, `{ url, formats: ['markdown'] }` törzs, `timeoutMs`) emeli át. Indok: a user "Firecrawl kliens" csomagot kért, egy kliens pedig hív, nem csak válaszalakot értelmez. Enélkül a `tool-web-fetch` csomagnak közvetlenül a `@easter/http-client` csomagtól kellene függnie, és a Firecrawl kliens felelőssége két csomag között oszlana meg.

A szerződése szándékosan azonos a `callMiniMax` szerződésével: `Promise<Outcome<unknown>>`, azaz a nyers JSON választ adja vissza, a szűkítést az `interpretScrapeResponse` végzi a hívó oldalon. Így a jelenlegi két, egymástól elkülönülő hibaág (elérhetetlen szolgáltatás, illetve értelmezhetetlen válasz) és a hozzájuk tartozó két külön hibaüzenet változatlan marad, tehát a `create-web-fetch-tool` tesztjeinek elvárásai nem módosulnak.

**Aszimmetria a MiniMax klienssel, szándékosan.** A `callMiniMax` paraméterként kapja az útvonalat, mert két végpontot szolgál ki, ezért a `PATH_SEARCH` és a `PATH_VLM` a csomag publikus felületén van. A Firecrawlnak egy végpontja van, ezért a `PATH_SCRAPE` a `scrapePage` belsejében marad, és **nincs** a barrelben.

**Függőség.** `@easter/http-client`, `@easter/env-reader`, `@easter/result`, `@easter/typeguards`.

---

### 5.12 `@easter/image-source`

**Felelősség.** Kép feloldása base64 data URL alakra `https` címről, helyi fájlból vagy már kész data URL-ből, plusz a média típus megállapítása.

| Jelenlegi fájl                                               | Cél                                                          |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| `agent-tools/src/image/image-media-type.ts`                  | `packages/image-source/src/image-media-type/` (típus-only)   |
| `agent-tools/src/image/read-file-function.ts`                | `packages/image-source/src/read-file-function/` (típus-only) |
| `agent-tools/src/image/media-type-from-content-type.ts`      | `packages/image-source/src/media-type-from-content-type/`    |
| `agent-tools/src/image/media-type-from-content-type.test.ts` | ugyanoda, `.spec.ts` néven                                   |
| `agent-tools/src/image/media-type-from-extension.ts`         | `packages/image-source/src/media-type-from-extension/`       |
| `agent-tools/src/image/media-type-from-extension.test.ts`    | ugyanoda, `.spec.ts` néven                                   |
| `agent-tools/src/image/resolve-image-data-url.ts`            | `packages/image-source/src/resolve-image-data-url/`          |
| `agent-tools/src/image/resolve-image-data-url.test.ts`       | ugyanoda, `.spec.ts` néven                                   |

**Függőség.** `@easter/http-client`, `@easter/result`.

**NEM tartalmazza.** A MiniMax képértelmező hívást. A kép előkészítése és a modell hívása két különböző dolog: az előbbi bármelyik képes providerrel használható, az utóbbi MiniMax specifikus.

---

### 5.13 `@easter/mcp-tool-kit`

**Felelősség.** Az MCP eszköz építő váz: a `tools/call` válasz alakja és a két válasz konstruktor, amit minden eszköz csomag használ.

| Jelenlegi fájl                                     | Cél                                                        |
| -------------------------------------------------- | ---------------------------------------------------------- |
| `agent-tools/src/result/tool-call-result.ts`       | `packages/mcp-tool-kit/src/tool-call-result/` (típus-only) |
| `agent-tools/src/result/text-tool-result.ts`       | `packages/mcp-tool-kit/src/text-tool-result/`              |
| `agent-tools/src/result/text-tool-result.test.ts`  | ugyanoda, `.spec.ts` néven                                 |
| `agent-tools/src/result/error-tool-result.ts`      | `packages/mcp-tool-kit/src/error-tool-result/`             |
| `agent-tools/src/result/error-tool-result.test.ts` | ugyanoda, `.spec.ts` néven                                 |

**Függőség.** Nincs workspace függősége, L0.

**NEM tartalmazza.** Egyetlen kész eszközt sem, és nem tartalmazza az in-process MCP szerver nevét sem. A user kifogása pontosan erre vonatkozott: a váz és a kész tool nem lakhat egy csomagban.

---

### 5.14 `@easter/tool-web-search`

**Felelősség.** A `web_search` MCP eszköz definíciója: Zod séma, leírás, és a MiniMax kereső hívása.

| Jelenlegi fájl                                         | Cél                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `agent-tools/src/tools/create-web-search-tool.ts`      | `packages/tool-web-search/src/create-web-search-tool/create-web-search-tool.ts` |
| `agent-tools/src/tools/create-web-search-tool.test.ts` | ugyanoda, `.spec.ts` néven                                                      |

**ÚJ fájl.** `packages/tool-web-search/src/web-search-tool-dependencies/web-search-tool-dependencies.ts`, típus-only.

A mai közös `AgentToolDependencies` három mezőt fog össze (`fetchFunction`, `environment`, `readFileFunction`), de a `web_search` eszköznek csak kettő kell. Ha a közös típus egy alacsonyabb csomagba kerülne, minden eszköz csomag függene tőle, és az összeállító csomagtól való függés kört okozna. Ezért minden eszköz csomag a saját, szűk függőség interfészét deklarálja, és az összeállító adja át a megfelelő mezőket. Ez a "a segéd soha nem lakik egy csomagban a kész toollal" elv következménye a függőség objektumra is.

**Függőség.** `@easter/mcp-tool-kit`, `@easter/minimax-client`, `@easter/result`, plusz `@anthropic-ai/claude-agent-sdk` és `zod`. A `FetchFunction` és az `EnvironmentReader` típust a `@easter/minimax-client` barreljéből veszi, a 6.6 pont 7. szabálya szerint, tehát a `@easter/http-client` és a `@easter/env-reader` **nem** szerepel a függőségei között.

**NEM tartalmazza.** A MiniMax HTTP hívást, a válasz szűkítést és formázást. Azok a kliens csomagban vannak, ez a csomag csak séma, leírás és a hibaágak megfogalmazása az agent felé.

---

### 5.15 `@easter/tool-web-fetch`

**Felelősség.** A `web_fetch` MCP eszköz definíciója: Zod séma, leírás, és a Firecrawl scrape hívása.

| Jelenlegi fájl                                        | Cél                                                                          |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| `agent-tools/src/tools/create-web-fetch-tool.ts`      | `packages/tool-web-fetch/src/create-web-fetch-tool/create-web-fetch-tool.ts` |
| `agent-tools/src/tools/create-web-fetch-tool.test.ts` | ugyanoda, `.spec.ts` néven                                                   |

**ÚJ fájl.** `packages/tool-web-fetch/src/web-fetch-tool-dependencies/web-fetch-tool-dependencies.ts`, típus-only, `fetchFunction` és `environment` mezővel.

**Függőség.** `@easter/mcp-tool-kit`, `@easter/firecrawl-client`, `@easter/result`, plusz `@anthropic-ai/claude-agent-sdk` és `zod`. A `FetchFunction` és az `EnvironmentReader` típust a `@easter/firecrawl-client` barreljéből veszi, a 6.6 pont 7. szabálya szerint.

**Változás a mai kódhoz képest.** A `postJson` hívás átkerül a `scrapePage` egységbe (5.11), tehát ez a fájl megszűnik közvetlenül HTTP réteget használni. A `@easter/http-client` és a `@easter/env-reader` **nem** szerepel a csomag függőségei között.

---

### 5.16 `@easter/tool-understand-image`

**Felelősség.** Az `understand_image` MCP eszköz definíciója: Zod séma, leírás, a kép feloldása és a MiniMax képértelmező hívása.

| Jelenlegi fájl                                                  | Cél                                                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `agent-tools/src/tools/create-image-understanding-tool.ts`      | `packages/tool-understand-image/src/create-image-understanding-tool/create-image-understanding-tool.ts` |
| `agent-tools/src/tools/create-image-understanding-tool.test.ts` | ugyanoda, `.spec.ts` néven                                                                              |

**ÚJ fájl.** `packages/tool-understand-image/src/understand-image-tool-dependencies/understand-image-tool-dependencies.ts`, típus-only, mindhárom mezővel (`fetchFunction`, `environment`, `readFileFunction`).

**Függőség.** `@easter/mcp-tool-kit`, `@easter/minimax-client`, `@easter/image-source`, `@easter/result`, plusz `@anthropic-ai/claude-agent-sdk` és `zod`. A `FetchFunction` és az `EnvironmentReader` típust a `@easter/minimax-client`, a `ReadFileFunction` típust a `@easter/image-source` barreljéből veszi, a 6.6 pont 7. szabálya szerint.

**Változás a mai kódhoz képest.** Az `ENV_MINIMAX_CODING_PLAN_API_KEY` helyett nincs változónév paraméter: a `resolveMiniMaxConfig` hívás argumentum nélkül történik, és az `ENV_MINIMAX_API_KEY` változóból dolgozik (5.10).

---

### 5.17 `@easter/agent-tool-bundle`

**Felelősség.** A lépésenként kapcsolható eszközkészlet összeállítása: az azonosítókból in-process MCP szerver konfiguráció és `allowedTools` lista.

| Jelenlegi fájl                                                  | Cél                                                                    |
| --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `agent-tools/src/tools/agent-tools-server-name.ts`              | `packages/agent-tool-bundle/src/agent-tools-server-name/`              |
| `agent-tools/src/tools/agent-tool-reference.ts`                 | `packages/agent-tool-bundle/src/agent-tool-reference/`                 |
| `agent-tools/src/tools/agent-tool-reference.test.ts`            | ugyanoda, `.spec.ts` néven                                             |
| `agent-tools/src/tools/agent-tool-dependencies.ts`              | `packages/agent-tool-bundle/src/agent-tool-dependencies/` (típus-only) |
| `agent-tools/src/tools/default-agent-tool-dependencies.ts`      | `packages/agent-tool-bundle/src/default-agent-tool-dependencies/`      |
| `agent-tools/src/tools/default-agent-tool-dependencies.test.ts` | ugyanoda, `.spec.ts` néven                                             |
| `agent-tools/src/tools/create-agent-tool.ts`                    | `packages/agent-tool-bundle/src/create-agent-tool/`                    |
| `agent-tools/src/tools/create-agent-tool.test.ts`               | ugyanoda, `.spec.ts` néven                                             |
| `agent-tools/src/tools/agent-tool-bundle.ts`                    | `packages/agent-tool-bundle/src/agent-tool-bundle/` (típus-only)       |
| `agent-tools/src/tools/create-agent-tool-bundle.ts`             | `packages/agent-tool-bundle/src/create-agent-tool-bundle/`             |
| `agent-tools/src/tools/create-agent-tool-bundle.test.ts`        | ugyanoda, `.spec.ts` néven                                             |

**Függőség.** `@easter/agent-tool-id`, `@easter/tool-web-search`, `@easter/tool-web-fetch`, `@easter/tool-understand-image`, `@easter/env-reader` (az `EnvironmentReader` típus), `@easter/http-client` (a `FetchFunction` típus), `@easter/image-source` (a `ReadFileFunction` típus), plusz `@anthropic-ai/claude-agent-sdk`.

**Az `AgentToolDependencies` szerepe itt.** Ez a csomag az egyetlen hely, ahol a három futásidejű függőség egy objektumban áll, mert ez az egyetlen hely, ami mindhárom eszközt ismeri. A `createAgentTool` switch ágai a teljes objektumból választják ki az adott eszköz szűk függőség interfészének megfelelő mezőket.

**NEM tartalmazza.** Egyetlen eszköz sémáját, leírását vagy hibaüzenetét sem. Ez a csomag nem tud arról, mit csinál egy eszköz, csak arról, hogy melyik azonosítóhoz melyik gyártófüggvény tartozik.

---

### 5.18 Mit veszít a `packages/agent-tools/src/index.ts` és a `packages/providers/src/index.ts`

Mindkét barrel törlődik. A jelenleg belőlük exportált szimbólumok az alábbi csomagok barreljébe kerülnek:

| Ma exportált szimbólum                                                                                                                               | Új csomag                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `EnvironmentReader`                                                                                                                                  | `@easter/env-reader`                   |
| `ENV_MINIMAX_API_KEY`, `ENV_MINIMAX_BASE_URL`, `ENV_MINIMAX_TIMEOUT_MS`                                                                              | `@easter/minimax-client`               |
| `ENV_MINIMAX_CODING_PLAN_API_KEY`                                                                                                                    | megszűnik (5.10)                       |
| `ENV_FIRECRAWL_BASE_URL`, `ENV_FIRECRAWL_TIMEOUT_MS`                                                                                                 | `@easter/firecrawl-client`             |
| `Outcome`, `isOkOutcome`                                                                                                                             | `@easter/result`                       |
| `ToolCallResult`                                                                                                                                     | `@easter/mcp-tool-kit`                 |
| `AgentToolDependencies`, `defaultAgentToolDependencies`, `AGENT_TOOLS_SERVER_NAME`, `agentToolReference`, `AgentToolBundle`, `createAgentToolBundle` | `@easter/agent-tool-bundle`            |
| `MeasurementId`, `EvidenceReference`, `EvidenceList`, `Fact`, `isKnownFact`, `isUnknownFact`                                                         | `@easter/evidence`                     |
| `ProviderCapabilityDescriptor`, `AgentToolRecommendation`                                                                                            | `@easter/provider-capability`          |
| `AgentToolId`                                                                                                                                        | `@easter/agent-tool-id`                |
| `MiniMaxModelId`, `MiniMaxFamilyId`                                                                                                                  | `@easter/provider-minimax`             |
| `ClaudeModelId`, `ClaudeFamilyId`                                                                                                                    | `@easter/provider-claude-subscription` |
| `ProviderRegistry`, `providerRegistry`                                                                                                               | `@easter/provider-registry`            |

### 5.19 Megfigyelés, nem ennek a specnek a hatóköre

A `packages/providers/package.json` `dependencies` mezője tartalmazza a `core` csomagot, de a `packages/providers/src` alatt egyetlen fájl sem importál a `core` csomagból (`grep -rn "from 'core'" packages/providers/src` nulla találat). Ez holt függőség. A csomag megszűnésével magától eltűnik, egyik utódcsomag sem veszi át.

## 6. A belső mappa konvenció

Ez a szekció kötelező érvényű, és a repo **minden** csomagjára vonatkozik, nem csak a most létrejövőkre.

### 6.1 Mappánként egy egység

```
packages/<csomag>/
  package.json
  tsconfig.json
  CLAUDE.md
  src/
    index.ts                       barrel, csak nevesitett ujraexport
    <egyseg-neve>/
      CLAUDE.md
      <egyseg-neve>.ts             a megvalositas
      <egyseg-neve>.spec.ts        a teszt, ha van futasideju sor
```

Szabályok:

1. A mappa neve **pontosan** megegyezik a benne álló megvalósítás fájl nevével, kiterjesztés nélkül.
2. A mappa neve kebab-case, és az exportált egység nevének kebab-case alakja. `isOkOutcome` egysége `is-ok-outcome`, `createWebSearchTool` egysége `create-web-search-tool`, `ProviderRegistry` egysége `provider-registry`.
3. Egy mappában egy egység áll. Kivétel: ugyanannak az egységcsaládnak a szorosan kapcsolódó variánsa ugyanabba a mappába kerülhet, ha az alapegység nevével kezdődik. Precedens a user saját kódjából: `packages/typeguards/src/is-function/` tartalmazza az `is-function.ts` és az `is-function-return-any.ts` fájlt. A variánsnak is saját `.spec.ts` fájlja van.
4. Egyetlen fájl sem állhat közvetlenül a `src/` alatt, az `index.ts` barrel kivételével.
5. Nincs egység mappán belüli `index.ts`. A csomagnak egyetlen belépési pontja van.

### 6.2 A spec fájl

1. A teszt a megvalósítás **mellett** áll, ugyanabban a mappában, nem külön `__tests__` vagy `test/` fa alatt.
2. A kiterjesztés `.spec.ts`, nem `.test.ts`. A repo minden meglévő `.test.ts` fájlja átnevezendő.
3. A neve pontosan a megvalósítás fájl neve plusz `.spec.ts`.
4. A Playwright end to end tesztek maradnak az `apps/web/e2e/` fa alatt, `.spec.ts` végződéssel, ahogy ma is. Az `apps/web/vitest.config.ts` már ma kizárja az `e2e/**` mintát, tehát a Vitest nem szedi fel őket.
5. **Megvalósítás fájl nélküli regressziós teszt.** Van olyan teszt, ami nem egy egységet fed le, hanem egy konfigurációs invariánst őriz. A repóban kettő ilyen van: `tooling/scripts/src/turbo-e2e-coverage-outputs.test.ts` (a `turbo.json` `test:e2e` task `outputs` mezőjét őrzi) és `tools/wire-probe/src/no-shadowed-path-import.test.ts` (árnyékolt relatív importot őriz). Az ilyen teszt is saját mappát kap, a mappa neve pedig **annak a dolognak a neve, amit őriz**, nem egy nem létező megvalósítás fájlé. A mappában egyetlen fájl áll, a `.spec.ts`. Az 6.1 pont 1. szabálya alóli kivétel, és a mappa `CLAUDE.md` fájlja kimondja, hogy nincs megvalósítás párja. A `tools/wire-probe` esetén a 6.8 pont szerint csak az átnevezés kötelező, a mappába vitel nem.

### 6.3 Típus-only fájlok

1. A típus-only fájl (`export type`, `export interface`, futásidejű utasítás nélkül) **ugyanúgy saját mappát kap**, mint bármely más egység.
2. Hozzá **nem** készül `.spec.ts`. Indok: nincs futásidejű sor, amit lefedni lehetne, a v8 coverage nulla utasítással veszi fel, tehát sem nem javítja, sem nem rontja a százalékot. Ezt a SPEC-001 9. szekciója már rögzítette a `capability/**` fájlokra.
3. A típus-only voltát a mappa `CLAUDE.md` fájljának `## Fájlok` táblázata jelöli, hogy az olvasó ne hiányolja a tesztet.
4. Tilos a típus-only fájlokat egy közös `types/` mappába gyűjteni. Az a technikai réteg szerinti csoportosítás, amit a 6.5 pont tilt.

### 6.4 Konstans gyűjtő fájlok

Egy fájl akkor is egyetlen egység, ha több exportált konstanst tartalmaz, feltéve hogy a konstansok **ugyanannak a szótárnak** a tagjai, azonos prefixszel vagy azonos szereppel. Precedens: `document-url.ts` 13 doksi URL-lel, `environment-variable-name.ts` a saját szolgáltatása változóneveivel.

Nem elfogadható gyűjtő: egymással nem összefüggő konstansok egy fájlban, illetve két szolgáltatás konstansai egy fájlban. Pontosan ezért válik ketté az `environment-variable-name.ts` és a `default-config-value.ts` a MiniMax és a Firecrawl csomag között (5.10, 5.11).

### 6.5 Csoportosító alkönyvtár

**Indokolt**, ha a csomagon belül két vagy több, egymástól független egységcsalád van, és a fájlnevek önmagukban nem különböztetik meg őket.

**Nem indokolt**, és tilos:

| Tiltott mappanév                                   | Miért                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `types/`, `interfaces/`, `models/`                 | technikai réteg szerinti csoportosítás, nem felelősség szerinti                                        |
| `utils/`, `helpers/`, `lib/`, `common/`, `shared/` | gyűjtőmappa, definíció szerint nincs egyetlen felelőssége                                              |
| `internal/`, `private/`                            | a láthatóságot a barrel szabályozza, nem a mappaszerkezet                                              |
| `config/`                                          | a mai `agent-tools/src/config` pont ezért keverte a generikus olvasót és két szolgáltatás beállításait |

**Fő szabály.** Ha egy csomagban csoportosító alkönyvtárra lenne szükség, az majdnem biztosan azt jelenti, hogy a csomag két csomag. Először a szétbontást kell mérlegelni. A jelen migráció után egyetlen új csomagban sincs csoportosító alkönyvtár: mind a 18 csomag lapos, `src/<egység>/` szintű.

### 6.6 A csomag publikus felülete

1. A publikus felület kizárólag a `src/index.ts` barrel.
2. A barrel csak **nevesített** újraexportot tartalmaz, `export { x } from './x/x.ts'` és `export type { X } from './x/x.ts'` alakban. `export *` tilos, mert nem látszik belőle, mi a felület, és a `verbatimModuleSyntax` mellett a típus és az érték export sem különül el.
3. A `package.json` `exports` mezője a `./src/index.ts` fájlra mutat, a SPEC-001 V-1 döntése szerint (forrás fogyasztás, nincs build lépés).
4. A barrel a coverage `exclude` listáján van (`**/index.ts`), tehát nem tartalmazhat futásidejű elágazást, csak újraexportot.
5. Ami nincs a barrelben, az a csomagon kívülről nem használható. Csomagon belül a hivatkozás relatív, `.ts` kiterjesztéssel, a `allowImportingTsExtensions` beállítás szerint.
6. Placeholder export (`IS_<CSOMAG>_PLACEHOLDER`) csak addig maradhat egy barrelben, amíg a csomagnak nincs valódi tartalma. Az első valódi export felvételekor törlendő.
7. **A barrel újraexportálja azokat az idegen csomagból származó típusokat, amik a csomag saját publikus szignatúráiban megjelennek.** Ha a `@easter/minimax-client` `resolveMiniMaxConfig` függvénye `EnvironmentReader` paramétert vár, akkor az `EnvironmentReader` típus a `minimax-client` barreljében is szerepel, `export type { EnvironmentReader } from '@easter/env-reader';` alakban.

Az utolsó szabály indoka: enélkül minden hívónak deklarálnia kellene a hívott csomag függőségeit is, hogy a saját függvényszignatúráit le tudja írni. Konkrétan a három `tool-*` csomagnak fel kellene vennie a `@easter/http-client` és a `@easter/env-reader` csomagot pusztán a `FetchFunction` és az `EnvironmentReader` típus miatt, ami hamis függést mutatna: a tool nem hív HTTP réteget, csak átadja a befecskendezett függvényt a kliensnek. A szabály hatálya alá eső három csomag és a re-exportált típusok:

| Csomag                     | Re-exportált típus                   | Miért van a szignatúrában                         |
| -------------------------- | ------------------------------------ | ------------------------------------------------- |
| `@easter/minimax-client`   | `EnvironmentReader`, `FetchFunction` | `resolveMiniMaxConfig`, `callMiniMax` paramétere  |
| `@easter/firecrawl-client` | `EnvironmentReader`, `FetchFunction` | `resolveFirecrawlConfig`, `scrapePage` paramétere |
| `@easter/image-source`     | `FetchFunction`, `ReadFileFunction`  | `resolveImageDataUrl` paramétere                  |

A `ReadFileFunction` a `@easter/image-source` saját típusa, tehát ott nem re-export, hanem eredeti export.

### 6.7 `CLAUDE.md` minden mappában

A gyökér `CLAUDE.md` szabálya és a `tooling/scripts/claude-md.sh` ellenőrzés együtt azt jelenti, hogy **minden egység mappa saját `CLAUDE.md` fájlt kap**. A 18 új csomagban 117 egység mappa keletkezik, csomagonként így:

| Csomag                | Egység | Csomag                         | Egység | Csomag                  | Egység |
| --------------------- | -----: | ------------------------------ | -----: | ----------------------- | -----: |
| `result`              |      2 | `provider-registry`            |      1 | `image-source`          |      5 |
| `evidence`            |      6 | `env-reader`                   |      3 | `mcp-tool-kit`          |      3 |
| `evidence-sources`    |      3 | `http-client`                  |      5 | `tool-web-search`       |      2 |
| `agent-tool-id`       |      1 | `minimax-client`               |     13 | `tool-web-fetch`        |      2 |
| `provider-capability` |     21 | `firecrawl-client`             |      9 | `tool-understand-image` |      2 |
| `provider-minimax`    |     16 | `provider-claude-subscription` |     16 | `agent-tool-bundle`     |      7 |

Ez 117 egység szintű plusz 18 csomag szintű `CLAUDE.md`, összesen 135 új fájl.

Hogy ez ne váljon zajjá, az egység szintű `CLAUDE.md` rövid és rögzített szerkezetű:

```markdown
# packages/<csomag>/src/<egyseg>

## Mi ez a mappa

Egy bekezdes: mit csinal az egyseg, es mi NEM tartozik ide.

## Fájlok

| Fájl               | Tartalom                                             |
| ------------------ | ---------------------------------------------------- |
| `<egyseg>.ts`      | egymondatos leiras, tipus-only eseten ezt is jelolve |
| `<egyseg>.spec.ts` | egymondatos leiras arrol, mit fed le                 |
```

A `## Függőségi irány`, a `## Szabályok` és a `## Kapcsolódó dokumentumok` szekció az egység szintű `CLAUDE.md` fájlban **elhagyandó**: azok csomag szintűek, és a SPEC-001 14. szekció "Amit tilos beleírni" pontja tiltja az ismétlést. A csomag szintű `CLAUDE.md` viszont kötelezően tartalmazza mind a hatot, és a `## Fájlok` táblázata az egység **mappákat** sorolja fel, nem az egyes fájlokat.

### 6.8 Két kivétel a hatókör alól

#### `apps/web/src/main.ts`

Ez a fájl a Vite belépési pontja, és a helyét három, egymástól független dolog rögzíti: az `apps/web/index.html` `<script src="/src/main.ts">` hivatkozása, a `vitest.config.ts` `coverage.exclude` listájának `apps/web/src/main.ts` sora, és az e2e nyc riport, ami erre a fájlútra jelent lefedettséget. Egy `src/main/main.ts` alakra vitel mindhármat elrontaná, nulla haszonért, ráadásul a SPEC-002 22. elfogadási kritériuma tiltja a `coverage.exclude` lista módosítását.

A fájl ezért a `src/` tetején marad. Amikor egy későbbi specifikáció a valódi UI belépési pontot felállítja, akkor kell újra megvizsgálni, a `coverage.exclude` sor megszüntetésével együtt (SPEC-001 9. szekció, "SZIGORITANI KELL").

#### `tools/wire-probe`

A konvenció **nem** vonatkozik a `tools/wire-probe` csomagra. A csomag szerkezete változatlan marad, beleértve a `src/cases/` alatti 37 mérési eset fájlt, a `src/harness/` és a `src/proxy/` mappát, valamint a `src/probe.ts`, `src/proxy.ts`, `src/summary.ts` fájlokat.

Indok, négy pontban:

1. **Nem termékkód.** A SPEC-001 13. szekciója szerint mérőeszköz, a SPEC-000 lezárt hatóköre. A coverage `exclude` listája teljes egészében kizárja, és a csomagnak nincs `test` npm scriptje.
2. **A mérés reprodukálhatósága a tét.** A `probe`, `proxy` és `summary` npm scriptek konkrét fájlutakat hívnak, és a `src/cases/index.ts` mind a 36 esetfájlt behúzza. Egy átszervezés a SPEC-000 mérések megismételhetőségét kockáztatná, nulla termékoldali haszonért.
3. **Az egység mappa itt értelmetlen volumenű lenne.** A `src/cases/m-01.ts` ... `m-36.ts` fájlokból 36 mappa és 36 `CLAUDE.md` keletkezne, olyan fájlokhoz, amiket egyetlen `index.ts` sorol fel és soha nem importál más.
4. **A `src/proxy.ts` és a `src/proxy/` mappa együtt él.** A konvenció szerinti `proxy/proxy.ts` alak ütközne a meglévő mappával, és pontosan azt az árnyékolt útvonal hibát hozná vissza, amit a `no-shadowed-path-import.spec.ts` regressziós teszt őriz.

Ami a `tools/wire-probe` csomagra **mégis** vonatkozik: a `@easter/` névtér (3. szekció), a `.spec.ts` végződés a `no-shadowed-path-import` regressziós tesztre (6.2 pont 5. szabálya, mappába vitel nélkül), és a `CLAUDE.md` kötelezettség minden forrást tartalmazó mappában, ahogy ma is. A csomagnak nincs `src/index.ts` fájlja és nincs `exports` mezője, mert soha senki nem importálja csomagnév szerint; ez így marad.

## 7. Amit a migráció NEM változtat meg

| Fájl vagy beállítás                           | Miért nem kell hozzányúlni                                                                                                                                             |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `turbo.json` taskok                           | a taskok csomagfüggetlenek, az `inputs` mintái `packages/*/src/**` alakúak, az új csomagokat automatikusan felveszik                                                   |
| `.github/workflows/ci.yml`                    | a jobok gyökér npm scripteket hívnak, csomagnevet sehol nem neveznek meg                                                                                               |
| `.github/actions/setup/action.yml`            | ugyanez                                                                                                                                                                |
| `eslint.config.ts` és `tooling/eslint-config` | a `**/*.test.ts` és a `**/*.spec.ts` minta már ma is együtt szerepel a `test-files.ts` fájlban                                                                         |
| `vitest.config.ts` `projects`                 | a `packages/*` glob minden új csomagot felvesz, a Vitest dokumentáltan minden mappát külön projektnek tekint                                                           |
| `vitest.config.ts` `coverage.include`         | `packages/*/src/**/*.{ts,tsx}`, az új csomagokra is illeszkedik                                                                                                        |
| `vitest.config.ts` `coverage.exclude`         | a `**/*.test.ts` és a `**/*.spec.ts` minta már ma is együtt szerepel                                                                                                   |
| `tooling/tsconfig/*.json`                     | csomagfüggetlen                                                                                                                                                        |
| `tooling/scripts/*.sh`                        | a nyolc wrapper és a `_lib.sh` csomagfüggetlen. Két dokumentált kivétel van: a `casing.sh` fájlban a `check-casing.ts` útvonala, és egy új wrapper a gráf ellenőrzőhöz |

**A `.test.ts` átnevezés nem igényel Vitest config módosítást.** A Vitest 4 dokumentált `test.include` alapértelmezése `['**/*.{test,spec}.?(c|m)[jt]s?(x)']` ([include](https://vitest.dev/config/include)), és ugyanez olvasható a telepített forrásban is (`node_modules/vitest/dist/chunks/defaults.9aQKnqFk.js`, `const defaultInclude = ["**/*.{test,spec}.?(c|m)[jt]s?(x)"]`). A gyökér `vitest.config.ts` két explicit projektje (`wire-probe-regression`, `tooling-scripts`) már ma `**/*.{test,spec}.ts` mintát használ.

**Amihez hozzá kell nyúlni:**

| Fájl                                      | Mit                                                                     |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| gyökér `package.json` `workspaces`        | változatlan glob, de a `catalog` bejegyzések változatlanok maradnak     |
| `turbo.json` `globalPassThroughEnv`       | a `MINIMAX_CODING_PLAN_API_KEY` sor törlendő (5.10)                     |
| minden új csomag `package.json`           | `@easter/` név, `workspace:*` függőségek, `catalog:` a közös devDeps-re |
| minden meglévő csomag `package.json`      | `@easter/` név és a hivatkozó `dependencies` kulcsok átírása            |
| `docs/research/2026-08-26-agent-tools.md` | a 4. szekció lezárása (5.10)                                            |
| gyökér `CLAUDE.md`                        | a 6. szekció konvenciója rövid hivatkozásként, a spec linkjével         |

## 8. Bun catalog és workspace deklarációk

1. Minden új csomag `devDependencies` mezője a közös eszközöket `catalog:` hivatkozással veszi át: `typescript`, `vitest`, `@types/node`. Literál verzió egyik új csomagba sem kerülhet, ez a SPEC-001 3. elfogadási kritériuma.
2. Minden workspace közötti függőség `"workspace:*"` alakban áll a `dependencies` mezőben. Ami nincs deklarálva, azt az `import-x/no-extraneous-dependencies` szabály hibaként jelzi.
3. Az `@anthropic-ai/claude-agent-sdk` verziója **pinelve** marad, és csak azokban a csomagokban szerepel, amik ténylegesen importálják: `@easter/tool-web-search`, `@easter/tool-web-fetch`, `@easter/tool-understand-image`, `@easter/agent-tool-bundle`. A SPEC-001 döntése szerint nem kerül katalógusba.
4. A `zod` szintén csak a három tool csomagban szerepel.
5. A `bun.lock` egyetlen fájl marad a gyökérben, és a `bun install --frozen-lockfile` minden lépés után hibátlanul lefut.

## 9. Coverage

1. A 100 százalékos küszöb minden új csomagra vonatkozik, **kizárás nélkül**. A `vitest.config.ts` `coverage.exclude` listája egyetlen új sorral sem bővülhet.
2. Az `apps/web/src/main.ts` ideiglenes kizárása változatlanul marad, mert nem ennek a specnek a hatóköre.
3. A típus-only fájlok nulla utasítással szerepelnek a riportban, tehát nem igényelnek sem tesztet, sem kizárást.
4. A `**/index.ts` kizárás miatt a barrel fájlok nem számítanak. Ez a 6.6 pont 4. szabályának az oka: a barrelben nem lehet lefedetlenül maradó elágazás.
5. Az `ÚJ` `scrape-page` egység (5.11) és a három `*-tool-dependencies` típus-only egység (5.14, 5.15, 5.16) sem kap kizárást. A `scrape-page` mindkét ágát (sikeres hívás, hibás hívás) a saját `.spec.ts` fedi, befecskendezett `fetch` függvénnyel, élő hálózat nélkül.

## 10. Kockázatok

| Kockázat                                                                                                   | Hatás                                                                             | Védelem                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A `.test.ts` átnevezés a git indexben más betűzéssel landol, mint a lemezen                                | a CI kis-nagybetű érzékeny checkoutján `TS2307 Cannot find module`, helyben semmi | `bun run check:casing` minden lépés végén, és `git mv` használata kézi törlés helyett                                                                                                                                                                                                                                       |
| Egy `Fact` érték elmozdul vagy elveszik a provider szétbontás során                                        | a mérési eredmény csendben elromlik                                               | a `provider-registry.spec.ts` bejáró tesztje minden lépés után zöld, plusz a szétbontás előtti és utáni normalizált JSON összehasonlítás, a SPEC-001 34. kritériumának mintájára                                                                                                                                            |
| A `MINIMAX_CODING_PLAN_API_KEY` megszüntetése után a képértelmezés kulcs nélkül marad                      | az eszköz minden hívásra hibaágat ad                                              | a `resolve-minimax-config.spec.ts` a hiányzó kulcs hibaágát változatlanul fedi, és a hibaüzenet megnevezi a beállítandó `MINIMAX_API_KEY` változót                                                                                                                                                                          |
| A `scrapePage` kiemelése megváltoztatja a `web_fetch` hibaüzeneteit                                        | az agent más szöveget kap, a teszt elvárások elcsúsznak                           | a `scrapePage` szerződése `Outcome<unknown>`, a szűkítés a hívónál marad, tehát a két hibaág és a két üzenet változatlan (5.11)                                                                                                                                                                                             |
| A `docs:check` a 117 új egység mappa miatt tömegesen pirosra vált                                          | a kapu elbukik, a lépés nem zárható le                                            | a `CLAUDE.md` az egység mappával **együtt**, ugyanabban a lépésben keletkezik, nem utólag                                                                                                                                                                                                                                   |
| A `@easter/` névtér átírása kimarad egy `dependencies` kulcsból                                            | `bun install` hibázik, vagy egy import registry csomagra oldódik fel              | a névtér átírás önálló, atomi lépés, a végén `bun install --frozen-lockfile` plusz mind a hét kapu                                                                                                                                                                                                                          |
| A 32 csomagos gráf lelassítja a Turborepo futást                                                           | lassabb helyi és CI futás                                                         | dokumentált felső korlát vagy teljesítmény-figyelmeztetés a csomagszámra a Turborepo dokumentációjában **nincs**, ezért számot itt nem rögzítünk; a lépések végén mért `turbo run typecheck` idő a tény                                                                                                                     |
| A `packages/typeguards` csomagon párhuzamosan dolgozik egy másik agent                                     | ütköző szerkesztés                                                                | a typeguards érintő lépés a terv legvégén áll, és csak akkor indul, ha a párhuzamos munka lezárult                                                                                                                                                                                                                          |
| A tisztán típus-only csomagok (`agent-tool-id`, `provider-capability`) barrelje futásidőben üres modult ad | a Vitest projekt vagy a Node type stripping nem tudja betölteni a csomagot        | a `verbatimModuleSyntax` mellett az `export type { X } from '...'` alak érvényes modult képez, tehát nem üres fájl. A `passWithNoTests: true` már ma be van állítva a gyökér configban, tehát a teszt nélküli projekt nem bukik el. Ha a betöltés mégis hibázna, a barrelbe egyetlen `export {}` sor kerül, kizárás helyett |

## 11. Elfogadási kritériumok

1. A `packages/agent-tools` és a `packages/providers` könyvtár nem létezik, és a repóban nincs rájuk mutató import a `docs/` alatti historikus szövegeken kívül.
2. A 4. szekció mind a 18 új csomagja létezik a megadott útvonalon, mindegyiknek van `package.json`, `tsconfig.json`, `src/index.ts` és `CLAUDE.md` fájlja.
3. Minden workspace csomag neve `@easter/` prefixszel kezdődik, kivétel nélkül, a `tooling/*` és a `tools/*` csomagokat is beleértve.
4. Az 5. szekció mind a 143 leképezett fájlja (75 az `agent-tools`, 68 a `providers` csomagból) elszámolt: 139 fájl a megadott cél útvonalon áll, 2 fájl (`environment-variable-name.ts`, `default-config-value.ts`) szolgáltatásonként kettévált és mind a négy fele megvan, 2 fájl (a két `src/index.ts` barrel) szándékosan törölve. Egyetlen fájl sem maradt le, és egyetlen exportált szimbólum sem veszett el, az 5.18 táblázat szerint.
5. A repóban nincs `.test.ts` végződésű fájl. A `git ls-files '*.test.ts'` kimenete üres.
6. Minden Vitest teszt fájl a megvalósítás mellett, azonos mappában áll, `<egység>.spec.ts` néven. Három kivétel: az `apps/web/e2e/` fa (Playwright tesztek), a 6.2 pont 5. szabálya szerinti, megvalósítás nélküli regressziós teszt, és a `tools/wire-probe` a 6.8 pont szerint.
7. A `src/` közvetlen gyermekei minden csomagban kizárólag az `index.ts` fájl és egység mappák, a 6.8 pont két kivételével. Ezt a következő parancs igazolja, aminek üres eredményt kell adnia:

   ```
   find packages apps tooling -path '*/src/*' -maxdepth 3 -type f -name '*.ts' \
     -not -name 'index.ts' -not -path 'apps/web/src/main.ts' -not -path '*/node_modules/*'
   ```

8. Minden egység mappában a mappanév megegyezik a benne álló megvalósítás fájl nevével, kiterjesztés nélkül. Az egyetlen megengedett eltérés a 6.1 pont 3. szabálya szerinti variáns fájl.
9. Egyetlen csomagban sincs `types/`, `utils/`, `helpers/`, `lib/`, `common/`, `shared/`, `internal/` vagy `config/` nevű alkönyvtár, a 6.8 pont szerinti `tools/wire-probe` kivételével.
10. A `packages/*` és az `apps/*` csomagokban nincs csoportosító alkönyvtár: minden egység mappa közvetlenül a `src/` alatt áll. A `tooling/*` csomagokra ugyanez érvényes, a `tools/wire-probe` a 6.8 pont szerint kivétel.
11. Minden csomag `src/index.ts` fájlja csak nevesített újraexportot tartalmaz. `export *` egyetlen barrelben sem szerepel.
12. Minden `packages/*` alatti könyvtárcsomag `package.json` `exports` mezője a `./src/index.ts` fájlra mutat. Az `apps/server`, az `apps/web`, a `tooling/scripts`, a `tooling/tsconfig` és a `tools/wire-probe` csomagnak nincs `exports` mezője, és nem is kap: ezeket egyetlen másik csomag sem importálja csomagnév szerint, ez a migráció előtti állapot, és nem változik.
13. A függőségi gráf aciklikus, és minden él szigorúan csökkenő rétegszám felé mutat, a 4. szekció "Rétegbesorolás, mind a 32 csomagra" táblázata szerint. Az eszköz csomagok (`eslint-config`, `tsconfig`, `scripts`, `wire-probe`) kizárólag `devDependencies` helyen jelenhetnek meg. Ezt az `import-x/no-cycle` szabály, a `package.json` `dependencies` mezők, és a T-002-24 lépésben készülő gráf ellenőrző együtt igazolja.
14. Egyetlen `tool-*` csomag `dependencies` mezőjében sem szerepel másik `tool-*` csomag vagy a `@easter/agent-tool-bundle`.
15. A `@easter/http-client` csomag `dependencies` mezőjében nem szerepel `@easter/minimax-client`, `@easter/firecrawl-client` vagy bármely `tool-*` csomag.
16. A `@easter/mcp-tool-kit` csomagban nincs egyetlen kész MCP eszköz definíció sem, és nem hivatkozik egyetlen `tool-*` csomagra sem.
17. A `@easter/evidence` csomag nem hivatkozik a `@easter/evidence-sources` csomagra, és a `@easter/provider-capability` nem hivatkozik egyetlen konkrét provider csomagra sem.
18. Minden egység mappában van `CLAUDE.md`, a 6.7 pont rövid sablonja szerint, és a `bun run docs:check` nulla kilépési kóddal fut a teljes repón.
19. Minden csomag szintű `CLAUDE.md` tartalmazza a SPEC-001 14. szekció mind a hat kötelező szekcióját, és a `## Fájlok` táblázata az egység mappákat sorolja fel.
20. A `bun run check:casing` nulla kilépési kóddal fut, tehát a git indexben tárolt fájlnevek betűzése megegyezik a rájuk hivatkozó relatív importokéval.
21. A `bun run test` nulla kilépési kóddal fut, és a lefedettség mind a négy metrikán 100 százalék.
22. A `vitest.config.ts` `coverage.exclude` listája nem bővült egyetlen sorral sem a migráció során. Az összehasonlítás alapja a migráció előtti fájl.
23. A `bun run typecheck`, a `bun run lint` és a `bun run format:check` nulla kilépési kóddal fut a teljes workspace-en, mind a 32 csomagra.
24. A `bun run build` nulla kilépési kóddal fut.
25. A `bun install --frozen-lockfile` hibátlanul lefut, és a `bun.lock` egyetlen fájl a gyökérben.
26. Minden új csomag `devDependencies` mezője `catalog:` hivatkozással veszi át a `typescript`, `vitest` és `@types/node` csomagot. Literál verzió egyetlen új csomagban sincs ezekre.
27. A `MINIMAX_CODING_PLAN_API_KEY` név nem fordul elő sem a kódban, sem a `turbo.json` fájlban, sem egyetlen `CLAUDE.md` fájlban. A migráció kiindulópontján hét helyen fordul elő: `environment-variable-name.ts`, `index.ts`, `create-image-understanding-tool.ts` (két sor), `create-image-understanding-tool.test.ts` (három sor), `packages/agent-tools/CLAUDE.md:38` és `turbo.json:17`. Az `agent-tools` csomagok által használt környezeti változók száma öt, és mind az öt szerepel a `turbo.json` `globalPassThroughEnv` listájában. Ez a SPEC-001 55. kritériumát váltja ki.
28. A `resolveMiniMaxConfig` függvénynek nincs változónév paramétere, és a `@easter/tool-understand-image` valamint a `@easter/tool-web-search` ugyanabból a környezeti változóból dolgozik.
29. A `docs/research/2026-08-26-agent-tools.md` 4. szekciója lezárt állapotú: rögzíti a saját mérés eredményét, a user döntését, és azt, hogy a külön változó megszűnt. A mérési táblázat sorai változatlanok.
30. Minden `Fact` mező `state`, `value` és `evidence` értéke bitre azonos a migráció előttivel. Ezt egy normalizált JSON összehasonlítás igazolja a migráció előtti és utáni `providerRegistry` fán.
31. A `provider-registry` csomag bejáró regressziós tesztje (`provider-registry.spec.ts`) változatlan invariánsokkal fut le: minden `Fact` pontosan az egyik ágon áll, a `known` ág nem üres bizonyítéklistát hordoz, az `unknown` ág indoklást és blokkoló mérést, egyetlen `purpose` vagy `reason` string sem tartalmaz `M-` mintájú azonosítót, és minden hivatkozott `MeasurementId` feloldható `docs/` horgonyra.
32. Az `@easter/firecrawl-client` `scrapePage` egysége `Outcome<unknown>` típussal tér vissza, és a `PATH_SCRAPE` konstans nem szerepel a csomag `src/index.ts` barreljében.
33. Egyetlen `tool-*` csomag `dependencies` mezőjében sem szerepel a `@easter/http-client` és a `@easter/env-reader`. A `FetchFunction` és az `EnvironmentReader` típust mindhárom tool csomag a hívott kliens csomag barreljéből veszi, a 6.6 pont 7. szabálya szerint, és a három kliens csomag barrelje tartalmazza a szabály táblázatában felsorolt re-exportokat.
34. A `turbo run typecheck` kétszer futtatva másodszorra teljes cache találatot ad, és egy `@easter/result` fájl módosítása után csak a `result` csomagtól függő csomagok taskja fut újra.
35. A `.github/workflows/ci.yml`, a `.github/actions/setup/action.yml` és a `tooling/tsconfig/*.json` fájlok **nem** változtak a migráció során. A `tooling/scripts/*.sh` fájlokban pontosan két, előre dokumentált változás történt: a `casing.sh` fájlban a `check-casing.ts` új útvonala (T-002-4), és egy új wrapper a gráf ellenőrzőhöz (T-002-24). Az összehasonlítás alapja a migráció előtti fájl.
36. A gyökér `CLAUDE.md` hivatkozik erre a specre a mappa konvenció forrásaként, és nem ismétli meg a 6. szekció tartalmát.

## 12. Kapcsolódó dokumentumok

- [`SPEC-001-monorepo-toolchain.md`](SPEC-001-monorepo-toolchain.md): a monorepo, a toolchain és a minőségi kapuk
- [`SPEC-000-provider-wire-measurement.md`](SPEC-000-provider-wire-measurement.md): a provider drótszintű mérés, ami a leírók tartalmát adja
- [`../plan/PLAN-002-csomag-architektura.md`](../plan/PLAN-002-csomag-architektura.md): a végrehajtási terv
- [`../research/2026-08-26-agent-tools.md`](../research/2026-08-26-agent-tools.md): a MiniMax és a Firecrawl végpontok saját mérése
