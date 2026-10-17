# T-009-60: a szám mezők pozitív egész szabálya és az `agents` bejegyzés kötelező mezői

**Dátum:** 2026-10-17
**Ág:** `feat/spec-008-szam-es-agent-mezok`, az `origin/main` `0b263ad` állapotáról
**Környezet:** Node `v26.7.0`, Bun `1.4.0`, `zod@4.4.3` (telepítve), Vitest `4.1.11`, Playwright `1.62.1`
chromium a sandbox `LD_LIBRARY_PATH` kerülőjével (`.claude/CLAUDE.md` 12. szekció).
**Hatókör:** SPEC-008 5.2, 5.4, O-37 ("Mező alatti hiba."), O-38 ("Üresen ne legyen menthető."), 14.1;
a 116. és a 117. kritérium; PLAN-009 T-009-60.

## 1. A hiány mérése, előtte

A változtatás előtti fán (`0b263ad`), az `apps/server` csomagból futtatott, a repóba nem került
egyszeri próba a `protocol` olvasó (`NodeConfigSchema`) és mentési (`NodeConfigSaveSchema`) sémáját és
a `db` `isNodeConfig` guardját ugyanarra a konfigra hívta. Az eredmény (igaz: elfogadja):

| Konfig                                  | olvasó | mentési | `db` guard |
| --------------------------------------- | ------ | ------- | ---------- |
| `loop`, `maxIterations: -1`             | igaz   | igaz    | hamis      |
| `error_handler`, `backoffMs: [1.5]`     | igaz   | igaz    | hamis      |
| `loop`, `maxIterations: Infinity`       | hamis  | hamis   | hamis      |
| `human_approval`, `timeoutMs: Infinity` | hamis  | hamis   | hamis      |
| `agent_step`, `maxTurns: -1` vagy `1.5` | igaz   | igaz    | igaz       |
| `human_approval`, `timeoutMs: -5`       | igaz   | igaz    | igaz       |

Az első két sor a SPEC-008 5.4 "Mi volt a hiány" bekezdése: a szerkesztő elküldte, a szerver
`malformed_node_config` hibával, mezőútvonal nélkül utasította el (a régi
`replace-workflow-graph.spec.ts` "érvénytelen node config-ra malformed_node_config hibát ad" tesztje
pontosan ezt a rést célozta). A harmadik és a negyedik sor mutatja, hogy a telepített `zod@4.4.3`
`z.number()` sémája a végtelen értéket maga elutasítja, tehát a pozitív egész szabály csak véges számra
ad hibát, a `NaN` és a végtelen mellé második hibát nem.

## 2. A szerver `PUT` kezelőjének `isNodeConfig` ága

A szabály után a mentési séma a `db` guard pozitív egész szabályát is érvényesíti. A kezelő a mentési
séma `parsed.data` kimenetét adta a guardnak, ami a zod saját, újonnan felépített objektuma, tehát a
guard hamis ága csak akkor futhatna, ha a séma és a guard egy alakon eltérően döntene. A guard minden
feltételére vett próba (rendszer prompt preset `append` és `excludeDynamicSections` nélkül, MCP
szerver hiányzó mezővel, `skills`, hiányos `sandbox`, `structuredOutput` `schema` kulcs nélkül és
`undefined` értékkel, szám `effort`, `start` `required` nélkül, `branch` `defaultBranchKey` nélkül,
`sub_workflow` nem szöveg leképezéssel, `join` `merge` lista `settings` értékkel, `human_approval`
`timeoutMs` nélkül, végtelen és `2^60` számok) mindenhol egyező döntést adott. A kezelő ezért a
`config` mezőt guard nélkül adja át (a két unió típusszinten azonos, `as` nem kell), mert az ottani
hibaág a HTTP úton garantáltan sosem futna, ami a 100 százalékos lefedettség miatt tilos
(`.claude/CLAUDE.md` 5. szekció). A próba esetei a repóba kerültek: az `apps/server`
`node-config-drift-protection.spec.ts` "a mentési séma és a db isNodeConfig guard a guard ellenőrzött
alakjain ugyanúgy dönt" blokkja (19 eset), tehát a két oldal szétválása a `test` kapun bukik.

**Mellékhatás, nem javítva (megfigyelés):** az `apps/web` `rest-error-class.spec.ts` "a mentés
malformed_node_config hibája a Toast üzenetében a saját mondatával áll" tesztje egy `PUT` válasz
mockja; a valós szerver ezt a hibaosztályt a `PUT` végponton ezentúl nem adja (a futás indításakor a
motor igen). A teszt a kliens hibaosztály leképezését ellenőrzi, ami ettől változatlanul érvényes.

## 3. A sodródás védelem szándékosan elrontott próbái (116. kritérium)

Az `apps/server` `node-config-drift-protection` témája mezőnként futásidejű ágat kapott: a három mező
(`loop.maxIterations`, `error_handler.maxAttempts`, a `backoffMs` három helye) a 0, a -3 és az 1,5
értékkel mindkét oldalon elbukik, az 5 értékkel mindkettőn átmegy, és a szabály alá nem tartozó három
szám mező (`timeoutMs`, `maxTurns`, `maxBudgetUsd`) mindhárom értékkel mindkettőn átmegy. Nem
commitolt próbák, a fájl utána visszaállítva:

| Rontás                                                                                      | Parancs                                                           | Eredmény                   |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------- |
| `protocol`: a `POSITIVE_INTEGER_FIELD_PATHS` `error_handler` sorából a `backoffMs.*` kivéve | `bun run vitest run apps/server/src/node-config-drift-protection` | 9 bukott, 85 zöld (94-ből) |
| `db`: az `isPositiveInteger` `value > 0` feltétele `value >= 0`-ra cserélve                 | ugyanaz                                                           | 5 bukott, 89 zöld (94-ből) |

A két rontás a két irányt igazolja: a `protocol` gyengülése és a `db` gyengülése is bukik. (A 94 a
19 egyezési eset felvétele előtti darabszám; azóta 113.)

## 4. Az e2e szándékosan elrontott próbái

Az új e2e fájl: `apps/web/e2e/graph-node-number-and-agent-fields.spec.ts`, 8 teszt (a három szám mező
öt esete a 0, -3, 1,5 sorral és a 7 mentésével, egy elhagyás alapú megjelenés a szám mezőn, az
`agents` két tesztje). Nem commitolt próbák, egyenként visszaállítva, a fájl futtatása
`bun x playwright test e2e/graph-node-number-and-agent-fields.spec.ts`:

| Rontás                                                                                | Eredmény                                     |
| ------------------------------------------------------------------------------------- | -------------------------------------------- |
| R1 `protocol`: a `loop` sora üres (`loop: []`)                                        | 1 bukott (`loop maxIterations`), 7 zöld      |
| R2 `apps/web` `validateGraphForSave`: az `agents` hibalista nem állítja meg a mentést | 1 bukott (az `agents` mentési teszt), 7 zöld |
| R3 `apps/web` `NodeInspector`: a hibatérkép nem kapja meg az `agents` hibáit          | 2 bukott (mindkét `agents` teszt), 6 zöld    |

## 5. Az e2e lefedettség előtte és utána

A 2026-09-05-i e2e research 29. szekciójának tiszta eljárása, a 47. és 49. szekció sandbox módja
szerint: `rm -rf apps/web/e2e/.nyc_output apps/web/coverage-e2e apps/web/test-results`, az `apps/web`
alatt `bun x playwright test --shard=<i>/8` nyolc egymás utáni futásban, `flock
/tmp/playwright-gep.lock` alatt, a config `workers: 3` értékével, majd `bun run coverage:e2e:report`
(exit 0, a meglévő küszöbbel). A darabszámok a `nyc report --reporter=json-summary` kimenetéből.

**Előtte** (`0b263ad`, 593 teszt, mind zöld) és **utána** (a lépés végső kódja, 601 teszt, mind zöld):

| Metrika    | Előtte fedett / összes (fedetlen) | Utána fedett / összes (fedetlen) |
| ---------- | --------------------------------- | -------------------------------- |
| statements | 1991 / 2005 (14)                  | 2013 / 2027 (14)                 |
| branches   | 918 / 929 (11)                    | 933 / 944 (11)                   |
| functions  | 684 / 686 (2)                     | 694 / 696 (2)                    |
| lines      | 1920 / 1934 (14)                  | 1940 / 1954 (14)                 |

**A fedetlen darabszám egyik metrikán sem nőtt**, és a fedetlen helyek ugyanazon az öt fájlon állnak,
mint előtte (`mount-app.tsx` 3/2/0/3, `read-frontend-config.ts` 8/7/1/8, `is-valid-connection.ts`
1/1/0/1, `perform-route-request.ts` 1/1/0/1, `use-stream-connection.ts` 1/0/1/1, statements / branches
/ functions / lines). Az új `find-blank-agent-definition-fields.ts` 16/16, 9/9, 8/8, 15/15 fedett; a
`isBlankAgentDefinitionField` "nem szöveg" ágát az új e2e prompt nélküli régi bejegyzése (`regi`) fedi.
A küszöb nem mozdul (PLAN-009 F9 bevezető szabálya: a lépés a darabszámot vezeti, a küszöböt nem).

## 6. Nyitott kérdés: a szám mező alatti hibaszöveg mondata

**Nyitva.** A SPEC-008 5.4 "Amit a döntés nem rögzít" bekezdése szerint a mondatot a user döntése nem
rögzíti. A meglévő minták: a mentési séma egyetlen saját mondata "A mező nem lehet üres." (a számra
nem illik), a szám mezők típushibája a zod saját, angol alapértelmezett szövege (a `VITE_COVERAGE`
buildben "Invalid input"), és az `apps/web` `read-frontend-config.ts` "A(z) X konfiguráció értéke nem
pozitív egész szám." mondata (konfigurációs hiba, nem mező alatti). Egyik sem dönti el.

**Addig:** a mentési séma `NOT_POSITIVE_INTEGER_MESSAGE` konstansa "A mező értéke nem pozitív egész
szám.", a két meglévő magyar minta összevonása (a `BLANK_FIELD_MESSAGE` "A mező ..." alanya és a
`read-frontend-config.ts` "... értéke nem pozitív egész szám." állítmánya). A szöveg egy konstansban
áll, a unit, a szerver és az e2e tesztek a literált állítják.

**Mi zárná le:** a user döntése. A megfontolt változatok:

1. "A mező értéke nem pozitív egész szám." (a jelenlegi, a két meglévő minta összevonása);
2. "A mező pozitív egész számot vár." (pozitív, elvárást megnevező alak);
3. a zod saját alapértelmezett üzenete, ahogy a `NaN` típushibánál ma (angol szöveg, a lefedettségi
   buildben "Invalid input").
