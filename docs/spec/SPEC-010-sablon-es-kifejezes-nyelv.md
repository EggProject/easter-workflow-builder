# SPEC-010: A sablon nyelv és a kifejezés nyelv szállított implementációja

|          |                                                                                                                                                                                                                                                                                                                                                                                                |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz  | tervezet, a user jóváhagyására vár                                                                                                                                                                                                                                                                                                                                                             |
| Dátum    | 2026-09-23                                                                                                                                                                                                                                                                                                                                                                                     |
| Előzmény | [`SPEC-004-vegrehajto-motor.md`](SPEC-004-vegrehajto-motor.md) (a két port szerződése, 3.2; az O-1 tétel, 15.), [`SPEC-006-szerver-alkalmazas.md`](SPEC-006-szerver-alkalmazas.md) (az `engine-assembly`), [`SPEC-008-graf-szerkeszto-es-futas-nezet.md`](SPEC-008-graf-szerkeszto-es-futas-nezet.md) (a szerkesztő)                                                                           |
| Bemenet  | [`../research/2026-09-23-sablon-es-kifejezes-nyelv.md`](../research/2026-09-23-sablon-es-kifejezes-nyelv.md) (a nyelvek összevetése), [`../research/2026-09-23-sablon-es-kifejezes-csomagok.md`](../research/2026-09-23-sablon-es-kifejezes-csomagok.md) (a csomagok), [`../research/2026-09-23-megszakitas-leallas-meres.md`](../research/2026-09-23-megszakitas-leallas-meres.md) 4. szekció |
| Kimenet  | egy új workspace csomag (`packages/workflow-language`, két téma mappával), egy új ellenőrzés az `engine` `run-validation` témájában, a két port bekötése az `apps/server` `engine-assembly` témájában, a mentés előtti ellenőrzés az `apps/web` `node-inspector` és `graph-editor` témájában                                                                                                   |
| Terv     | [`../plan/PLAN-010-sablon-es-kifejezes-nyelv.md`](../plan/PLAN-010-sablon-es-kifejezes-nyelv.md)                                                                                                                                                                                                                                                                                               |

---

## 1. Cél és hatókör

**A mai állapot.** A termék ma nem futtat agent lépést. A sablon port szállított implementációja
kimondottan elutasító, tehát minden sablont renderelő lépés (`agent_step` `promptTemplate`,
`human_approval` `bodyTemplate`, `fan_out` `branchLabelTemplate`) a futásakor
`template_render_failed` hibával bukik, a sablon tartalmától függetlenül (mérve,
`docs/research/2026-09-23-megszakitas-leallas-meres.md` 4. szekció). A kifejezés port ugyanígy
elutasító, tehát a `branch`, a `fan_out` és a `loop` csomópont egyike sem jut túl a saját
kifejezésén (M-103). A SPEC-004 O-1 nyitott kérdése ennek az oka: a nyelv megválasztása
termékdöntés volt.

### A user döntése, amit ez a spec megvalósít

| #   | Döntés (2026-09-23)                                    | Alapja                                                  | Hol valósul meg |
| --- | ------------------------------------------------------ | ------------------------------------------------------- | --------------- |
| 1   | A sablon nyelv **Mustache**                            | `docs/research/2026-09-23-sablon-es-kifejezes-nyelv.md` | 4.1, 6. szekció |
| 2   | A kifejezés nyelv **CEL** (Common Expression Language) | ugyanott, 3. és 6. szekció                              | 4.2, 7. szekció |

### Amit eldönt

- Hova kerül a két nyelv implementációja a SPEC-002 6. szekció csomag és mappa konvenciója szerint, és miért kell hozzá új csomag (3. szekció).
- Melyik npm csomag valósítja meg a két nyelvet, pontos, pinelt verzióval, élő registry lekérdezésből, két független forrással (4. szekció).
- Mit lát a sablon és a kifejezés a `RunContext` alakból, és mit nem láthat (5. szekció).
- A Mustache HTML escape alapértelmezését prompt sablonra, dokumentált forrással (6.1).
- A Mustache név feloldásának szűkítését saját adat tulajdonságra, mert a könyvtár alapértelmezett feloldásán át egy sablon mérten leállította a szerver folyamatot (5.2, 6.6).
- A CEL környezet felépítését, a JavaScript és a CEL értékek közötti leképezést mindkét irányban (7. szekció).
- A három kifejezés csomópont típus elvárását és azt, mi történik más típusú eredménynél (7.5).
- A biztonsági korlátokat: melyik dokumentált, és melyik marad nyitott kérdés (8. szekció).
- A hibaosztályokat, és azt, hol látja a felhasználó a hibát (9. szekció).
- A mentés előtti ellenőrzést a szerkesztőben és a futás indítási ellenőrzést a motorban (9.2, 10. szekció).
- A SPEC-004 O-1 lezárását és az átvezetéseket (13. szekció).

### Amit NEM dönt el

- **Nem változtatja meg a két port szerződését.** A `TemplateRendererPort` és az `ExpressionEvaluatorPort` szignatúrája (SPEC-004 3.2) változatlan; a motor továbbra sem ismer nyelvet, csak a portot.
- **A `fan_out` és a `loop` csomópont eredmény kezelése változatlan marad** (M-102). **A `branch` csomópont kezelése a user O-6 döntésével módosul**: a nem string eredmény `expression_evaluation_failed` hibával bukik (7.5, 15. szekció, O-6 lezárva), ami felülírja a SPEC-004 M-102 tényt és az 5. szekció "nincs egyezés, a `defaultBranchKey` dönt" leírását a nem string esetre.
- **Nem vezet be új hibaosztályt.** A meglévő `template_render_failed` és `expression_evaluation_failed` hordozza a fordítási és a futásidejű hibát is (9. szekció).
- **Nem vezet be sablon vagy kifejezés mezőt olyan helyre, ahol ma nincs.** A `systemPrompt`, a `human_approval` `title` és a `sub_workflow` `inputMapping` nem sablon és nem kifejezés.
- **Nem ad számot korlátra dokumentált forrás vagy mérés nélkül.** A csomag dokumentált alapértékein túli korlát nyitott kérdés (8. szekció, 15. szekció).
- **Nem változtatja meg a drótszintű protokollt** (`packages/protocol`): sem sémát, sem hibakódot nem vesz fel.

## 2. Megerősített tények, forrással

Minden sor mögött hivatalos dokumentáció, a publikált csomag forrása, élő registry lekérdezés, vagy
a repó kódjának olvasása áll. Amire nincs forrás, az a 15. szekcióban áll. A számozás `M-100`-tól
indul, hogy a korábbi specek azonosítóival (SPEC-006: `M-1` ... `M-36`, SPEC-007: `M-1` ...
`M-49`, SPEC-008: `M-50` ... `M-94`) ne ütközzön.

### 2.1 A motor és a szerver mai állapota (a kód olvasása, 2026-09-23)

| #     | Tény                                                                                                                                                                                                                                                                                                                                                                                                                                                | Forrás                                                                                                                                                              |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M-100 | A két port: `render(template: string, context: unknown): Outcome<string>` plusz `compile(template: string): Outcome<void>`, illetve `evaluate(expression: string, context: unknown): Outcome<unknown>` plusz `compile(expression: string): Outcome<void>`. Szinkron, kivételt nem vár                                                                                                                                                               | `packages/engine/src/engine-port/template-renderer-port.ts`, `expression-evaluator-port.ts`, SPEC-004 3.2                                                           |
| M-101 | A `render` hívási helyei: `promptTemplate` (`run-agent-step.ts`, a `join` `ai_synthesis` módja is ezen megy), `bodyTemplate` (`execute-human-approval.ts`, a renderelt szöveg a `requestApproval` `body` mezőjébe kerül), `branchLabelTemplate` (`execute-fan-out.ts` `renderItemLabels`, elemenként, `item` és `itemIndex` felülírással; a renderelt címke eldobódik, csak a siker számít)                                                         | a három fájl                                                                                                                                                        |
| M-102 | Az `evaluate` eredményének kezelése: `branch`: nem string eredmény "nincs egyezés", tehát a `defaultBranchKey` dönt, ennek hiányában `branch_no_matching_edge`; `fan_out`: nem tömb eredmény `fan_out_items_not_a_list`; `loop`: nem logikai eredmény `expression_evaluation_failed`                                                                                                                                                                | `execute-branch.ts` `resolveBranchTarget`, `execute-fan-out.ts`, `execute-loop.ts`                                                                                  |
| M-103 | **A motor sehol nem hívja a `compile` metódust** (a `packages/engine/src` alatt a `.spec.ts` fájlokon kívül csak a két port típus deklarálja, és egy komment említi az `execute-fan-out.ts` fájlban). Ebből következik, hogy ma a kifejezés port hiánya sem a futás indításakor jelentkezik, hanem a `branch`, `fan_out` vagy `loop` lépés futásakor, `expression_evaluation_failed` osztállyal, aminek az üzenete idézi az elutasító port szövegét | `grep -rn "compile" packages/engine/src`; a research fájl 4. szekciójának mellékmegfigyelése ugyanezt mérte a sablon portra                                         |
| M-104 | A szerver a `createRejectingExpressionEvaluator()` és a `createRejectingTemplateRenderer()` portot köti be; az `expression_evaluator_unavailable` hibaosztályt kizárólag ez a két fájl állítja elő, és a szerver `error-mapping` témája az `unprocessable` kódra képzi                                                                                                                                                                              | `apps/server/src/engine-assembly/build-engine-dependencies.ts`, a két `create-rejecting-*.ts`, `apps/server/src/error-mapping/map-outcome-message-to-error-code.ts` |
| M-105 | A `RunContext` hét mezője: `input`, `steps`, `item`, `itemIndex`, `iteration`, `joinInputs`, `error`. A `steps` rekord csak a feloldható ősök kimenetét tartalmazza, a fel nem oldható ős **hiányzik** belőle, nem hiba                                                                                                                                                                                                                             | `packages/engine/src/run-context/run-context.ts`, `build-run-context.ts`, SPEC-004 6.1, 6.2                                                                         |
| M-106 | A lépés kimenete a `step_run.output` oszlopba a Drizzle `text` `mode: 'json'` oszlopán át íródik, tehát `JSON.stringify` alakítja szöveggé                                                                                                                                                                                                                                                                                                          | `packages/db/src/step-run/step-run.ts`                                                                                                                              |
| M-107 | A node azonosító a dróton `z.string()`, formai megkötés nélkül                                                                                                                                                                                                                                                                                                                                                                                      | `packages/protocol/src/workflow/workflow-graph-document.ts`                                                                                                         |
| M-108 | A szerkesztő mezőnkénti hibatérképe a `node-inspector` témában épül a `NodeConfigSchema.safeParse` hibáiból (`FieldErrorsContext`, `fieldErrorsFromZodError`), és a `graph-editor` `validateGraphForSave` függvénye hiba esetén nem engedi a `PUT` kérést                                                                                                                                                                                           | `apps/web/src/node-inspector/field-errors-context.ts`, `field-errors-from-zod-error.ts`, `apps/web/src/graph-editor/validate-graph-for-save.ts`                     |
| M-109 | A réteg térkép szerint az `apps/web` és a `packages/engine` egyaránt L5, az `apps/server` L6, a `core` és a `typeguards` L0; azonos rétegen belüli él tilos                                                                                                                                                                                                                                                                                         | `tooling/scripts/src/dependency-graph/package-layer.ts`                                                                                                             |

### 2.2 Mustache (`mustache@4.2.0`)

Részletek és nyers adatok: [`../research/2026-09-23-sablon-es-kifejezes-csomagok.md`](../research/2026-09-23-sablon-es-kifejezes-csomagok.md) 1., 3. és 7. szekció.

| #     | Tény                                                                                                                                                                                                                                                                                                                                                                                                      | Forrás                                                                                                                        |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| M-110 | A `latest` `4.2.0` (2021-03-28), MIT, futásidejű függőség nélkül, ESM belépési ponttal (`mustache.mjs`); a típus a `@types/mustache@4.2.6` csomagban                                                                                                                                                                                                                                                      | `registry.npmjs.org`, `cdn.jsdelivr.net` és `unpkg.com` `package.json`, research 1.                                           |
| M-111 | Minden `{{név}}` alapból HTML escape-elt, nyolc karakter cseréjével (`&`, `<`, `>`, `"`, `'`, `/`, backtick, `=`); a `{{{név}}}` és a `{{& név}}` nyersen ír                                                                                                                                                                                                                                              | README "Variables", mustache(5), `mustache/spec` `interpolation.yml`, a publikált `entityMap`                                 |
| M-112 | Az escape a README szerint kifejezetten nem HTML formátumok sablonozásához cserélhető; a `render` negyedik, `config` argumentuma `escape` függvényt fogad (4.1.0 óta), és az egyedi függvény minden értéktípust megkap                                                                                                                                                                                    | README, a `Writer.prototype.render` doc kommentje, `CHANGELOG.md` 4.1.0, `@types/mustache` `RenderOptions`                    |
| M-113 | A LangChain JS prompt sablonja ugyanezt a hívásonkénti, escape nélküli beállítást használja                                                                                                                                                                                                                                                                                                               | `langchain-core/src/prompts/template.ts`, research 3.4                                                                        |
| M-114 | Hiányzó névre a kimenet üres szöveg; a `mustache.js` ezt kapcsolóval nem teszi szigorúvá                                                                                                                                                                                                                                                                                                                  | README, mustache(5)                                                                                                           |
| M-115 | A `Mustache.parse` hibás sablonra kivételt dob (`Unclosed tag`, `Unopened section`, `Unclosed section`, `Invalid tags`)                                                                                                                                                                                                                                                                                   | a publikált `mustache.js` `parseTemplate`                                                                                     |
| M-116 | A pontozott név köztes szegmenseit a feloldás ellenőrzés nélkül olvassa, az utolsót objektumon a `in` operátorral, függvényen és primitíven saját tulajdonságként fogadja el; így a prototípus lánc nevei és a beépített konstruktorok statikus metódusai is feloldódnak. A feloldott függvényt a `lookup` argumentum nélkül hívja, a függvény értékű szakaszt a szakasz szövegével. A pont névelválasztó | a publikált `mustache.js` `hasProperty`, `primitiveHasOwnProperty`, `Context.prototype.lookup`, `renderSection`; research 3.8 |
| M-132 | **Saját mérés, Node v26.7.0:** a `{{input.items.constructor.fromAsync}}` sablon szinkron `[object Promise]` szöveget ad, majd a folyamat egy kezeletlen promise elutasítás miatt `1` kóddal leáll; a `{{input.constructor.constructor.name}}` kimenete `Function`, a `{{input.items.map}}` szinkron kivételt dob                                                                                          | research 7. szekció                                                                                                           |
| M-133 | A Node alapértelmezett `--unhandled-rejections` módja a v15.0.0 óta `throw`, tehát kezelő nélkül a kezeletlen elutasítás nem elkapott kivételként hat                                                                                                                                                                                                                                                     | a Node `cli.md` és `process.md` dokumentációja, research 5.5                                                                  |
| M-134 | A `Context` és a `Writer` osztály exportált és típusosan deklarált; a `render` egy kapott `Context` példányt változatlanul használ, a `Context.prototype.push` viszont mindig alap `Context` példányt hoz létre                                                                                                                                                                                           | a publikált `mustache.js`, `@types/mustache`, research 3.12                                                                   |
| M-117 | Partial csak a hívó által adott `partials` argumentumból renderelődik; a könyvtár nem olvas fájlt, és a forrásában nincs modul import                                                                                                                                                                                                                                                                     | a publikált `mustache.js` `renderPartial`                                                                                     |
| M-118 | A feldolgozott sablon alapból gyorsítótárba kerül a sablon szövege szerint; a `Mustache.templateCache = undefined` (4.0.0 óta) kikapcsolja                                                                                                                                                                                                                                                                | README "Pre-parsing and Caching Templates", `CHANGELOG.md` 4.0.0                                                              |
| M-119 | Az utolsó npm kiadás 2021-03-28, az utolsó `master` commit 2023-01-21; a repó nem archivált; a GitHub Advisory DB egyetlen aktív tétele a `< 2.2.1` verziókat érinti                                                                                                                                                                                                                                      | `api.github.com`, research 1.                                                                                                 |

### 2.3 CEL és a `@marcbachmann/cel-js@8.0.0`

Részletek: ugyanaz a research fájl, 1., 2. és 4. szekció.

| #     | Tény                                                                                                                                                                                                                                                                                                    | Forrás                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| M-120 | A CEL mellékhatás mentes, terminál, nem Turing-teljes, és csak a gazda alkalmazás által adott adathoz fér hozzá                                                                                                                                                                                         | cel-spec `langdef.md` "Overview", `cel.dev`                                                 |
| M-121 | Van feltételes operátor (`? :`), `has`, `all`, `exists`, `exists_one`, `map`, `filter` makró; map esetén `e.f` a `e['f']` megfelelője, a hiányzó kulcs hiba, a `has(e.f)` a kulcs meglétét adja                                                                                                         | langdef `#macros`, `#field-selection`, `#runtime-errors`                                    |
| M-122 | `int`, `uint` és `double` között nincs automatikus aritmetikai konverzió; az összehasonlítás futásidőben típusok között is értelmezett; a JSON szám CEL `double`                                                                                                                                        | langdef `#values`, `#numbers`, `#dynamic-values`                                            |
| M-123 | A beágyazott makrók ideje exponenciális lehet, és a spec a makró láncolás korlátozását ajánlja az implementációknak                                                                                                                                                                                     | langdef `#macro-performance`, `#performance-limits`                                         |
| M-124 | A `@marcbachmann/cel-js` `latest` `8.0.0` (2026-07-07), MIT, függőség nélküli, csak ESM, beépített típussal, `node >=20.19.0`; a publikált `lib/` alatt nincs `node:` import                                                                                                                            | `registry.npmjs.org`, `unpkg.com` `package.json`, GitHub `v8.0.0` release, research 1., 2.  |
| M-125 | Dokumentált, parse idejű korlátok és alapértékük: `maxAstNodes: 100000`, `maxDepth: 250`, `maxListElements: 1000`, `maxMapEntries: 1000`, `maxCallArguments: 32`. Kiértékelés idejű költség, lépésszám vagy időkorlát opció nincs                                                                       | README "Environment Options", `lib/options.js` `DEFAULT_LIMITS`, `test/limits.test.js`      |
| M-126 | A `new Environment()` alapból elutasítja a nem deklarált változót; `registerVariable(név, típus)` deklarál; `env.check(kifejezés)` kivétel nélkül ad `{ valid, error }` alakot; a `parse` `ParseError`, a kiértékelés `EvaluationError` kivételt dob                                                    | README "Environment Options", "Environment Methods", "Type Checking", "Error Handling"      |
| M-127 | Az `int` eredmény `BigInt`, a `uint` a csomag saját `UnsignedInt` osztályának példánya, a `double` `number`, a map sima objektum, a lista tömb, a `bytes` `Uint8Array`. A `ParseError` a `message` mellett `code`, `range` és `summary` mezőt hordoz, és a `message` a forrás kiemelését is tartalmazza | README "Data Types", "Migrating from `cel-js`", "Error Handling", research 4.11, 4.13, 4.14 |
| M-128 | A hivatalos `google/cel-spec` conformance suite futtatására ennél a csomagnál **nincs bizonyíték**; a három vizsgált JS jelölt közül csak a `@bufbuild/cel` futtatja, béta státusszal                                                                                                                   | research 2.                                                                                 |

### 2.4 JavaScript, JSON és a böngésző

| #     | Tény                                                                                                                                                                                 | Forrás                                                                               |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| M-129 | A `JSON.stringify` `BigInt` értékre `TypeError` kivételt dob; a `NaN` és az `Infinity` értékből `null`, a `Map` objektumból `{}` lesz, csendes adatvesztéssel                        | MDN `JSON.stringify` "Exceptions", "Description"; ECMA-262 `sec-json.stringify`      |
| M-130 | A React a JSX gyerekként kapott szöveget escape-eli; nyers HTML csak a `dangerouslySetInnerHTML` úton kerül a DOM-ba                                                                 | legacy.reactjs.org "JSX Prevents Injection Attacks", react.dev, MDN XSS              |
| M-131 | A kimeneti kódolásnak a kimenet környezetéhez kell illeszkednie; a HTML entitás kódolás HTML környezetre való                                                                        | OWASP XSS Prevention Cheat Sheet, MDN XSS                                            |
| M-135 | Amíg az eseményhurok egy kliens hosszú számításán dolgozik, más kliens kérését nem szolgálja ki; a dokumentált két megoldás a darabolás (partitioning) és a kiszervezés (offloading) | `https://nodejs.org/learn/asynchronous-work/dont-block-the-event-loop`, research 5.6 |

### 2.5 Amit ezekből NEM következtetünk

- **Az M-125-ből nem következik kiértékelési korlát.** A csomag korlátai a kifejezés **szerkezetét** korlátozzák a feldolgozáskor, nem a kiértékelés idejét; egy rövid, beágyazott makrós kifejezés egy nagy listán a korlátokon belül is sokáig futhat (M-123). Ez az O-2 nyitott kérdés.
- **A `cel-go` alapértékeit (research 4.7) nem vesszük át.** Azok egy másik implementáció dokumentált számai; a mi csomagunkra nincs forrásunk arra, hogy ugyanazt jelentenék.
- **Az M-119-ből nem következik, hogy a Mustache elhagyott.** A kiadási és commit dátum a karbantartás ütemét mutatja, nem a hibák számát; a kockázat kezelése a 4.1 szekcióban áll.
- **Az M-128-ból nem következik, hogy a választott csomag hibás.** Azt jelenti, hogy a helyességét a saját mérésünk és tesztünk igazolja a mi három felhasználási mintánkra (PLAN-010 F0), nem egy külső tanúsítvány.

## 3. Hova kerül a kód

### 3.1 A döntés

**Új workspace csomag: `packages/workflow-language`, neve `@easter-workflow-builder/workflow-language`, L1 réteg.** Két téma mappája van:

```
packages/workflow-language/
  package.json
  tsconfig.json
  CLAUDE.md                    a csomag gyokereben, es SEHOL MASHOL
  src/
    index.ts                   barrel, csak nevesitett ujraexport
    mustache-template/
    cel-expression/
```

| Téma                | Mi kerül bele                                                                                                                                                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mustache-template` | a `createMustacheTemplateRenderer()` gyártó függvény, ami a `TemplateRendererPort` alakú `{ render, compile }` objektumot adja (6. szekció); az escape beállítás; a gyorsítótár kikapcsolása; a saját adat tulajdonságra szűkített név feloldás (6.6)                       |
| `cel-expression`    | a `createCelExpressionEvaluator()` gyártó függvény, ami az `ExpressionEvaluatorPort` alakú `{ evaluate, compile }` objektumot adja (7. szekció); a hét változó neve (`RUN_CONTEXT_VARIABLE_NAMES`); a bemeneti leképezés a CEL felé; az eredmény normalizálása JSON értékre |

**A csomag a motor port típusát nem importálja**, mert az L5 rétegen áll (M-109). A két gyártó
függvény visszatérési alakja szerkezetileg azonos a portéval, és az illeszkedést a szerver
`buildEngineDependencies` függvényének `EngineDependencies` visszatérési típusa a `typecheck`
kapun ellenőrzi.

### 3.2 Miért új csomag, a konvenció próbája szerint

A `.claude/CLAUDE.md` 6. szekciója szerint a csomagon belül kell tagolni, nem új csomaggal. Új
csomag csak akkor indokolt, ha egyetlen meglévő csomag sem fogadhatja be a kódot. A kódnak két
fogyasztója van: a szerver (a motor portjaként, L6) és a szerkesztő (a mentés előtti
ellenőrzéshez, L5). **Olyan csomag kell tehát, ami mindkettőnek szigorúan alacsonyabb rétegen áll.**

| Meglévő csomag        | Réteg | Miért nem                                                                                                                                                                 |
| --------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/server`         | L6    | az `apps/web` nem függhet tőle                                                                                                                                            |
| `packages/engine`     | L5    | az `apps/web` azonos rétegen áll, tehát nem függhet tőle (M-109); és a motor nyelvfüggetlensége a SPEC-004 3.2 szerkezeti döntése: a nyelv port mögött él, nem a motorban |
| `packages/protocol`   | L1    | a drótszintű alakok egyetlen forrása Zod sémákból (SPEC-005); egy sablon motor és egy kifejezés kiértékelő futásidejű viselkedés, nem drótszintű alak                     |
| `packages/core`       | L0    | ma egyetlen futásidejű függősége sincs, és a workspace csomagok többsége függ tőle; két nyelvi könyvtár felvétele minden fogyasztójába behúzná őket                       |
| `packages/typeguards` | L0    | általános, újrahasznosítható guardok helye, fájlonként egy guarddal                                                                                                       |
| `packages/ui`         | L2    | domain mentes React komponensek (SPEC-007 3.1)                                                                                                                            |

**A PLAN-004 3. szekció bontási kritériuma a csomagon belül teljesül:** a két téma két, önálló
domain nevű fogalom (sablon és kifejezés), egyetlen fájl sem tartozik mindkettőbe, és a két téma
nem hivatkozik egymásra. A `src/` alatt egy szint mély a szerkezet, harmadik szint nincs.

### 3.3 A név

A SPEC-002 6.9 elnevezési elve próbát ad: ha holnap egy második implementáció érkezik ugyanarra a
funkcióra, megkülönböztethető marad-e. A csomag neve a domain fogalmat nevezi meg (a workflow
felhasználó által írt nyelvei), a **konkrét nyelvet a téma mappa neve nevezi meg**
(`mustache-template`, `cel-expression`). Egy második kifejezés nyelv egy új, saját nevű téma
lenne, tehát a két implementáció megkülönböztethető marad. A tiltott mappanevek listáját
(`.claude/CLAUDE.md` 6.) egyik név sem érinti.

### 3.4 Függőségi irány

| Csomag                       | `dependencies` a spec után                                                                                 | Változás                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `packages/workflow-language` | `@easter-workflow-builder/core`, `@easter-workflow-builder/typeguards`, `mustache`, `@marcbachmann/cel-js` | új csomag; `devDependencies`: `@types/mustache` |
| `apps/server`                | a mai lista plusz `@easter-workflow-builder/workflow-language`                                             | egy új workspace függőség                       |
| `apps/web`                   | a mai lista plusz `@easter-workflow-builder/workflow-language`                                             | egy új workspace függőség                       |
| `packages/engine`            | változatlan                                                                                                | **nem** függ az új csomagtól                    |

A két külső csomag **pontos verzióval** kerül be, tartomány nélkül (4. szekció), és a verzió a
`docs/research/2026-08-26-toolchain.md` fájlban áll. A csomag felkerül a
`tooling/scripts/src/dependency-graph/package-layer.ts` térképre L1 értékkel, különben a
`bun run check:graph` hiányzó réteg-hozzárendelés hibát ad. A csomag forrása nem importálhat
`node:` modult, mert az `apps/web` futásidejű zárt halmazába kerül, és ezt a meglévő
`browser-safe-imports` regressziós teszt őrzi.

### 3.5 Az elvetett alternatívák

| Alternatíva                                                                                          | Miért nem                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| az implementáció az `apps/server` `engine-assembly` témájában, és a szerver a `PUT` végponton fordít | a hiba csak a mentés **után**, a szerver `ProtocolErrorBody.message` szövegében jelenne meg; a `ProtocolErrorBody` mezőútvonalat nem hordoz, tehát a hiba nem kerülhetne a hibás mező alá, amit a `.claude/CLAUDE.md` 11. szekció "kizárólag a mező alatt" szabálya megkövetel. A mezőútvonal felvétele a protokollba SPEC-005 módosítás lenne |
| csak a motor indítási ellenőrzése, szerkesztő oldali ellenőrzés nélkül                               | a user kifejezetten mentés előtti ellenőrzést kért; a hiba így csak a "Futtatás" gombra jelentkezne                                                                                                                                                                                                                                            |
| két külön csomag (`template-mustache`, `expression-cel`)                                             | a `.claude/CLAUDE.md` 6. szekció szerint a csomagon belül kell tagolni; a két téma ugyanazt a két fogyasztót szolgálja ki, ugyanazon a rétegen                                                                                                                                                                                                 |

## 4. A választott npm csomagok

A verziók élő registry lekérdezésből jönnek, két független forrással, és a
`docs/research/2026-08-26-toolchain.md` fájlba vannak vezetve (research 1. szekció).

### 4.1 Mustache: `mustache@4.2.0`, típus: `@types/mustache@4.2.6`

A `mustache.js` a Mustache nyelv referenciaként kezelt JavaScript implementációja, futásidejű
függőség nélkül (M-110). **A karbantartási kockázat kimondva:** az utolsó kiadás 2021-es (M-119).
A kezelése:

1. **Pontos verzió**, tartomány nélkül, tehát egy új kiadás nem kerül be csendben.
2. **A felhasznált felület szűk**: `parse`, `render` a `config.escape` argumentummal, és a
   `templateCache` beállítás, ami dokumentált (M-112, M-115, M-118), plusz az exportált `Context`
   osztály alosztálya a 6.6 szerint, ami forrásszintű viselkedésre épül (M-134), ezért mérés és
   teszt őrzi. Ennél többre nem építünk.
3. **Az ismert sebezhetőség régi és javított** (`< 2.2.1`, M-119), és helper nincs, tehát a
   sablon motorok legsúlyosabb CVE osztálya (helper láncon át a `Function` konstruktorig) nem
   értelmezhető rá (`2026-09-23-sablon-es-kifejezes-nyelv.md` 6. szekció).
4. **A név feloldás viszont túlnyúlik az adaton, és ezt a saját mérésünk kimutatta** (M-116,
   M-132): egy sablon a beépített konstruktorok statikus metódusait is meghívhatja, és egy ilyen
   hívás a szerver folyamatát leállította. A kezelése a 6.6 szekció: a név feloldás saját adat
   tulajdonságra szűkül, és a mechanizmust a PLAN-010 F0 blokkoló mérése igazolja.

### 4.2 CEL: `@marcbachmann/cel-js@8.0.0`

A három vizsgált JavaScript implementáció összevetése a research 2. szekciójában áll. **A
választás a `@marcbachmann/cel-js`**, mert egyedül ez egyszerre karbantartott (nem archivált, az
utolsó commit 2026-07-07), függőség nélküli (M-124), és egyedül ennek vannak dokumentált,
alapértékkel bíró korlátai (M-125). A `cel-js` (ChromeGG) archivált, és a saját README-je a
választott csomagot ajánlja utódként. A `@bufbuild/cel` az egyetlen conformance tesztelt jelölt,
de béta státuszú, dokumentált korlátja nincs, és a map, lista eredménye saját osztály, nem JSON
alak (research 2.).

**A fiatal JS binding kockázata, és a kezelése.** A csomag 2025-06-13 óta létezik, 87 kiadással,
sűrű főverzió lépéssel, és a hivatalos conformance suite futtatására nincs bizonyíték (M-128). A
kezelés négy eleme:

1. **Pontos, pinelt verzió** (`8.0.0`), tartomány nélkül. Egy frissítés külön, forrásolt lépés:
   élő registry lekérdezés két forrással, a toolchain research átvezetése, és a 2. pont mérésének
   megismétlése regresszióként, ugyanúgy, ahogy az Agent SDK frissítése előtt a SPEC-000 mérései
   futnak (`.claude/CLAUDE.md` 9.).
2. **Blokkoló mérés a terv elején** (PLAN-010 F0): a pinelt csomag a valódi `RunContext` alakon
   ténylegesen kifejezi-e a három csomópont igényét (7.5), és a 7.3, 7.4 leképezés úgy viselkedik-e,
   ahogy a spec leírja. **Amíg a mérés nem zöld, egyetlen sor termékkód sem íródik.**
3. **A saját felhasználásunk tesztje a csomag valódi példányán fut**, mock nélkül: amit mi
   használunk belőle, azt a mi tesztünk igazolja (12.1).
4. **Kimondott visszaút:** ha a mérés azt mutatja, hogy a csomag valamelyik igényt nem teljesíti,
   a terv megáll, és a kérdés a userhez megy; a következő jelölt a `@bufbuild/cel`, aminek a
   bevezetése a 7.4 normalizálás átírását igényli (saját `CelMap` és `CelList` osztály), tehát
   spec módosítás, nem csendes csere.

## 5. A kontextus: mit lát a sablon és a kifejezés

### 5.1 A hét változó

A két nyelv **kizárólag** a motor által átadott `RunContext` objektumot látja (M-100, M-105), mindkettő
ugyanazt.

| Változó      | Mikor van értéke                                                                | A kifejezés (CEL) ezt látja          | A sablon (Mustache) ezt látja |
| ------------ | ------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------- |
| `input`      | mindig: a futás bemenete, a `start` csomópont kimenete                          | az érték, változatlanul              | az érték                      |
| `steps`      | mindig: node azonosító -> a látható ős példány kimenete (SPEC-004 6.2)          | map, változatlanul                   | objektum                      |
| `item`       | a legbelső `fan_out` hatókörben; a `fan_out` címke sablonjánál az aktuális elem | az érték, vagy `null`, ha nincs      | az érték, vagy hiányzó név    |
| `itemIndex`  | ugyanott                                                                        | CEL `int`, vagy `null`               | szám, vagy hiányzó név        |
| `iteration`  | a legbelső `loop` hatókörben                                                    | CEL `int`, vagy `null`               | szám, vagy hiányzó név        |
| `joinInputs` | kizárólag a `join` csomópontnál (a `join` `ai_synthesis` prompt sablonja látja) | lista, vagy `null`                   | tömb, vagy hiányzó név        |
| `error`      | kizárólag az `error_handler` csomópontnál                                       | `{ kind, message }` map, vagy `null` | objektum, vagy hiányzó név    |

**Az `error` ma egyetlen sablon vagy kifejezés mezőben sem látszik**, mert az `error_handler`
csomópontnak nincs ilyen mezője (SPEC-003 4.3). A változó ettől még deklarált, mert a `RunContext`
része, és a 11.2 sodródás védelem a teljes mezőlistát őrzi.

### 5.2 Mit nem láthat

| Mit                           | Miért nem láthatja                                                                                                                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| env változó, titok            | a `RunContext` env **értéket** nem tartalmaz: a provider env blokkját a motor `provider-environment` témája külön, a `processEnvironment` porton át építi, és sem üzenetben, sem kimenetben nem ad vissza értéket (SPEC-004 14.3, 64. kritérium). A két nyelv más objektumot nem kap |
| fájlrendszer                  | a Mustache nem olvas fájlt, partial csak a hívó által adott argumentumból jön, és a mi hívásunk nem ad partialt (M-117); a CEL mellékhatás mentes, és csak a gazda által adott adatot éri el (M-120)                                                                                 |
| globális objektum, modul, kód | a CEL nem Turing-teljes, függvényt a gazda regisztrál, és mi egyet sem regisztrálunk (7.1); a Mustache név feloldása a 6.6 szerint kizárólag saját adat tulajdonságot ér el, és függvényt nem hív                                                                                    |
| más fan-out ág kimenete       | a `steps` rekord csak az ős példányokat tartalmazza (SPEC-004 6.2)                                                                                                                                                                                                                   |

**Amit ez a spec nem véd, és kimondja:** egy agent lépés kimenete adat, és ha egy agent maga ír ki
titkot a kimenetébe, azt a `steps` rekord tovább viszi. A titok védelme a
`provider-environment` szabályán áll, nem a nyelven (`.claude/CLAUDE.md` 7. szekció).

**A Mustache alapértelmezett név feloldása a `RunContext` adatán túl is elér, és ez mérten
veszélyes** (M-116, M-132). A pontozott név köztes szegmensei ellenőrzés nélkül olvasódnak, így egy
sablon a JavaScript beépített objektumaihoz jut (`{{input.constructor.constructor.name}}` kimenete
`Function`), és a talált beépített függvényt meg is hívja. A saját mérésünkben a
`{{input.items.constructor.fromAsync}}` sablon egy kezeletlen promise elutasítást okozott, ami
a Node alapértelmezett módjában (M-133) a folyamatot `1` kóddal leállította: **egyetlen
felhasználó által írt sablon a teljes szervert leállíthatja**, és ezt a `render` körüli
`try`/`catch` nem fogja meg, mert az elutasítás a visszatérés után történik. Ezért a spec a
Mustache név feloldását a 6.6 szekció szerint saját adat tulajdonságra szűkíti.

### 5.3 Hivatkozás egy korábbi lépés kimenetére

A `steps` kulcsa a node azonosító, ami a dróton tetszőleges szöveg (M-107).

| Nyelv    | Alak                         | Mikor működik                                                                       |
| -------- | ---------------------------- | ----------------------------------------------------------------------------------- |
| CEL      | `steps["<azonosító>"].mező`  | mindig, mert map esetén a `e["f"]` és a `e.f` egyenértékű (M-121)                   |
| CEL      | `steps.azonosító.mező`       | csak akkor, ha az azonosító CEL azonosító szintaxisú                                |
| Mustache | `{{steps.<azonosító>.mező}}` | csak akkor, ha az azonosító nem tartalmaz pontot, mert a pont névelválasztó (M-116) |

### 5.4 A hiányzó adat

- **CEL:** a hiányzó map kulcs hiba (M-121), tehát a lépés `expression_evaluation_failed` osztállyal bukik. Opcionális mezőt a `has()` makróval kell vizsgálni, például `has(input.prioritas) ? input.prioritas : "normal"`.
- **Mustache:** a hiányzó név viselkedése O-4 szerint kettéválik. A sima változó tag (`{{név}}`, `{{{név}}}`, `{{& név}}`) fel nem oldható neve **`template_render_failed`** hibát ad, megnevezve a nevet (6.7). A szakasz és a fordított szakasz (`{{#név}}...{{/név}}`, `{{^név}}...{{/név}}`) hiányzó névvel változatlanul a Mustache alapértelmezett, hiba nélküli viselkedését kapja (M-114), mert ott a hiány a szándék.

## 6. A sablon nyelv: Mustache

### 6.1 A HTML escape: a prompt sablon alapértelmezése a nyers szöveg

**A döntés: a `{{név}}` behelyettesítés escape nélkül, szövegként írja az értéket, mindhárom
sablon mezőben** (`promptTemplate`, `bodyTemplate`, `branchLabelTemplate`). A `{{{név}}}` és a
`{{& név}}` ettől változatlanul nyers, tehát a három alak ugyanazt adja.

Az indok, forrással:

1. **Egy prompt nem HTML.** A kimeneti kódolásnak a kimenet környezetéhez kell illeszkednie, és a
   HTML entitás kódolás HTML környezetre való (M-131). A motor a renderelt promptot változatlanul a
   `query()` `prompt` mezőjébe adja (SPEC-004 3.3), nem jeleníti meg HTML-ként.
2. **A könyvtár maga nevezi meg ezt az esetet.** A README szerint az escape kifejezetten nem HTML
   formátumok sablonozásához cserélhető (M-112).
3. **Egy független prompt eszköz ugyanígy dönt.** A LangChain JS prompt sablonja hívásonként
   kikapcsolja az escape-et (M-113).
4. **Az alapértelmezett escape a prompt tartalmát rontaná.** Egy kód részletet, egy
   összehasonlítást vagy egy idézőjeles szöveget tartalmazó bemenet `&lt;`, `&gt;`, `&quot;` és
   `&#x2F;` alakban érne a modellhez (M-111), ami nem az, amit a felhasználó írt.
5. **A megjelenítés HTML környezetében a React escape-el** (M-130). A `bodyTemplate` renderelt
   szövege a jóváhagyás panelen jelenik meg (SPEC-008 8. szekció); JSX gyerekként, szövegként
   renderelve a HTML kódolás a helyes rétegben, a megjelenítéskor történik. Az `apps/web` és a
   `packages/ui` forrásában ma nincs `dangerouslySetInnerHTML` (a 2026-09-23-i forrás keresése
   szerint), és ezt a jövőben greppes invariáns őrzi (16. szekció, 31. kritérium).

**Az ellenpélda kimondva.** A Microsoft Semantic Kernel alapból kódolja a prompt tartalmat, de a
dokumentált oka az, hogy a promptot XML szerű jelölésként elemzi; a mi motorunk a promptot nem
elemzi, tehát ez az ok ránk nem érvényes (research 6. szekció).

**A megvalósítás módja.** Az escape a `Mustache.render` negyedik, `config` argumentumában, **hívásonként**
áll (M-112), egy `(value: unknown) => string` függvénnyel, ami az értéket a 6.5 szerint alakítja
szöveggé: szám, logikai érték és `null` `String(value)` alakra, tömb és sima objektum
`JSON.stringify(value)` alakra (O-5 lezárva). **A globális `Mustache.escape` felülírása tilos**, mert az a modul minden hívóját
érintené; ugyanezt az okot a LangChain JS forrása is kimondja (M-113).

### 6.2 `compile` és `render`

| Művelet                     | Mit tesz                                                                                               | Hibaág                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `compile(template)`         | `Mustache.parse(template)`, az eredményt eldobja                                                       | a kivétel üzenete `Outcome` hibaágba kerül, a könyvtár szövegével (M-115)  |
| `render(template, context)` | `Mustache.render(template, <a 6.6 szerinti Context alosztály a context körül>, undefined, { escape })` | minden kivétel `Outcome` hibaágba kerül; kivétel nem hagyja el a függvényt |

**Kivétel nem repül ki a csomagból.** A két könyvtár kivételt dob (M-115, M-126), a projekt
konvenciója `Outcome` (SPEC-004 F-24), ezért mindkét gyártó függvény minden kimenete `Outcome`, a
hibaág szövege a könyvtár üzenete egy magyar előtaggal. A hibaosztály nevét **nem** a csomag teszi
hozzá, hanem a hívó: a motor a saját `formatEngineErrorMessage` függvényével (9.1).

### 6.3 A sablon gyorsítótár kikapcsolva

A `mustache.js` minden feldolgozott sablont a szövege szerint gyorsítótárba tesz, felső korlát
nélkül (M-118). A szerkesztőben a mentés előtti ellenőrzés minden szerkesztett változatot lefordít
(10. szekció), tehát egy munkamenet alatt a gyorsítótár minden valaha begépelt változatot
megtartana. **A `createMustacheTemplateRenderer()` a dokumentált `Mustache.templateCache = undefined`
beállítással kikapcsolja.** Ez modul szintű állapot; a workspace-ben a `workflow-language` csomag az
egyetlen, ami a `mustache` csomagot importálja, és ezt greppes invariáns őrzi (16. szekció, 7.
kritérium); a kikapcsolást a 12. kritérium futtatott tesztje igazolja.

### 6.4 Mit tud a nyelv a mi kontextusunkon

| Szerkezet                                   | Viselkedés                                            |
| ------------------------------------------- | ----------------------------------------------------- |
| `{{input.tema}}`                            | pontozott név feloldása                               |
| `{{#input.elemek}}- {{.}}{{/input.elemek}}` | szakasz egy tömbön: elemenként renderel               |
| `{{^input.elemek}}nincs{{/input.elemek}}`   | fordított szakasz: üres vagy hiányzó értékre renderel |
| `{{> név}}`                                 | mindig üres, mert a hívás nem ad partialt (M-117)     |
| `{{=<% %>=}}`                               | a határoló csere a nyelv része, tiltás nélkül         |

### 6.5 A behelyettesített érték szöveggé alakítása

**A döntés (O-5 lezárva, 2026-09-23, user döntés): tömb és objektum JSON szövegként íródik ki,
nem `[object Object]` és nem vesszővel összefűzve.** Az escape függvény ezért típus szerint dönt:
a szám, a logikai érték és a `null` a szokásos szöveges alakját kapja (`String(value)`); a tömb és
a sima objektum (a 7.4 szerinti prototípus alapú guarddal felismerve, `Object.prototype` vagy
`null` prototípussal) a `JSON.stringify(value)` eredményét kapja. Egy korábbi lépés strukturált
kimenetének egésze ezért egyetlen `{{steps.x}}` hivatkozással is olvasható a promptban, JSON
alakban; a mezőnkénti vagy szakaszos bejárás (6.4) emellett továbbra is elérhető, ha csak egy-egy
mezőre van szükség.

**Miért nem dobhat kivételt a `JSON.stringify`.** A sablon kontextusa kizárólag a `RunContext`
adata (5.1), ami a `step_run.output` JSON kerekútján (M-106) vagy közvetlenül a futás bemenetéből
származik, tehát nem tartalmazhat `BigInt`, `Map` vagy más nem JSON értéket (M-129); a CEL
kifejezés eredménye is a 7.4 szerint már JSON-ra normalizálva kerül a `steps` rekordba, mielőtt a
sablon látná. A `JSON.stringify` a sablon kontextusán emiatt kivétel nélkül fut.

### 6.6 A név feloldás szűkítése saját adat tulajdonságra

**A döntés.** A renderelés csak olyan nevet old fel, aminek **minden** szegmense a nézet adatának
saját tulajdonsága, és a feloldott értéket **soha nem hívja meg** függvényként. Minden más név
hiányzó névként viselkedik, tehát üres szöveget ad (M-114). A szerződés: a sablon kimenete
kizárólag a `RunContext` adatából állhat elő, és a renderelés egyetlen, a nézetben vagy a
prototípus láncon álló függvényt sem hív meg. Ennek oka az 5.2 szekcióban mért leállás (M-132).

**A mechanizmus, és miért ez.** A `mustache.js` a `Context` osztályt exportálja, és a `render`
egy kapott `Context` példányt változatlanul használ (M-134). A `createMustacheTemplateRenderer()`
egy saját `Context` alosztállyal hív, ami:

1. a `lookup` metódust saját tulajdonságra szűkített feloldásra cseréli, a szülő kontextus
   bejárásával, a `.` névvel és a pontozott névvel együtt, függvényhívás nélkül;
2. a `push` metódust úgy cseréli, hogy a szakaszok belsejében is ugyanez az alosztály álljon,
   mert a könyvtár `push` metódusa alap `Context` példányt hozna létre (M-134).

Ez a könyvtár forrásszintű viselkedésére épül, nem dokumentált bővítési pontra. Ezért a pontos
verzió (4.1), a PLAN-010 F0 mérése és a valódi könyvtáron futó teszt együtt igazolja, és a
könyvtár frissítése előtt ez a mérés is regresszióként fut.

**Az elvetett alternatívák.**

| Alternatíva                              | Miért nem                                                                                                                                                                                                                                                                                                |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a nézet null prototípusú mély másolata   | a tárolókon megszünteti a `constructor` elérést, de a primitív érték (szöveg, szám, logikai) a pontozott névben objektummá alakul, így a `String`, `Number` és `Boolean` konstruktor továbbra is elérhető (research 7.: `{{input.tema.constructor.name}}` kimenete `String`); a szerződés nem teljesülne |
| a veszélyes nevek tiltólistája           | minden új beépített metódussal elavul; a mért leállást okozó `Array.fromAsync` is egy újabb nyelvi elem                                                                                                                                                                                                  |
| `unhandledRejection` kezelő a szerverben | csak a mért tünetet fogná meg, a beépített függvények hívását nem akadályozná meg                                                                                                                                                                                                                        |

**A kimondott visszaút.** Ha a F0 mérés szerint az alosztály a szakaszokon, a fordított
szakaszokon vagy a pontozott neveken eltér a könyvtár dokumentált viselkedésétől, vagy a támadó
sablon lista bármely eleme függvényt hív, a terv megáll, és a kérdés a userhez megy: a lehetséges
következő lépés (saját, a Mustache részhalmazát renderelő kód, vagy egy másik Mustache
implementáció) a user döntését igényli.

### 6.7 A hiányzó név szigorú kezelése (O-4 lezárva)

**A döntés, 2026-09-23, user döntés: hiba legyen.** A sima változó tag (`{{név}}`, a nyers
`{{{név}}}` és a `{{& név}}` is) fel nem oldható neve **`template_render_failed`** hibát ad,
megnevezve a nevet. **Ez kizárólag a sima változó tagra vonatkozik.** A szakasz és a fordított
szakasz (`{{#név}}...{{/név}}`, `{{^név}}...{{/név}}`) hiányzó névvel változatlanul a Mustache
szemantikája szerint viselkedik (M-114): a szakasz nem renderel, a fordított szakasz igen, mert
ott a hiány maga a szándék (egy opcionális blokk vagy egy "nincs elem" ág).

**A mechanizmus.** A `mustache.js` erre nem ad kapcsolót (M-114), tehát saját ellenőrzés kell, a
6.6 szerinti feloldási szabály pontos követésével: a saját `Context` alosztály meg tudja
különböztetni, hogy egy `lookup` hívás sima változó feloldásból jön-e (a `Writer.prototype.render`
`{{név}}` ága) vagy szakaszból (`renderSection`, `renderInverted`), mert a könyvtár a kettőt külön
hívja. A sima változó ágon egy fel nem oldható név (a 6.6 szerinti, saját tulajdonságra szűkített
feloldás szerint hiányzó) a `render` hívást hibaágra viszi, a nevet idézve; a szakasz ágon a
hiányzó név a könyvtár alapértelmezett, hiba nélküli viselkedését kapja.

**A pontozott név.** A hibaüzenet a teljes, kért nevet nevezi meg (például `input.nemletezik`),
nem csak az első hiányzó szegmenst, mert ez az, amit a felhasználó a sablonba írt.

**A F0 mérés eleme.** A PLAN-010 T-010-3 blokkoló mérése ellenőrzi, hogy a fenti megkülönböztetés
a pinelt könyvtárral ténylegesen megvalósítható-e a `render`/`renderSection` hívási úton; ha nem,
a terv megáll, és a kérdés a userhez megy, ugyanúgy, ahogy a 6.6 visszaútja.

## 7. A kifejezés nyelv: CEL

### 7.1 A környezet

A `createCelExpressionEvaluator()` egyetlen `Environment` példányt épít, a csomag dokumentált
opcióival (M-125, M-126):

| Beállítás                             | Érték                                             | Miért                                                                                                          |
| ------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| deklarált változók                    | a hét `RunContext` mező neve, mind `dyn` típussal | a `RunContext` alakja futásidőben ismeretlen szerkezetű (M-105), tehát statikus típus nem adható               |
| `unlistedVariablesAreDyn`             | a csomag alapértéke (`false`)                     | így a `compile` a nem deklarált változót (például `step.x` a `steps.x` helyett) már a szerkesztőben elutasítja |
| `limits`                              | a csomag alapértéke, felülírás nélkül             | dokumentált alapérték (M-125); saját szám nincs rá forrásunk (8. szekció)                                      |
| `homogeneousAggregateLiterals`        | a csomag alapértéke                               | dokumentált alapérték                                                                                          |
| `enableOptionalTypes`                 | a csomag alapértéke                               | dokumentált alapérték                                                                                          |
| regisztrált függvény, operátor, típus | egy sem                                           | a nyelv beépített készlete elég a három csomópont igényéhez (7.5); minden saját függvény új felület lenne      |

A hét név a csomag `RUN_CONTEXT_VARIABLE_NAMES` konstansában áll. Mivel a csomag a motor
`RunContext` típusát nem importálhatja (3.1), a két lista egyezését a 11.2 sodródás védelem őrzi.

### 7.2 `compile`

`env.parse(kifejezés)`, majd `env.check(kifejezés)`. A `ParseError` kivétel és az `env.check`
`valid: false` eredménye egyaránt `Outcome` hibaágat ad, a könyvtár üzenetével (M-126). A `compile`
tehát három hibafajtát fog meg a futás előtt: a szintaktikai hibát, a nem deklarált változót, és a
parse idejű korlát túllépését (M-125).

### 7.3 `evaluate`: a bemenet leképezése a CEL felé

A kontextus a porton `unknown` típussal érkezik (M-100). A leképezés a hét deklarált névre
egyenként történik, a projekt typeguardjaival:

| Bemenet                                                                     | A CEL felé               | Forrás, indok                                                                                                                                                      |
| --------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| egy felső szintű mező `undefined` értéke                                    | `null`                   | a CEL-ben a `null` érték, az `undefined` nem; így az `item == null` a `fan_out` hatókörön kívül is kiértékelhető, hiba helyett                                     |
| `itemIndex` és `iteration` (egész `number`)                                 | CEL `int`, azaz `BigInt` | mindkettő definíció szerint egész számláló (SPEC-004 4.3); `int` nélkül az `iteration + 1` nem illeszkedő overload lenne, mert nincs automatikus konverzió (M-122) |
| minden más érték (`input`, `steps`, `item`, `joinInputs`, `error` tartalma) | változatlanul            | JSON alakú adat; a JSON szám a CEL szerint `double` (M-122), tehát egy adatbeli szám `double` marad                                                                |

**A JSON szám `double`, és ennek a következménye kimondva:** egy adatbeli számhoz egész literált
összeadni nem illeszkedő overload (`input.darab + 1` hiba), a helyes alak `input.darab + 1.0`.
Összehasonlításnál ez nem gond, mert az típusok között is értelmezett (M-122). A PLAN-010 F0
mindkét állítást a pinelt csomagon méri.

### 7.4 `evaluate`: az eredmény normalizálása JSON értékre

A kifejezés eredménye egy lépés kimenetévé is válhat (a `fan_out` kimenete maga a lista), ami a
`step_run.output` oszlopba `JSON.stringify` útján íródik (M-106). A `JSON.stringify` a `BigInt`
értékre kivételt dob, a `NaN` és az `Infinity` értéket és a `Map` objektumot pedig csendben
elrontja (M-129). **Az `evaluate` ezért az eredményt JSON értékre normalizálja, és amit nem tud
veszteség nélkül, azt hibaággal utasítja el:**

| CEL eredmény (JS alakban, M-127)                                                                                           | Normalizált alak                                                 |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `string`, `boolean`, `null`                                                                                                | változatlan                                                      |
| véges `number` (`double`)                                                                                                  | változatlan                                                      |
| `NaN`, `Infinity`, `-Infinity`                                                                                             | **hiba**: JSON-ban nem ábrázolható (M-129)                       |
| `BigInt` (`int`)                                                                                                           | `number`, ha a `Number.isSafeInteger` igaz rá; különben **hiba** |
| tömb                                                                                                                       | tömb, elemenként normalizálva                                    |
| sima objektum (CEL map), prototípusa `Object.prototype` vagy `null`                                                        | objektum, értékenként normalizálva                               |
| minden más (`UnsignedInt` azaz `uint`, `Uint8Array`, időbélyeg, időtartam, típus érték, `Map`, bármely más osztálypéldány) | **hiba**: nem JSON érték                                         |

A hibaág szövege megnevezi, mi nem normalizálható. **A sima objektum felismerése prototípus
alapú.** A meglévő `isRecord` guard (`packages/typeguards`) erre nem elég, mert minden nem `null`,
nem tömb objektumot átenged, az `UnsignedInt`, a `Uint8Array` és a `Map` példányt is, és ezekből a
`JSON.stringify` csendben `{}` alakot írna (M-129). Ezért a normalizáláshoz új, általános guard
kell, ami a `typeguards` csomagba kerül, mindkét ágra és a szűkítésre unit teszttel
(`.claude/CLAUDE.md` 5. szekció). Maga a normalizálás a `cel-expression` téma saját függvénye, mert
CEL specifikus.

### 7.5 A három kifejezés csomópont

| Csomópont | Mező                 | Elvárt eredmény                                          | Ha más típust ad (M-102, változatlan)                                                                                                                                                                                    | Példa                                                    |
| --------- | -------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `branch`  | `expression`         | CEL `string`, egy bekötött `branch_key` értéke           | **nem string eredmény (O-6 lezárva): `expression_evaluation_failed` osztállyal bukik.** String eredmény, ami "nincs egyezés"-t ad: a `defaultBranchKey` dönt, ha van és be van kötve; különben `branch_no_matching_edge` | `input.pontszam >= 50.0 ? "magas" : "alacsony"`          |
| `fan_out` | `itemsExpression`    | CEL `list`, ami a 7.4 szerint JSON tömbre normalizálható | a lépés `fan_out_items_not_a_list` osztállyal bukik; a nem normalizálható elem `expression_evaluation_failed`                                                                                                            | `input.elemek.filter(e, e.aktiv).map(e, e.nev)`          |
| `loop`    | `continueExpression` | CEL `bool`                                               | a lépés `expression_evaluation_failed` osztállyal bukik                                                                                                                                                                  | `iteration < 3` vagy `steps["ellenorzes"].kesz == false` |

**A `branch` nem string ágának fenti kezelése felülírja a SPEC-004 M-102 tényt és az 5. szekció
`branch` végrehajtó táblázatának korábbi leírását** ("nincs egyezés", a `defaultBranchKey` dönt,
minden nem string eredményre); a SPEC-004 érintett helye ugyanerre a döntésre hivatkozva javítva
(13. szekció).

**A `loop` saját `continueExpression`-je által látott `iteration` értéke** a motor hatókör
vermétől függ (SPEC-004 4.3, 4.6, `buildRunContext`), és a spec nem állítja kódolvasásból. A
PLAN-010 F0 a valódi motoron méri, és az eredményt ide és a research fájlba vezeti; a 16. szekció 49. kritériumának `loop` kifejezése erre a mérésre épül.

## 8. A biztonsági korlátok

**A nyelvi alapgarancia dokumentált.** A Mustache logika mentes: a README szerint nincs benne
`if`, `else` és `for`, és a szakasz csak az adaton iterál (`2026-09-23-sablon-es-kifejezes-nyelv.md` 2. szekció); a CEL nem Turing-teljes, mellékhatás mentes, és terminál (M-120). **A Mustache
könyvtár név feloldása azonban a nyelvi garancián túl beépített függvényeket is meghív** (M-116,
M-132), ezért a garancia a mi renderelőnkben a 6.6 szekció szűkítésével áll elő, nem a
könyvtártól. **Ez nem jelenti, hogy nincs erőforrás kockázat:** a CEL makrók beágyazva exponenciális időt adhatnak (M-123), és a Mustache
szakasz egy nagy tömbön nagy kimenetet.

| Korlát                                                 | Nyelv    | Érték                               | Forrás                     | Státusz                                                                        |
| ------------------------------------------------------ | -------- | ----------------------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| AST csomópontok száma                                  | CEL      | `100000`                            | M-125, a csomag alapértéke | dokumentált alapérték, **nem írjuk felül**                                     |
| AST mélység                                            | CEL      | `250`                               | M-125                      | ugyanaz                                                                        |
| lista literál elemszáma                                | CEL      | `1000`                              | M-125                      | ugyanaz; **csak a kifejezésben leírt literálra hat**, a futásidejű listára nem |
| map literál bejegyzésszáma                             | CEL      | `1000`                              | M-125                      | ugyanaz, ugyanazzal a megkötéssel                                              |
| függvényhívás argumentumszáma                          | CEL      | `32`                                | M-125                      | ugyanaz                                                                        |
| a kifejezés szövegének hossza                          | CEL      | nincs dokumentált opció a csomagban | M-125                      | **nyitott**, O-1; a fenti AST korlátok addig közvetve határolnak               |
| a sablon szövegének hossza                             | Mustache | nincs dokumentált opció             | M-110 ... M-118            | **nyitott**, O-1                                                               |
| kiértékelési idő, lépésszám, költség                   | CEL      | nincs dokumentált opció a csomagban | M-125, M-123               | **nyitott**, O-2                                                               |
| renderelési idő                                        | Mustache | nincs dokumentált opció             | M-110 ... M-118            | **nyitott**, O-2                                                               |
| a renderelt szöveg mérete                              | Mustache | nincs dokumentált opció             | M-110 ... M-118            | **nyitott**, O-3                                                               |
| a kifejezés eredményének mérete, a `fan_out` elemszáma | CEL      | nincs dokumentált opció             | M-125                      | **nyitott**, O-3                                                               |

**A szinkron kiértékelés következménye kimondva.** A port szinkron (M-100), és a Node hivatalos
útmutatója szerint amíg az eseményhurok egy kliens hosszú számításán dolgozik, más kliens kérését
nem szolgálja ki (M-135). Egy hosszú kiértékelés vagy renderelés tehát a szerver minden futását és
kérését megállítja a teljes idejére. Az útmutató két dokumentált megoldása a számítás darabolása
és a kiszervezése (M-135); a szinkron `Outcome` visszatérésű port egyiket sem engedi a port
szerződésének módosítása nélkül. Ez az O-2 lezárásának a feltétele, nem mellékes részlet.

## 9. A hibák

### 9.1 Hol keletkezik, milyen osztállyal, és hol látja a felhasználó

| Mikor                                  | Mi bukik                                     | Hibaosztály                                                                           | Hol látja a felhasználó                                                                                                                                                                                             |
| -------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| szerkesztés közben, **mentés előtt**   | a `compile` egy sablon vagy kifejezés mezőre | nincs, ez mezőhiba                                                                    | **a hibás mező alatt**, a `.claude/CLAUDE.md` 11. szekció megjelenési szabálya szerint (érintett és érvénytelen, vagy sikertelen mentési kísérlet után); a `PUT` nem indul (10. szekció)                            |
| a futás indításakor                    | a motor indítási ellenőrzése (9.2)           | `template_render_failed` vagy `expression_evaluation_failed`                          | a `POST .../runs` válasza `unprocessable`, az üzenet megnevezi a csomópontot és a mezőt; a felület a szerver üzenetét jeleníti meg ott, ahol ma az indítási hibát (SPEC-008 5.4 2. indok); futás sor nem keletkezik |
| a lépés futásakor, renderelés          | a `render`                                   | `template_render_failed`                                                              | a futás nézetben: a csomópont kártyáján az osztály, a panelen a teljes üzenet (SPEC-008 6.4)                                                                                                                        |
| a lépés futásakor, kiértékelés         | az `evaluate`, beleértve a 7.4 normalizálást | `expression_evaluation_failed`                                                        | ugyanott                                                                                                                                                                                                            |
| a lépés futásakor, rossz eredménytípus | a motor típusellenőrzése (7.5)               | `fan_out_items_not_a_list`, `expression_evaluation_failed`, `branch_no_matching_edge` | ugyanott                                                                                                                                                                                                            |

**Miért kell a futásidejű ág, ha van indítási ellenőrzés.** A `compile` a szerkezetet és a
változóneveket ellenőrzi, az adatot nem látja: a hiányzó map kulcs (5.4), a rossz eredménytípus
(7.5) és a nem normalizálható eredmény (7.4) csak kiértékeléskor derül ki.

### 9.2 Az új indítási ellenőrzés a motorban

Az ellenőrzés a SPEC-004 4.7 listáját bővíti; a SPEC-004 4.7 táblázata után álló bekezdés erre
hivatkozik, a táblázat maga nem kap új sort, hogy a SPEC-004 8. kritériumának "tíz ellenőrzés"
száma érvényes maradjon. Az ellenőrzés a SPEC-004 4.8 szerinti 3. lépésben (gráf validáció) fut, tehát
**egyetlen adatbázis sort sem ír** (SPEC-004 4.8 utolsó bekezdése):

| Ellenőrzés                                                                                                                                | Hibaosztály                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| minden sablon mező lefordítható a `templateRenderer.compile` hívással, és minden kifejezés mező az `expressionEvaluator.compile` hívással | sablonnál `template_render_failed`, kifejezésnél `expression_evaluation_failed` |

A vizsgált mezők: `agent_step.promptTemplate`, a `join` `ai_synthesis` módjának
`settings.promptTemplate` mezője, `human_approval.bodyTemplate`, `fan_out.branchLabelTemplate`,
`branch.expression`, `fan_out.itemsExpression`, `loop.continueExpression`. Az ellenőrzés a
gráf minden csomópontjára lefut, a gyerek futás indításakor is, mert az a 4.8 teljes menetét
követi (SPEC-004 5.9 3. pont). Ez zárja a research mellékmegfigyelését (M-103): a hibás sablon
eddig csak a lépés futásakor derült ki.

**Miért van indítási ellenőrzés, ha a szerkesztő már fordít.** A `PUT` végpont nem fordít (3.5), tehát
egy nem a felületen át mentett, vagy a SPEC-010 előtt mentett gráf fordíthatatlan mezőt
hordozhat. A futás indítása az egyetlen pont, ahol minden gráf átmegy.

### 9.3 A szerver leképezése

A `apps/server` `error-mapping` témájának `unprocessable` halmaza a `template_render_failed` és az
`expression_evaluation_failed` osztállyal bővül, különben az indítási elutasítás `internal` kódot
kapna (SPEC-006 5.5: a be nem sorolt osztály `internal`). A két osztály a REST válaszban csak a
futás indításából érkezhet, mert a lépés futásának hibája nem a `startRun` `Outcome` értékén megy
ki, hanem a futás eseményein. A SPEC-005 8.3 táblázatának "gráf validációs hibaosztályai" sora
ezzel a két osztállyal bővül.

### 9.4 Az `expression_evaluator_unavailable` sorsa, és az eltérés a feladat szövegétől

**A feladat a meglévő `expression_evaluator_unavailable` osztályt is a követendő hibaosztályok
közé sorolta. A spec ettől eltér, és ezt kimondja.** Az osztály jelentése "a szervernek nincs
kifejezés nyelve"; a SPEC-010 után ilyen állapot nem létezik, és az osztályt kizárólag a két
elutasító port állította elő (M-104), ami a bekötés cseréjével megszűnik. Egy szintaktikai hibát
"nem elérhető kiértékelőként" jelezni félrevezető lenne. Ezért:

1. a két `create-rejecting-*.ts` fájl és a tesztje törlődik, mert a SPEC-010 bekötése árvává
   teszi őket (gyökér `CLAUDE.md` 3.: a saját változtatás árváit takarítjuk);
2. az `expression_evaluator_unavailable` érték kikerül az `EngineErrorKind` unióból, a
   `isEngineErrorKind` guardból és a szerver `unprocessable` halmazából, ugyanabból az okból.

**Lezárva, 2026-09-23, a user döntésével: a törlés jóváhagyva.** Mindkét pont változatlanul
végrehajtandó: a két `create-rejecting-*.ts` fájl és a tesztje törlődik, és az
`expression_evaluator_unavailable` érték kikerül az `EngineErrorKind` unióból, az
`isEngineErrorKind` guardból és a szerver `unprocessable` halmazából.

### 9.5 Az üzenet alakja

Minden hibaüzenet a SPEC-004 F-24 konvenciója szerint zárójelben, a végén tartalmazza a
hibaosztály nevét. A motor üzenete megnevezi a csomópont azonosítóját és a mező nevét, és
tartalmazza a csomag hibaleírását.

**A csomag hibaleírása nem idézi a sablon vagy a kifejezés szövegét.** A futás indítási
elutasítás a `POST .../runs` válaszában megy ki, és a szerver a válaszban nem továbbíthat a
kliens által küldött, elutasított értéket (SPEC-005 8.4, SPEC-006 5.5). A CEL `ParseError`
`message` mezője a forrás kiemelését tartalmazza (M-127), ezért a `cel-expression` téma a hiba
`summary` és `range` mezőjéből épít leírást, nem a `message` mezőből. A Mustache `parseTemplate`
hibaszövege egy pozíciót és legfeljebb egy szakasz nevet tartalmaz (M-115); a PLAN-010 F0 méri,
hogy a két könyvtár hibaleírása ennél többet ne adjon ki. A szerkesztő mezőhibája (10. szekció)
hibaosztályt nem hordoz, csak ugyanezt a leírást egy magyar előtaggal, mert az mezőhiba, nem
`Outcome` a motorból.

## 10. A mentés előtti ellenőrzés a szerkesztőben

**A szerkesztő a szerverrel azonos csomagot, azonos verzióban hív** (3.1), tehát a kliens oldali
fordítás nem második forrás, hanem ugyanaz a kód.

| Mit              | Hol                                                                                                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a fordítás       | az `apps/web` `node-inspector` témája a kiválasztott csomópont hét mezőjéből (9.2 listája), amelyik a csomópont típusán létezik, lefordítja a sablont a `mustache-template`, a kifejezést a `cel-expression` `compile` hívásával       |
| a hiba helye     | ugyanabba a mezőnkénti hibatérképbe kerül, amibe a séma hibái (M-108), a mező útvonalán (`expression`, `itemsExpression`, `settings.promptTemplate` ...); a megjelenés szabálya a meglévő `field-error-visibility` téma, változatlanul |
| a mentés tiltása | a `graph-editor` `validateGraphForSave` függvénye a séma ellenőrzés után minden csomópontra lefuttatja ugyanezt; hiba esetén `Outcome` hibaágat ad, ami megnevezi a csomópontot és a mezőt, és a `PUT` nem indul                       |
| sorrend          | a fordítás csak sémahelyes mezőn fut; séma hiba esetén a mező alatt a séma hibája áll                                                                                                                                                  |

**Ez a SPEC-008 5.4 kiegészítése, nem ellentéte.** Az 5.4 a **gráf szemantikai** validáció
kliens oldali másolását tiltja, három okkal. A fordítás nem gráf szemantika (egyetlen mező
szövegéről szól), és a három ok egyike sem áll rá: (1) nem keletkezik második forrás, mert
ugyanaz a csomag fut; (2) a mező alatti hiba nem a `ProtocolErrorBody.message` elemzése; (3) a
lefedettség nem duplikálja a motor tesztjét, mert a szerkesztő csak a bekötést teszteli, a nyelvet
a `workflow-language` csomag tesztje. A SPEC-008 5.4 szekciója erre a pontra hivatkozó mondattal
bővül.

## 11. A bekötés a szerverben

### 11.1 Az `engine-assembly` téma

A `buildEngineDependencies` a `templateRenderer` mezőre a `createMustacheTemplateRenderer()`, az
`expressionEvaluator` mezőre a `createCelExpressionEvaluator()` eredményét adja. Az elutasító port
fájlok törlődnek (9.4). A SPEC-006 1. szekció "Amit NEM dönt el" pontja és a 9.1 táblázat
`engine-assembly` sora a SPEC-010-re hivatkozik.

### 11.2 A sodródás védelem a hét változónévre

A `RUN_CONTEXT_VARIABLE_NAMES` a `RunContext` mezőlistájának szándékos duplikátuma (7.1), mert a
`workflow-language` az `engine` csomagtól nem függhet. **A védelem a meglévő minta szerint épül**
(`.claude/CLAUDE.md` 5. szekció, `enum-drift-protection`, `node-config-drift-protection`): új,
megvalósítás nélküli regressziós téma az `apps/server` alatt, ahol a két csomag egyszerre látszik,
típusszintű kétirányú egyezéssel a `typecheck` kapun: a konstans elemeinek uniója pontosan a
`keyof RunContext`. Ha a motor a `RunContext` alakját bővíti, a `typecheck` bukik, amíg a lista nem
követi. A védelmet szándékos elrontással kell igazolni, ahogy a meglévő két minta.

## 12. Tesztelés

### 12.1 A `workflow-language` csomag

- **A két könyvtár valódi, pinelt példányán fut**, mock nélkül: a teszt azt igazolja, amit mi
  használunk belőlük.
- 100 százalék lefedettség mind a négy metrikán, kizárás nélkül (`.claude/CLAUDE.md` 8.).
- Kötelező esetek: a 6.1 escape (mind a nyolc karakter változatlanul átjut), a 6.2 hibaágai
  kivétel nélkül, a 6.3 gyorsítótár kikapcsolása, a 6.6 szűkítés a támadó sablon listán és a 6.4
  szerkezetein, a 7.2 három hibafajtája, a 7.3 leképezés minden
  sora, a 7.4 táblázat minden sora, és a 7.5 három példa kifejezése egy valós alakú `RunContext`
  értéken.

### 12.2 A motor

Az új indítási ellenőrzés (9.2) a motor meglévő mintája szerint hamis portokkal tesztelt (SPEC-004
14.): minden vizsgált mezőre egy eset, ahol a `compile` hibát ad, és igazolt, hogy a futás
indítása elutasít, egyetlen adatbázis sor nélkül.

### 12.3 A szerver: végponttól végpontig, valódi szerver ellen

Egy futtatott teszt a valódi `apps/server` modulokkal (HTTP réteg, útvonal kezelők, stream
nyilvántartás, valódi motor, valódi `:memory:` adatbázis, a szállított Mustache és CEL port), a
meglévő `continue-startup-with-database.spec.ts` 46. kritériumos harnessának mintájára, **kizárólag
az `agentQueryRunner` portot cserélve** egy hamis agentre, ami rögzített, a SPEC-004 F-3 szerinti
alakú üzenetsorozatot ad, és rögzíti a kapott promptot. Valódi API hívás nincs. A próba a REST
felületen hozza létre a workflow-t, menti a gráfot, beállítja az alapértelmezett providert, és
indítja a futást; a futás végét a futás eseményéből olvassa, kézi időzítés nélkül. A pontos
elvárások a 16. szekció 48 ... 50. kritériumában állnak.

### 12.4 A szerkesztő

- Unit: a fordítás hibája a hibás mező alá kerül, és a `validateGraphForSave` hibaágat ad.
- E2e (Playwright, a `.claude/CLAUDE.md` 11. szekció szabályai szerint, minden REST hívás
  `page.route()` mockon): egy hibás kifejezés beírása és a mező elhagyása után a hibaüzenet a mező
  alatt látszik; a mentés gomb megnyomására nem megy ki `PUT` kérés.
- Az e2e lefedettségi küszöb ratchet szabálya érvényes: a fedetlen tételek száma egyik metrikán
  sem nőhet (`.claude/CLAUDE.md` 8.).

## 13. A SPEC-004 O-1 lezárása és az átvezetések

**A SPEC-004 O-1 a user 2026-09-23-i döntésével lezárult:** a sablon nyelv Mustache, a kifejezés
nyelv CEL, a szállított implementációt a jelen spec írja le.

| Dokumentum                              | Mi változik                                                                                                                                                                                                                                                                                                                                                                                                                      | Mikor                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| SPEC-004                                | a 15. szekció O-1 sora lezárva, a 3.2 port táblázat "Ki adja" oszlopa, az 1. szekció "Amit NEM dönt el" első pontja, a 16. szekció kockázat sora, a 17. szekció 68. kritériuma és a 4.7 táblázat utáni új bekezdés a SPEC-010-re hivatkozik; az O-6 lezárása miatt az M-102 tény és az 5. szekció `branch` végrehajtó táblázata utáni új bekezdés kimondja, hogy a nem string eredmény kezelése a SPEC-010 7.5 szerint felülírva | a jelen spec commitjában                                         |
| SPEC-006                                | az 1. szekció "Amit NEM dönt el" pontja és a 9.1 `engine-assembly` sora a SPEC-010-re hivatkozik                                                                                                                                                                                                                                                                                                                                 | a jelen spec commitjában                                         |
| SPEC-008                                | az 5.4 szekció egy, a 10. szekcióra hivatkozó mondattal bővül                                                                                                                                                                                                                                                                                                                                                                    | a jelen spec commitjában                                         |
| `docs/research/2026-08-26-toolchain.md` | a két csomag verziója, két forrással                                                                                                                                                                                                                                                                                                                                                                                             | a jelen spec commitjában                                         |
| `.claude/CLAUDE.md`                     | a 7. szekció stack listája és indoklás táblája, a 13. szekció táblázata                                                                                                                                                                                                                                                                                                                                                          | a jelen spec commitjában                                         |
| SPEC-005                                | a 8.3 táblázat gráf validációs sora a két osztállyal (9.3)                                                                                                                                                                                                                                                                                                                                                                       | a PLAN-010 végrehajtásakor, a kóddal együtt                      |
| `.claude/CLAUDE.md`                     | a 6. szekció csomagszáma és rétegleírása az új csomaggal                                                                                                                                                                                                                                                                                                                                                                         | a PLAN-010 végrehajtásakor, amikor a csomag ténylegesen létrejön |

## 14. Kockázatok

| Kockázat                                                                                                | Hatás                                              | Védelem                                                                                                                   |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| A fiatal CEL csomag a mi alakunkon hibásan számol                                                       | rossz ág, rossz lista, rossz ciklus döntés         | pontos verzió, blokkoló F0 mérés, a saját felhasználás tesztje a valódi csomagon, kimondott visszaút (4.2)                |
| Egy CEL frissítés csendben megváltoztatja a viselkedést                                                 | eltérő futás ugyanarra a gráfra                    | pontos verzió; a frissítés külön lépés, az F0 mérés regresszióként újrafut (4.2 1. pont)                                  |
| A Mustache karbantartása megállt                                                                        | egy jövőbeli hiba javítatlan marad                 | a szűk, dokumentált felület (4.1), a függőség nélküliség, és a logika mentes nyelv; a csere egy téma mappán belül maradna |
| Egy sablon a Mustache név feloldásán át beépített függvényt hív, és a szervert leállítja (mérve, M-132) | minden futás és kapcsolat megszakad                | a 6.6 saját adat tulajdonságra szűkített feloldás, a F0 támadó sablon listája, és a 14. kritérium futtatott tesztje       |
| A `BigInt` eredmény a `JSON.stringify` hívásnál kivételt dob                                            | a lépés kimenete nem írható, a futás elakad        | a 7.4 normalizálás, soronként tesztelve                                                                                   |
| A prompt HTML entitásokkal torzul                                                                       | a modell mást kap, mint amit a felhasználó írt     | a 6.1 escape döntés, és egy teszt mind a nyolc karakterre                                                                 |
| Egy beágyazott makró vagy egy nagy szakasz a szerver eseményhurkát blokkolja                            | minden futás és kérés megáll a kiértékelés idejére | nyitott kérdés (O-2); addig a CEL parse idejű korlátai határolnak, a futásidőre nincs védelem, és ezt a spec kimondja     |
| Egy elgépelt Mustache név üres szöveget ad a promptban                                                  | a modell hiányos promptot kap, hiba nélkül         | nyitott kérdés (O-4)                                                                                                      |
| A `RunContext` bővül, a CEL környezet nem követi                                                        | a `compile` érvényes kifejezést utasít el          | a 11.2 sodródás védelem a `typecheck` kapun                                                                               |
| A szerkesztő és a szerver más verziót fordít                                                            | mentéskor elfogadott kifejezés indításkor bukik    | egy csomag, egy pontos verzió, egy workspace (3.1)                                                                        |
| Egy SPEC-010 előtt mentett gráf fordíthatatlan mezőt hordoz                                             | a futás indítás közben derülne ki                  | a 9.2 indítási ellenőrzés elutasítja, futás sor nélkül, a mezőt megnevezve                                                |

## 15. Nyitott kérdések, amikre nincs forrás

Egyik sem zárható le tippeléssel.

| #   | Kérdés                                                                              | Addig                                                                                                                                                                                                                                                                                                          | Mi zárná le                                                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O-1 | A sablon és a kifejezés szövegének legnagyobb hossza                                | a Mustache sablonra nincs korlát; a CEL kifejezést a csomag parse idejű AST korlátai határolják (M-125), karakterszám korlát nincs                                                                                                                                                                             | termékdöntés egy értékről, és egy mérés, ami megmutatja, a választott érték alatt a `compile` és a kiértékelés ideje a szerveren elfogadható-e                                           |
| O-2 | A kiértékelés és a renderelés idejének, lépésszámának korlátja                      | nincs korlát; a CEL terminál (M-120), de a beágyazott makró exponenciális lehet (M-123), és a szinkron hívás a szerver eseményhurkát blokkolja (8. szekció)                                                                                                                                                    | egy mérés a legrosszabb esetre a mi `RunContext` méreteinken, és egy döntés arról, hogy a kiértékelés külön szálra kerül-e, vagy a makró láncolást korlátozzuk, ahogy a CEL spec ajánlja |
| O-3 | A renderelt szöveg, a kifejezés eredménye és a `fan_out` elemszám legnagyobb mérete | nincs korlát                                                                                                                                                                                                                                                                                                   | termékdöntés, és egy mérés a `step_run.output` és a `run_event` írásának viselkedéséről nagy értéken                                                                                     |
| O-4 | A hiányzó Mustache név szigorú kezelése                                             | **Lezárva, 2026-09-23, a user döntésével:** a sima változó tag hiányzó neve `template_render_failed` hibát ad, megnevezve a nevet; a szakasz és a fordított szakasz hiányzó névvel változatlanul a Mustache szemantikája szerint viselkedik, mert ott a hiány a szándék (6.7)                                  | lezárva                                                                                                                                                                                  |
| O-5 | Egy objektum vagy tömb behelyettesítése a sablonban                                 | **Lezárva, 2026-09-23, a user döntésével:** a tömb és az objektum JSON szövegként íródik ki, nem `[object Object]` és nem vesszővel összefűzve (6.5)                                                                                                                                                           | lezárva                                                                                                                                                                                  |
| O-6 | A `branch` nem string eredménye                                                     | **Lezárva, 2026-09-23, a user döntésével:** a nem string eredmény `expression_evaluation_failed` hibával bukik, ahogy a `loop` nem logikai eredménye; ez felülírja a SPEC-004 M-102 és az 5. szekció korábbi "nincs egyezés, a `defaultBranchKey` dönt" leírását a nem string esetre (7.5, SPEC-004 átvezetve) | lezárva                                                                                                                                                                                  |

## 16. Elfogadási kritériumok

### A csomag és a határok

1. A `packages/workflow-language` csomag létezik, neve `@easter-workflow-builder/workflow-language`, a `src/` alatt pontosan két téma mappával (`mustache-template`, `cel-expression`) és az `index.ts` barrellel; egyetlen téma mappában sincs alkönyvtár.
2. A csomag `CLAUDE.md` fájlja a csomag gyökerében áll, a kötelező szekciókkal, és a `## Fájlok` táblázata mindkét témát felsorolja. A `bun run docs:check` zöld.
3. A barrel csak nevesített újraexportot tartalmaz, `export *` nélkül, és nem exportál a `mustache` vagy a `@marcbachmann/cel-js` csomagból származó típust vagy értéket.
4. A csomag `dependencies` mezője pontosan: `@easter-workflow-builder/core`, `@easter-workflow-builder/typeguards`, `mustache`, `@marcbachmann/cel-js`; a két külső csomag pontos verzióval, tartomány nélkül; a `devDependencies` tartalmazza a `@types/mustache` pontos verzióját. A három verzió megegyezik a `docs/research/2026-08-26-toolchain.md` soraival.
5. A csomag a `package-layer.ts` térképen L1 értékkel áll, és a `bun run check:graph` zöld.
6. Az `apps/server` és az `apps/web` `dependencies` mezője tartalmazza a `@easter-workflow-builder/workflow-language` bejegyzést `workspace:*` alakban; a `packages/engine` `dependencies` mezője **nem** tartalmazza, és a `packages/engine/src` alatt nincs `mustache` és `cel` szövegű import.
7. A workspace-ben a `mustache` és a `@marcbachmann/cel-js` csomagot kizárólag a `packages/workflow-language/src` importálja; ezt greppes invariáns teszt őrzi.
8. A `packages/workflow-language/src` alatt nincs `node:` import, és az `apps/web` `browser-safe-imports` regressziós tesztje zöld.

### A sablon nyelv

9. A `render` a `{{x}}` alakban a `&`, `<`, `>`, `"`, `'`, `/`, backtick és `=` karaktert változatlanul adja ki; futtatott teszt mind a nyolcra.
10. A `{{x}}`, a `{{{x}}}` és a `{{& x}}` ugyanarra az értékre ugyanazt a kimenetet adja.
11. Az escape a `Mustache.render` negyedik argumentumában, hívásonként áll; a csomag forrásában nincs `Mustache.escape =` értékadás.
12. A `createMustacheTemplateRenderer()` a `Mustache.templateCache` értékét `undefined`-ra állítja; futtatott teszt igazolja, hogy a gyártó függvény hívása és egy renderelés után a `Mustache.templateCache` értéke `undefined`.
13. A `compile` a zárt listájú négy `parseTemplate` hibára (le nem zárt tag, meg nem nyitott szakasz, le nem zárt szakasz, érvénytelen határoló) `Outcome` hibaágat ad, kivétel nélkül; érvényes sablonra `ok`.
14. A `render` egyetlen bemenetre sem dob kivételt: minden könyvtári kivétel `Outcome` hibaágként jön vissza. **A név feloldás a 6.6 szerint saját adat tulajdonságra szűkített, és függvényt nem hív:** a F0 támadó sablon listájának minden eleme (köztük a `{{toString}}`, a `{{input.constructor.constructor.name}}`, a `{{#constructor}}x{{/constructor}}` és a `{{input.items.constructor.fromAsync}}`) üres szöveget ad, mint egy hiányzó név, és a futtató folyamat nem kap kezeletlen promise elutasítást; futtatott teszt a valódi könyvtáron igazolja. A szakasz, a fordított szakasz, a `.` név és a pontozott név a szűkítés mellett is a 6.4 táblázat szerint működik.
15. A `{{> x}}` partial hivatkozás üres szöveget ad, fájl olvasás nélkül.
16. A 6.5 szerinti szöveggé alakítás: szám, logikai érték és `null` behelyettesítése `String(value)` szöveget ad, a tömb és az objektum behelyettesítése a `JSON.stringify(value)` szöveget adja, nem `[object Object]`-et és nem vesszővel összefűzött listát (O-5 lezárva); futtatott teszt mind a négy típusra.

### A kifejezés nyelv

17. A CEL környezet pontosan a hét `RUN_CONTEXT_VARIABLE_NAMES` nevet deklarálja `dyn` típussal, saját függvény, operátor és típus regisztráció nélkül, és a `limits` opciót nem írja felül.
18. A `compile` szintaktikai hibára, nem deklarált változóra és a `maxDepth` korlát túllépésére egyaránt `Outcome` hibaágat ad; érvényes kifejezésre `ok`.
19. A felső szintű `undefined` mező `null`-ként érkezik a CEL-be: az `item == null` a `fan_out` hatókörön kívül `true`.
20. Az `itemIndex` és az `iteration` CEL `int`-ként érkezik: az `iteration + 1` és az `itemIndex % 2` kiértékelhető.
21. Egy adatbeli JSON szám `double`: az `input.darab + 1.0` kiértékelhető, az `input.darab + 1` `Outcome` hibaágat ad, az `input.darab > 1` pedig kiértékelhető.
22. A 7.4 táblázat minden sora futtatott teszttel igazolt: a biztonságos egész `BigInt` számmá válik, a nem biztonságos egész, a `uint` (`UnsignedInt`), a `NaN`, az `Infinity`, a `bytes` és az időbélyeg `Outcome` hibaágat ad, a lista és a map rekurzívan normalizált. A sima objektum felismerése a `typeguards` csomag új, prototípus alapú guardjával történik, ami egy osztálypéldányt és egy `Map` objektumot elutasít; a guard mindkét ágára és a szűkítésre unit teszt áll.
23. Az `evaluate` egyetlen bemenetre sem dob kivételt.
24. A hiányzó map kulcsra hivatkozó kifejezés `Outcome` hibaágat ad, a `has()` makróval védett alakja kiértékelhető.
25. A `steps["kötőjeles-azonosító"].mező` alak kiértékelhető.
26. A 7.5 táblázat három példa kifejezése egy valós alakú `RunContext` értéken a várt típusú eredményt adja: `string`, JSON tömb, `boolean`.
27. A PLAN-010 F0 mérés eredménye a `docs/research/` alatt áll, a pinelt csomagverzióval, és a 7.3, 7.4, 7.5 szekció, valamint az 5.2 prototípus lánc bekezdése a mért eredménnyel egyezik.

### A kontextus és a titok

28. Futtatott teszt igazolja, hogy egy titkot tartalmazó env változó mellett sem a sablon, sem a kifejezés nem tud olyan kimenetet adni, ami a titok értékét tartalmazza, a `process.env` bármely kulcsára hivatkozva.
29. A csomag forrásában nincs `process`, `globalThis`, `require` és `import(` hivatkozás, és greppes teszt őrzi.
30. A `render` a hívásban nem ad `partials` argumentumot.
31. Az `apps/web/src` és a `packages/ui/src` alatt nincs `dangerouslySetInnerHTML`, és greppes invariáns teszt őrzi.

### A motor

32. A motor futás indítási ellenőrzése a 9.2 mind a hét mezőjére meghívja a megfelelő port `compile` metódusát; minden mezőre külön teszteset igazolja, hogy a hibás mező elutasítja az indítást a megfelelő osztállyal, és egyetlen adatbázis sor sem keletkezik.
33. Az elutasító üzenet megnevezi a csomópont azonosítóját és a mező nevét, és a F-24 konvenció szerint a végén zárójelben a hibaosztályt; a sablon vagy a kifejezés teljes szövegét nem idézi, a CEL hibánál a `ParseError` `message` mezőjét sem (9.5). Futtatott teszt egy hosszú, egyedi jelölő szöveget tartalmazó hibás kifejezéssel igazolja, hogy a jelölő nem szerepel az üzenetben.
34. A gyerek futás indítása (`sub_workflow`) ugyanezt az ellenőrzést futtatja a gyerek gráfján; futtatott teszt igazolja.
35. A `packages/engine` port típusai (`TemplateRendererPort`, `ExpressionEvaluatorPort`) változatlanok.
36. A három csomópont eredmény kezelése változatlan (M-102), és a meglévő tesztjeik változatlanul zöldek.

### A szerver

37. A `buildEngineDependencies` a `createMustacheTemplateRenderer()` és a `createCelExpressionEvaluator()` eredményét köti be; futtatott teszt igazolja, hogy egy érvényes sablon és kifejezés `compile` hívása `ok`.
38. A két `create-rejecting-*.ts` fájl és a tesztje megszűnt, és az `apps/server/src` alatt nincs rájuk hivatkozás.
39. Az `error-mapping` `unprocessable` halmaza tartalmazza a `template_render_failed` és az `expression_evaluation_failed` osztályt, és egy futás indítási elutasítás ezekkel `422` választ ad; futtatott teszt mindkettőre.
40. A 9.4 döntés (törlés jóváhagyva) végrehajtva: az `expression_evaluator_unavailable` sehol nem szerepel a `packages/engine/src` és az `apps/server/src` alatt, és a két `create-rejecting-*.ts` fájl a tesztjével együtt megszűnt.
41. A 11.2 sodródás védelem létezik az `apps/server` alatt, megvalósítás nélküli regressziós téma mappában; a `RUN_CONTEXT_VARIABLE_NAMES` elemeinek uniója és a `keyof RunContext` típusszinten egyezik, és a védelmet egy szándékos elrontás `typecheck` bukása igazolja.
42. A SPEC-006 1. és 9.1 szekciója, és a SPEC-005 8.3 táblázata a SPEC-010-re hivatkozik.

### A szerkesztő

43. A kiválasztott csomópont minden, a 9.2 listáján álló, a típusán létező mezőjét a szerkesztő lefordítja, és a fordítási hiba a hibás mező alatt jelenik meg, a meglévő megjelenési szabály szerint (érintett és érvénytelen, vagy sikertelen mentési kísérlet után).
44. A `validateGraphForSave` fordítási hiba esetén hibaágat ad, ami megnevezi a csomópontot és a mezőt, és a `PUT` kérés nem indul; unit teszt igazolja.
45. Playwright e2e teszt igazolja valós böngészőben, `page.route()` mockkal: a hibás kifejezés beírása és a mező elhagyása után a hibaüzenet a mező alatt látszik, és a mentés gomb megnyomására nem megy ki `PUT` kérés.
46. A séma hibás mezőn a séma hibája áll, nem a fordítási hiba.
47. A SPEC-008 5.4 szekciója a 10. szekcióra hivatkozik.

### Végponttól végpontig, valódi szerver ellen

48. **Futtatott teszt a valódi `apps/server` modulokkal** (HTTP szerver `127.0.0.1` címen, `port: 0` értékkel, útvonal kezelők, stream nyilvántartás, valódi motor, valódi `:memory:` adatbázis a commitolt migrációkkal, a szállított Mustache és CEL port), **kizárólag az `agentQueryRunner` portot cserélve hamis agentre**, valódi API hívás nélkül. A REST felületen létrehozott, mentett és elindított workflow tartalmaz legalább egy `agent_step`, egy `branch`, egy `fan_out` (utána `join`) és egy `loop` csomópontot, és a futás **`succeeded`** állapotban zár.
49. Ugyanebben a próbában: a hamis agent által kapott promptok pontosan a `RunContext` adatával renderelt szövegek (az `input` mezőjéből, a `fan_out` elemekből és az `itemIndex` értékből); a `branch_taken` esemény a kifejezés által választott kulcsot hordozza; a nem választott ág csomópontja nem kapott `step_run` sort; a `fan_out_expanded` esemény `itemCount` értéke a bemeneti lista hossza; a `loop_iteration_started` események száma pontosan annyi, amennyit a `continueExpression` a F0 mérés szerinti `iteration` szemantikával előír.
50. Ugyanez a harness egy második esetben egy fordíthatatlan kifejezést tartalmazó gráfot indít, és a `POST .../runs` `422` választ ad, a csomópont és a mező nevével, futás sor nélkül.

### Dokumentáció és kapuk

51. A SPEC-004 15. szekciójában az O-1 lezárva, a user döntésére és a SPEC-010-re hivatkozva, és a 13. szekció táblázatának minden "a jelen spec commitjában" sora átvezetve.
52. A `docs/research/2026-08-26-toolchain.md` a `mustache`, a `@types/mustache` és a `@marcbachmann/cel-js` verzióját két független forrással rögzíti.
53. A 15. szekció mind a hat kérdése vagy a user válaszával, illetve méréssel lezárva és átvezetve, vagy nyitottként áll a "mi a viselkedés addig" és a "mi zárná le" mezővel. Tippeléssel lezárt pont nincs.
54. A `packages/workflow-language/src`, az `apps/server/src` és az `apps/web/src` alatt nincs `any`, `as` típuskényszerítés (az `as const` kivételével) és új `eslint-disable` sor a két könyvtár típusai miatt.
55. A lefedettség mind a négy metrikán 100 százalék, a `coverage.exclude` lista nem bővült; az e2e fedetlen tételek száma egyik metrikán sem nőtt.
56. Mind a kilenc minőségi kapu nulla kilépési kóddal fut a teljes workspace-en; a kapuk mérvadó listája a `.claude/CLAUDE.md` 8. szekciója.

### Az O-4, O-5 és O-6 lezárása (user döntés, 2026-09-23)

57. A `render` egy tömb vagy egy sima objektum értékre a `JSON.stringify` eredményét adja szövegként, nem `[object Object]`-et és nem vesszővel összefűzött listát; futtatott teszt mindkét típusra, beágyazott mezőkkel is (O-5).
58. A `render` egy sima változó tag (`{{név}}`, `{{{név}}}`, `{{& név}}`) fel nem oldható nevére `Outcome` hibaágat ad `template_render_failed` jelleggel, a hiányzó nevet a hibaüzenetben idézve; ugyanaz a hiányzó név egy szakaszban vagy fordított szakaszban (`{{#név}}`, `{{^név}}`) nem hibát ad, hanem a Mustache alapértelmezett, hiba nélküli viselkedését. Futtatott teszt mindhárom alakra és a szakasz/fordított szakasz ellenpéldájára (O-4).
59. A `branch` csomópont nem string kiértékelési eredménye `expression_evaluation_failed` osztállyal bukik; egy string, de egyetlen bekötött `branch_key`-hez sem illeszkedő eredmény változatlanul a `defaultBranchKey`, ennek hiányában a `branch_no_matching_edge` úton dől el. Futtatott teszt mindkét ágra, a `packages/engine` `execute-branch.spec.ts` bővítésével (O-6).

## 17. Kapcsolódó dokumentumok

- [`../plan/PLAN-010-sablon-es-kifejezes-nyelv.md`](../plan/PLAN-010-sablon-es-kifejezes-nyelv.md): a végrehajtási terv
- [`SPEC-004-vegrehajto-motor.md`](SPEC-004-vegrehajto-motor.md): a két port, a `RunContext`, a futás indítási validáció, az O-1
- [`SPEC-006-szerver-alkalmazas.md`](SPEC-006-szerver-alkalmazas.md): az `engine-assembly` és az `error-mapping`
- [`SPEC-008-graf-szerkeszto-es-futas-nezet.md`](SPEC-008-graf-szerkeszto-es-futas-nezet.md): a mezőnkénti hibajelzés és a futás nézet
- [`SPEC-002-csomag-architektura.md`](SPEC-002-csomag-architektura.md): a csomag és mappa konvenció, a rétegzés
- [`../research/2026-09-23-sablon-es-kifejezes-nyelv.md`](../research/2026-09-23-sablon-es-kifejezes-nyelv.md): a nyelvek összevetése, a döntés alapja
- [`../research/2026-09-23-sablon-es-kifejezes-csomagok.md`](../research/2026-09-23-sablon-es-kifejezes-csomagok.md): a csomagok forrásai
- [`../research/2026-08-26-toolchain.md`](../research/2026-08-26-toolchain.md): a rögzített verziók
