# Sablon nyelv és kifejezés nyelv jelöltek a SPEC-004 O-1 kérdéshez (2026-09-23)

Ez a fájl a SPEC-004 O-1 nyitott kérdéséhez (a `templateRenderer` és az `expressionEvaluator` port
mögötti nyelv megválasztása) gyűjt össze forrásokkal alátámasztott, összehasonlítható jelölteket. A
fájl **nem dönt**: a döntés a userre tartozik, a döntést egy külön spec valósítja majd meg
(SPEC-004 15. szekció O-1). A repóban kódváltozás nem történt ehhez a fájlhoz kapcsolódóan.

Módszer: a `packages/engine` tényleges kódjának olvasása (mit kap a port ténylegesen), élő npm
registry lekérdezés (`registry.npmjs.org`, 2026-09-23-i állapot) a verziókra, licencre, `engines`
mezőre és típusdefinícióra, valamint a GitHub Advisory Database hivatalos API-ja
(`api.github.com/advisories`) a biztonsági történetre, csomagonként, `ecosystem=npm` szűréssel.
Minden verziószám és CVE-azonosító ebből a két élő lekérdezésből származik, dátummal.

## 1. A kontextus: mit kap a sablon és a kifejezés

A `RunContext` (`packages/engine/src/run-context/run-context.ts`) alakja szó szerint ugyanaz a
kifejezés és a sablon portnak is:

```
RunContext {
  input: unknown
  steps: Readonly<Record<string, unknown>>
  item: unknown
  itemIndex: number | undefined
  iteration: number | undefined
  joinInputs: readonly unknown[] | undefined
  error: { kind: string, message: string } | undefined
}
```

Ez egy tetszőlegesen mély, JSON alakú, futásidőben ismeretlen szerkezetű objektum: a `steps` mezőn
és a `joinInputs` listán át korábbi `agent_step` lépések strukturált kimenete is idekerülhet, tehát
a nyelvnek dinamikus, tetszőlegesen mély property path elérést kell tudnia, séma nélkül.

**Mit vár vissza az egyes csomópont a kifejezés eredményétől** (`packages/engine/src/node-executor/`):

| Csomópont | Kifejezés mező       | Elvárt eredmény típus                                                                                                                                                                          | Forrás                                    |
| --------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `branch`  | `expression`         | `string`, ami illeszkedik egy bekötött `branch_key`-re, vagy nem illeszkedik semmire (ekkor a `defaultBranchKey` dönt); nem string eredmény "nincs egyezés"-ként kezelt, nem külön hibaosztály | `execute-branch.ts` `resolveBranchTarget` |
| `fan_out` | `itemsExpression`    | tömb (`Array.isArray`); minden más érték `fan_out_items_not_a_list` hibát ad                                                                                                                   | `execute-fan-out.ts`                      |
| `loop`    | `continueExpression` | `boolean` (`isBoolean` typeguard); minden más érték `expression_evaluation_failed` hibát ad                                                                                                    | `execute-loop.ts`                         |

Ebből következik, hogy a kifejezés nyelvnek **legalább** tudnia kell: mély property path elérést
ismeretlen alakú JSON-ban, összehasonlító és logikai operátorokat, egy feltételes (elágazó)
konstrukciót ami stringet vagy tetszőleges értéket ad vissza (a `branch` kulcs kiválasztásához), és
lista előállítást vagy szűrést egy meglévő tömbből (a `fan_out` szétbontáshoz).

**A sablon port** (`packages/engine/src/engine-port/template-renderer-port.ts`) a `promptTemplate`
(`run-agent-step.ts` 242. sor), a `bodyTemplate` (`execute-human-approval.ts` 218. sor) és a
`branchLabelTemplate` (`execute-fan-out.ts` `renderItemLabels`, elemenként, `item`/`itemIndex`
felülírással bővített kontextussal) renderelését végzi, mindig ugyanazzal a `RunContext`-tel, és
mindig `string`-et ad vissza. A sablon **csak szöveget állít elő** (agent prompt, jóváhagyási
szöveg, fan-out ág címke), a tényleges elágazási/lista döntést a külön kifejezés port hozza; ez a
szétválasztás a SPEC-004 saját tervezési döntése (3.2 táblázat), nem ennek a kutatásnak a
következtetése.

**A kockázat jellege.** A sablon és a kifejezés szövegét a workflow szerkesztőben a felhasználó
írja, és a szerveren, a motor folyamatában fut le (SPEC-004 5.2, 5.8). Ez pontosan az a
fenyegetési modell, amit a sablon motorok dokumentációja "untrusted template" vagy "user-defined
template" néven ír le, ezért a biztonsági szempont minden jelöltnél a legfontosabb, ahogy a
feladat is kéri.

## 2. Sablon nyelv jelöltek

| Jelölt                                          | Utolsó npm kiadás                | Biztonsági jelleg                                                                                                                                                                                                                                                                                                                                                                                                                                | Ismert CVE (GitHub Advisory DB, npm)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | TS típus                                                           | Licenc       | `compile`/`render` szétválasztás                                                                                                    |
| ----------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Mustache** (`mustache`)                       | 4.2.0, 2021-03-28                | Logic-less: nincs függvényhívás, `if`/`for`, tetszőleges kód a sablonból; a hivatalos README szó szerint "no if statements, else clauses, or for loops"                                                                                                                                                                                                                                                                                          | 2 bejegyzés, mindkettő évekkel ezelőtt javítva (pl. CVE-2015-8862 XSS, `GHSA-w3w8-37jv-2c58`); kódfuttatásra vezető CVE nincs dokumentálva                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Nincs beépítve, külön `@types/mustache` (utolsó kiadás 2025-05-05) | MIT          | Igen: `Mustache.parse(template)` külön a `Mustache.render(template, view)`-től, a README "Pre-parsing and Caching" szakasza szerint |
| **Handlebars** (`handlebars`)                   | 4.7.9, 2026-03-26                | Turing-complete helper rendszer, `lookup`/precompiler/partial mechanizmus; a GitHub Advisory DB **20 bejegyzést** listáz erre a csomagra                                                                                                                                                                                                                                                                                                         | Súlyos, visszatérő minta: 2026-ban egy 6 tételes "AST Type Confusion" kritikus/magas súlyosságú klaszter (`CVE-2026-33937` kritikus, plusz `-33938`, `-33939`, `-33940`, `-33941`, `GHSA-2qvq-rjwj-gvw9`), mind a jelenlegi `4.7.9`-ben javítva (`vulnerable_range <= 4.7.8`, `first_patched_version 4.7.9`, élő GHSA lekérdezés); korábban 3 kritikus RCE/prototípus-szennyezés (`CVE-2019-19919`, `CVE-2021-23369`, `CVE-2021-23383`), mind régen javítva                                                                                                                                                                                                      | Beépített (`types/index.d.ts`)                                     | MIT          | Igen: `Handlebars.compile(template)` egy hívható sablonfüggvényt ad, a végrehajtás külön lépés                                      |
| **LiquidJS** (`liquidjs`)                       | 10.29.0, 2026-08-11              | Dokumentáltan "logic-less"-hez közelítő, szűrő/tag alapú nyelv, saját `memoryLimit`/`renderLimit` védelemmel; a GitHub Advisory DB **18 bejegyzést** listáz                                                                                                                                                                                                                                                                                      | Kritikus RCE `CVE-2026-45618` (CVSS 10.0, `GHSA-gf2q-c269-pqgc`, publikálva 2026-05-24): a `valueOf` szűrő és prototípuslánc-bejárás a `Function` konstruktorig jutott, patch `10.26.0`-tól (jelenlegi `10.29.0` ezen túl van); **de** élő GHSA lekérdezés szerint legalább 6 további, DoS/limit-megkerülő bejegyzésnél a `first_patched_version` mező üres (pl. `GHSA-hh27-hf48-9f5q` `date` szűrő memóriakorlát megkerülés, `GHSA-9x9p-qf8f-mvjg` `ownPropertyOnly` megkerülés `Context.spawn()`-on át, `GHSA-8xx9-69p8-7jp3` `renderLimit` megkerülés), ami azt jelzi, hogy a védelmi rétegen (`memoryLimit`/`ownPropertyOnly`) rendszeresen találnak új rést | Beépített (`dist/index.d.ts`)                                      | MIT          | Igen: `engine.parse(template)` külön az `engine.render(tpl, ctx)`-től                                                               |
| **Nunjucks** (`nunjucks`)                       | 3.2.4, 2023-04-13                | A **hivatalos dokumentáció szó szerint kimondja**: "Nunjucks does not sandbox execution so it is not safe to run user-defined templates or inject user-defined content into template definitions. On the server, you can expose attack vectors for accessing sensitive data and remote code execution." (mozilla.github.io/nunjucks/api, idézve a projekt szabálya szerint 15 szónál rövidebben nem adható vissza szó szerint, itt parafrazálva) | 2 bejegyzés, mindkettő XSS (`CVE-2023-2142` autoescape megkerülés, `CVE-2016-10547`), mindkettő javítva; a hivatalos önbevallás a döntő tényező, nem a CVE szám                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Nincs beépítve, külön `@types/nunjucks`                            | BSD-2-Clause | Igen: `nunjucks.compile(str, env)` ad `Template` objektumot, a `.render(context)` külön hívás                                       |
| **Eta** (`eta`)                                 | 4.6.0, 2026-04-25                | A **hivatalos biztonsági oldal szó szerint kimondja**, hogy a sandboxolás "not a goal of the project", és "Rendering a template is equivalent to executing JavaScript code" (eta.js.org/docs/4.x.x/intro/security)                                                                                                                                                                                                                               | 2 bejegyzés: `CVE-2022-25967` (kód befecskendezés sablon konfiguráción át) és `CVE-2023-23630` (XSS Express API-val), mindkettő javítva a jelenlegi kiadásban; a hivatalos önbevallás itt is döntőbb, mint a CVE szám                                                                                                                                                                                                                                                                                                                                                                                                                                            | Beépített (`dist/index.d.mts`)                                     | MIT          | Igen, de irreleváns: a `compile` egy JS függvényt ad, aminek a törzse maga a beírt sablon kód                                       |
| **Saját, minimális `{{path}}` behelyettesítés** | nem létező csomag, a csapat írná | Strukturálisan a legszűkebb támadási felület: ha az implementáció kizárólag reguláris kifejezéssel keres `{{a.b.c}}` mintát és property path szerint olvas ki értéket, nincs `eval`, `new Function`, helper, filter vagy prototípuslánc bejárási út, mert ezek a funkciók nincsenek megírva                                                                                                                                                      | Nem értelmezhető (nincs kiadási előzmény); a biztonság a saját kód helyességén múlik, amit a projekt saját tesztjeinek kell lefedniük                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | A projekt konvenciója szerint (strict TS, típusgárdák)             | a projekté   | Triviális, mert a "compile" lépés is csak a saját regex validálása lenne                                                            |

## 3. Kifejezés nyelv jelöltek

| Jelölt                                                | Utolsó npm kiadás                                                                                                                                                                          | Biztonsági jelleg                                                                                                                                                             | Ismert CVE (GitHub Advisory DB, npm)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Kifejezőerő a három csomóponthoz                                                                                                                                                                                                                                                | TS típus                                                                                   | Licenc                                                                                                       | `compile`/`evaluate` szétválasztás                                                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JSONata** (`jsonata`)                               | 2.2.2, 2026-07-16                                                                                                                                                                          | Deklaratív JSON lekérdező nyelv, nem "logic-less" (van feltétel, függvénydefiníció a kifejezésen belül is)                                                                    | 6 bejegyzés; a legsúlyosabb egy 2026-os, 3 tételes kritikus "Arbitrary Code Execution via crafted JSONata expressions" klaszter (`CVE-2026-77413/-77414/-77415`, `GHSA-66mm-25pp-rfff` és társai), plusz korábbi prototípus-szennyezés (`CVE-2024-27307`, `CVE-2026-12208`); élő GHSA lekérdezés szerint **mindegyik** `<= 2.2.1`-nél javítva, a jelenlegi `2.2.2` mindegyiken túl van                                                                                                                                                                                                                                      | Teljes: van ternary (`cond ? a : b`), lista szűrés/leképezés (`[]`, predikátumok), string összefűzés (`&`)                                                                                                                                                                      | `jsonata.d.ts`, beépített                                                                  | MIT                                                                                                          | Igen: `jsonata(expr)` egy kifejezés objektumot ad, az `.evaluate(data)` külön hívás                                                                       |
| **CEL** (`cel-js` vagy `@marcbachmann/cel-js`)        | `cel-js` 0.8.2 (2026-07-11, első kiadás 2023-12-04, 25 verzió, **0.x, tehát 1.0 előtti API**); `@marcbachmann/cel-js` 8.0.0 (2026-07-07, első kiadás 2025-06-13, 87 verzió 15 hónap alatt) | Google Common Expression Language: **tervezetten nem Turing-teljes**, nincs korlátlan ciklus vagy rekurzió, nincs I/O, a specifikáció maga a biztonsági érv (lásd 5. szekció) | `cel-js` és `@marcbachmann/cel-js` csomagra a GitHub Advisory DB **nulla** bejegyzést ad; ez a nyelvspecifikáció érettségét, nem a konkrét JS implementáció auditáltságát igazolja, mert mindkét csomag fiatal                                                                                                                                                                                                                                                                                                                                                                                                              | Teljes: hivatalos ternary (`? :`), `map`/`filter` makró listákra, összehasonlító és aritmetikai operátorok                                                                                                                                                                      | `cel-js`: `dist/index.d.ts`; `@marcbachmann/cel-js`: `lib/index.d.ts`, mindkettő beépített | MIT mindkettőnél                                                                                             | Igen: a `cel-js` csomag `parse(expr)` és `evaluate(expr, context)` külön függvény                                                                         |
| **JMESPath** (`jmespath`)                             | 0.16.0, 2022-01-19                                                                                                                                                                         | Tiszta lekérdező nyelv: "no arithmetic, no user-defined functions, and no side effects" (jmespath.org specifikáció)                                                           | 0 bejegyzés a GitHub Advisory DB-ben                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | **Hiányos a mi esethez**: nincs natív feltételes (ternary) operátor, tehát a `branch.expression` "számítsd ki, melyik kulcsot add vissza" igénye nem fejezhető ki natívan, csak kerülő megoldással (pl. `                                                                       |                                                                                            | ` rövidzár-lánc); a lista előállítás/szűrés (`fan_out`) és a logikai kifejezés (`loop`) viszont natívan megy | Nincs beépítve                                                                                                                                            | Apache-2.0 | Az npm csomag `compile(expr)` függvénye AST-t ad, a `search(data, expr)` végzi el mindkettőt egyben (`unpkg.com/jmespath@0.16.0/jmespath.js` `exports.compile`, `exports.search`) |
| **JSON Logic** (`json-logic-js`)                      | 2.0.5, 2024-07-09                                                                                                                                                                          | Tervezetten biztonságos szabálynyelv: "no setters, no loops, no functions or gotos... never uses eval()" (jsonlogic.com)                                                      | 2 bejegyzés, mindkettő régi és javítva (`CVE-2021-4329` parancs befecskendezés, javítva `2.0.1`-ben; prototípus-szennyezés a `method` operátoron, javítva `2.0.0`-ban); a jelenlegi `2.0.5` mindkettőn túl van                                                                                                                                                                                                                                                                                                                                                                                                              | Teljes: `if` (többágú elágazásra is), `map`/`filter`/`reduce`/`all`/`none`/`some` listákra, `var` pont-jelöléssel mély elérésre, `cat` string összefűzésre (jsonlogic.com/operations.html)                                                                                      | Nincs beépítve                                                                             | MIT                                                                                                          | A szabály maga már egy JSON adatstruktúra (nincs külön "fordítási" lépés a szó hagyományos értelmében); a port `compile` hívása JSON validálásra szűkülne |
| **filtrex** (`filtrex`)                               | 3.1.0, 2024-10-14                                                                                                                                                                          | Kifejezetten "safe" jelzővel hirdetett, "Expressions cannot escape the sandbox" (GitHub README); nem `eval`-lal fordít, hanem Jison alapú saját fordítóval                    | 0 bejegyzés a GitHub Advisory DB-ben                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | **Korlátozott**: a saját README szerint "There are only 2 types: numbers and strings" - tehát tömböt vagy beágyazott objektumot nem tud visszaadni, ami kizárja a `fan_out.itemsExpression` natív kifejezését; van viszont ternary (`x ? y : z`), ami a `branch`-hoz elég lenne | `dist/esm/filtrex.d.ts`, beépített                                                         | MIT                                                                                                          | Igen: `compileExpression(expr)` egy függvényt ad, a hívás külön lépés                                                                                     |
| **expr-eval** (`expr-eval`) és a **`expr-eval-fork`** | `expr-eval` 2.0.2, 2019-09-28 (nincs újabb kiadás); `expr-eval-fork` 3.0.3, 2026-02-02                                                                                                     | Matematikai kifejezés kiértékelő, `new Function()`-re épül                                                                                                                    | Az eredeti `expr-eval` csomagra a GitHub Advisory DB **3 bejegyzést** ad, és mindháromnál a `first_patched_version` mező **üres**: kritikus kódfuttatás (`CVE-2026-12866`, a `toJSFunction()` API-n át natív JS-sé fordított kifejezésekkel), prototípus-szennyezés (`CVE-2025-13204`) és korlátlan függvényhívás (`CVE-2025-12735`) - **egyik sincs javítva az eredeti csomagban, mert nincs újabb kiadás 2019 óta**. A közösségi `expr-eval-fork` a két régebbi hibát javította (`2.0.2`, illetve `3.0.1`), a legújabb kritikus tételnél (`CVE-2026-12866`) a GHSA lekérdezés a fork csomagot meg sem említi érintettként | Van ternary (`?:`), aritmetika, összehasonlítás; a mély, ismeretlen alakú objektum/tömb bejárás a dokumentáció szerint korlátozottabb, mint a JSONata/CEL/JSON Logic-nál                                                                                                        | `parser.d.ts` (mindkettőnél)                                                               | MIT                                                                                                          | Igen: `Parser.parse(expr)` ad egy `Expression` objektumot, `.evaluate(context)` külön hívás                                                               |

## 4. Egy nyelv mindkettőre?

Egyetlen jelöltnél sem található olyan hivatalos dokumentáció, ami a nyelvet egyszerre "szöveg
sablon, beágyazott változóhelyettesítéssel" és "tetszőleges értéket visszaadó kifejezés" szerepre
ajánlaná ugyanazzal az API felülettel, ami a két port eltérő visszatérési típusát (`Outcome<string>`
a rendernek, `Outcome<unknown>` az evaluate-nek) egy hívással kiszolgálná:

- A **JSONata** tud string összefűzést (`&` operátor), tehát egy teljes promptszöveg elméletileg
  megírható egyetlen JSONata kifejezésként (`"Kedves " & input.name & "!"`), de ez az ergonómia
  szenvedne: egy több bekezdéses agent prompt szövegben minden literál szövegrészt escapelt string
  literálba kellene tenni, szemben a sablon nyelvek natív "szöveg a sorok között, `{{...}}` csak a
  behelyettesítésnél" modelljével. Erre a használati módra nincs dokumentált JSONata minta.
- A **LiquidJS** a `{% if %}`/`{% for %}` tageken át elméletileg vezérlést is tud, tehát a `branch`
  vagy a `loop` logikája technikailag kifejezhető lenne Liquid sablonban, de a port szerződése
  `evaluate(expression, context): Outcome<unknown>` egy típusos értéket vár, nem egy renderelt
  stringet, amit utólag vissza kellene alakítani (pl. `"true"` stringből `boolean`-re) - ez pont az
  a fajta implicit típuskonverzió, amit a projekt `unknown` plusz típusgárda elve tilt (gyökér
  `.claude/CLAUDE.md` 5. szekció). Ráadásul a LiquidJS biztonsági rekordja (3. szekció) miatt ez
  nem is vonzó irány.
- A **CEL** és a **JSON Logic** kifejezés nyelvek, nem rendelkeznek szöveg-sablon móddal
  (nincs "szöveg a sorok között" szintaxisuk), tehát a `promptTemplate`/`bodyTemplate` renderelésre
  natívan nem alkalmasak.

**Következtetés:** a két port eltérő feladatot fed le (szöveg előállítás kontra típusos érték
kiszámítás), és egyik vizsgált jelölt sem old meg mindkettőt kompromisszum nélkül egyetlen
könyvtárral. A két külön port (SPEC-004 3.2) ebből a szempontból a helyes tervezési döntésnek
látszik; két, egymástól független nyelv választása pontosabb illesztést ad, mint egyetlen nyelv
kényszerítése mindkét szerepre.

## 5. Mit használ a környezet, dokumentált tények

- **n8n** saját, "Tournament" nevű sablon nyelvet használ a `{{ }}` kifejezésekhez (output
  kompatibilis újraírása a `riot-tmpl`-nek), JavaScript kiértékeléssel egy explicit **sandbox**
  mögött, ami a hivatalos dokumentáció szerint blokkolja a távoli kódfuttatást, hálózati hívásokat,
  vezérlésátadást és alacsony szintű hozzáférést, miközben megengedi a biztonságosnak ítélt
  segédeszközöket (`Date`, `Math`). Az n8n emellett dokumentáltan a **JMESPath** könyvtárat építi be
  JSON lekérdezésre (n8n-io/n8n-docs, docs.n8n.io/code/builtin/overview, n8n-io/tournament).
- **GitHub Actions** saját, nem npm csomagként terjesztett kifejezés szintaxist használ
  (`${{ }}`), kontextusokkal és beépített függvényekkel, kifejezetten workflow feltételek és
  értékszámítás céljára (docs.github.com/actions/learn-github-actions/expressions). Ez nem
  telepíthető könyvtár, csak a tervezési precedens releváns: egy elterjedt workflow eszköz is
  külön, korlátozott kifejezés nyelvet vezetett be a sablon/YAML mellé, nem általános célú JS-t.
- **CEL** hivatalos, dokumentált elfogadása: Kubernetes admission control és CRD validáció
  (kubernetes.io/docs/reference/using-api/cel), Envoy Proxy útválasztás, Google Cloud IAM
  feltételek és a Google Cloud Eventarc esemény szűrés (docs.cloud.google.com/eventarc/advanced),
  valamint a Firebase Security Rules eredeti tervezési tapasztalatára épül (cel.dev, ARMO glossary,
  google/cel-spec). A közös indok mindenhol dokumentáltan ugyanaz: a nyelv nem Turing-teljes, nincs
  I/O és nincs mellékhatás, ezért biztonságos felhasználó által írt kifejezést közvetlenül, a
  kérés útjában kiértékelni.
- **Temporal** nem használ külön sablon vagy kifejezés nyelvet a workflow logikához: a hivatalos
  dokumentáció szerint a workflow maga "sequences of steps written in a general-purpose programming
  language", determinisztikussági megkötésekkel (docs.temporal.io/workflows,
  docs.temporal.io/workflow-definition). Ez nem precedens egyik jelöltre sem, csak azt mutatja,
  hogy nem minden workflow eszköz old meg hasonló problémát elkülönített nyelvvel.
- **Claude Agent SDK / Claude Code**: a rendelkezésre álló hivatalos dokumentációban
  (code.claude.com/docs, anthropics/claude-agent-sdk-python, anthropics/claude-agent-sdk
  GitHub) nem található dokumentált sablon vagy kifejezés nyelv a prompt összeállításra; a
  rendszerprompt testreszabása string összefűzéssel és egy `SYSTEM_PROMPT_DYNAMIC_BOUNDARY`
  jelölővel történik, nem egy beágyazott sablon motorral. **NEM MEGERŐSÍTETT**, hogy a Claude
  Agent SDK vagy a Claude Code bármilyen formában használna Mustache-t, Handlebars-t vagy más
  vizsgált nyelvet; erre a kérdésre nem találtunk sem megerősítő, sem cáfoló hivatalos forrást,
  ezért erről a research nem állít semmit.

## 6. Ajánlás

**Sablon: Mustache.** A logic-less tervezés strukturálisan zárja ki a sablon nyelvek legsúlyosabb
kockázati osztályát (helper/filter lánc a `Function` konstruktorig, ahogy a LiquidJS és a Handlebars
CVE-i mutatják, illetve a nyílt kódfuttatás, ahogy az Eta hivatalosan bevallja, illetve a nem
sandboxolt futtatás, ahogy a Nunjucks hivatalosan bevallja): a Mustache szintaxisában nincs
függvényhívás, helper vagy filter mechanizmus, tehát a talált CVE-osztályok egyike sem
értelmezhető rá. A GitHub Advisory DB két, régen javított, kizárólag kimeneti XSS jellegű
bejegyzést ismer, kódfuttatásra vezetőt nem. A `promptTemplate`/`bodyTemplate`/`branchLabelTemplate`
mind egyszerű, szöveg jellegű kimenetet igényel (nem elágazást, azt a külön kifejezés port végzi),
amihez a Mustache szekció/dotted-name funkciói elegendőnek látszanak a `packages/engine` kódban
talált használati mintákhoz. A `compile`/`render` szétválasztás natívan megvan
(`Mustache.parse`/`Mustache.render`), a licenc MIT, nulla futásidejű függőség. Egyetlen valódi
hátrány: az utolsó npm kiadás 2021-03-28, tehát **NEM MEGERŐSÍTETT**, hogy a projekt aktívan
karbantartott-e 2026-ban a szokásos értelemben (ez csak a kiadási dátumból nem dönthető el); ezt a
usernek érdemes mérlegelnie a döntésnél.

**Kifejezés: nincs egyértelműen domináns jelölt, két reális irány marad.** A JMESPath-ot a
ternary hiánya, a filtrex-et a "csak szám és string" korlátozás, az eredeti `expr-eval`-t a
javítatlan kritikus CVE (nincs újabb kiadás 2019 óta) zárja ki. A JSONata a legkifejezőbb, de
2026-ban egy kritikus, kódfuttatásig jutó, 3 tételes CVE klaszteren esett át (jelenleg javítva a
`2.2.2`-ben), ami visszatérő mintát mutat (négy évvel korábban is volt prototípus-szennyezés
CVE-je). Ezzel szemben:

- A **CEL** biztonsági érve nem egy adott implementáció auditján, hanem magán a
  nyelvspecifikáción áll: tervezetten nem Turing-teljes, amit Google, a Kubernetes és az Envoy
  éppen azért használ éles, felhasználó által írt kifejezésekre, mert ez a tulajdonság
  szerkezetileg zárja ki a legtöbb sandbox-kitörési mintát. **NEM MEGERŐSÍTETT** ugyanakkor, hogy
  a két vizsgált JS implementáció (`cel-js` 0.8.2, 1.0 előtti API; `@marcbachmann/cel-js` 8.0.0,
  15 hónap alatt 87 kiadással) éles, biztonságkritikus terhelés alatt ugyanolyan auditáltsági
  szinten áll, mint maga a CEL specifikáció; egyik csomagra sincs dokumentált biztonsági
  incidens, de egyiknek sincs hosszú, nagy felhasználói bázison bevizsgált előélete sem.
- A **JSON Logic** a konzervatívabb, éretlenség szempontjából alacsonyabb kockázatú alternatíva:
  a jelenlegi `2.0.5` évek óta stabil, a talált 2 CVE régi és javított, a nyelv maga is
  dokumentáltan "no setters, no loops, no functions" elven áll, és a `if`/`map`/`filter`/`var`
  operátorkészlete lefedi mind a három csomópont igényét, bár JSON alakban írva kevésbé olvasható
  egy hosszú, beágyazott feltételnél, mint egy szöveges mini-nyelv.

Emiatt a research két, egymással versengő, forrásokkal alátámasztott utat lát: **CEL, ha a
nyelvtervezési biztonsági garancia a döntő szempont** és a fiatal JS binding kockázata
elfogadható, vagy **JSON Logic, ha a bizonyított, több éves stabilitás a döntő szempont** és a
JSON-alapú szintaxis olvashatósági hátránya elfogadható. A választás a usert illeti (SPEC-004
O-1); ez a research nem zárja le a kérdést.

## Források

- Mustache: <https://github.com/janl/mustache.js/blob/master/README.md>,
  <https://vulert.com/vuln-db/npm-mustache-58766>, `registry.npmjs.org/mustache`,
  `api.github.com/advisories?ecosystem=npm&affects=mustache`
- Handlebars: <https://github.com/EQSTLab/CVE-2026-33937>,
  <https://github.com/advisories/GHSA-2w6w-674q-4c4q> és a további 2026-33938/-33939/-33940/-33941
  bejegyzés, `registry.npmjs.org/handlebars`,
  `api.github.com/advisories?ecosystem=npm&affects=handlebars`
- LiquidJS: <https://github.com/advisories/GHSA-gf2q-c269-pqgc>,
  <https://orca.security/resources/blog/critical-rce-in-liquidjs-lets-attackers-execute-arbitrary-commands-on-unpatched-hosts/>,
  `registry.npmjs.org/liquidjs`, `api.github.com/advisories?ecosystem=npm&affects=liquidjs`
- Nunjucks: <https://mozilla.github.io/nunjucks/api.html>,
  <https://github.com/advisories/GHSA-x77j-w7wf-fjmw>, `registry.npmjs.org/nunjucks`
- Eta: <https://eta.js.org/docs/4.x.x/intro/security>,
  <https://github.com/advisories/GHSA-mf6x-hrgr-658f>, `registry.npmjs.org/eta`
- JSONata: <https://raw.githubusercontent.com/jsonata-js/jsonata/master/CHANGELOG.md>,
  <https://github.com/advisories/GHSA-66mm-25pp-rfff>, `registry.npmjs.org/jsonata`
- CEL: <https://cel.dev/>, <https://kubernetes.io/docs/reference/using-api/cel>,
  <https://celbyexample.com/>, <https://www.npmjs.com/package/cel-js>,
  <https://www.npmjs.com/package/@marcbachmann/cel-js>,
  <https://docs.cloud.google.com/eventarc/advanced/docs/receive-events/use-cel>
- JMESPath: <https://jmespath.org/specification.html>, <https://unpkg.com/jmespath@0.16.0/jmespath.js>,
  `api.github.com/advisories?ecosystem=npm&affects=jmespath`
- JSON Logic: <https://jsonlogic.com/operations.html>,
  <https://github.com/advisories/GHSA-67j4-2mh6-8627>, `registry.npmjs.org/json-logic-js`
- filtrex: <https://raw.githubusercontent.com/joewalnes/filtrex/master/README.md>,
  `api.github.com/advisories?ecosystem=npm&affects=filtrex`
- expr-eval / expr-eval-fork: <https://www.bleepingcomputer.com/news/security/popular-javascript-library-expr-eval-vulnerable-to-rce-flaw/>,
  <https://github.com/advisories/GHSA-q9v2-7m5w-4693>, <https://github.com/advisories/GHSA-jc85-fpwf-qm7x>,
  `registry.npmjs.org/expr-eval`, `registry.npmjs.org/expr-eval-fork`
- n8n: <https://github.com/n8n-io/n8n-docs/blob/main/docs/code/expressions.md>,
  <https://github.com/n8n-io/tournament>, <https://docs.n8n.io/code/builtin/overview/>
- GitHub Actions: <https://docs.github.com/en/actions/learn-github-actions/expressions>
- Temporal: <https://docs.temporal.io/workflows>, <https://docs.temporal.io/workflow-definition>
- Claude Agent SDK: <https://code.claude.com/docs/en/agent-sdk/modifying-system-prompts>,
  <https://github.com/anthropics/claude-agent-sdk-python>
- A motor kódja: `packages/engine/src/run-context/run-context.ts`,
  `packages/engine/src/engine-port/template-renderer-port.ts`,
  `packages/engine/src/engine-port/expression-evaluator-port.ts`,
  `packages/engine/src/node-executor/execute-branch.ts`,
  `packages/engine/src/node-executor/execute-fan-out.ts`,
  `packages/engine/src/node-executor/execute-loop.ts`,
  `packages/engine/src/node-executor/execute-human-approval.ts`,
  `packages/engine/src/agent-step/run-agent-step.ts`,
  `apps/server/src/engine-assembly/create-rejecting-template-renderer.ts`,
  `docs/spec/SPEC-004-vegrehajto-motor.md` 1., 3.2, 5., 6.1, 15. szekció,
  `docs/research/2026-09-23-megszakitas-leallas-meres.md` 4. szekció
