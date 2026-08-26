# SPEC-001: Monorepo, toolchain, CI

|          |                                                                                                                                                                  |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz  | tervezet                                                                                                                                                         |
| Dátum    | 2026-08-26                                                                                                                                                       |
| Bemenet  | [`../research/2026-08-26-toolchain.md`](../research/2026-08-26-toolchain.md) rögzített verziói                                                                   |
| Előzmény | [`SPEC-000-provider-wire-measurement.md`](SPEC-000-provider-wire-measurement.md), lezárva                                                                        |
| Kimenet  | Bun workspace, Turborepo, TS 6.0.3 config, ESLint 10 flat config, Prettier, Vitest 4, Playwright, wrapper scriptek, GitHub Actions, a `src/providers` migrációja |

---

## 1. Cél és hatókör

### Amit eldönt

- A repo szerkezetét: `apps/`, `packages/`, `tooling/`, `tools/` felosztás, csomagonkénti felelősség, és a csomagok közötti megengedett függőségi irány.
- A Bun workspace és a Turborepo konfigurációját: milyen taskok léteznek, mi függ mitől, mi kerül a cache bemenetébe és kimenetébe.
- A megosztott TypeScript 6.0.3 alapkonfigurációt, és azt, hogy a csomagok forrás `.ts` alakban vagy fordított kimenetként fogyasztják egymást.
- Az ultra strict ESLint 10 flat config szabálykészletét, kiemelten azokat a szabályokat, amik a `CLAUDE.md` kódolási elvárásait kényszerítik ki.
- A Prettier és az ESLint munkamegosztását.
- A Vitest 4 és a Playwright infrastruktúráját, a coverage gyűjtés módját és a küszöb kikényszerítésének helyét.
- A `tooling/scripts` alatti token takarékos wrapper scriptek kimeneti szerződését.
- A GitHub Actions pipeline job szerkezetét, sorrendjét és a cache kulcsokat.
- A `src/providers` áthelyezését `packages/providers` alá, a belső mappaszerkezettel és a mérési hivatkozások kódból való kiemelésével.
- Minden könyvtár `CLAUDE.md` fájljának kötelező tartalmát.

### Amit NEM dönt el

- Nem tervez domain modellt, nem definiál workflow gráf típusokat, nem ír adatbázis sémát. A `packages/core`, `packages/db`, `packages/engine`, `packages/agent`, `packages/protocol` tartalma külön specifikáció tárgya, ez a spec csak a csomaghatárt és a függőségi irányt rögzíti.
- Nem ír teszteket. Csak a teszt infrastruktúra, a coverage konfiguráció és a küszöb tartozik ide.
- Nem tervez UI-t. A `packages/ui` és az `apps/web` itt csak mint workspace csomag jelenik meg.
- Nem nyúl a provider képességleírók tartalmához. A migráció fájlmozgatás, szétbontás és hivatkozás kiemelés, nem tartalmi felülvizsgálat. Egyetlen `Fact` sem vált állapotot a migráció során.
- Nem dönt a deploy folyamatról. A CI a `main` védelmét és a PR ellenőrzést szolgálja, nincs release job, nincs artefaktum publikálás a teszt riportokon kívül.
- Nem vezet be Dockert, image buildet vagy konténer alapú sandboxot. A `CLAUDE.md` szerint az agent sandbox az SDK `sandbox` opciója.

## 2. Kiinduló állapot

| Ami van                 | Hol                                                                     | Mi lesz vele                                                                   |
| ----------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Provider képességleírók | `src/providers/*.ts` (4 fájl, 1203 sor)                                 | átkerül `packages/providers` alá, szétbontva                                   |
| Drótszintű mérőeszköz   | `tools/wire-probe/` (saját `package.json`, `tsconfig.json`, `bun.lock`) | marad a helyén, de a workspace tagja lesz                                      |
| Gyökér `tsconfig.json`  | `include: ["src/**/*.ts"]`                                              | megszűnik, helyére a `tooling/tsconfig` alapok és a csomagonkénti tsconfig lép |
| `.gitignore`            | gyökér                                                                  | kiegészül, nem íródik felül                                                    |
| `.nvmrc`                | `v26.0.0`                                                               | marad                                                                          |
| Dokumentáció            | `docs/spec`, `docs/plan`, `docs/research`                               | marad                                                                          |

Ami nincs: gyökér `package.json`, `turbo.json`, lint, formázó, teszt futtató, CI.

## 3. Csomagtérkép és függőségi irány

### Csomagok

| Csomag                  | Típus      | Felelősség                                              |
| ----------------------- | ---------- | ------------------------------------------------------- |
| `apps/server`           | alkalmazás | HTTP és WebSocket szerver, futás orchestráció           |
| `apps/web`              | alkalmazás | React 19 és Vite 8 frontend                             |
| `packages/core`         | könyvtár   | domain típusok, typeguardok, `Result`, branded típusok  |
| `packages/db`           | könyvtár   | Drizzle séma, migrációk, repository-k                   |
| `packages/engine`       | könyvtár   | DAG scheduler, node végrehajtók, retry policy           |
| `packages/agent`        | könyvtár   | Agent SDK adapter, event normalizálás                   |
| `packages/providers`    | könyvtár   | provider config fájlok és capability leírók             |
| `packages/protocol`     | könyvtár   | REST és WebSocket kontraktus, egy forrás a két oldalnak |
| `packages/logger`       | könyvtár   | pino és pino-roll, rotációval                           |
| `packages/ui`           | könyvtár   | eggproject-design alapú komponensek                     |
| `tooling/eslint-config` | eszköz     | megosztott flat config                                  |
| `tooling/tsconfig`      | eszköz     | megosztott TypeScript alapok                            |
| `tooling/scripts`       | eszköz     | token takarékos wrapper scriptek                        |
| `tools/wire-probe`      | mérőeszköz | SPEC-000 drótszintű mérés, nem termékkód                |

### Megengedett függőségi irány

| Csomag      | Amitől függhet                                                     |
| ----------- | ------------------------------------------------------------------ |
| `core`      | semmitől a futásidejű függőségek közül                             |
| `logger`    | semmitől a workspace csomagok közül                                |
| `protocol`  | `core`                                                             |
| `providers` | `core`                                                             |
| `db`        | `core`, `logger`                                                   |
| `agent`     | `core`, `providers`, `logger`                                      |
| `engine`    | `core`, `db`, `agent`, `logger`                                    |
| `ui`        | `core`, `protocol`                                                 |
| `server`    | `core`, `protocol`, `db`, `engine`, `agent`, `providers`, `logger` |
| `web`       | `core`, `protocol`, `ui`                                           |

Tiltott: bármely visszafelé mutató él, bármely kör, és az `apps/web` függése a `db`, `engine`, `agent` vagy `server` csomagtól. A `packages/protocol` a kontraktus egyetlen forrása, tehát a `server` és a `web` ugyanabból a csomagból veszi a típusokat, nem duplikálja őket.

### A függőségi irány kikényszerítése

Két, egymást kiegészítő mechanizmus:

1. Az `import-x/no-cycle` szabály a körökre.
2. A csomagok `package.json` `dependencies` mezője. Ami nincs felvéve, azt nem lehet importálni, ezt az `import-x/no-extraneous-dependencies` szabály fogja meg.

A Turborepo 2.x `turbo.json` gyökérszintje ismer egy `boundaries` kulcsot ([turbo.json reference](https://turborepo.dev/docs/reference/configuration)), ami tag alapú import korlátozást ad. A `tags` mező pontos szintaxisát és azt, hogy a `turbo boundaries` parancs a CI-ben hibás kilépési kódot ad-e, a végrehajtás során dokumentációból kell ellenőrizni. Addig a fenti két mechanizmus az elsődleges, a `boundaries` opcionális megerősítés.

## 4. Bun workspace

Bun 1.4.0, kizárólag csomagkezelő és workspace. A futtatás Node 26.

### Gyökér `package.json`

Kötelező mezők:

| Mező                        | Érték                                              | Forrás                                                                                                             |
| --------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `private`                   | `true`                                             | gyökér nem publikálható                                                                                            |
| `type`                      | `"module"`                                         | a `tools/wire-probe/package.json` már ezt használja                                                                |
| `workspaces`                | `["apps/*", "packages/*", "tooling/*", "tools/*"]` | [Bun workspaces](https://bun.com/docs/pm/workspaces)                                                               |
| `devEngines.packageManager` | `{ "name": "bun", "version": "1.4.0" }`            | [Turborepo structuring a repository](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository) |
| `engines.node`              | a `.nvmrc` értékével összhangban                   | `.nvmrc` = `v26.0.0`                                                                                               |

A Turborepo megköveteli a csomagkezelő deklarációját a workspace-ben, ezért a `devEngines.packageManager` nem elhagyható.

**V-2 lezárva, méréssel.** A Turborepo 2.10.12 a `devEngines.packageManager` alakot **önmagában elfogadja**, a régi `packageManager` mező nélkül is. Mindkét mező hiányában a `turbo run` nem nulla kóddal hibázik, és a hibaüzenete maga is a `devEngines` alakot nevezi meg elsőként, a `packageManager` mezőt pedig `legacy` jelzővel. Ezért a gyökér `package.json` **csak** a `devEngines.packageManager` mezőt tartalmazza: két mező azt jelentené, hogy a Bun verziószám két helyen áll, és egy verzióemelésnél szétcsúszhat.

Következmény, amit tudni kell: a `devEngines` mezőt az npm 10.9 óta kikényszeríti, ezért ebben a repóban az `npm` és az `npx` megtagadja a futást (`EBADDEVENGINES`). Ez a mező szándékolt működése. A CI-ben és helyben `bunx` vagy `bun run` használandó, `npx` nem. Részletek: [`../research/2026-08-26-spec001-ellenorzesek.md`](../research/2026-08-26-spec001-ellenorzesek.md), V-2.

A lockfile `bun.lock` (JSONC, szöveges), nem a bináris `bun.lockb`. A `tools/wire-probe/bun.lock` a workspace felállítása után megszűnik, a függőségek a gyökér lockfile-ba olvadnak.

### Verziók egyben tartása

A Bun 1.4 ismeri a `catalog` és `catalogs` mezőt ([Bun catalogs](https://bun.com/docs/pm/catalogs)), amivel a `research` fájlban rögzített verziók egyetlen helyen élnek, és a csomagok `"catalog:"` hivatkozással veszik át. Ezt a spec **kötelezővé teszi** azokra a csomagokra, amik több workspace tagban is szerepelnek: TypeScript, ESLint és pluginjei, Prettier, Vitest, React, `@types/node`. Indok: a `research` fájl az egyetlen verzióforrás, és a katalógus ezt kódban is egyetlen hellyé teszi.

**Bevezetve, a következő alakban.** A katalógus a gyökér `package.json` felső szintű `catalog` kulcsa alatt áll. A dokumentáció szerint a `catalog` és a `catalogs` kulcs a `workspaces` objektumon belül és a `package.json` tetején egyaránt működik, és a `catalog:` hivatkozás a gyökér és a workspace tag `package.json` fájlokban is feloldódik. Utóbbit **élő futtatás igazolta**: a gyökér saját `devDependencies` mezőjében is működik, a `bun.lock` pedig önálló `catalog` blokkban rögzíti a definíciókat.

Ami **literál marad**, és miért: `turbo`, `jiti`, `happy-dom`, `vite`, `vite-plugin-istanbul`, `nyc`, `zod`, `@anthropic-ai/claude-agent-sdk`. Mindegyik pontosan egy `package.json` fájlban szerepel, tehát nincs mit egyetlen forrásba terelni; katalógusba emelésük csak egy indirekciós réteget adna. Az `@anthropic-ai/claude-agent-sdk` külön is szándékosan marad a `tools/wire-probe` csomagban: a pinelése SPEC-000 döntés, és ott kell látszania, ahol a mérés fut.

**Ismert mellékhatás, nem blokkoló.** Az `eslint-plugin-sonarjs` a repo `package.json` fájljait beolvassa a saját függőség-feloldó rétegében, és a Bun `catalog:` protokollt csak a **szülő** `package.json` katalógusából oldja fel. A gyökér `package.json` saját `catalog:` hivatkozásaihoz nincs szülő, ezért a plugin fájlonként `Dependency "X" could not be resolved for catalog "default"` sort ír a stdoutra. Ez a plugin telepített forrásában ellenőrizve (`cjs/helpers/dependency-manifests/resolvers/package-json.js`, a `findClosestParentPackageJsonWithCatalogs` függvény `dir === topDir` ágon azonnal `undefined`-ot ad). Nem hiba, nem befolyásolja a lint kilépési kódját, és a `tooling/scripts/lint.sh` kimenetébe sem szivárog be, mert a wrapper csak az ESLint hibaformátumra illeszkedő sorokat emeli ki.

Tilos `bun:` prefixű modul a termékkódban, tilos `bun test`. A Vitest futtatása `bun run vitest`.

## 5. Turborepo

Turborepo 2.10.12. A `turbo.json` gyökérkulcsa `tasks`, nem `pipeline`.

### Gyökérszintű kulcsok

| Kulcs                  | Tartalom                                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `$schema`              | a Turborepo séma URL-je                                                                                              |
| `globalDependencies`   | `bun.lock`, a `tooling/tsconfig` és `tooling/eslint-config` fájljai, a gyökér Prettier config, a gyökér `turbo.json` |
| `globalEnv`            | `CI`, `NODE_ENV`                                                                                                     |
| `globalPassThroughEnv` | a provider env változói, hogy ne kerüljenek a cache hashbe                                                           |
| `ui`                   | `"stream"` a CI-ben olvasható kimenetért                                                                             |
| `tasks`                | lásd lent                                                                                                            |

A `globalPassThroughEnv` azért kell, mert a `passThroughEnv` alatt felsorolt változók értéke nem számít bele a cache hashbe, tehát az API kulcs jelenléte nem érvényteleníti a cache-t, és nem is kerül a hash bemenetébe.

### Taskok

| Task           | `dependsOn`      | `outputs`                                     | `cache` | `persistent` | Mit csinál                                                    |
| -------------- | ---------------- | --------------------------------------------- | ------- | ------------ | ------------------------------------------------------------- |
| `build`        | `["^build"]`     | `["dist/**"]`                                 | `true`  | `false`      | csak ott van, ahol tényleg keletkezik artefaktum (`apps/web`) |
| `typecheck`    | `["^typecheck"]` | `[]`                                          | `true`  | `false`      | `tsc --noEmit` a csomagra                                     |
| `lint`         | `["^typecheck"]` | `[]`                                          | `true`  | `false`      | ESLint a csomagra, típusinformációval                         |
| `format:check` | `[]`             | `[]`                                          | `true`  | `false`      | Prettier `--check`                                            |
| `test`         | `[]` (lásd lent) | `["coverage/**"]`                             | `true`  | `false`      | Vitest futtatás coverage-dzsel, gyökér-szkópolt task          |
| `test:e2e`     | `["build"]`      | `["playwright-report/**", "test-results/**"]` | `true`  | `false`      | Playwright, saját csomagban                                   |
| `dev`          | `[]`             | nincs                                         | `false` | `true`       | fejlesztői szerver                                            |

A `dependsOn` `^` prefixe a csomag belső függőségeinek azonos nevű taskját várja be. A `lint` azért `^typecheck`-től függ és nem `^build`-tól, mert a könyvtárcsomagok forrás `.ts` alakban fogyaszthatók (6. szekció), tehát nincs mire várni buildként; ha a 6. szekció V-1 ellenőrzése a fordított kimenet mellett dönt, ez `^build`-ra változik.

**A `test` task, utólag igazítva a végrehajtáshoz: `//#test`, `dependsOn: []`.** A 9. szekció
(Vitest) szerint a coverage kizárólag a TELJES folyamatra vonatkozik, a Vitest "Test Projects"
dokumentációja a `coverage` blokkot explicit "Unsupported Option"-ként sorolja fel projekt
szinten ([Test Projects, "Configuration"](https://vitest.dev/guide/projects): _"coverage:
coverage is done for the whole process"_). Emiatt a `test` nem lehet a többi taskhoz hasonló,
csomagonként ismétlődő task: egyetlen, gyökérre szkópolt `//#test` taskként van definiálva
(Turborepo "Registering Root Tasks" mintája,
[configuring-tasks#registering-root-tasks](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks#registering-root-tasks)),
ami a gyökér `package.json` `"test": "vitest run --coverage"` scriptjét futtatja.

Ebből következik, hogy a `^typecheck` (eredeti terv) **nem alkalmazható és félrevezető** lett
volna: a `^` mikroszintaxis a csomag `package.json` `dependencies`/`devDependencies` mezőjében
felsorolt workspace csomagok azonos nevű taskját várja be, a gyökér `package.json`-nak viszont
nincs érdemi függősége a termékcsomagok felé (csak a `tooling/eslint-config`-ra, mint
`devDependencies` belépés). **Élő méréssel igazolva** (`turbo run test --dry=json`, a `//#test`
task `dependsOn: ["^typecheck"]` mellett): a feloldott `dependencies` mező kizárólag
`["eslint-config#typecheck"]`, egyetlen termékcsomag (`packages/core`, `packages/providers`,
`apps/server` stb.) `typecheck` taskja **nem** kerül be a függőségek közé. A `^typecheck` tehát
azt a hamis benyomást keltette volna, hogy a teszt bevárja az összes csomag típusellenőrzését,
miközben ténylegesen csak egy irreleváns eszközcsomagét várná be. Mivel a forrás `.ts`
fogyasztás (V-1) miatt a Vitestnek amúgy sincs mire várnia build- vagy típus-artefaktumként (a
`tsc --noEmit` nem termel semmit, amit a Vitest felhasználna), a helyes és a valósággal
összhangban álló érték `dependsOn: []`. Ez nem a kritérium megkerülése, hanem a spec egy hibás
feltételezésének javítása: a spec eredetileg a `test`-et csomagonként ismétlődő taskként
képzelte el, mielőtt a 9. szekció Vitest-coverage megkötése (gyökér-szkópolt, egyetlen folyamat)
ismertté vált volna. Részletek: [`../research/2026-08-26-spec001-ellenorzesek.md`](../research/2026-08-26-spec001-ellenorzesek.md), V-18.

Az `outputs: []` érvényes és azt jelenti, hogy a task csak a logját cache-eli. A Turborepo saját TypeScript útmutatója pontosan így, `outputs` kulcs nélkül definiálja a típusellenőrző taskot ([TypeScript guide](https://turborepo.dev/docs/guides/tools/typescript)).

### Cache bemenetek

Alapértelmezésben a Turborepo a csomag összes git által követett fájlját hashbe veszi. Explicit `inputs` csak ott kerül be, ahol ez túl tág:

| Task           | `inputs`                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------- |
| `format:check` | `["$TURBO_DEFAULT$"]` kiegészítve a gyökér Prettier configgal (a `globalDependencies` fedi) |
| `test:e2e`     | a Playwright teszt könyvtár és a `playwright.config.ts`                                     |

Máshol az alapértelmezés marad. Indok: a szűkítés csendes cache találatot okozhat olyan változásra, ami valójában érinti a taskot, és ez rosszabb, mint egy fölösleges újrafuttatás.

## 6. TypeScript

TypeScript 6.0.3, fix. A megosztott alapok a `tooling/tsconfig` csomagban élnek.

### Fájlkészlet

| Fájl                          | Kinek                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `tooling/tsconfig/base.json`  | minden csomag közös alapja                                                    |
| `tooling/tsconfig/node.json`  | Node 26 alatt futó csomagok (`apps/server`, `packages/*`, `tools/wire-probe`) |
| `tooling/tsconfig/react.json` | `apps/web`, `packages/ui`                                                     |

### Amit a base beállít

A TS 6.0 alapértelmezései a `research` fájl szerint: `strict: true`, `module: esnext`, `target` a legújabb ES, `types: []`, `noUncheckedSideEffectImports: true`, `libReplacement: false`, `rootDir` a tsconfig könyvtára. **Ezeket a base nem ismétli meg**, mert az alapértelmezés ismétlése zaj, és a 6.0 migrációs útmutató sem kéri.

Amit a base beállít, mert eltér az alapértelmezéstől:

| Opció                                  | Miért                                                                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `exactOptionalPropertyTypes`           | a `Fact<T>` és a leírók opcionális mezői (`EnvironmentRequirement.literalValue`) csak így viselkednek helyesen       |
| `noUncheckedIndexedAccess`             | indexelt olvasás `undefined`-dal, typeguard kényszerítés                                                             |
| `noUnusedLocals`, `noUnusedParameters` | a `CLAUDE.md` szerint a saját változásaink árváit takarítjuk                                                         |
| `noImplicitOverride`                   | öröklésnél explicit `override`                                                                                       |
| `noFallthroughCasesInSwitch`           | átesés csak szándékosan                                                                                              |
| `noPropertyAccessFromIndexSignature`   | index szignatúrás olvasás csak zárójeles alakban, láthatóan                                                          |
| `verbatimModuleSyntax`                 | `import type` kötelező, a type-only import nem tűnik el csendben                                                     |
| `isolatedModules`                      | a Vite és a Node type stripping ugyanazt látja, mint a `tsc`                                                         |
| `erasableSyntaxOnly`                   | Node 26 type strippinggel futtatja a `.ts` fájlt, tehát nem futhat benne `enum`, `namespace` vagy parameter property |
| `noEmit`, `allowImportingTsExtensions` | a `tools/wire-probe/tsconfig.json` már működő mintája: nem emittálunk, a relatív importban `.ts` kiterjesztés van    |

Az `erasableSyntaxOnly` és az `isolatedDeclarations` a research szerint 6.0-ban nem lett alapértelmezett, tehát explicit bekapcsolás kell. Az `isolatedDeclarations` csak akkor kerül be, ha a V-1 ellenőrzés a fordított kimenet mellett dönt, mert csak deklaráció emittálásnál van értelme.

Eltávolított vagy deprecated opció (`baseUrl`, `moduleResolution: node`, `downlevelIteration`, `outFile`, `esModuleInterop: false`, `alwaysStrict: false`, `target: es5`) egyetlen configba sem kerülhet. Az `"ignoreDeprecations": "6.0"` átmeneti kapcsolót sem használjuk: ha valami deprecated, azt megszüntetjük, nem elnémítjuk.

A `node.json` a base fölé `"types": ["node"]` beállítást tesz, mert a 6.0 alapértelmezése üres `types`. A `react.json` a JSX beállítást adja hozzá; a pontos `jsx` értéket a React 19 és a TS 6.0 dokumentációjából a végrehajtás során kell kiolvasni, mert erre a research fájl nem tartalmaz rögzített értéket.

### Csomagok közötti fogyasztás

**V-1, kötelező ellenőrzés a végrehajtás elején.** Két út létezik, és a döntést mérés dönti el, nem feltételezés:

- **(a) Forrás fogyasztás.** A könyvtárcsomagok `package.json` `exports` mezője a `./src/index.ts` fájlra mutat, nincs build lépés, a Node 26 type stripping és a Vite egyaránt a forrást olvassa. Előnye: nincs build sorrend, nincs `dist`, nincs deklaráció emittálás.
- **(b) Fordított kimenet.** Minden könyvtárcsomag `tsc` buildet kap `dist/` kimenettel és deklarációval, az `exports` a `dist`-re mutat, az `isolatedDeclarations` bekapcsol.

Az (a) út blokkoló kockázata: a Node type stripping viselkedése a `node_modules` alatt feloldott, de a workspace-en belülre szimlinkelt csomagoknál nem ismert számunkra dokumentált szinten. Ezt egy minimális, két csomagos próbával kell eldönteni (`packages/core` egy exportált típussal és egy futásidejű függvénnyel, `apps/server` importálja, `node apps/server/src/index.ts` futtatás), és az eredményt a `docs/research/` alá kell vezetni forrás URL-lel együtt. Amíg ez nem dőlt el, a `turbo.json` `build` taskja csak az `apps/web` csomagban létezik.

### Projekt referenciák

**D-1, lezárt döntés.** A user a Turborepo hivatalos ajánlását választotta: **nincs TypeScript
projekt referencia** (`references` mező) a csomagok között, és egyetlen `tsconfig.json` sem
használ `composite: true` vagy `tsc --build` alapú fordítást. Minden csomagnak önálló
tsconfigja van egy közös base-ből (`tooling/tsconfig`), és a build sorrendet kizárólag a
`turbo.json` `dependsOn` mezője adja.

Az indok a Turborepo hivatalos TypeScript útmutatója: _"We don't recommend using TypeScript
Project References as they introduce both another point of configuration as well as another
caching layer to your workspace"_ ([TypeScript guide](https://turborepo.dev/docs/guides/tools/typescript)).
A user ezt az ajánlást fogadta el, ezért a Turborepo cache és a `.tsbuildinfo` egymás elleni,
dokumentált kockázata nem áll fenn: `.tsbuildinfo` sehol nem keletkezik, mert nincs `composite`
build. A V-4 pont (15. szekció) ezzel tárgytalanná vált.

## 7. ESLint

ESLint 10.9.1, kizárólag flat config (`eslint.config.ts` a gyökérben, a szabálykészlet a `tooling/eslint-config` csomagban). Az `.eslintrc` alak megszűnt.

### Bázis konfigok

| Forrás                                                                | Amit hoz                                              | Verzió                                                     |
| --------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------- |
| `tseslint.configs.strictTypeChecked`                                  | típusinformációt használó szigorú alap                | `typescript-eslint@8.68.0`                                 |
| `tseslint.configs.stylisticTypeChecked`                               | stílus, típusinformációval                            | ugyanaz                                                    |
| `unicorn.configs.recommended`                                         | általános szigorítás                                  | `eslint-plugin-unicorn@73.0.0`                             |
| `importX.flatConfigs.recommended` és `importX.flatConfigs.typescript` | import helyesség és feloldás                          | `eslint-plugin-import-x@4.17.1`                            |
| `sonarjs.configs.recommended`                                         | kognitív komplexitás, duplikáció                      | `eslint-plugin-sonarjs@4.2.0`, LGPL-3.0-only, dev függőség |
| `eslint-config-prettier/flat`                                         | a formázási szabályok kikapcsolása, mindig utolsóként | lásd 8. szekció                                            |

Az `eslint-plugin-unicorn` 73.0.0 a `configs.recommended` alakot használja; a régi `configs['flat/recommended']` visszafelé kompatibilitási alias, deprecated. Az `eslint-plugin-import-x` TypeScript feloldásához külön `eslint-import-resolver-typescript` csomag kell, a `settings['import-x/resolver-next']` alakban bekötve.

Típusinformációt igénylő linteléshez a parser `languageOptions.parserOptions.projectService: true` beállítást kap. A typescript-eslint dokumentációja ezt ajánlja a `project` tömb helyett ([parser doc](https://typescript-eslint.io/packages/parser/#projectservice)). A `projectService` és a monorepo több tsconfigja közötti viszonyt a végrehajtás során ellenőrizni kell, mert erre a research fájl nem tartalmaz tényt.

### A CLAUDE.md kódolási elvárásait kikényszerítő szabályok

#### Tilos `any`

| Szabály                                            | Beállítás                                               | Státusz                                                             |
| -------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------- |
| `@typescript-eslint/no-explicit-any`               | `error`, `ignoreRestArgs: false`, `fixToUnknown: false` | létezik, [doc](https://typescript-eslint.io/rules/no-explicit-any/) |
| `@typescript-eslint/no-unsafe-argument`            | `error`                                                 | létezik                                                             |
| `@typescript-eslint/no-unsafe-assignment`          | `error`                                                 | létezik                                                             |
| `@typescript-eslint/no-unsafe-call`                | `error`                                                 | létezik                                                             |
| `@typescript-eslint/no-unsafe-member-access`       | `error`, `allowOptionalChaining: false`                 | létezik                                                             |
| `@typescript-eslint/no-unsafe-return`              | `error`                                                 | létezik                                                             |
| `@typescript-eslint/no-unsafe-function-type`       | `error`                                                 | létezik                                                             |
| `@typescript-eslint/no-unsafe-declaration-merging` | `error`                                                 | létezik                                                             |
| `@typescript-eslint/no-unsafe-enum-comparison`     | `error`                                                 | létezik                                                             |

A `strictTypeChecked` preset ezeket hozza, de a config explicit is felsorolja őket, mert a `CLAUDE.md` konkrét elvárása, és nem függhet attól, hogy egy preset tartalma verzióval változik.

#### Tilos `as`, helyette `satisfies`

| Szabály                                         | Beállítás                     | Státusz                                                                                                                                                |
| ----------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@typescript-eslint/consistent-type-assertions` | `{ assertionStyle: 'never' }` | létezik, az `assertionStyle` értékkészlete `"as" \| "angle-bracket" \| "never"`, [doc](https://typescript-eslint.io/rules/consistent-type-assertions/) |
| `@typescript-eslint/no-unsafe-type-assertion`   | `error`                       | létezik, de **egyetlen preset sem hozza**, explicit bekapcsolás kell, [doc](https://typescript-eslint.io/rules/no-unsafe-type-assertion/)              |

Az `assertionStyle: 'never'` mind az `as X`, mind a `<X>` alakot tiltja. Nincs olyan community szabály, ami a `satisfies` **használatát** írná elő az `as` helyett; a tiltás plusz a code review adja a `satisfies` felé terelést. A `satisfies` operátort egyik szabály sem korlátozza, tehát a `CLAUDE.md` elvárása ezzel a két szabállyal teljesíthető.

Kivétel: az `as const` nem típuskényszerítés, hanem const assertion. Hogy az `assertionStyle: 'never'` beállítás jelzi-e az `as const` alakot, a végrehajtás során egy próbafájllal kell ellenőrizni; ha jelzi, a config `objectLiteralTypeAssertions` vagy fájlszintű kivétel helyett a `satisfies` alakra tér át, `eslint-disable` nélkül.

#### Egy fájlba egy dolog

**Nem ESLint szabály, munkautasítás.** A user tisztázta: ez neki szóló elvárás, nem gépi
kényszer. A `CLAUDE.md`-ben marad mint kódolási elvárás, de a lint ezt nem ellenőrzi, és a
`tooling/eslint-config` alatt **nem** készül hozzá saját szabály.

Ellenőrzött és elvetett community szabály jelöltek, csak dokumentációs célból (ha a döntés
valaha megváltozna, ezekből egyik sem alkalmas közvetlenül):

| Jelölt                                                         | Mit csinál valójában                                                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `max-classes-per-file` (ESLint core)                           | csak osztályt számol, függvényt, típust, konstanst nem                                                   |
| `import-x/max-dependencies`                                    | az importok számát korlátozza, nem az exportokét                                                         |
| `import-x/group-exports`                                       | több named export egyetlen `export` utasításba vonását kéri, tehát pont hogy megengedi a többes exportot |
| `import-x/no-default-export`, `import-x/prefer-default-export` | a default export stílusáról szól, nem a darabszámról                                                     |
| `eslint-plugin-unicorn` 73.0.0, `eslint-plugin-sonarjs` 4.2.0  | nincs ilyen szabályuk                                                                                    |

A `packages/providers` migrációja (13. szekció) a fájlonként egy exportot ettől
függetlenül, kézi fegyelemként követi: minden exportált típus, konstans és leíró szekció
külön fájlba kerül, de ezt lint nem kényszeríti ki.

#### Valódi privát mező a `private` kulcsszó helyett

**Lezárva, kész szabállyal megoldva.** Nem kell saját ESLint plugin csomag. A typescript-eslint
oldalán a "prefer native private class field" szabályjavaslat (`typescript-eslint` issue #10944)
**not planned** státusszal lezárva, tehát community szabály nem várható, de a megoldás az ESLint
core `no-restricted-syntax` szabálya, AST szelektorral. A typescript-eslint AST-jában a
`PropertyDefinition`, a `MethodDefinition` és a `TSParameterProperty` csomópont hordoz
`accessibility` mezőt, aminek értékkészlete `'private' | 'protected' | 'public'` ([AST spec](https://typescript-eslint.io/packages/typescript-estree/ast-spec)).

A pontos, használandó konfiguráció:

```js
'no-restricted-syntax': [
  'error',
  {
    selector: "PropertyDefinition[accessibility='private']",
    message: "Use native ECMAScript private fields (e.g., #field) instead of the TypeScript 'private' modifier.",
  },
  {
    selector: "MethodDefinition[accessibility='private']",
    message: "Use native ECMAScript private methods (e.g., #method) instead of the TypeScript 'private' modifier.",
  },
  {
    selector: "TSParameterProperty[accessibility='private']",
    message: "Do not use 'private' in constructor parameter properties. Define a native private field (#field) and assign the value manually.",
  },
],
```

Amit ellenőriznie kell:

- Osztálymező vagy metódus `private` accessibility módosítóval: hiba, a `#` alak az elvárt.
- Konstruktor parameter property `private` módosítóval: hiba. Ezt egyébként az `erasableSyntaxOnly` TypeScript kapcsoló is fordítási hibává teszi (6. szekció), tehát itt két réteg fedi ugyanazt.
- A `protected` és a `public` módosító nem tárgya ennek a szabálynak.

A végrehajtás során egy próbafájllal még ellenőrizendő, hogy a szelektor ténylegesen jelez-e
(V-8), de a saját szabály fallback út (`require-native-private-fields`) elesett: ez a
konfiguráció a kötelezően használandó megoldás.

#### Egyéb, a CLAUDE.md-ből következő szabályok

| Szabály                                             | Miért                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `@typescript-eslint/switch-exhaustiveness-check`    | a diszkriminált uniók (`Fact`, `EvidenceRef`) teljes lefedése                                           |
| `@typescript-eslint/no-non-null-assertion`          | a `!` ugyanolyan tippelés, mint az `as`                                                                 |
| `@typescript-eslint/explicit-module-boundary-types` | a csomaghatáron átmenő típus nem következtetett                                                         |
| `@typescript-eslint/consistent-type-imports`        | a `verbatimModuleSyntax` párja lint oldalon                                                             |
| `import-x/no-cycle`                                 | a 3. szekció függőségi iránya                                                                           |
| `import-x/no-extraneous-dependencies`               | csak deklarált függőség importálható                                                                    |
| `sonarjs/cognitive-complexity`                      | a küszöb értékét a plugin alapértelmezése adja, saját számot **nem** rögzítünk, mert nincs rá forrásunk |

A `sonarjs/cognitive-complexity` küszöbét a plugin dokumentált alapértelmezésén hagyjuk. Ha a végrehajtás során kiderül, hogy szigorítás kell, az érték csak a plugin dokumentációjából vehető, becsülni tilos.

### Fájlminták

| Minta                               | Eltérés                                                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `**/*.test.ts`, `**/*.spec.ts`      | a `sonarjs/no-duplicate-string` és a `max-lines` jellegű szabályok lazíthatók, mert a teszt ismétlődése szándékos |
| `tooling/**`, `tools/wire-probe/**` | az `import-x/no-extraneous-dependencies` a `devDependencies` importot engedi                                      |
| `**/*.config.ts`                    | default export engedett                                                                                           |

## 8. Prettier

Prettier 3.9.6. Nincs 4.0.

### Munkamegosztás az ESLint-tel

A Prettier formáz, az ESLint nem. A Prettier saját dokumentációja ezt írja az `eslint-plugin-prettier` jellegű integrációról: _"These plugins were especially useful when Prettier was new... But these days you can run `prettier --check .` and most editors have Prettier support."_, és felsorolja a hátrányokat (szerkesztői zaj, lassabb futás, egy réteg indirekció) ([integrating with linters](https://prettier.io/docs/integrating-with-linters)).

Ebből a döntés:

- **Nincs `eslint-plugin-prettier`.**
- Van `eslint-config-prettier`, `eslint-config-prettier/flat` importtal, a flat config tömb **utolsó** elemeként. Ez kikapcsolja azokat az ESLint szabályokat, amik a Prettierrel ütköznének.
- A formázás ellenőrzése önálló task (`format:check`), ami `prettier --check` parancsot futtat. A `--check` a dokumentált CI mód, a `--list-different` csak akkor, ha a listát tovább kell csövezni.

### Konfiguráció

A gyökérben egy Prettier config fájl és egy `.prettierignore`. A `.prettierignore` gitignore szintaxist használ, és alapból kizárt a `node_modules`.

Beállítás: a Prettier 3 alapértelmezéseit **nem írjuk felül tetszőlegesen**. Az alapértelmezések a hivatalos [options](https://prettier.io/docs/options) szerint `printWidth: 80`, `tabWidth: 2`, `trailingComma: "all"` (3.0-ban változott `es5`-ről), `arrowParens: "always"`, `semi: true`, `singleQuote: false`, `endOfLine: "lf"`.

A repo meglévő kódja (`src/providers/*.ts`, `tools/wire-probe/**`) egyszeres idézőjelet és 100 karakter körüli sorhosszt használ. Két opció felülírása ezért indokolt: `singleQuote: true` és `printWidth` a meglévő kódhoz igazítva. A `printWidth` konkrét értékét a végrehajtás során kell meghatározni úgy, hogy a meglévő fájlok formázási diffje minimális legyen, és az értéket a `tooling/scripts` formázó wrapper méri le, nem tippeljük.

## 9. Vitest

Vitest 4.1.11, v8 coverage provider, Node runtime alatt. Futtatás `bun run vitest`, soha nem `bun test`.

### Monorepo mód

A Vitest 3.2 óta a `vitest.workspace.ts` és a `defineWorkspace` deprecated, helyette a gyökér `vitest.config.ts` `test.projects` mezője a dokumentált mód ([Test Projects](https://vitest.dev/guide/projects), [Migration Guide](https://vitest.dev/guide/migration.html)). Emiatt:

- Gyökér `vitest.config.ts`, benne `test.projects` glob mintákkal a `packages/*` és `apps/*` alá.
- Csomagonként saját `vitest.config.ts` csak akkor, ha a csomagnak eltérő környezet kell (`apps/web` és `packages/ui` böngésző jellegű környezetet igényel, a többi Node-ot).
- `vitest.workspace.ts` fájl nem jön létre.

### Coverage

A v8 provider `node:inspector` alapon gyűjt, ezért Node runtime kell, Bun alatt nem működik. A `research` fájl ezt már rögzíti.

Konfiguráció a gyökér `vitest.config.ts`-ben, `test.coverage` alatt:

| Kulcs             | Érték                                                               | Indok                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `provider`        | `'v8'`                                                              | research döntés                                                                                                                                                                                        |
| `thresholds[100]` | `true`                                                              | ez a dokumentált, egyetlen kapcsolós alak a 100 százalékos küszöbre mind a négy metrikán ([coverage config](https://vitest.dev/config/coverage))                                                       |
| `include`         | explicit lista                                                      | Vitest 4-ben a `coverage.all` **megszűnt**, és az alapértelmezés csak a teszt futás alatt betöltött fájlokat fedi; ha a nem tesztelt fájlt is látni akarjuk, az `include` mezőt magunknak kell megadni |
| `exclude`         | explicit lista                                                      | Vitest 4-ben a `coverage.exclude` alapértelmezése **üres tömb**, tehát a korábbi verziók nagy alapértelmezett kizáró listája nincs meg                                                                 |
| `reporter`        | `['text', 'json', 'html', 'lcov']` a végrehajtás során véglegesítve | a `text` a wrapper scriptnek, az `lcov` a CI artefaktumnak                                                                                                                                             |

A `coverage.experimentalAstAwareRemapping` opciót nem állítjuk be: Vitest 4-ben megszűnt, az AST alapú remapping az egyetlen és alapértelmezett mód.

### Az explicit exclude lista tartalma

Mivel a Vitest 4 alapértelmezése üres, a következőket **nekünk** kell kizárni, és mindegyikhez tartozik indok:

| Minta                                       | Indok                                          |
| ------------------------------------------- | ---------------------------------------------- |
| `**/node_modules/**`                        | idegen kód                                     |
| `**/dist/**`, `**/build/**`                 | generált                                       |
| `**/*.config.{ts,js,mts}`                   | konfiguráció, nem viselkedés                   |
| `**/*.d.ts`                                 | csak típus, nincs futásidejű sor               |
| `**/index.ts` barrel fájlok                 | csak újraexport, futásidejű elágazás nélkül    |
| `tools/wire-probe/**`                       | mérőeszköz, nem termékkód, a SPEC-000 hatóköre |
| `tooling/**`                                | build eszköz                                   |
| `packages/db/**/migrations/**`              | generált Drizzle migráció                      |
| `**/*.test.ts`, `**/*.spec.ts`, `**/e2e/**` | maga a teszt                                   |

**A `packages/providers` NEM kizárt.** A spec korábban azt mérlegelte, hogy a leíró fájlokat adat literálként kizárja. A végrehajtás ezt elvetette, és helyette tesztet írt: a `packages/providers/src/**` teljes egészében a coverage hatókörében van, a 100 százalékos küszöb rá is vonatkozik, és teljesül. Amit ez ad:

- Az `isKnown` és az `isUnknown` typeguard valódi unit tesztet kapott (`is-known.test.ts`, `is-unknown.test.ts`), mindkét ágra plusz a típusszűkítésre.
- A leíró fájlokat egy bejáró regressziós teszt (`registry.test.ts`) tölti be, ami a teljes `providerRegistry` fán végigmegy, és minden `Fact` értékre invariánst ellenőriz: pontosan az egyik ágon áll, a `known` ág nem üres bizonyítéklistát hordoz, az `unknown` ág indoklást és blokkoló mérést. Ez nem lefedettség kedvéért írt üres teszt, hanem a SPEC-000 leíró invariánsainak kikényszerítése.
- Ugyanez a teszt fogja meg a 35. elfogadási kritériumot (nincs prózai `M-` hivatkozás a `reason` mezőkben) és a 36. kritériumot (minden hivatkozott `MeasurementId` feloldható `docs/` horgonyra).

A tisztán típusdeklarációt tartalmazó fájlok (`capability/**`, `model-id.ts`, `family-id.ts`, `fact.ts`, `evidence-list.ts`, `evidence-reference.ts`, `measurement-id.ts`) nincsenek kizárva, és nem is kell kizárni őket: futásidejű utasítás nélkül nulla darab utasítással szerepelnek a riportban, tehát sem nem rontják, sem nem javítják a százalékot.

### Modulfeloldás a monorepóban

A Vitest a Vite feloldását használja, és a Vite alapból nem olvassa a `tsconfig.json` `paths` és `baseUrl` mezőit. A dokumentált út a csomagok `package.json` `exports` mezője ([Common Errors](https://vitest.dev/guide/common-errors.html)). Ebből a döntés: a workspace csomagok importja a csomagnév és az `exports` mező alapján történik, `paths` alias nélkül, tehát nincs szükség `vite-tsconfig-paths` pluginra. Ha a V-1 ellenőrzés a forrás fogyasztás mellett dönt, az `exports` a `./src/index.ts`-re mutat, és ezt a Vite feloldja.

## 10. Playwright és e2e coverage

Playwright 1.62.1. A `research` fájl szerint a Playwrightnak nincs beépített coverage funkciója, a Chromium-only `page.coverage` CDP API nem alkalmas React alkalmazás lefedettségére.

### Elhelyezés

Az e2e tesztek önálló workspace csomagba kerülnek (`apps/web` alá `e2e/` alkönyvtárként vagy külön csomagként), saját `playwright.config.ts` fájllal. A `turbo.json` `test:e2e` taskja csak ebben a csomagban létezik, és `dependsOn: ["build"]`, mert lefordított frontend kell hozzá.

A `playwright.config.ts` dokumentált opciói ([test configuration](https://playwright.dev/docs/test-configuration)): `testDir`, `fullyParallel`, `forbidOnly`, `retries`, `workers`, `reporter`, `use.baseURL`, `use.trace`, `projects`, `webServer`, `outputDir`. A `retries` és a `workers` konkrét CI értékét nem rögzítjük itt: a Playwright CI útmutatója a `workers: 1` beállítást ajánlja CI-ben ([CI guide](https://playwright.dev/docs/ci#workers)), ez az egyetlen szám, amire dokumentált forrásunk van. A `retries` értékére nincs, tehát a végrehajtás során kell eldönteni, és a döntést a `docs/research/` alá vezetni.

### E2E coverage váz

A `research` fájl szerint az út: `vite-plugin-istanbul` instrumentálás, majd a `window.__coverage__` mentése Playwrightból.

| Elem                                      | Állapot                                                                                                                                                                                            |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vite-plugin-istanbul` legfrissebb verzió | 9.0.1, npm                                                                                                                                                                                         |
| Vite 8 és Rolldown-Vite támogatás         | **nem igazolt**. A v9.0.0 kiadási jegyzet csak annyit mond, hogy a minimum Vite verzió 7-re nőtt, és hogy a build tooling rolldownra váltott. Explicit Vite 8 kompatibilitási állítás sehol nincs. |
| Plugin opciók                             | `include`, `exclude`, `extension`, `requireEnv`, `cypress`, `checkProd`, `forceBuildInstrument`, `nycrcPath`, `generatorOpts`, `instrumenter`, README                                              |
| Playwright oldali gyűjtés és összefésülés | a plugin saját dokumentációja **nem írja le**. Csak annyit rögzít, hogy a `window.__coverage__` populálódik.                                                                                       |

Ebből a spec állása:

1. A `vite-plugin-istanbul` beépítése a Vite configba `requireEnv: true` mellett, hogy a fejlesztői és a produkciós build ne legyen instrumentálva.
2. Playwright fixture, ami minden teszt után kiolvassa a `window.__coverage__` objektumot és fájlba írja.
3. Az összefésülés és a riport generálás lépése. **A konkrét eszközt (nyc, `istanbul-lib-coverage`, monocart) a végrehajtás során kell kiválasztani**, mert erre hivatalos, a mi verzióinkhoz kötött dokumentációnk nincs.
4. **Az e2e coverage-re ebben a specben nincs küszöb.** A 100 százalékos küszöb a Vitest unit coverage-re vonatkozik. E2E küszöböt csak akkor rögzítünk, ha a gyűjtés stabilan működik, és akkor is külön döntéssel.

Ha a `vite-plugin-istanbul` és a Vite 8 együttműködése a végrehajtás során nem igazolható, az e2e coverage váz elhalasztódik, és ez a spec elfogadási kritériumát nem blokkolja (16. szekció 24. pont).

## 11. Token takarékos wrapper scriptek

A `CLAUDE.md` kötelezővé teszi: minden zajos parancshoz wrapper, ami csak összegzést és a hibákat írja ki. Helyük: `tooling/scripts`.

| Script         | Mit burkol                                                                         |
| -------------- | ---------------------------------------------------------------------------------- |
| `lint.sh`      | `turbo run lint`                                                                   |
| `typecheck.sh` | `turbo run typecheck`                                                              |
| `test.sh`      | közvetlenül a Vitestet (`vitest run --coverage`), nem a `//#test` taskon keresztül |
| `format.sh`    | `prettier --check` és `--write` mód, közvetlenül                                   |
| `build.sh`     | `turbo run build`                                                                  |

**A `test.sh` és a `format.sh`, utólag igazítva a végrehajtáshoz: közvetlen hívás, nem
turbo taskon keresztül.** Mindkét eszköz jellemzője, hogy EGYETLEN futással fedi a teljes
repót (a Vitest coverage-je a fentebb, az 5. szekcióban leírt okból gyökér-szkópolt; a
Prettier natívan egy paranccsal fut végig a fán). Egy csomagonként ismétlődő Turborepo
taskon átvezetni egy már eleve egyetlen, gyökér szintű futást csak indirekciót adna, cache
előnyt nem: a `turbo.json` `//#test` taskja emiatt is létezik és ugyanezt a Vitest parancsot
futtatja, de azt a CI `verify` jobja (`turbo run format:check typecheck lint test`, 12.
szekció) hívja, a Turborepo cache-e kedvéért - a `test.sh` wrapper ettől függetlenül,
közvetlenül hívja a Vitestet, mert a `--reporter=json --outputFile=...` kapcsolóra van
szüksége a strukturált, gépileg olvasható összegzőhöz (teszt szám, coverage
metrikánként), amit egy `turbo run` rétegen át nehezebb kontrollálni. Ez nem a kritérium
megkerülése: a 11. szekció kimeneti szerződése (fejléc, összegzés, hibablokk, teljes
kilépési kód átadás) mindkét wrapperre változatlanul teljesül, csak a burkolt parancs nem
`turbo run <task>` alakú.

### Közös kimeneti szerződés

Minden wrapper ugyanazt a három blokkot adja, ebben a sorrendben:

1. **Fejléc, egy sor.** A parancs neve és a futás időtartama.
2. **Összegzés, egy sor csomagonként vagy egyetlen sor összesen.** Amit tartalmaz: hány egység futott, hány sikeres, hány hibás, hány jött cache-ből.
3. **Hibablokk, csak ha van hiba.** Hibánként egy sor: `<fájl>:<sor>:<oszlop> <szabály vagy hibakód> <üzenet első sora>`.

Amit **nem** ír ki: sikeres egységek részletei, a burkolt eszköz haladásjelzője, banner, verzió kiírás, cache találat sorok egyenként, stack trace, a burkolt eszköz teljes stdoutja.

### Kilépési kód

A wrapper a burkolt parancs kilépési kódját adja tovább. Nulla csak akkor, ha nincs hiba. Hibánál nem nulla, akkor is, ha a hibalistát csonkolta.

### Csonkolás

Ha a hibák száma nagy, a wrapper a hibalistát csonkolja, és az utolsó sorban kiírja, hány hiba maradt ki, valamint a teljes kimenet elérési útját. A csonkolási határ konkrét értékét a végrehajtás során kell meghatározni; erre nincs dokumentált szabály, ezért számot itt nem rögzítünk.

### Teljes kimenet

Minden wrapper a burkolt parancs teljes kimenetét egy fájlba írja a `.turbo` vagy egy `.gitignore`-olt könyvtár alá, és a fájl útját csak hiba esetén nevezi meg. Ez a fájl nem kerül gitbe.

### Nyelv

A wrapperek `bash` scriptek, nem Node programok, hogy a `node_modules` állapotától függetlenül fussanak, és hogy egy hibás telepítés se némítsa el őket.

## 12. GitHub Actions

A `main` védett, PR-rel dolgozunk. A workflow PR-en és a `main`-re irányuló push-on fut.

Action verziók a research fájl szerint: `actions/checkout` v7.0.1, `actions/setup-node` v7.0.0, `oven-sh/setup-bun` v2.2.0, `actions/cache` v6.1.0, `actions/upload-artifact` v7.0.1.

**Ellentmondás lezárva, megerősítve.** Élő ellenőrzés a GitHub API-n (`repos/actions/cache/releases/latest`): az `actions/cache` legfrissebb release-e valóban **v6.1.0** (2026-06-26). A korábbi ellenőrzés, ami a v5.x sorozatot találta legfrissebbnek, elavult volt. A research fájl helyes volt. Ugyanígy megerősítve élő lekérdezéssel: `actions/checkout` v7.0.1, `actions/setup-node` v7.0.0, `oven-sh/setup-bun` v2.2.0, `actions/upload-artifact` v7.0.1. Mind az öt action verzió létező, jelenleg is legfrissebb release tag.

### Jobok és sorrend

| Job       | Függ      | Mit csinál                                                                                   |
| --------- | --------- | -------------------------------------------------------------------------------------------- |
| `install` | nincs     | checkout, `setup-bun`, `bun install --frozen-lockfile`, cache mentés                         |
| `verify`  | `install` | `turbo run format:check typecheck lint test` egy futásban, a Turborepo oldja fel a sorrendet |
| `build`   | `verify`  | `turbo run build`                                                                            |
| `e2e`     | `build`   | Playwright böngésző telepítés, `turbo run test:e2e`                                          |

A `verify` azért egyetlen job, mert a Turborepo a taskok közötti függőséget maga oldja fel, és a négy külön job négyszer telepítené a függőségeket. Ha a futásidő ezt később indokolja, a job szétbontható, de a szétbontás nem alapállapot.

A `--frozen-lockfile` kötelező: a CI nem módosíthatja a `bun.lock` fájlt.

### Cache

| Mit                   | Hogyan                                                                                                                     | Forrás                                                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Turborepo helyi cache | `actions/cache`, path `.turbo`, kulcs `${{ runner.os }}-turbo-${{ github.sha }}`, `restore-keys` `${{ runner.os }}-turbo-` | [Turborepo GitHub Actions guide](https://turborepo.com/docs/guides/ci-vendors/github-actions), hivatalosan dokumentált                                                                                      |
| Bun globális cache    | `actions/cache`, path `~/.bun/install/cache`, kulcs a `bun.lock` hasheből                                                  | a könyvtár hivatalos ([Bun global cache](https://bun.com/docs/pm/global-cache)), de az `actions/cache` recept **nem hivatalos**, a végrehajtás során kell összerakni és mérni, hogy nyer-e időt             |
| Playwright böngészők  | **nem cache-eljük**                                                                                                        | a Playwright CI útmutatója kifejezetten ellenjavallja: a cache visszaállítás ideje összemérhető a letöltéssel, és a Linux rendszerfüggőségek nem cache-elhetők ([CI guide](https://playwright.dev/docs/ci)) |

Az `actions/setup-node` `cache` bemenete `npm`, `yarn` és `pnpm` értéket ismer, **a `bun` nem támogatott érték**. Ezért a Bun cache-t kézzel, `actions/cache` lépéssel kell kezelni, és a `setup-node` csak a Node verziót adja. A `setup-bun` `no-cache` bemenete csak a Bun bináris cache-ét szabályozza, nem a projekt függőségeit.

A remote cache (Vercel) nincs hatókörben. Nincs `TURBO_TOKEN`, nincs `TURBO_TEAM`.

### Artefaktumok

| Mikor       | Mit                                               | Retenció                      |
| ----------- | ------------------------------------------------- | ----------------------------- |
| Mindig      | a `verify` job coverage riportja (`lcov`, `html`) | a végrehajtás során beállítva |
| Hiba esetén | a `e2e` job Playwright riportja és trace fájljai  | a végrehajtás során beállítva |

Retenciós napszámot itt nem rögzítünk, mert nincs rá projekt szintű forrásunk.

### Titok

A CI nem kap MiniMax API kulcsot. A `tools/wire-probe` mérései nem futnak CI-ben, csak a `typecheck` és a `lint` érinti a mérőeszközt. Ezt a `turbo.json` úgy biztosítja, hogy a `tools/wire-probe` csomagban nincs `test` script.

## 13. A `src/providers` migrációja `packages/providers` alá

### Amit a user kért

1. A mappa legyen jól strukturált, ne egymás mellé dobált fájlok.
2. A mérési `M-*` hivatkozások prózai leírása ne keveredjen a production kódba.

### A jóváhagyott megoldás

A kódban marad: a **stabil azonosító** (`M-19`, doksi URL, research szekció azonosító), a **doksi link**, és egy **rövid, egymondatos indok**. A mérés leírása, a nyers számok és az artefaktum hivatkozás a `docs/` alatt marad.

Jelenlegi állapot, amit ez megszüntet: a `minimax.ts` 502 sorában 77 `M-*` hivatkozás van, és több `purpose` illetve `reason` string több mondatos, mért számokat tartalmazó prózát hordoz.

### Mappaszerkezet

Egy fájlba egy dolog, tehát minden exportált típus, konstans és leíró szekció külön fájlba kerül.

```
packages/providers/
  package.json
  tsconfig.json
  CLAUDE.md
  src/
    index.ts                       barrel, csak ujraexport
    evidence/
      CLAUDE.md
      measurement-id.ts            MeasurementId
      evidence-ref.ts              EvidenceRef
      evidence-list.ts             EvidenceList
      fact.ts                      Fact<TValue>
      is-known.ts                  isKnown
      is-unknown.ts                isUnknown
    capability/
      CLAUDE.md
      structured-output-strategy-id.ts
      structured-output-strategy.ts
      structured-output-capability.ts
      tool-choice-value.ts
      tool-choice-capability.ts
      thinking-mode.ts
      thinking-capability.ts
      effort-capability.ts
      prompt-cache-mode.ts
      prompt-caching-capability.ts
      streaming-capability.ts
      server-tool-descriptor.ts
      model-descriptor.ts
      models-endpoint-capability.ts
      rate-limit-bucket.ts
      rate-limit-capability.ts
      concurrency-capability.ts
      environment-requirement.ts
      disallowed-environment-requirement.ts
      provider-capability-descriptor.ts
    references/
      CLAUDE.md
      document-url.ts               nevesitett hivatalos doksi URL-ek
      research-section.ts          nevesitett research szekcio azonositok
      measurement-document.ts       MeasurementId -> docs horgony lekepezes
    minimax/
      CLAUDE.md
      model-id.ts
      family-id.ts
      required-environment.ts
      disallowed-environment.ts
      structured-output.ts
      tool-choice.ts
      thinking.ts
      effort.ts
      prompt-caching.ts
      streaming.ts
      server-tools.ts
      models.ts
      rate-limits.ts
      concurrency.ts
      descriptor.ts                a satisfies kapcsolas
    claude-subscription/
      CLAUDE.md
      (ugyanaz a bontas)
    registry.ts                    a ket leiro egyetlen readonly rekordban
```

Indoklás a bontásra: a `minimax.ts` jelenleg egyetlen 502 soros objektum literál. Csoportonként külön fájlban a diff olvasható marad, egy mérési kör eredménye egyetlen fájlt érint, és az "egy fájlba egy dolog" munkautasítás (7. szekció, `CLAUDE.md` elvárás, nem lint szabály) teljesül.

**Elnevezés, utólag igazítva a végrehajtáshoz.** A fenti fa az `env` és a `doc` rövidítést használja (`env-requirement.ts`, `doc-url.ts`, `measurement-doc.ts`). A végrehajtás ehelyett a teljes szót írta ki (`environment-requirement.ts`, `document-url.ts`, `measurement-document.ts`, és ugyanígy a `minimax/` és `claude-subscription/` alatt `required-environment.ts`, `disallowed-environment.ts`), mert a mappában máshol sehol nincs rövidítés (`concurrency-capability.ts`, `structured-output-capability.ts`, `model-descriptor.ts` mind teljes szót ír ki), és a `references/` mappában két fájl közül az egyiket rövidíteni (`measurement-doc.ts`), a másikat nem (`document-url.ts` -- ha az is rövidítve lenne, `doc-url.ts`) belsőleg következetlen lenne. A típus neve is a teljes szót használja (`EnvironmentRequirement`, lásd 6. szekció), tehát a fájlnév rövidítése a típusnévvel sem lenne összhangban. Ez a spec szövegének utólagos javítása a végrehajtás jobb döntéséhez, nem a fájlok átnevezése a spec szövegéhez: a tényleges kód marad, a fenti fa és a 16. szekció 36. kritériuma lett a valósághoz igazítva.

### A mérési hivatkozás kiemelése

Új fájl: `references/measurement-document.ts` (elnevezés lásd fent). Egyetlen exportált konstans, ami minden `MeasurementId` értéket egyetlen `docs/` horgonyra képez le. Ez teszi lehetővé, hogy a kódban sehol ne legyen próza:

- Az `EvidenceRef` `measurement` variánsa marad, ahogy van: csak `kind` és `id`.
- A prózát a `measurement-document.ts` leképezés oldja fel, a fogyasztó (UI, jelentés) innen kapja a linket.
- A leíró fájlokban a `purpose` és a `reason` mező **egy mondat**, mért szám és artefaktum útvonal nélkül.

Mechanikusan ellenőrizhető szabály, ami ezt kikényszeríti:

1. A `packages/providers/src/**/*.ts` fájlokban a `purpose` és a `reason` string literál **nem tartalmazhat** `M-` mintára illeszkedő mérési azonosítót. A hivatkozás helye az `evidence` mező.
2. Ugyanezek a string literálok nem tartalmazhatnak `tools/wire-probe/artifacts` vagy `docs/measurements` útvonalrészletet.
3. A `//` és `/* */` kommentek nem tartalmazhatnak több mondatos mérési narratívát; a mérési magyarázat helye a `docs/research/2026-08-26-spec000-meresi-jegyzokonyv.md` és a `docs/research/2026-08-26-spec000-kiertekeles.md`.

Az 1. és 2. pontot egy `tooling/scripts` alatti ellenőrző script vagy egy saját ESLint szabály fogja meg; melyik, azt a végrehajtás dönti el. A 3. pont code review kérdés, mert a "több mondatos narratíva" nem definiálható mechanikusan karakterszámra, és a `CLAUDE.md` tiltja a forrás nélküli számhatárokat.

**A migráció nem változtat tartalmat.** Minden `Fact` állapota, értéke és bizonyítéklistája bitre azonos marad. Ami kikerül a kódból, az a próza, és az a `docs/` alá kerül, nem törlődik.

### Import útvonalak

A jelenlegi fájlok relatív, `.ts` kiterjesztéses importot használnak (`from './capability-descriptor.ts'`). Ez a `tooling/tsconfig` `allowImportingTsExtensions` beállítása mellett működik tovább. A csomagon kívülről az import a csomagnév és az `exports` mező alapján történik.

### A `tools/wire-probe` viszonya

A mérőeszköz marad a helyén, mert nem termékkód. A workspace-be illesztése:

- Bekerül a gyökér `workspaces` glob alá (`tools/*`).
- A saját `bun.lock` fájlja megszűnik, a függőségei a gyökér lockfile-ba olvadnak.
- A `tsconfig.json`-ja a `tooling/tsconfig/node.json` fájlt terjeszti ki, és a `types: ["node"]`, `noEmit`, `allowImportingTsExtensions` beállítás onnan jön.
- Kap `typecheck` és `lint` scriptet, hogy a Turborepo gráfban benne legyen. `test` scriptet **nem** kap.
- A `probe`, `proxy`, `summary` scriptjei változatlanok maradnak, mert valós API kulcsot igényelnek és nem futnak CI-ben.
- A coverage `exclude` listája kizárja.

## 14. `CLAUDE.md` fájlok

A `CLAUDE.md` projekt szabály szerint minden mappában vezetni kell egy `CLAUDE.md` fájlt.

### Kötelező tartalom

| Szekció                      | Mit tartalmaz                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `# <útvonal>`                | a mappa útvonala címként                                                                                     |
| `## Mi ez a mappa`           | egy bekezdés a felelősségről, és hogy mi **nem** tartozik ide                                                |
| `## Fájlok`                  | táblázat: fájlnév és egymondatos tartalom, csak ha a mappában konkrét fájlok vannak                          |
| `## Függőségi irány`         | csomag szintű `CLAUDE.md`-ben: mitől függhet ez a csomag, és mitől tilos                                     |
| `## Szabályok`               | a mappára jellemző, a gyökér `CLAUDE.md`-t **kiegészítő** szabályok. Ismételni nem kell, ami a gyökérben áll |
| `## Kapcsolódó dokumentumok` | relatív linkek a specre, planre, researchre                                                                  |

### Hol kell

| Szint                                                  | Példa                                       | Kell                                          |
| ------------------------------------------------------ | ------------------------------------------- | --------------------------------------------- |
| Gyökér                                                 | `CLAUDE.md`                                 | van, marad                                    |
| Alkalmazás                                             | `apps/server/CLAUDE.md`                     | igen                                          |
| Csomag                                                 | `packages/core/CLAUDE.md`                   | igen                                          |
| Csomag alkönyvtár                                      | `packages/providers/src/evidence/CLAUDE.md` | igen, ha a könyvtárnak önálló felelőssége van |
| Eszköz                                                 | `tooling/eslint-config/CLAUDE.md`           | igen                                          |
| Mérőeszköz                                             | `tools/wire-probe/CLAUDE.md`                | van, frissítendő a workspace illesztés után   |
| Generált könyvtár (`dist`, `coverage`, `node_modules`) | nem                                         | nem                                           |

### Amit tilos beleírni

- A gyökér `CLAUDE.md` szabályainak szó szerinti ismétlését.
- Verziószámot, ha az a `docs/research/2026-08-26-toolchain.md` fájlban is szerepel. Helyette link a research fájlra. Így egy verziófrissítés egy helyen történik.
- Mérési narratívát vagy nyers számokat. Azok helye a `docs/research/` alatt van.

### Karbantartási szabály

Ha egy mappa fájlkészlete változik, a `CLAUDE.md` `## Fájlok` táblázata ugyanabban a commitban változik. Ezt a végrehajtás során egy ellenőrző script fogja meg, ami minden nem generált könyvtárra megnézi, hogy létezik-e `CLAUDE.md`, és hogy a `## Fájlok` táblázatban felsorolt nevek megegyeznek-e a könyvtár tartalmával.

## 15. Ellenőrizendő pontok, állás

**A tételes lezárás a [`../research/2026-08-26-spec001-ellenorzesek.md`](../research/2026-08-26-spec001-ellenorzesek.md)
fájlban van**, pontonként a kérdéssel, a válasszal, a bizonyítékkal (forrás URL vagy saját mérés) és
a következménnyel. Az alábbi táblázat csak az állást összegzi.

**19-ből 17 lezárva, 2 nyitva (V-14, V-19).** Feltételezéssel lezárt pont nincs: a nyitva
maradó pontok is explicit, indokolt nyitva-jelöléssel szerepelnek, nem hallgatólagos
feltételezéssel lezárva. A V-18 és a V-19 az elfogadási kritériumok tételes auditja során
merült fel, utólag, a V-1 ... V-17 lezárása után.

| ID   | Amit el kellett dönteni                                                  | Állás                                                                                                                                                                                   |
| ---- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V-1  | Forrás `.ts` fogyasztás szimlinkelt workspace csomagra                   | **Lezárva, méréssel.** Működik. Az (a) forrás fogyasztás út érvényes, minden könyvtárcsomag `exports` mezője `./src/index.ts`, nincs `build` a könyvtárcsomagokban.                     |
| V-2  | Elfogadja-e a Turborepo a `devEngines.packageManager` mezőt önmagában    | **Lezárva, méréssel.** Elfogadja. A `packageManager` mező eltávolítva, csak a `devEngines` marad, hogy a Bun verzió egy helyen álljon.                                                  |
| V-3  | A `boundaries` és `tags` szintaxisa, a `turbo boundaries` kilépési kód   | **Lezárva, méréssel.** Szintaxis igazolt, szabálysértésre 1-es kilépési kód. A funkció kísérleti, ezért **nem vezetjük be**, marad opcionális (3. szekció).                             |
| V-4  | `.tsbuildinfo` és a Turborepo cache viszonya                             | **Lezárva, tárgytalan.** A D-1 döntés szerint nincs projekt referencia, tehát `.tsbuildinfo` nem keletkezik.                                                                            |
| V-5  | A `jsx` compilerOption értéke React 19 és TS 6.0 mellett                 | **Lezárva, dokumentációval.** `"jsx": "react-jsx"`, a TS tsconfig referencia és a Vite hivatalos react-ts sablonja alapján.                                                             |
| V-6  | A `projectService: true` viselkedése több tsconfigos monorepóban         | **Lezárva, dokumentációval.** Monorepóhoz nem kell külön konfiguráció. Az `allowDefaultProject` a csomag `include` mintáin kívüli config fájlokra kell.                                 |
| V-7  | Jelzi-e az `assertionStyle: 'never'` az `as const` alakot                | **Lezárva, méréssel.** Nem jelzi. Az `as const` szabadon használható, nem kell kivétel és nem kell `eslint-disable`.                                                                    |
| V-8  | Jelzi-e a `no-restricted-syntax` szelektor a `private` módosítót         | **Lezárva, méréssel.** Mindhárom szelektor jelez (mező, metódus, parameter property), a `#` alakra nincs jelzés. Saját ESLint plugin nem kell.                                          |
| V-9  | A `sonarjs/cognitive-complexity` alapértelmezett küszöbe                 | **Lezárva, forrásból.** A dokumentált alapértelmezés **15**, a `recommended` config `error` szinten hozza. Saját küszöbszámot nem állítunk.                                             |
| V-10 | A Prettier `printWidth` értéke                                           | **Lezárva, méréssel.** **120.** A Prettier előtti 51 fájlon mért diff minimuma egy 120 és 140 közötti fennsík, ezen belül a 120 a legkisebb sorhossz.                                   |
| V-11 | A `vite-plugin-istanbul` 9.0.1 és a Vite 8 (Rolldown)                    | **Lezárva, méréssel.** Működik. A `requireEnv` pontosan a dokumentált módon kapcsol, az e2e coverage váz nem halasztódik el.                                                            |
| V-12 | Az e2e coverage összefésülő eszköz                                       | **Lezárva, dokumentációval.** `nyc`, a `nyc report --temp-dir` alakban. A Playwright oldali gyűjtést egyik eszköz doksija sem fedi, azt saját fixture oldja meg.                        |
| V-13 | Az `actions/cache` v6.1.0 létezése                                       | **Lezárva, megerősítve.** Élő GitHub API lekérdezéssel igazolva, a research fájl helyes volt.                                                                                           |
| V-14 | A Bun globális cache `actions/cache` receptje nyer-e időt                | **NYITVA.** A cache könyvtár helye hivatalos, de hivatalos `actions/cache` recept nincs, és a kérdés csak GitHub Actions runneren mérhető. Lásd lent.                                   |
| V-15 | A Playwright `retries` CI értéke                                         | **Lezárva, dokumentációval.** Kimondott ajánlás nincs, ezért a dokumentált alapértelmezésen, `0`-n marad. A `workers` CI értéke `1`, arra van kimondott ajánlás.                        |
| V-16 | A wrapper scriptek csonkolási határa                                     | **Lezárva, projekt döntéssel, mérésre támaszkodva.** Marad 50. Dokumentált szabály erre nincs, ezt kimondjuk; a mérés a nagyságrendi keretet adja.                                      |
| V-17 | Az artefaktum retenciós napszám                                          | **Lezárva, projekt döntéssel.** Nem állítunk explicit értéket, a repository alapértelmezése érvényesül. Ajánlott napszámra dokumentált forrás nincs.                                    |
| V-18 | A `//#test` gyökér-szkópolt task `dependsOn` értéke                      | **Lezárva, méréssel.** `[]` a helyes érték, a spec eredeti `^typecheck` javaslata a root taskra nem alkalmazható (lásd 5. szekció, `turbo run test --dry=json` mérés).                  |
| V-19 | A Playwright smoke teszt tényleges böngésző-futtatása ebben a sandboxban | **NYITVA.** `browserType.launch` hibázik, a host rendszerből hiányoznak a böngésző futtatásához szükséges függőségek, a sandbox rootless konténerben ez itt nem telepíthető. Lásd lent. |

### A nyitva maradt pont

**V-14.** Ami igazolt: a Bun globális cache könyvtára `~/.bun/install/cache`
([Bun global cache](https://bun.com/docs/pm/global-cache)), az `oven-sh/setup-bun` kizárólag a Bun
binárist cache-eli, és az `actions/setup-node` `cache` bemenete dokumentáltan csak `npm`, `yarn`,
`pnpm` értéket ismer. Ami nyitva marad: hivatalos `actions/cache` recept nincs, és hogy a lépés
nyer-e időt, az csak GitHub Actions runneren mérhető, hideg és meleg cache összehasonlításával. A
végrehajtási környezet nem GitHub Actions runner, ezért itt nem mérhető, becsülni pedig tilos.

A lezárásához egy PR kell, ami legalább kétszer lefuttatja a workflow-t, és összeveti a
`Cache Bun global cache` plusz `Install dependencies` lépés együttes idejét. Ha nem nyer időt, a
lépés elhagyandó. Ez nem blokkolja a spec elfogadását: a hivatalosan dokumentált `.turbo` cache
ettől függetlenül működik.

**V-19.** Ami igazolt: az `apps/web` Playwright csomagja, a `playwright.config.ts` és a
`webServer` konfiguráció önmagában helyes és működik - `bun run test:e2e` a csomagban a
`vite build && vite preview` párost hibátlanul elindítja, a Playwright a portot eléri. Ami
nyitva marad: a Chromium tényleges elindítása ebben a végrehajtási sandboxban meghiúsul, a
pontos hibaüzenet:

```
Error: browserType.launch:
Host system is missing dependencies to run browsers.
Please install them with the following command:
    sudo npx playwright install-deps
Alternatively, use apt:
    sudo apt-get install libxdamage1
```

A sandbox rootless konténer: `id` szerint `uid=1045(vigilant-clever-mendel)`, nem `0`. A `sudo`
explicit megtagadja a futást (`sudo: The "no new privileges" flag is set, which prevents sudo
from running as root.`), az `apt-get install` pedig `Permission denied`-et ad a dpkg lock
fájlon (`E: Could not open lock file /var/lib/dpkg/lock-frontend`). Nincs jogosultság a hiányzó
rendszerkönyvtárak telepítésére, és ez a végrehajtási környezet korlátja, nem a konfigurációé.

A lezárásához egy olyan futtatókörnyezet kell, ahol a Playwright rendszerfüggőségei
telepíthetők (root jogosultsággal vagy a hivatalos Playwright Docker image-dzsel - a `CLAUDE.md`
Docker-tilalma a termék agent sandboxára vonatkozik, nem a CI futtatókörnyezetére). A GitHub
Actions `ubuntu-latest` runner alapból tartalmazza a szükséges rendszerkönyvtárakat, tehát a CI-n
ez a probléma várhatóan nem jelentkezik - ezt viszont csak egy tényleges CI futtatás igazolhatja,
itt nem. Nem blokkolja a spec elfogadását: a smoke teszt kódja és a Playwright-infrastruktúra
maga helyesen áll, csak ebben a konkrét sandboxban nem futtatható végig.

### Lezárt döntés

| ID  | Döntés                                           | Állás                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-1 | TypeScript projekt referenciák a csomagok között | **Lezárva.** A user a Turborepo hivatalos ajánlását választotta: nincs projekt referencia. Minden csomagnak önálló tsconfigja van egy közös base-ből, `composite` és `references` nélkül, a build sorrendet a `turbo.json` `dependsOn` mezője adja. |

## 16. Elfogadási kritériumok

1. A gyökérben van `package.json`, `private: true`, `type: "module"`, `workspaces: ["apps/*", "packages/*", "tooling/*", "tools/*"]` és csomagkezelő deklaráció. A `bun install --frozen-lockfile` hibátlanul lefut.
2. A gyökérben egyetlen `bun.lock` van, `tools/wire-probe/bun.lock` nem létezik, és a `bun.lockb` alak sehol nem fordul elő.
3. A `research` fájlban rögzített, több csomagban használt verziók (TypeScript, ESLint és pluginjei, Prettier, Vitest, React, `@types/node`) Bun katalógusban vannak, és a csomagok `"catalog:"` hivatkozással veszik át. Egyetlen csomag sem tartalmaz ezekhez literál verziót.
4. A 3. szekció mind a 13 csomagja létezik a megadott útvonalon, mindegyiknek van `package.json`, `tsconfig.json` és `CLAUDE.md` fájlja.
5. A `turbo.json` gyökérkulcsa `tasks`. Nincs benne `pipeline` kulcs. A 7 task (`build`, `typecheck`, `lint`, `format:check`, `test`, `test:e2e`, `dev`) definiált a megadott `dependsOn` és `outputs` értékekkel; a `test` a `//#test` gyökér-szkópolt taskként létezik, `dependsOn: []` értékkel (lásd 5. szekció "A `test` task, utólag igazítva a végrehajtáshoz" és V-18).
6. A `turbo run typecheck` kétszer futtatva másodszorra teljes cache találatot ad, és a wrapper script kimenete ezt sorban jelzi.
7. Egy `packages/core` fájl módosítása után a `turbo run typecheck` újrafuttatja a `core`-tól függő csomagok taskját, és nem futtatja újra a tőle független csomagokét. Ezt a wrapper kimenete igazolja.
8. A `tooling/tsconfig` alatt van `base.json`, `node.json` és `react.json`. Egyik sem tartalmaz TS 6.0-ban eltávolított vagy deprecated opciót, és egyik sem használ `"ignoreDeprecations"` kapcsolót.
9. A `tooling/tsconfig/base.json` nem ismétli meg a TS 6.0 alapértelmezéseit (`strict`, `module`, `types`, `rootDir`), csak az attól eltérő opciókat állítja.
10. A `turbo run typecheck` a teljes workspace-en nulla kilépési kóddal fut, beleértve a `tools/wire-probe` csomagot és a migrált `packages/providers` csomagot.
11. A V-1 döntés eredménye a `docs/research/` alá van vezetve, forrás URL-lel, és a `turbo.json`, a `package.json` `exports` mezői és a `dependsOn` értékek ezzel a döntéssel összhangban vannak.
12. Az ESLint flat config a 7. szekció mind a hat bázis konfigját tartalmazza, az `eslint-config-prettier/flat` az utolsó elem, és `eslint-plugin-prettier` nincs a függőségek között.
13. A `no-explicit-any` és a nyolc `no-unsafe-*` szabály explicit `error` szinten szerepel a configban, nem csak preset öröklésen keresztül.
14. A `consistent-type-assertions` `assertionStyle: 'never'` beállítással és a `no-unsafe-type-assertion` `error` szinten szerepel. Egy szándékosan `as X` alakot tartalmazó próbafájlon a lint hibát ad.
15. Az "egy fájlba egy dolog" a `CLAUDE.md`-ben szerepel mint kódolási elvárás. Nincs hozzá ESLint szabály és nincs `tooling/eslint-config` alatti saját implementáció; a betartás code review kérdése.
16. A `private` kulcsszó tiltása működik: egy szándékosan `private` módosítót tartalmazó próbafájlon a lint hibát ad, a `#` alakon nem. A megoldás a 7. szekcióban rögzített `no-restricted-syntax` szelektor, saját ESLint plugin nélkül.
17. A Prettier config és a `.prettierignore` létezik, a `turbo run format:check` nulla kilépési kóddal fut a teljes repón, és a `printWidth` értéke a V-10 mérésre hivatkozik, nem tippelésre.
18. A gyökér `vitest.config.ts` `test.projects` mezőt használ. `vitest.workspace.ts` fájl nem létezik a repóban.
19. A coverage `provider: 'v8'` és `thresholds[100]: true`. A `coverage.all` opció nem szerepel a configban, mert Vitest 4-ben megszűnt.
20. A coverage `include` és `exclude` explicit lista, és a 9. szekció táblázatának minden sorához tartozik bejegyzés. Az `isKnown` és az `isUnknown` typeguard **benne van** a coverage hatókörében.
21. A `turbo run test` egy szándékosan lefedetlen ágat tartalmazó próbafájllal nem nulla kilépési kóddal fut, tehát a 100 százalékos küszöb ténylegesen kikényszerül.
22. Létezik `playwright.config.ts` az e2e csomagban, a `turbo run test:e2e` task `dependsOn: ["build"]` értékkel van definiálva, és egy triviális smoke teszt lefut. **Környezetfüggő, részben teljesül.** A `webServer` felállítása (`vite build && vite preview`) és a Playwright-infrastruktúra igazoltan működik, de a böngésző tényleges elindítása ebben a végrehajtási sandboxban nem lehetséges: `browserType.launch: Host system is missing dependencies to run browsers` (a Playwright a `sudo npx playwright install-deps` vagy `sudo apt-get install libxdamage1` parancsot javasolja). A sandbox rootless konténer (`uid=1045`, nem `0`), a `sudo` a "no new privileges" flag miatt explicit megtagadja a futást, az `apt-get` pedig `Permission denied`-et ad a dpkg lock fájlon. Ez a végrehajtási környezet korlátja, nem javítható itt. Részletek: [`../research/2026-08-26-spec001-ellenorzesek.md`](../research/2026-08-26-spec001-ellenorzesek.md), V-19.
23. A `vite-plugin-istanbul` be van építve `requireEnv: true` mellett, és létezik a Playwright fixture, ami a `window.__coverage__` objektumot fájlba menti.
24. A V-11 (Vite 8 kompatibilitás) eredménye dokumentálva van a `docs/research/` alatt. Ha a plugin nem működik Vite 8 alatt, ez a tény és a halasztás indoka le van írva, és ez nem blokkolja a spec elfogadását.
25. A `tooling/scripts` alatt létezik mind az öt wrapper (`lint`, `typecheck`, `test`, `format`, `build`), mindegyik bash, mindegyik a 11. szekció három blokkos kimeneti szerződését teljesíti, és a burkolt parancs kilépési kódját adja tovább.
26. Mindegyik wrapper hibás bemenetre nem nulla kilépési kóddal fut, és a kimenete nem tartalmazza a burkolt eszköz teljes stdoutját. Ezt egy szándékosan hibás fájl bevezetése igazolja mind az öt wrapperre.
27. A GitHub Actions workflow létezik, a 12. szekció négy jobját a megadott sorrendben tartalmazza, és a `bun install --frozen-lockfile` alakot használja.
28. A workflow `actions/cache` lépése a `.turbo` könyvtárat cache-eli a hivatalosan dokumentált kulcs mintával, és a Playwright böngészőket **nem** cache-eli.
29. A workflow `actions/setup-node` lépése nem használ `cache: bun` értéket, mert az nem támogatott.
30. A workflow action verziói a `docs/research/2026-08-26-toolchain.md` táblázatával egyeznek. A V-13 ellentmondás lezárva: az `actions/cache` v6.1.0 létezése élő GitHub API lekérdezéssel igazolt.
31. A CI nem kap MiniMax API kulcsot, és a `tools/wire-probe` csomagnak nincs `test` scriptje, tehát a mérések nem futnak CI-ben.
32. A `packages/providers` a 13. szekció mappaszerkezete szerint áll fel, minden fájl pontosan egy dolgot exportál (kézi fegyelem, nem lint-kikényszerített).
33. A `src/providers` könyvtár megszűnt, és a repóban nincs rá mutató hivatkozás a `docs/` alatti historikus szövegeken kívül.
34. A migráció után minden `Fact` mező `state`, `value` és `evidence` értéke bitre azonos a migráció előttivel. Ezt egy összehasonlító futtatás igazolja, ami a régi és az új leírót ugyanabba a normalizált JSON alakba szerializálja.
35. A `packages/providers/src/**/*.ts` fájlokban egyetlen `purpose` vagy `reason` string literál sem tartalmaz `M-` mintájú mérési azonosítót vagy artefaktum útvonalat. Ezt ellenőrző script vagy lint szabály igazolja.
36. Létezik a `references/measurement-document.ts`, ami minden a leírókban hivatkozott `MeasurementId` értéket feloldható `docs/` horgonyra képez le, és nincs feloldatlan azonosító.
37. A `tools/wire-probe` a workspace tagja: szerepel a gyökér `workspaces` glob alatt, a `tsconfig.json`-ja a `tooling/tsconfig/node.json` fájlt terjeszti ki, van `typecheck` és `lint` scriptje, és nincs saját `bun.lock` fájlja.
38. A `tools/wire-probe` `typecheck` és `lint` taskja a Turborepo gráfban nulla kilépési kóddal fut, és a mérőeszköz forrása nem igényelt `any` vagy `as` bevezetést a szigorítás miatt.
39. Minden nem generált könyvtárban van `CLAUDE.md`, a 14. szekció kötelező szekcióival, és egyik sem tartalmaz olyan verziószámot, ami a research fájlban is szerepel.
40. A `CLAUDE.md` teljességet ellenőrző script létezik, és a teljes repón nulla kilépési kóddal fut.
41. A 15. szekció mind a 19 `V-*` pontja rendezett: vagy dokumentált forrásra hivatkozó döntéssel lezárva, vagy saját, most futtatott mérésre hivatkozva lezárva, vagy - V-14 és V-19 esetén - explicit, indokolt nyitva-jelöléssel, ami a végrehajtási környezet igazolt korlátjára hivatkozik. Feltételezéssel (mérés vagy dokumentáció nélkül) lezárt pont nincs.
42. A D-1 döntés lezárva: a user döntése alapján nincsenek TypeScript projekt referenciák a csomagok között, a build sorrendet kizárólag a `turbo.json` `dependsOn` mezője adja.

## 17. Kockázatok

| Kockázat                                                                         | Hatás                                                             | Kezelés                                                                                                                         |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| A Node 26 type stripping nem működik szimlinkelt workspace csomagra (V-1)        | a forrás fogyasztás elesik, minden könyvtárcsomag buildet igényel | a spec mindkét utat leírja, a `turbo.json` `dependsOn` értékei a döntéstől függenek, a bevezetés nem indul a V-1 lezárása előtt |
| A `vite-plugin-istanbul` nem működik Vite 8 alatt (V-11)                         | nincs e2e coverage                                                | a spec ezt nem teszi blokkolóvá, a unit coverage 100 százalékos küszöbe független tőle                                          |
| A `projectService` több tsconfigos monorepóban lassú vagy hibás (V-6)            | a típusinformációt igénylő lint nem futtatható a teljes repón     | visszaesés a `project` tömbre, ami dokumentáltan még támogatott, csak nem ajánlott                                              |
| A 100 százalékos coverage küszöb triviális tesztek írására ösztönöz              | álbiztonság                                                       | az explicit `exclude` lista kiveszi az adat literálokat és a barrel fájlokat, tehát a küszöb valódi logikára vonatkozik         |
| A `packages/providers` szétbontása során elveszik vagy elmozdul egy `Fact` érték | a mérési eredmény csendben elromlik                               | a 16. szekció 34. kritériuma normalizált JSON összehasonlítást ír elő a migráció előtti és utáni állapotra                      |
| A Bun globális cache recept nem hivatalos (V-14)                                 | a CI lassabb marad, vagy a cache lépés hibázik                    | mérés, és ha nem nyer időt, elhagyjuk; a `.turbo` cache hivatalosan dokumentált, az marad                                       |
