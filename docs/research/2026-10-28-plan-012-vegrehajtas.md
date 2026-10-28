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
