# PLAN-012 végrehajtás: mérések és feljegyzések (2026-10-28)

Kapcsolódó: [`../plan/PLAN-012-beallitasok-es-agent-konfiguracio.md`](../plan/PLAN-012-beallitasok-es-agent-konfiguracio.md),
[`../spec/SPEC-009-beallitasok-es-agent-konfiguracio.md`](../spec/SPEC-009-beallitasok-es-agent-konfiguracio.md),
`.claude/CLAUDE.md` 8. szekció (kapuk, a helyi futtatás módja).

## 1. Kiinduló állapot (T-012-1)

**Fa:** `feat/spec-009-beallitasok`, fej `54d53f5` (a munka előtt; a mérés a futtató
sandboxban, `~/wt/s09`, Linux, 4 mag, 3 GB RAM, Node és Bun a `. ~/envrc` szerint).

### 1.1 A kilenc kapu a fejen

| Parancs                                 | Kilépési kód | Megjegyzés                  |
| --------------------------------------- | ------------ | --------------------------- |
| `bun run format:check`                  | 0            | minden fájl formázott       |
| `TURBO_CONCURRENCY=1 bun run typecheck` | 0            | 19/19, turbo gyorsítótárból |
| `bun x turbo run lint --concurrency=1`  | 0            | 32/32, turbo gyorsítótárból |
| `bun run test`                          | 0            | lásd 1.2                    |
| `bun run build`                         | 0            | 1/1, turbo gyorsítótárból   |
| `bun run docs:check`                    | 0            |                             |
| `bun run check:casing`                  | 0            |                             |
| `bun run check:graph`                   | 0            |                             |
| `bun run check:db-drift`                | 0            |                             |

A typecheck, a lint és a build gyorsítótárból válaszolt (a turbo bemeneti lenyomata azonos a korábbi zöld
futással); a `test` mindig valódi futás (nem turbo task).

### 1.2 Unit tesztszámok (`bun run test`, Vitest, a lefedettségi küszöb 100 százalék, zöld)

620 tesztfájl, **6535 teszt**, mind zöld; a futás 78,3 s (transform 15,9 s, import 78,6 s, tests 26,8 s,
environment 39,9 s), `flock /tmp/kapu-gep.lock` alatt, egy bash hívásba belefér.

### 1.3 Az e2e: tesztszám és fedetlen tételek

Teljes e2e **649 teszt, mind zöld**: nyolc shardban 82 + 7 x 81. A shardok futásideje (Playwright jelentés
szerint): 30,4 / 27,4 / 48,3 / 46,1 / 52,9 / 30,1 / 34,2 / 32,9 s, bash hívásban 31 / 28 / 49 / 46 / 55 / 30 /
35 / 33 s (a `vite build` a `webServer` része, az első shardnál épül, a többinél `reuseExistingServer` miatt
nem várt). `bun run coverage:e2e:report` kilépési kód **0** a jelenlegi küszöbbel (99.35 / 98.94 / 99.73 /
99.32); a riport 10 s.

A számok a `nyc report --reporter=json-summary` kimenetéből (ugyanaz a nyers könyvtár):

| Metrika    | Fedett / összes | Arány (%) | Fedetlen | Küszöb a `package.json`-ban |
| ---------- | --------------- | --------- | -------- | --------------------------- |
| statements | 2156 / 2166     | 99,53     | 10       | 99.35                       |
| branches   | 1034 / 1044     | 99,04     | 10       | 98.94                       |
| functions  | 751 / 752       | 99,86     | 1        | 99.73                       |
| lines      | 2071 / 2081     | 99,51     | 10       | 99.32                       |

**Fedetlen tételek fájlonként** (statements / branches / functions / lines): `app-mount/mount-app.tsx` 3/2/0/3,
`frontend-config/read-frontend-config.ts` 4/6/0/4, `graph-editor/is-valid-connection.ts` 1/1/0/1,
`rest-client/perform-route-request.ts` 1/1/0/1, `stream-client/use-stream-connection.ts` 1/0/1/1. Ez ugyanaz az
öt fájl, mint az `2026-09-05-e2e-lefedettsegi-kuszob.md` 49.3 szekciójában; a fedetlen darab akkor 14/11/2/14
volt (49.2), most 10/10/1/10, tehát egyik metrikán sem nőtt. A küszöb
(`apps/web/package.json`) ebben a lépésben **nem változott**: a küszöb mozgatása külön, tételes levezetést
igénylő döntés (`.claude/CLAUDE.md` 8. szekció, ratchet), nem T-012-1 feladata.

### 1.4 Az SDK pin

`@anthropic-ai/claude-agent-sdk` `0.3.245`: `apps/server/package.json:11` és `packages/agent/package.json:12`
pontos verzió, a telepített `node_modules/.bun/@anthropic-ai+claude-agent-sdk@0.3.245+.../package.json`
`version` mezője `0.3.245`, a `docs/research/2026-08-26-toolchain.md:10` sora `0.3.245` ("pinelve"). Változatlan.

### 1.5 A helyi futtatás módja (a következő agenteknek)

Egy bash hívás a sandboxban kb. 80 s után a hívó oldalon megszakadhat (mérve: négy shard egy hívásban 81 s után
elvesztette a kimenetet, a futás félbemaradt), a háttérfolyamat a hívással hal. Ezért:

1. Tiszta nyers könyvtár: `rm -rf apps/web/e2e/.nyc_output apps/web/coverage-e2e apps/web/test-results`.
2. Az `apps/web` könyvtárban, **hívásonként legfeljebb két shard**, egymás után, mindegyik `flock
/tmp/playwright-gep.lock` alatt, `timeout 70` mellett, a `workers: 3` (config) értékével:
   `. ~/envrc && cd ~/wt/s09/apps/web && for i in 1 2; do timeout 70 flock /tmp/playwright-gep.lock bun x
playwright test --shard=$i/8 > /tmp/e$i.log 2>&1; echo shard$i exit=$?; done`, majd a `3 4`, `5 6`, `7 8`
   párokkal további három hívásban. A nyolc shard ugyanabba a nyers könyvtárba ír (a fájlnevek egyediek).
   Elég a 8 shard, a `/16` bontás nem kellett (a leglassabb shard 55 s a hívásban).
3. Ha egy hívás megszakadt, a részleges nyers adat érvénytelen: a 1. lépéstől újra (a félbemaradt shard adata
   a nyers könyvtárban maradna, és a metrikát torzítaná).
4. Riport: `cd ~/wt/s09 && bun run coverage:e2e:report` (kilépési kód a küszöbről dönt, 10 s). A darabszámokhoz
   ugyanazon a nyers adaton: `cd apps/web && bun x nyc report --temp-dir e2e/.nyc_output --report-dir /tmp/covjson
--reporter=json-summary`.
5. A `playwright.config.ts` `webServer` lépése `vite build`-et futtat `VITE_COVERAGE=true` mellett; a `build`
   gyorsítótár ezt nem érinti.
6. A nehéz kapuk `flock /tmp/kapu-gep.lock` alatt, a `test` egy hívásba belefér (78 s), a typecheck
   `TURBO_CONCURRENCY=1`, a lint `--concurrency=1`.

## 2. T-012-19: e2e a T-012-14 ... T-012-18 forgatókönyveire

Mérés és munka a `feat/spec-009-beallitasok` ágon, a `c0a4266` fejről indulva. A termékkód nem változott, a
rontások mind visszaállítva.

### 2.1 Mi készült

- `apps/web/e2e/settings-screen.spec.ts`: a Provider kártya (Kapcsolat teszt gomb, eredmény, hiba), a
  Párhuzamossági korlát kártya (soronkénti Mentés `PUT` és Korlát törlése `DELETE`, mező alatti hiba nem pozitív
  egészre, `PUT` nélkül), a Futás napló kártya (Switch, mentés alatti tiltás, szerver válaszából vezérelt érték,
  hiba), a betöltési hibák és a kártyák tér/téma mátrixa (light/dark x 320/1440 pixel). Kiegészítés, nem
  duplikáció: a meglévő Provider kártya tesztek érintetlenek.
- `apps/web/e2e/workflow-list.spec.ts`: a "Workflow szerkesztése" modális (név, leírás, provider, `PATCH`
  törzs, "Nincs megadva" = `providerId: null`, Kapcsolat teszt, betöltés és hiba, mentés alatti állapot,
  téma x szélesség mátrix).
- `apps/web/e2e/node-inspector.spec.ts`: a lépés felülírás provider választójának Kapcsolat teszt gombja.
- Új segédek: `e2e/request-gate.ts` (tartott kérés, hogy a függő állapot időzítő nélkül állítható legyen) és
  `e2e/expect-horizontally-inside.ts` (vízszintes beférés a viewportba).
- Minden REST hívás `page.route()` mockon megy (`installApiMocks`, `mockRoute`).

### 2.2 Egy meglévő teszt módosítása és oka

A `responsive.spec.ts` "a Beállítások sorának felirata és választója minden támogatott szélességen a
viewporton belül van" tesztje az új három kártya miatt a Gráf szerkesztő kártyát a nézetablak alá szorította
(`toBeInViewport({ ratio: 1 })` bukott a 5. shardon). A teszt az állítás előtt a kártya régiójára görget
(`scrollIntoViewIfNeeded`). Az állítás tárgya nem változott.

### 2.3 A lefedettségi fixtúra csapdája

A `coverage-fixture.ts` a `window.__coverage__` értéket a teszt végén nyitott lapból írja ki. Egy teszten belüli
`page.reload()` vagy navigáció a korábbi lap lefedettségét elveszíti. Két betöltési hiba teszt ezért először
újratöltést tartalmazott, és a `ConcurrencyLimitsSettingsCard.tsx` 33. sora fedetlen maradt. A javítás: egy
teszt egy betöltési hiba, újratöltés nélkül (négy teszt két helyett).

### 2.4 Szándékos rontások

Minden rontás egy ideiglenes termékkód hiba, a megfelelő spec futtatásával; az ép kódon a teszt zöld volt, a
rontásra legalább egy új teszt elbukott, utána a fájl visszaállt.

| Csoport              | Rontások                     | Mit rontottunk (példák)                                                                                   | Eredmény                         |
| -------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Korlát sor           | R1 ... R6, R20, R21          | a szám mező alapértéke `'5'`, a vázlat elfogadja a `0`-t, a Mentés/Törlés hívás és a mező alatti hiba ága | mindegyikre bukott új teszt      |
| Futás napló kártya   | R7, R8, R19b, R27, R28       | a kapcsoló érték, a mentés alatti tiltás, a hiba ág                                                       | mindegyikre bukott új teszt      |
| Provider és választó | R9, R10, R11, R24, R25, R33  | a Kapcsolat teszt gomb tiltása, az eredmény megjelenítése, a hiba ág                                      | mindegyikre bukott új teszt      |
| Szerkesztő modális   | R12, R13, R29, R30, R31, R32 | a `providerId: null` küldése, a mentés alatti állapot, a Kapcsolat teszt hatóköre                         | mindegyikre bukott új teszt      |
| Korlát kártya        | R14, R23, R26                | a betöltés és a hiba ág                                                                                   | mindegyikre bukott új teszt      |
| Üres válasz (204)    | R34                          | `emptyResponseSchema` hibaága                                                                             | bukott a törzsel válaszoló teszt |
| Elrendezés mátrix    | R15, R16, R17b, R18, R19     | `.provider-select` szélesség, átfedés, sötét téma `Alert` festés                                          | a mátrix tesztek bukták          |

Megjegyzés a `.provider-select { min-width: 500px }` rontásról: 320 pixelen nem bukott, mert a választó fix 200
pixeles. A rontás `width: 500px; flex: none` alakra cserélve már bukott a 320 pixeles mátrix teszteken.

### 2.5 Lefedettség és ratchet

Teljes futás: 8 shard, tiszta nyers könyvtár, `bun run coverage:e2e:report` kilépési kód 0. E2E tesztek száma:
688 (kiinduló 649, +39). A pontos számok `nyc report --reporter=json-summary` kimenetéből:

| Metrika    | Kiinduló (fedett/összes) | Kiinduló fedetlen | Most (fedett/összes) | Most fedetlen |
| ---------- | ------------------------ | ----------------- | -------------------- | ------------- |
| statements | 2156/2166                | 10                | 2323/2334            | 11            |
| branches   | 1034/1044                | 10                | 1123/1133            | 10            |
| functions  | 751/752                  | 1                 | 806/808              | 2             |
| lines      | 2071/2081                | 10                | 2228/2239            | 11            |

A fedetlen tételek száma három metrikán eggyel nő (statements, functions, lines), pontosan egy forrásból:
`apps/web/src/provider-select/unavailable-provider-connection-tester.ts` 11. sora (1 utasítás, 1 függvény, 1
sor). Ez a `ProviderOptionsContext` alapértéke. E2E-vel nem érhető el: az `AgentStepConfigFields` csak a
`GraphEditorScreen` alatt renderelődik, ami mindig megadja a kontextust, tehát az alapértékhez felhasználói
úton nincs út. Unit teszt fedi. A küszöb nem változott (99.35 / 98.94 / 99.73 / 99.32), a százalékok felette
állnak (99.52 / 99.11 / 99.75 / 99.50).

A T-012-14 további két új fedetlen tételét e2e teszt zárta le: `ProviderSelect.tsx` `errorMessage ?? undefined`
ága (Kapcsolat teszt hiba üzenet nélkül) és az `empty-response-schema.ts` hibaága (a `DELETE` 204 helyett
törzsel válaszol).

Döntés kérdés: az egy fennmaradó tétel elfogadása e2e-vel nem elérhető tételként, vagy a T-012-14 alapérték
átalakítása (termékkód terv döntés). A szabálykönyv 8. szekciója ilyen kategóriát ismer, de a fedetlen darabszám
növekedése itt tényleges, ezért a döntést nem hoztam meg.

A 2.5 szekció nyitott kérdése lezárult, lásd a 3. szekció 3.4 pontját: az alapérték függvény megszűnt, a
fedetlen tételek száma visszaállt a kiinduló értékre.

## 3. T-012-24 és T-012-25: hibamondatok és e2e a skill és MCP felületekre

Mérés és munka a `feat/spec-009-beallitasok` ágon, a `d477355` fejről indulva. A kilenc kapu az utolsó
termékkód változás után zöld (3.6).

### 3.1 T-012-24: a leképezés ellenőrzése

A `protocol-error-class-message.ts` `Record<ProtocolErrorClass, string>` leképezése kimerítő (a `skill_not_found`,
a `mcp_server_not_found`, a `missing_mcp_server_env` és a SPEC-009 5.4 tizenöt feltöltési osztálya mind benne
áll); a unit teszt táblázata a zárt szótár minden tagját pontosan egyszer fedi, és ellenőrzi az írásjelet. A tizenöt
mondat a SPEC-009 5.4 táblázat "A mondat tárgya" oszlopával egyezik (például "A csomag túl nagy.", "Hiányzik a
SKILL.md."). Új hiány nem volt, kódot nem kellett írni.

Ami hiányzott, az az e2e a futás indításának három motor hibájára: `rest-error-class.spec.ts`, három új teszt
(`skill_not_found`, `mcp_server_not_found`, `missing_mcp_server_env`), mindegyik a lábléc danger `Alert` blokkját
állítja a saját mondatra, `.alert--danger` osztállyal, a szerver belső szövege és a hibaosztály neve nélkül.

### 3.2 T-012-25: új és kiegészített e2e

- `apps/web/e2e/skill-library-settings.spec.ts` (új, 12 teszt): lista (név, leírás, üres leírás mondata, méret, a
  két kockázat mondata), betöltés csontváz és hiba, új feltöltés (a `PUT` a névre megy, a törzs bájtról bájtra a
  fájl, `Content-Type: application/zip`, a lista újratöltődik, az űrlap kiürül), név és fájl hiba a mező alatt, a
  fájl eltávolítása, felülírás megerősítő `Modal` (Mégse nem küld, Felülírás küld), a "túl nagy" és a "hiányzó
  SKILL.md" mondat az `Alert` blokkban, mind a tizenöt osztály mondata egy tesztben, a feltöltés alatti tiltás és
  `aria-busy`, törlés megerősítés (Mégse, Törlés `DELETE`), a törlés hibája, az üres állapot.
- `mcp-server-settings.spec.ts` (+4 teszt): sse szerkesztés és a nullázott Authorization "nincs" választása, a
  hozzárendelés nélküli változó a soron, az argumentum címke eltávolítása (a bejelentés a `status` régióban), a lista
  betöltési hibája, a törlés hibája.
- `graph-node-mcp-references.spec.ts` (+3 teszt): sse szerver és hozzárendelés nélküli változó alapértelmezés
  felirata, az eltávolított szerver oldali név jelzése, az érvénytelen bejegyzésű hivatkozás megnevezése.
- `graph-node-skills.spec.ts`: nem kellett bővíteni (az összes ága fedett).

### 3.3 Egy valódi hiba, amit az e2e talált

A `SkillUploadForm` a sikeres feltöltés után kiürítette a név mezőt, de a `TextField` "érintett" jelölése megmaradt,
ezért az üres név azonnal a névszabály hibáját mutatta a mező alatt. A javítás: a mező külön `key` számlálót kap, ami
csak siker után lép (a fájl eltávolítása nem törli az érintettséget). Védelem: a `SkillUploadForm.spec.tsx` "új
névvel" tesztje (a mező elhagyása után a siker után nincs `.field__error`; a javítás nélkül elbukik) és az e2e
feltöltés tesztje (`alert` darabszám nulla).

Egy megfigyelés, javítás nélkül: a kattintás előtt elhagyott, érvénytelen név mezőn a hiba megjelenése eltolja a
gombot, ezért a Playwright `click` a lenyomás és az elengedés között más elemre kerülhet. A teszt emiatt az üres
űrlapra kattint (a mező érintetlen), nem a kitöltött, érvénytelen névre. Ez a repó több űrlapján közös viselkedés,
nem a skill feltöltés sajátja.

### 3.4 A T-012-19 e2e rés lezárása és a fedetlen tételek

- `ProviderOptionsContext` alapértéke: a `testConnection` `undefined` (puszta adat), a `ProviderSelect` a kezelőt
  `testConnection && (...)` alakkal építi, ami ág nélkül szűkít, és a gomb `disabled` feltétele kibővült a
  `handleTest === undefined` operandussal (az e2e-ben kiértékelődik). Az `unavailableProviderConnectionTester`
  fájl és spec törölve. Felhasználónak látható viselkedés nem változott; a gomb a szolgáltató nélküli (csak
  önálló komponens tesztben létező) esetben tiltott.
- `request-route-with-zip-body.ts`: a `parameters` kötelező lett (az egyetlen hívó mindig ad), a `?? {}` ág
  megszűnt (e2e úton elérhetetlen volt).
- A `RunViewHeaderSkeleton.tsx` nincs a fedetlen fájlok között a teljes futás végén, és a kiinduló öt fájl
  (1.3 szekció) egyike sem változott.

### 3.5 A teljes e2e és a lefedettség

Nyolc shard, tiszta nyers könyvtár (`rm -rf apps/web/e2e/.nyc_output apps/web/coverage-e2e apps/web/test-results`),
a shardok sorban, `flock /tmp/playwright-gep.lock` alatt: 93 + 92 x 7 = **737 e2e teszt, mind zöld** (kiinduló 649,
a T-012-19 után 688). `bun run coverage:e2e:report` kilépési kód **0**, a küszöb nem változott.

| Metrika    | Fedett / összes | Arány (%) | Fedetlen | Kiinduló fedetlen (1.3) |
| ---------- | --------------- | --------- | -------- | ----------------------- |
| statements | 2662 / 2672     | 99,62     | 10       | 10                      |
| branches   | 1307 / 1317     | 99,24     | 10       | 10                      |
| functions  | 933 / 934       | 99,89     | 1        | 1                       |
| lines      | 2551 / 2561     | 99,60     | 10       | 10                      |

A fedetlen tételek ugyanaz az öt fájl, mint a kiinduló állapotban (`app-mount/mount-app.tsx`,
`frontend-config/read-frontend-config.ts`, `graph-editor/is-valid-connection.ts`,
`rest-client/perform-route-request.ts`, `stream-client/use-stream-connection.ts`), tételszámra is azonosak.

A köztes futás (a skill és a hibamondat e2e után, az MCP kiegészítés előtt) 13 / 21 / 2 / 13 fedetlent mutatott, és a
küszöböt (branches) nem teljesítette; a hiány a T-012-22 és T-012-23 lépések fedetlen ágaiból jött (MCP kártya,
hivatkozás mező, `request-route-with-zip-body`), ezeket a 3.2 pont kiegészítései és a 3.4 pont szerinti átalakítás
fedte le. A küszöböt nem módosítottuk.

Unit: 714 tesztfájl, **7474 teszt**, mind zöld, 100 százalék mind a négy metrikán (`bun run test` kilépési kód 0).

### 3.6 Szándékos rontások

Minden rontás egy ideiglenes termékkód hiba, a megfelelő spec futtatásával; a rontás előtt a teszt zöld volt, a
rontásra legalább egy új teszt elbukott, utána a fájl visszaállt.

| Jel     | Mit rontottunk                                                              | Bukó teszt                                          |
| ------- | --------------------------------------------------------------------------- | --------------------------------------------------- |
| R1      | `SkillRow`: az üres leírás mondata helyett üres szöveg                      | lista                                               |
| R2      | feltöltés `Content-Type`: `application/json`                                | új feltöltés                                        |
| R3      | feltöltés törzse üres `Blob`                                                | új feltöltés                                        |
| R4      | feltöltés után nincs lista újratöltés                                       | új feltöltés, felülírás, feltöltés alatt            |
| R5      | siker után a fájl kiválasztás megmarad                                      | új feltöltés                                        |
| R6      | a név mező `key` nélkül (a 3.3 hiba visszahozva)                            | új feltöltés                                        |
| R7      | azonos névre nincs felülírás megerősítés                                    | felülírás                                           |
| R8      | törlés siker után a modális nem zár                                         | törlés                                              |
| R9      | törlés hiba `Alert` elhagyva                                                | törlés hiba                                         |
| R10     | `skill_archive_too_large` mondata megváltoztatva                            | "túl nagy" és a tizenöt osztály tesztje             |
| R11     | a fájl eltávolítása nem csinál semmit                                       | fájl eltávolítás                                    |
| R12     | a Feltöltés gomb a feltöltés alatt nem tiltott                              | feltöltés alatti tiltás                             |
| R13     | a névszabály nem érvényesül (bármi elfogadva)                               | üres űrlap, hiba a mező alatt                       |
| R14     | a hiányzó fájl hibája nem jelenik meg                                       | üres űrlap, fájl eltávolítás                        |
| R15     | az üres állapot feltétele hibás                                             | utolsó skill törlése                                |
| R16     | a lista betöltési hibája nem jelenik meg                                    | betöltés alatt és hiba                              |
| R17     | a betöltés csontváz `aria-busy` nélkül                                      | betöltés alatt és hiba                              |
| R18-R20 | `skill_not_found`, `mcp_server_not_found`, `missing_mcp_server_env` mondata | az adott osztály futás indítás tesztje              |
| R21     | a `ProviderSelect` kezelője mindig `undefined`                              | 5 teszt a `settings-screen` és `node-inspector` e2e |
| R22     | MCP törlés hiba `Alert` elhagyva                                            | MCP törlés hiba                                     |
| R23     | MCP lista betöltési hiba `Alert` elhagyva                                   | MCP lista hiba                                      |
| R24     | tárolt, de eltávolított név jelzése elhagyva                                | eltávolított név jelzése                            |
| R25     | sse szerkesztés: az Authorization mező üres                                 | sse szerkesztés                                     |
| R26     | hozzárendelés nélküli változó is nyíllal                                    | hozzárendelés nélküli változó                       |
| R27     | az eltávolítás bejelentésének szövege más                                   | argumentum eltávolítás                              |
| R28     | `definition.authEnvName ?? 'nincs'` helyett más felirat                     | sse alapértelmezés felirata                         |
| R29     | üres alapértelmezésnél nem a deklarált név a felirat                        | sse alapértelmezés felirata                         |
| R30     | az érvénytelen bejegyzés nem jelzi a hivatkozás alakját                     | érvénytelen bejegyzés                               |

A rontásokat a `/tmp/ront/ront.py` segédszkript futtatta (ideiglenes, nem a repóé): kicseréli a termékkód egy
szövegét, lefuttatja a megadott spec fájlt, kiírja a bukó teszteket, és visszaállítja a fájlt.

### 3.7 Kapuk

`format:check`, `typecheck` (`TURBO_CONCURRENCY=1`), `lint` (`--concurrency=1`), `test`, `build`, `docs:check`,
`check:casing`, `check:graph`, `check:db-drift`: mind kilépési kód 0 a végső termékkód fején.

## 4. Adverzariális átvizsgálás (T-012-27)

### 4.1 ZIP: a skill feltöltés, lista és törlés találatai

Egy független átvizsgálás tizenegy találatot adott a `apps/server` `skill-endpoint` és `http-server`
témájára (a reprodukciós szkriptek a repón kívül, `/tmp/adv-zip/` alatt álltak). Minden javított bug
mellett regressziós unit teszt áll; mindegyik a javítás előtti kódon bukik (saját futtatás: a termékfájlok
`HEAD` előtti változatával a felsorolt tesztek bukottak, a javítással zöldek). A teszt nevek a
`<spec fájl> › <describe> > <it>` alakban állnak, rövidítve.

| #   | Találat                                                                                                                                          | Javítás                                                                                                                                                                                                                                                  | Commit    | Teszt                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | két egyidejű feltöltés ugyanarra a névre: `ENOTEMPTY`/`ENOENT` kivétel (500), árva `.staging-*-<uuid>` könyvtár                                  | névenkénti soros zár (`skill-name-lock.ts`, folyamaton belüli ígéret lánc), a csere és a törlés ugyanazon a záron; a `previous` könyvtár a `finally` ágban minden kimenetel után törlődik                                                                | `0b07acc` | `upload-skill.spec.ts` › egyidejű írások: "a csere a név zárján fut", "nyolc párhuzamos felülírás mind sikeres", "egyidejű feltöltés és törlés a HTTP úton"; `skill-name-lock.spec.ts` (4 teszt)                                                                           |
| 2   | Unicode normalizálási ütközés (NFC és NFD név) macOS-en felülírás; a `mkdir` hívások a `try` blokkon kívül                                       | az ütközés kulcsa `normalize('NFC').toLowerCase()`; minden fájlrendszer hívás a bejegyzésenkénti `try` blokkban (`writeEntry`)                                                                                                                           | `2941298` | `find-path-collision.spec.ts` › "két csak Unicode normalizálásban eltérő útvonal ütközik"; `extract-skill-archive.spec.ts` › "2. két, csak Unicode normalizálásban eltérő útvonal"                                                                                         |
| 3   | a fájlrendszer hibák besorolása: a könyvtár ág `ENAMETOOLONG` 500, a fájl ágon minden fájlrendszer hiba (`EACCES` is) `skill_archive_unreadable` | `isFileSystemError` guard és `classifyFileSystemWriteError` tábla: `ENAMETOOLONG` `skill_archive_unreadable` (O-50 addig), `EEXIST`/`ENOTDIR`/`EISDIR` `skill_archive_path_collision`, minden más továbbdobva, a szerver belső hiba útján 500 `internal` | `2941298` | `extract-skill-archive.spec.ts` › "3. a túl hosszú nevű könyvtár bejegyzés", "3. a túl hosszú nevű fájl és a túl hosszú nevű szülő könyvtár", "3. a szerver oldali fájlrendszer hiba (EACCES)"; `classify-file-system-write-error.spec.ts`; `is-file-system-error.spec.ts` |
| 4   | YAML alias bomba: a `document.toJS()` dobása kezeletlen                                                                                          | `toPlainValue` elkapja, `skill_manifest_invalid`                                                                                                                                                                                                         | `0c17e14` | `read-skill-manifest.spec.ts` › "az alias bombát hordozó frontmatter skill_manifest_invalid"                                                                                                                                                                               |
| 5   | a lista (`GET /api/skills`) egy elrontott elemre bukik (`Promise.all`)                                                                           | `summarizeSkillDirectory` elemenként hibatűrő (leírás, méret saját bejárással); a lista `Promise.allSettled`, a `stat` hibás elem kimarad                                                                                                                | `0c17e14` | `list-skills.spec.ts` › "egy kívülről elrontott elem nem buktatja a listát", "a meg sem nyitható elem kimarad"; `summarize-skill-directory.spec.ts` › kívülről elrontott könyvtár (4 teszt)                                                                                |
| 6   | a záró rekord alulhazudott bejegyzésszáma: a többi bejegyzés csendben kimarad                                                                    | a beolvasott központi könyvtár rekordok összhossza a deklarált központi könyvtár mérettel (ZIP64 esetén a ZIP64 rekordéval) egyezik, különben `skill_archive_unreadable` (`read-declared-central-directory-size.ts`)                                     | `2941298` | `extract-skill-archive.spec.ts` › "6. a záró rekordban alulhazudott bejegyzésszám", "6. a ZIP64 záró rekordos csomag"; `read-declared-central-directory-size.spec.ts`                                                                                                      |
| 7   | adatot hordozó könyvtár bejegyzés; a csak a helyi fejlécben titkosítottat jelző bejegyzés                                                        | a nem nulla kicsomagolt méretű könyvtár `skill_archive_entry_type_unsupported`; a fájl helyi fejlécének 0. bitje `skill_archive_entry_encrypted`                                                                                                         | `2941298` | `extract-skill-archive.spec.ts` › "7. az adatot hordozó könyvtár bejegyzés", "7. a csak a helyi fejlécben titkosítottat jelző fájl"                                                                                                                                        |
| 8   | nincs induláskori takarítás                                                                                                                      | `removeStagingLeftovers` a kapcsolatok fogadása előtt (`continueStartupWithDatabase`)                                                                                                                                                                    | `0b07acc` | `remove-staging-leftovers.spec.ts` (2 teszt); `continue-startup-with-database.spec.ts` › "a kapcsolatok fogadása előtt törli a skill könyvtár gyökerének .staging-* maradékait"                                                                                            |
| 9   | a `PUT` névellenőrzése a törzs teljes beolvasása után fut                                                                                        | a `BinaryRouteHandler` `accept(parameters)` lépése a törzs olvasása előtt dönt; névhibára a törzs megtartás nélkül (nulla korláttal) végigolvasva, a válasz 422                                                                                          | `0b07acc` | `upload-skill.spec.ts` › "a névszabálynak meg nem felelő vagy hiányzó névre az accept a törzs nélkül skill_name_invalid"; `create-http-server.spec.ts` › "a paraméterek elutasításakor a hibaválasz a törzs feldolgozása nélkül jön"                                       |
| 10  | SPEC-009 5.4 6. pont táblája: "a törzs olvasó a korláton túl olvasást megszakítja", a kód végigolvas                                             | a tábla a kódhoz igazítva (a döntött viselkedés a végigolvasás)                                                                                                                                                                                          | `0c17e14` | dokumentáció, teszt nem tartozik hozzá                                                                                                                                                                                                                                     |
| 11  | a nem szöveg frontmatter `name` (`123`, `null`) `skill_name_mismatch`                                                                            | termékdöntés, nem változott: SPEC-009 14.9 O-51                                                                                                                                                                                                          | `2941298` | nincs (a viselkedés változatlan)                                                                                                                                                                                                                                           |

### 4.2 Forrás alapú döntések

- **6. találat, felismerhetőség a `yauzl` 3.4.0 forrásából.** A `ZipFile.prototype._readEntry`
  (`index.js` 282. sor) a 284. sorban `self.entryCount === self.entriesRead` feltételnél leáll; a záró
  rekord 12. bájtján álló központi könyvtár méretet a `yauzl` nem olvassa és nem ellenőrzi, a
  `readEntryCursor` mező a `@types/yauzl` 3.4.0 szerint `boolean` típusú, tehát `as` nélkül nem
  használható. A kicsomagoló ezért a pufferből maga olvassa a deklarált méretet, a `yauzl` keresésével
  azonos módon (a legutolsó aláírás a fájl utolsó 22 bájtja előtt, ZIP64 helymutatónál a ZIP64 rekord 40. bájtja), és a bejegyzésenkénti `46 + fileNameLength + extraFieldLength + fileCommentLength` összeggel
  hasonlítja össze (APPNOTE 4.3.12, 4.3.14, 4.3.16).
- **7. találat, a helyi fejléc olcsó elérése.** A `ZipFile.prototype.readLocalFileHeader` (`index.js` 635.
  sor) a helyi fejléc 30 bájtját és a nevet olvassa, a `generalPurposeBitFlag` mezővel; a kicsomagolás a
  `openReadStream` hívásban ugyanezt a fejlécet amúgy is beolvassa (`minimal: true`), tehát a többlet
  bejegyzésenként egy 30 bájtos és egy név hosszú olvasás a memóriabeli pufferből.
- **7. találat, az osztály.** A SPEC-009 5.4 táblájának "deklarált és tényleges méret eltér" sora a `yauzl`
  `validateEntrySizes` ellenőrzésére szól, ami könyvtár bejegyzésre nem fut (az adatát a kicsomagoló nem
  olvassa); a könyvtár név és a nem nulla tartalom ellentmondásos típus, ezért az 1. pont osztálya
  (`skill_archive_entry_type_unsupported`), a spec 5.4 1. pontjában rögzítve. A deflate tömörítésű üres
  könyvtár (nulla kicsomagolt méret) elfogadott, ezért a feltétel a kicsomagolt méret, nem a tömörített.
- **4. találat.** A telepített `yaml` 2.9.1 `Document.js` `toJS` hívása a `maxAliasCount` értékét
  alapból 100-ra állítja, az `Alias.js` túllépéskor "Excessive alias count indicates a resource exhaustion
  attack" kivételt dob; a kivétel elkapása elég, korlátot nem állítunk.

### 4.3 Korlátok és nyitott pontok

- **O-50 (SPEC-009 14.9):** a túl hosszú név vagy túl mély útvonal osztálya termékdöntés; addig
  `skill_archive_unreadable`, fájl és könyvtár bejegyzésre egyaránt.
- **O-51 (SPEC-009 14.9):** a nem szöveg frontmatter `name` osztálya termékdöntés; addig
  `skill_name_mismatch`.
- **A 6. találat összehangolt hazugsága.** Ha a záró rekord a bejegyzésszámot ÉS a központi könyvtár
  méretét is az első bejegyzésekhez igazítja, a további rekordok rejtve maradnak, és ezt az ellenőrzés nem
  látja. Lezárná: a központi könyvtár vége (eltolás plusz méret) és a záró rekord (ZIP64 esetén a ZIP64
  rekord) kezdete közti rés vizsgálata. Nem készült el, mert a találat a bejegyzésszám hazugságáról szólt.
- **Digitális aláírás rekord.** Az APPNOTE 4.3.12 szerint a központi könyvtár végén digitális aláírás
  rekord állhat; ha a deklarált méret azt is tartalmazza, az ilyen csomag `skill_archive_unreadable`
  lesz. Valódi eszköz kimenetén nem ellenőrzött.
- **`EEXIST`, `ENOTDIR`, `EISDIR`.** A saját ütközés ellenőrzés után Linuxon nem idézhető elő, ezért csak a
  besoroló tábla unit tesztje fedi; a macOS fájlrendszer kis-nagybetű összevonásának a `toLowerCase`
  kulcstól eltérő esetei nem ellenőrzöttek.
- **A zár folyamaton belüli.** Két szerver folyamat ugyanarra a skill könyvtárra nem sorosodik; a SPEC-009
  5.1 egyetlen szerver folyamatot ír le.
- **A lista kimaradó eleme nem naplózódik.** A `stat` hibás skill könyvtár csendben kimarad, mert a
  végpont kezelők nem kapnak loggert (a `create-http-server.ts` naplózási modellje).
- **A jogosultság tesztek** (`chmod`) nem root futtatót feltételeznek; a sandbox futtatója nem root
  (`id -u`: 1045).

### 4.4 Kapuk

Minden commit előtt a kilenc kapu nulla kilépési kóddal futott (`format:check`, `typecheck`
`TURBO_CONCURRENCY=1`, `lint` `--concurrency=1`, `test` 100 százalékos lefedettséggel mind a négy metrikán,
`build`, `docs:check`, `check:casing`, `check:graph`, `check:db-drift`). Az e2e nem futott újra: a
változás kizárólag az `apps/server` csomagot érinti, az `apps/web` e2e tesztjei minden REST hívást
`page.route()` mockkal szolgálnak ki (szabálykönyv 11. szekció), tehát a szerver kódja az e2e
lefedettségben nem szerepel.

### 4.5 MCP és izoláció: találatok, javítások, mérések

Egy független átvizsgálás az MCP, a titok és az izoláció témában hat javítandó (A ... F) és három csak
rögzítendő pontot (O-52, O-53, CSRF) adott. Minden javított bug mellett regressziós unit teszt áll, és
mindegyik a javítás előtti kódon bukik (saját futtatás: a termékfájlok `HEAD` előtti változatával a felsorolt
tesztek bukottak, a javítással zöldek). Valódi provider hívás nem futott.

| #   | Találat                                                                                                                                                                                                                                                    | Javítás                                                                                                                                                                                                                                                                                                                                                           | Commit    | Teszt                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A   | a kapcsolat teszt `query()` hívása `settingSources` és `strictMcpConfig` nélkül futott, tehát minden beállítás forrás betöltődött (más hitelesítés, a gép MCP szerverei és hookjai)                                                                        | `testProviderConnection`: `settingSources: []`, `strictMcpConfig: true`; SPEC-009 7.1 és AC22 igazítva                                                                                                                                                                                                                                                            | `1bfe286` | `create-engine.spec.ts` › testProviderConnection › "a lépéssel azonos izolációval fut"                                                                                                                                                                                                                                                                                                                                                                       |
| B   | a valódi env olvasó `process.env[name] ?? null` alakja a `constructor`, `toString`, `hasOwnProperty`, `__proto__`, `valueOf` névre függvényt vagy objektumot adott, nem `null`-t, így a `missing_mcp_server_env` elmaradt                                  | `Object.hasOwn(process.env, name) && isString(value)`; a komment a viselkedéshez igazítva (az üres érték nem hiányzó, SPEC-009 6.4, nyitott kérdés marad)                                                                                                                                                                                                         | `f48b204` | `create-process-environment-reader.spec.ts` › "a prototípus lánc %s neve hiányzó változó" (5 eset), "az üres érték nem hiányzó"                                                                                                                                                                                                                                                                                                                              |
| C   | a `__proto__` MCP szerver nevet a névszabály elfogadta, az SDK eldobta                                                                                                                                                                                     | a mentési névszabály (`McpServerNameSaveSchema`) a mért három nevet tiltja; a `PUT /api/mcp-servers/:name` és a Beállítások űrlap ezt használja; SPEC-009 6.1 igazítva                                                                                                                                                                                            | `d9b8137` | `mcp-server-name-save-schema.spec.ts`; `save-mcp-server-definition.spec.ts` › "fenntartott név" (3 eset); `find-mcp-server-draft-errors.spec.ts` › "a fenntartott %s név"                                                                                                                                                                                                                                                                                    |
| D   | a lépés hivatkozásának `envBindings` értéke és `authEnvName` mezője névszabály nélkül ment át, egy REST úton beírt érték (titok) a `missing_mcp_server_env` üzenetben visszaíródott volna                                                                  | a `NodeConfigSaveSchema` ötödik szabálya (`findInvalidMcpServerReferenceEnvironmentNames`, az `agent_step` és a `join` `ai_synthesis` `settings` mezőjén, a hiba a mező útvonalán, az érték nélkül); az agent definíción a motor `parseAgentDefinition` hívása (`isEnvironmentVariableName`, új általános guard a `typeguards` csomagban) `malformed_node_config` | `3995fc0` | `node-config-save-schema.spec.ts` › "az MCP hivatkozás szerver oldali nevei env változó nevek" (5 teszt); `find-invalid-mcp-server-reference-environment-names.spec.ts`; `replace-workflow-graph.spec.ts` › "nem név alakú szerver oldali neve invalid_request"; `parse-agent-definition.spec.ts` › "nem név alakú envBindings érték", "nem név alakú authEnvName"; `resolve-outgoing-agents.spec.ts` › "malformed_node_config, és az érték nem jelenik meg" |
| E   | a sodródás védelem a hivatkozásra gyenge volt (az `isStringRecord` helyett `isRecord`, és az `authEnvName` ellenőrzés helyett `true` mindkét sodródás tesztet túlélte); a `{"envBindings":{"__proto__":"X"}}` alakot a zod eldobta, a `db` guard elfogadta | a futásidejű ág a `db` `isMcpServerReference` minden ágára egy-egy alakhiba esettel bővült (a központi definíció ágán is); a saját `__proto__` kulcs a hivatkozás rekordban és az `envBindings` rekordban mindkét oldalon elutasítva (`protocol` `recordWithoutPrototypeKey`, `db` `Object.hasOwn` vizsgálat)                                                     | `3995fc0` | `node-config-drift-protection.spec.ts` › "az alakhiba mindkét oldalon elbukik" (7 eset), "a név szabály csak a mentési sémán bukik" (2 eset); `mcp-server-definition-drift-protection.spec.ts` (4 új alakhiba eset); `is-mcp-server-reference.spec.ts`, `is-agent-step-config.spec.ts`, `mcp-server-reference.spec.ts`, `record-without-prototype-key.spec.ts`                                                                                               |
| F   | egyetlen hibás definíció sor (`corrupt_mcp_server_definition`) minden agent lépést és futás indítást megállított, hivatkozás nélkül is                                                                                                                     | a központi lista olvasása csak akkor fut, ha a lépés vagy egy agent definíciója hivatkozik MCP szerverre (`hasMcpServerReferences`)                                                                                                                                                                                                                               | `037d9c0` | `has-mcp-server-references.spec.ts`; `run-agent-step.spec.ts` › "MCP hivatkozás nélkül a központi lista hibája nem állítja meg a lépést"; `create-engine.spec.ts` › "MCP hivatkozás nélkül a központi lista hibája nem állítja meg a futást"                                                                                                                                                                                                                 |

**Az E rontások, saját futtatás.** A `db` `is-mcp-server-reference.ts` három rontása a javítás után a
`node-config-drift-protection.spec.ts` futásán bukik: `isStringRecord` helyett `isRecord` (1 bukás: nem
szöveg értékű `envBindings`), az `authEnvName` ellenőrzés helyett `true` (3 bukás: szám, objektum és hiányzó
`authEnvName`), a `__proto__` vizsgálat törlése (1 bukás).

**C, mérés (telepített `@anthropic-ai/claude-agent-sdk` `0.3.245` és a beágyazott CLI `2.1.245`, valódi API
hívás nélkül).** (1) SDK oldal: a `query()` egy hamis `pathToClaudeCodeExecutable` szkripttel futott, ami a
kapott argumentumokat fájlba írta. Az `Object.fromEntries` hívással épített `mcpServers` hat kulcsából
(`__proto__`, `constructor`, `prototype`, `toString`, `hasOwnProperty`, `ok`) a `--mcp-config` JSON értékében
öt maradt: a `__proto__` elveszett (az `sdk.mjs` `let sI={}` gyűjtése `sI[or]=Vr` értékadással a prototípust
állítja). (2) CLI oldal: a beágyazott `claude` bináris `-p --output-format stream-json --verbose
--mcp-config <JSON> --strict-mcp-config --setting-sources=` hívással, `ANTHROPIC_BASE_URL=http://127.0.0.1:9`
(lezárt helyi port, nincs kimenő hívás) és üres `HOME` mellett, az első `system`/`init` üzenet `mcp_servers`
mezőjét olvasva, nevenként egy szerverrel: a `constructor` kulccsal a CLI "Invalid MCP configuration:
mcpServers: Invalid input: expected record, received object" hibával kilépett (egy másik szerverrel együtt
is), a `prototype` kulcs csendben kimaradt (`mcp_servers: []`, egy másik szerverrel együtt csak az maradt),
a CLI-nek közvetlenül átadott `__proto__` kulcs (egy másik szerverrel együtt) szintén csendben kimaradt
(csak a másik szerver jelent meg), tehát az SDK nélkül is elveszne. A `toString`, `hasOwnProperty`,
`valueOf`, `isPrototypeOf`, `__defineGetter__`, `__lookupSetter__`, `propertyIsEnumerable` és
`toLocaleString` név megjelent (`failed` állapotban, mert a parancs `true`). A tiltás ezért pontosan a
`__proto__`, a `constructor` és a `prototype`.

**B, mérés (Node `26.7.0`).** `process.env[n]` típusa a `constructor`, `toString`, `hasOwnProperty`,
`valueOf` névre `function`, a `__proto__` névre `object`; `Object.hasOwn(process.env, n)` mindegyikre
`false`. A `process.env` saját tulajdonsága mindig szöveg: az értékadás szöveggé alakít, a
`defineProperty` nem szöveg értékre kivételt dob, ezért az `isString` ág a javított kódban csak a típus
szűkítése.

**E, mérés (zod `4.4.3`).** `z.record(z.string(), z.string())` a `JSON.parse('{"__proto__":"X","b":"c"}')`
bemenetből `{ b: 'c' }` eredményt ad, sikerrel; a kulcs sémájára tett `refine` vagy `regex` sem fut le a
`__proto__` kulcsra. Az elutasításhoz ezért a nyers bemeneten futó ellenőrzés kell (`z.unknown().refine(...)
.pipe(...)`).

**O-52, forrás eredmény (telepített `sdk.mjs`, `sdk.d.ts`, beágyazott CLI `2.1.245`).**

- Az `sdk.mjs` a nem `sdk` típusú `mcpServers` elemeket egy JSON értékké fűzi, és
  `Y.push("--mcp-config",fe({mcpServers:W}))` hívással parancssori argumentumként adja át; a fenti hamis
  végrehajtóval mérve a `http` szerver `Authorization` fejléc értéke a parancssorban szó szerint megjelent.
- **Fájl alapú út van, forrásból és mérve.** A CLI `--help` kimenete: "`--mcp-config <configs...>` Load MCP
  servers from JSON files or strings (space-separated)". Az SDK `Options.extraArgs` mezője (`sdk.d.ts`
  1510-1515. sor: "Additional CLI arguments to pass to Claude Code. Keys are argument names (without --),
  values are argument values") a hamis végrehajtóval mérve `extraArgs: { 'mcp-config': '<útvonal>' }`
  alakban `--mcp-config <útvonal>` argumentumot ad, és a beágyazott CLI egy `0600` jogú fájlból betöltötte a
  szervert (az `init` üzenet `mcp_servers` mezőjében megjelent, a fenti helyi, hívás nélküli módon).
  Ekkor a parancssorban csak az útvonal látszik.
- **Egy második út: a vezérlő csatorna.** A `Query.setMcpServers()` (`sdk.d.ts` 2645-2667. sor) a
  szervereket a futó CLI-nek a vezérlő protokollon (`mcp_set_servers` kérés, a folyamat stdin csatornája)
  adja át; ez a lépés indulása után fut, tehát a lépés első üzenete előtt a szerverek még nincsenek bent.
  Ezt nem mértük.
- **Az agent definíciók nem a parancssorban mennek.** Az `agents` opció az `initialize` vezérlő kérésben
  (stdin) megy át, nem argumentumként: a hamis végrehajtóval mérve egy agent definíció stdio `env`
  értéke nem jelent meg az argumentumok között, a lépés `mcpServers` `Authorization` értéke igen.
- Nem ellenőrzött: hogy a CLI a `--mcp-config` fájlt csak induláskor olvassa-e (egy újracsatlakozás
  újraolvashatja-e), tehát mikor törölhető a fájl; és hogy a `/proc/<pid>/cmdline` más felhasználó számára
  olvasható-e a szerver gépén (a Linux alapértelmezés szerint igen, de a dokumentációt itt nem vetettük
  össze két forrással).
- A javaslat (O-52 (a)): a motor a lépés `mcpServers` értékét a SDK `mcpServers` opciója helyett egy
  korlátozott jogú (`0600`), lépésenkénti ideiglenes fájlba írja, és az `extraArgs` `mcp-config`
  kulcsával adja át; a fájl a lépés végén törlődik. Termékdöntés, a SPEC-009 14.9 O-52 sora.

**O-53 és a CSRF.** A SPEC-009 14.9 O-53 sora és a 11. szekció kockázati sorai rögzítik; kód nem
változott.

### 4.6 MCP és izoláció: korlátok

- **Név alakú titok.** A D javítás után is átmegy egy betűvel kezdődő, csak betűt, számot és aláhúzást
  tartalmazó titok (például egy ilyen alakú token), és a `missing_mcp_server_env` üzenet visszaírja. A
  javítás a gyakori alakokat (kötőjel, számmal kezdődő, üres) zárja ki, nem minden titkot.
- **A régi gráf és pillanatkép.** Az olvasó séma és a `db` guard a nem név alakú hivatkozás értéket
  változatlanul elfogadja (pillanatkép olvashatóság, szabálykönyv 10. szekció 2. pont), és a motor a lépés
  hivatkozását indításkor név alakra nem ellenőrzi, tehát egy a javítás előtt mentett érték a
  hibaüzenetben továbbra is megjelenhet.
- **A központi definíció `envBindings` mezője.** A deklarált `__proto__` névre szóló hozzárendelést a
  `protocol` `z.record` sémája eldobja, a `db` guard megtartaná; a HTTP út a séma kimenetét írja, tehát a
  tárolt alak egységes. Az átvizsgálás ezt nem nevezte meg, nem változott.
- **Régi, fenntartott nevű definíció sor.** A C javítás a mentést zárja; egy korábban mentett `constructor`
  vagy `prototype` nevű definíciót az olvasó séma és a motor változatlanul kiad.
- **Az e2e.** Az `apps/web` termékkódjában csak a Beállítások MCP űrlap névhiba mondata változott (új ág
  nélkül); a `mcp-server-settings.spec.ts` e2e (14 teszt) zölden futott, a teljes e2e és a lefedettségi
  riport nem futott újra.

### 4.7 MCP és izoláció: kapuk

Minden commit előtt a kilenc kapu nulla kilépési kóddal futott, a 4.4 szerinti módon. Az A, B és C javítás
kapui egy közös munkafán futottak (a három változás fájlszinten független), utána három commitba kerültek.

### 4.8 Felület: találatok, javítások, tesztek

Kiinduló fej: `2fcdfad`. Minden javítás külön, a kilenc kapun zöld commit. Az e2e nevek a fájl
`test(...)` címei.

| #   | Találat                                                                                          | Commit    | Teszt (régi kódon bukik)                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A skill feltöltés utáni újratöltés hibája némán elnyelődött, az új skill nem látszott a listában | `b1896bb` | `merge-skill.spec.ts` (4), `use-skill-library.spec.tsx` (3), `SkillLibrarySettingsCard.spec.tsx` (2), e2e `skill-library-settings.spec.ts`: a feltöltés utáni újratöltés hibája danger Alert, az új skill a listában marad, az azonos nevű feltöltés megerősítést kér |
| 2   | Az MCP hivatkozás e2e `toMatchObject` állítása egy megmaradt `envBindings` felülírást átengedett | `dd55617` | `graph-node-mcp-references.spec.ts`: `toEqual` a mentett lépés konfigurációra                                                                                                                                                                                         |
| 3   | Az elrendezés mátrix nem fedte a Skill könyvtár és az MCP szerverek kártyát                      | `aa30d3f` | e2e `settings-screen.spec.ts`: a hat kártya, hosszú nevekkel, két téma, 320 és 1440 pixel, átfedés és túllógás nélkül, kifestve (kontraszt állítás nincs, lásd O-54)                                                                                                  |
| 4   | A hiányzó skill fájl és a deklarált változó nevek hibája nem volt a mezőhöz kötve                | `f8a0d71` | `FileUpload.spec.tsx`, `TagInput.spec.tsx` (a prop), `SkillUploadForm.spec.tsx`, `McpServerEditModal.spec.tsx`, e2e `skill-library-settings.spec.ts` és `mcp-server-settings.spec.ts` (`toHaveAccessibleDescription`, `aria-invalid`)                                 |
| 5   | A workflow szerkesztő Mentés gombja nem jelzett betöltést                                        | `ceddf2c` | `edit-workflow-modal.spec.tsx` (aria-busy, tiltott, a felirat nem változik), e2e `workflow-list.spec.ts`                                                                                                                                                              |
| 6   | A mező hibája alatt a gomb elmozdul                                                              | nincs     | nincs javítás, lásd az alábbi megfigyelést                                                                                                                                                                                                                            |
| 7   | A SPEC-009 AC9 grep mintája a dokumentumokat is találta                                          | `7e8de1a` | a minta hatóköre `-- packages apps tooling`; futtatva nulla találat                                                                                                                                                                                                   |
| 8   | A `ProviderSelect` kommentje szerint az `errorMessage` mindig a motor magyar szövege             | `d436f18` | csak komment, teszt nincs                                                                                                                                                                                                                                             |

**Az 1. találat.** A `uploadSkill` a PUT válaszát `mergeSkill` hívással azonnal a listába illeszti
(név szerinti, UTF-16 kódegység sorrend, azonos név esetén csere), és csak utána tölt újra egy külön
`reloadRequest` állapottal. Az újratöltés hibája a kártyán danger `Alert`, a lista és az űrlap megmarad.

**A 2. találat árnyalata.** A termékkód már helyes volt. A `''` tárolására irányuló rontást a mentési
séma mindkét teszt alakban megfogja, tehát az nem mutat különbséget. Kimutatható rés a "megmaradt régi
hozzárendelés" rontás: a régi `toMatchObject` zölden maradt, az új `toEqual` elbukik.

**Az 5. találat és a létrehozás.** A `create-workflow-modal.tsx` "Létrehozás..." felirata ugyanezt a
mintát tartalmazza. Nem a találat része, nem változott.

**A 6. találat: megfigyelés, javítás nélkül.** Nincs dokumentált design system megoldás a hibaüzenet
megjelenése miatti elmozdulásra (sem az `eggproject-design*` skillekben, sem a projekt precedensei között),
ezért terméket nem változtattam. Mérés egy ideiglenes, azóta törölt Playwright szkripttel, a hiba
megjelenésekor a gomb függőleges elmozdulása: 22,8 pixel 1440 pixel szélességen, 90 pixel 320 pixel
szélességen, és 320 pixelen a kattintás elveszett. A lehetséges javítás (a hiba helyének fenntartása) elrendezés döntés, a usert illeti.

**Nyitott pontok, amelyeket nem javítottam.** A SPEC-009 14.9 új sorai "addig" viselkedéssel: O-54 (a
FileUpload dropzone sötét témában olvashatatlan), O-55 (a kapcsolat teszt nyers `errorMessage` szöveget
mutat), O-56 (card in card a FileUpload körül).

**Ugyanaz a hiba a `use-mcp-server-library.ts` fájlban.** Az MCP szerver lista újratöltés hibája ott is
elnyelődhet; a találat a skill felületre szólt, nem változott.

### 4.9 Felület: a teljes e2e és a lefedettség

Módszer: az 1.5 szerint, tiszta nyers könyvtárral (`rm -rf apps/web/e2e/.nyc_output apps/web/coverage-e2e
apps/web/test-results`), nyolc shard egymás után ugyanabba a nyers könyvtárba, `flock` alatt, majd a
gyökérből `bun run coverage:e2e:report`. Fej: `d436f18`.

- Tesztszám: 738 (56 fájl), mind zöld; a shardok 93, 93, 92, 92, 92, 92, 92, 92. A `playwright test
--list` ugyanezt az összeget adja.
- A `coverage:e2e:report` kilépési kódja nulla, a küszöb változatlan.

| Metrika    | Fedett | Összes | Fedetlen |
| ---------- | ------ | ------ | -------- |
| statements | 2674   | 2684   | 10       |
| branches   | 1317   | 1327   | 10       |
| functions  | 937    | 938    | 1        |
| lines      | 2561   | 2571   | 10       |

A fedetlen tételek száma egyetlen metrikán sem nőtt (kiinduló: 10, 10, 1, 10). A statements, a branches és
a lines számokat a nyers adatból újra előállított `json-summary` riport adja, a functions és a többi az
`lcov.info` összesítésével egyezik.

### 4.10 Felület: kapuk

Minden commit előtt a kilenc kapu nulla kilépési kóddal futott, a 4.4 szerinti módon.

### 4.11 Felület: a két maradék találat (a 4.8 két "nem változott" pontja)

Kiinduló fej: `fdaf7d8`. Mindkét javítás külön, a kilenc kapun zöld commit.

| #   | Találat                                                                                                          | Commit    | Teszt (régi kódon bukik)                                                                                                                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9   | Az MCP szerver mentése utáni újratöltés hibája némán elnyelődött, az új szerver nem látszott a listában          | `a3a163f` | `merge-mcp-server.spec.ts` (4), `use-mcp-server-library.spec.tsx` (2 új, 1 bővített), `McpServerSettingsCard.spec.tsx` (2), e2e `mcp-server-settings.spec.ts`: a mentés utáni újratöltés hibája danger Alert a kártyán, az új szerver a PUT válaszából a listában marad, és az azonos nevű következő hozzáadás felülírás figyelmeztetést kap |
| 10  | A workflow létrehozó modális Létrehozás gombja "Létrehozás..." feliratot váltott, nem a közös `isLoading` mintát | `459cb8c` | `create-workflow-modal.spec.tsx` (aria-busy, tiltott, `is-loading`, a felirat nem változik), e2e `workflow-list.spec.ts`: a létrehozás alatt a Létrehozás gomb tiltott és betöltést jelez                                                                                                                                                    |

**A 9. találat.** A `saveServer` a `skill-upload` mintájára (`b1896bb`) a PUT válaszát `mergeMcpServer` hívással azonnal a
listába illeszti (név szerinti, UTF-16 kódegység sorrend, azonos név esetén csere; a név ASCII, tehát a szerver bináris
`ORDER BY name` sorrendjével egyezik), és csak utána tölt újra egy külön `reloadRequest` állapottal; az újratöltés hibája a
kártyán danger `Alert` a lista és a Hozzáadás gomb között. A törlés útja nem tölt újra (a sor helyben kikerül), ott a hiba nem
nyelődhetett el. A régi kódon az e2e teszt az új szerver sorát nem találta, a hook unit tesztjei a `reloadState` hiányán buktak.

**A teljes e2e a két javítás után** (fej `459cb8c`, a 4.9 módszerével): 740 teszt, mind zöld; a fedetlen tételek 10 / 10 / 1 / 10
(statements 10/2692, branches 10/1327, functions 1/942, lines 10/2577), egyik metrikán sem nőtt. A kritérium tábla
lépés (T-012-28) egy további e2e tesztet hozott, a teljes futás utána 741 teszt, a fedetlen tételek változatlanok
(`docs/research/2026-10-28-spec-009-kriterium-tabla.md` 3. szekció).

## 5. Merge kapu (`.claude/CLAUDE.md` 8. szekció, a CI kikapcsolt állapotában)

**A merge.** `git fetch` után a friss `origin/main` (`6d17889`, PR #65, csak doksi és komment) bemergelve
(`git merge origin/main`, merge commit `48e075e`, nem rebase). Egyetlen ütközés volt, a
`docs/spec/SPEC-001-monorepo-toolchain.md` 15. szekciója (a V-19 lezárása mindkét oldalon, az ág `ce3eff0`, a `main`
PR #65). A feloldás mindkét oldal tényét megtartja: az ág V-20 sorát és a "20-ból 19 lezárva, 1 nyitva (V-14)"
számot, a `main` V-19 lezáró bekezdését, a V-19 sorában a két oldal mondatait együtt (`libXdamage.so.1`, csomag
`libxdamage1`; a smoke teszt és a `bun run test:e2e` valódi Chromiumon zöld), a 41. kritériumban a 20 pontot. A
merge utáni igazítás (`32e6f3b`): a hiányleltár H-23, H-25 sora és 8. szekciója a PR #65 bemergelésével
(`git merge-base --is-ancestor 6d17889 HEAD` igaz), és az `apps/web/CLAUDE.md` téma mappa száma, amit a PR #65 a
`main` 34 mappájára írt át, az ág három új témájával (`provider-select`, `skill-upload`, `mcp-server-config`; a
`ls -d apps/web/src/*/ | wc -l` kimenete 37).

**A teljes kapu a `32e6f3b` fejen futott.** Futtatási mód: `~/wt/s09`, a nehéz parancsok `flock /tmp/kapu-gep.lock`
alatt, a Playwright `flock /tmp/playwright-gep.lock` alatt, 3 workerrel (minden shard fejléce: `using 3 workers`).

| Parancs                                                                    | Kilépési kód | Összegzés                                                    |
| -------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------ |
| `bun run format:check`                                                     | 0            | minden fájl formázott                                        |
| `TURBO_CONCURRENCY=1 bun run typecheck`                                    | 0            | 19/19 sikeres                                                |
| `bun x turbo run lint --concurrency=1`                                     | 0            | 32/32 task sikeres                                           |
| `bun run test`                                                             | 0            | 727 tesztfájl, 7643 teszt, mind zöld                         |
| `bun run build`                                                            | 0            | 1/1 sikeres                                                  |
| `bun run docs:check`                                                       | 0            | 20/20 kötelező helyen van `CLAUDE.md`                        |
| `bun run check:casing`                                                     | 0            | 0 eltérés                                                    |
| `bun run check:graph`                                                      | 0            | 0 eltérés                                                    |
| `bun run check:db-drift`                                                   | 0            | a séma és a migrációk szinkronban                            |
| `bun x playwright test --shard=<i>/8` (i = 1 ... 8, tiszta nyers könyvtár) | mind 0       | 93 + 93 + 93 + 93 + 93 + 92 + 92 + 92 = 741 teszt, mind zöld |
| `bun run coverage:e2e:report`                                              | 0            | a küszöb (99.35 / 98.94 / 99.73 / 99.32) felett, lásd lent   |

A shardok előtt `rm -rf apps/web/e2e/.nyc_output apps/web/coverage-e2e apps/web/test-results`, a nyolc shard sorban,
ugyanabba a nyers könyvtárba, megszakítás nélkül.

**Unit lefedettség** (`coverage/coverage-summary.json`): statements 8392/8392, branches 5164/5164, functions
2265/2265, lines 8168/8168, mind 100 százalék.

**E2e lefedettség** (a nyers adatból újra előállított `json-summary` riport, a functions és a lines az `lcov.info`
összesítésével egyezik):

| Metrika    | Fedett | Összes | Százalék | Fedetlen |
| ---------- | ------ | ------ | -------- | -------- |
| statements | 2682   | 2692   | 99.62    | 10       |
| branches   | 1317   | 1327   | 99.24    | 10       |
| functions  | 941    | 942    | 99.89    | 1        |
| lines      | 2567   | 2577   | 99.61    | 10       |

A fedetlen tételek fájlonként: `app-mount/mount-app.tsx` (3/2/0/3), `frontend-config/read-frontend-config.ts`
(4/6/0/4), `graph-editor/is-valid-connection.ts` (1/1/0/1), `rest-client/perform-route-request.ts` (1/1/0/1),
`stream-client/use-stream-connection.ts` (1/0/1/1).

**Ratchet.** A fedetlen tételek száma (10 / 10 / 1 / 10) egyik metrikán sem nőtt sem az ág kiindulásához (1.3
szekció: 10 / 10 / 1 / 10), sem a `main` mai értékéhez képest (a PR #65 sem a küszöböt, sem az e2e-vel mért kódot
nem változtatta: az `apps/web/package.json` és az `apps/web/src` a `main` két fején azonos). A küszöb változatlan.
**Feljegyzés, nem lépés:** a mért százalék mind a négy metrikán a küszöb felett van, a fedetlen darabszám nem nőtt,
tehát a 8. szekció ratchet szabálya szerint a küszöb felfelé követhetné a mért értéket; ez ebben a PR-ban nem
történt meg.
