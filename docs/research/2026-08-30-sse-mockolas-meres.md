# SSE mockolás mérés, 2026-08-30

Kérdés: a `.claude/CLAUDE.md` szabálykönyv 11. szekciójában nyitva hagyott kérdés lezárása
saját méréssel, a frontend spec (SPEC-007) megírása előtt: megbízhatóan mockolható-e a
`GET /events` SSE csatorna `page.route()` + `route.fulfill({ contentType:
'text/event-stream' })` mintával a projekt pinelt Playwright verziója ellen, és ha nem
teljesen, hol a pontos határa.

Ez a dokumentum a `docs/research/2026-08-29-playwright-teszt-szabalyok.md` 9. szekciójában
leírt nyitott kérdést zárja le. Az ott hivatkozott `microsoft/playwright` #15353 GitHub
issue továbbra sem ellenőrizhető (a kommentszál nem érhető el), ezért az alábbi mérés
kizárólag saját, most futtatott Playwright futásokra épül, nem az issue-ra.

---

## 1. Mérési környezet

| Elem                      | Érték                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@playwright/test` verzió | **1.62.1** — ellenőrizve két forrásból: `bun.lock` (`"@playwright/test": "1.62.1"`, `"playwright": "1.62.1"`) és a repo `node_modules/@playwright/test/package.json` ténylegesen telepített `version` mezője, valamint a `playwright --version` parancs kimenete. Mindhárom egyezik a `docs/research/2026-08-26-toolchain.md`-ben rögzített értékkel. |
| Böngésző projekt          | Kizárólag **chromium** — az `apps/web/playwright.config.ts` `projects` tömbje csak egyetlen, `chromium` nevű projektet definiál, tehát a mérés nem terjed ki Firefoxra/WebKitre, mert a projekt e2e-je sem futtatja azokat.                                                                                                                           |
| Böngésző build            | `chromium-1234` (a `~/.cache/ms-playwright` alatt telepítve), a mért oldalak `navigator.userAgent`-je szerint `Chrome/151.0.7922.34 HeadlessChrome`.                                                                                                                                                                                                  |
| Futtatókörnyezet          | Rootless Linux sandbox, `LD_LIBRARY_PATH` a hiányzó `libXdamage.so.1`-hez igazítva (lásd gyökér `.claude/CLAUDE.md` 12. szekció, "Playwright rootless konténerben") — a repóban ehhez semmi nem változott.                                                                                                                                            |
| Harness helye             | `/tmp/sse-meres/` (a projekt node_modules-ára symlinkelve, hogy pontosan a pinelt `@playwright/test@1.62.1` fusson) — **eldobható, nem része a reponak**, ez a dokumentum az egyetlen tartós nyoma.                                                                                                                                                   |

A harness felépítése: egy `node:http` alapú statikus szerver (`server.mjs`) szolgálja ki a
tesztoldalt és egy "valódi szerver" `/events` végpontot (ami szándékosan egy azonosítható,
599 státuszú, `REAL_SERVER_HIT` törzsű választ ad — ez a kontroll ág, ami bizonyítja, hogy
a mockolt teszteknél tényleg a `page.route()` szólal meg, nem a valódi hálózat), plusz egy
`e2e/sse.spec.ts` Playwright teszt fájl, ami minden kérdést külön `test.describe`-ban mér.
Az oldal egy valódi `EventSource`-t nyit, és `window.__events`/`window.__opened`/
`window.__errors` globálisokba naplózza a viselkedést, amit a teszt `page.evaluate()`-tel
olvas ki. Minden várakozás állapot alapú (`page.waitForFunction`, `expect.poll`,
`expect(locator).toHaveText()`), `page.waitForTimeout()` a végleges mérésekben nem
szerepel (csak a diagnosztikai melléktesztekben, amiket ez a dokumentum külön jelöl).

---

## 2. A nyolc kérdés, mérve

### 2.1 Elfogja-e a `page.route()` az `EventSource` kérését? — **IGEN**

Egy `page.route('**/events', handler)` regisztrálása után a handler ténylegesen lefut,
mielőtt bármilyen valódi hálózati kérés elindulna. Mérés: `called` flag `true`-ra vált,
`expect.poll(() => called).toBe(true)` zöld. Kontrollként (lásd 2.9) mockolás NÉLKÜL a
kliens ténylegesen a valódi szerver 599-es válaszát kapja — ez zárja ki, hogy a route
"véletlenül" ne is kellene, mert amúgy is a valódi szerver válaszolna helyesen.

### 2.2 `onopen` tüzel-e a mockolt válaszra? — **IGEN**

`route.fulfill({ status: 200, contentType: 'text/event-stream', body: ': comment\n\n' })`
után az `EventSource.onopen` lefut, `window.__opened === true`. Zöld teszt.

### 2.3 Megérkeznek-e az `onmessage` események, több keret is? — **IGEN**

Egy `fulfill` hívás törzsében három `data:` keret (`data: first\n\ndata: second\n\ndata:
third\n\n`) mindhárom `onmessage` eseményt helyesen, sorrendben kiváltja:
`['first', 'second', 'third']`. Zöld teszt.

### 2.4 Az `id:` mező eljut-e a kliensig (`event.lastEventId`)? — **IGEN, egyetlen kapcsolaton belül**

`id: 42\ndata: hello\n\n` törzsre az `onmessage` esemény `lastEventId` mezője pontosan
`'42'`. Zöld teszt. **Fontos árnyalás — lásd 2.6**: ez csak az ugyanazon (első) kapcsolaton
belüli `lastEventId`-ra igaz; az `id:` mező **újracsatlakozáskor kimenő** hatása (a
`Last-Event-ID` kérés fejléc) más eredményt ad, ld. lent.

### 2.5 Az `event:` mezős nevesített esemény működik-e? — **IGEN**

`event: custom\nid: 7\ndata: custom-payload\n\n` törzsre az oldal
`addEventListener('custom', ...)` listenere lefut, a kapott objektum pontosan
`{ type: 'custom', data: 'custom-payload', lastEventId: '7' }`. Zöld teszt.

### 2.6 Mi történik újracsatlakozáskor? A második kérés fejléce tartalmazza-e a `Last-Event-ID`-t? — **NEM, `page.route()` mellett ez nem figyelhető meg**

Ez a mérés kritikus eredménye, és **eltér** attól, amit egy valódi szerver ellen mérnénk.

**Mockolt eset** (`page.route('**/events', ...)`, első válasz `retry: 100\nid:
1\ndata: first-connection\n\n`, ami egy lezárt, teljes `fulfill` törzs, tehát a kapcsolat
a válasz elküldése után természetesen bezár, és a böngésző a `retry:` érték — 100 ms —
után automatikusan újracsatlakozik):

- A második `page.route()` hívás **ténylegesen bekövetkezik** (`callCount` 2-re nő,
  `expect.poll` zöld) — az újracsatlakozás maga tehát működik.
- A második hívásban **sem** `route.request().headers()`, **sem** `route.request().allHeaders()`,
  **sem** `route.request().headersArray()` nem tartalmaz `last-event-id` kulcsot.
- Ugyanez **függetlenül megerősítve** egy második megfigyelési csatornán: a `page.on('request',
...)` eseményből olvasott `req.headers()` a második hívásra is `last-event-id` nélküli —
  tehát nem a `Route` API egy adott metódusának hibája, a böngésző oldali kérés Playwright
  számára látható fejléclistája egyáltalán nem tartalmazza.
- A mért teszt asszerciója (`expect(secondCallHeaders?.['last-event-id']).toBe('1')`) **bukik**:
  `Received: undefined`.

**Kontroll, valódi szerver ellen** (ugyanaz a kliens oldali `EventSource`-kód, de a
`page.route()` mock helyett a `server.mjs` `node:http` szerver valódi `/real-events`
végpontja válaszol, ugyanazzal a `retry: 100\nid: 1\ndata: real-first\n\n` törzzsel):

- A második, valódi HTTP kérés fejléclistájában (amit maga a Node szerver naplóz,
  Playwright-tól teljesen függetlenül) **jelen van** a `last-event-id: 1` fejléc, pontosan
  a várt értékkel.

Ez a két mérés együtt egyértelműen bizonyítja: **a `Last-Event-ID` fejléc a valódi
böngésző-újracsatlakozás része, és a valódi szerver meg is kapja, de a `page.route()`
mockolt interceptje ezt nem teszi láthatóvá / nem továbbítja** a teszt felé (`route.fulfill`
egyszeri, lezárt válasz — lásd 2.7 —, és az ezt követő automatikus böngésző-szintű
újracsatlakozás fejléceit a `page.route()` réteg nem adja vissza teljesen; ezt közvetve
alátámasztja, hogy más, a böngésző hálózati rétege által hozzáadott fejlécek is
következetesen hiányoznak a route-on át látott listából mindkét híváskor, pl.
`cache-control`, `pragma`, `sec-fetch-*`, `accept-encoding` — ezek a valódi szerver felé
menő kérésben jelen vannak, a mockolt route felé menőben viszont egyik hívásnál sem).

**Következmény**: a `Last-Event-ID`-alapú újracsatlakozás — ami a projekt protokolljának
kritikus eleme — `page.route()` mockolással **nem tesztelhető és nem is asszertálható**.

### 2.7 Streamelhető-e a válasz, vagy csak egyben adható? — **CSAK EGYBEN, nincs streaming API**

Kétféle bizonyíték:

1. **Típusdefiníció** (a ténylegesen telepített `playwright-core@1.62.1` csomagból,
   `types/types.d.ts`, a `Route.fulfill` szignatúrája): `body?: string|Buffer;` — nincs
   stream, `ReadableStream`, async iterátor vagy callback alapú, folyamatos írási
   lehetőség dokumentálva a típusban.
2. **Empirikus teszt**: ugyanarra a route-ra egymás után kétszer hívva a `route.fulfill()`-t,
   a második hívás **dob**, a hibaüzenet szó szerint: `"Route is already handled!"`. Ez
   közvetlen, mért bizonyíték arra, hogy egy `fulfill()` hívás lezárja a route kezelését,
   nincs mód rá, hogy a teszt később, a teszt egy másik pontján egy újabb keretet toljon be
   ugyanabba, már megnyitott kapcsolatba.

**Következmény**: az "épp fut a workflow, és menet közben érkezik egy esemény" forgatókönyv
`page.route()`-tal **nem szimulálható egyetlen, folyamatosan élő kapcsolaton belül**. Az
egyetlen közelítő minta a 2.6-ban mért újracsatlakozásos technika (minden "új" keretet egy
újabb, lezárt kapcsolat ad ki), de ennek ára, hogy a kapcsolat közben bezár és újranyit —
ami pont a `Last-Event-ID` mérhetetlensége miatt (2.6) nem alkalmas arra, hogy a valós,
folytonos kapcsolatot igénylő reconnect-viselkedést hitelesen tesztelje.

### 2.8 A `Content-Type` `null`-ként érkezik-e (a hivatkozott GitHub issue állítása)? — **NEM REPRODUKÁLHATÓ**

Két mérés:

1. Az oldalon belüli `fetch('/content-type-check')` a mockolt route ellen: a válasz
   `response.headers.get('content-type')` értéke pontosan `'text/event-stream'`, nem
   `null`.
2. Ugyanerre a mintára nyitott valódi `EventSource` sikeresen megnyílik
   (`window.__opened === true`). A HTML Living Standard szerint, ha a `Content-Type`
   ténylegesen nem egyezne pontosan a `text/event-stream` értékkel, az `EventSource`
   "Fail the connection"-t hajtana végre, és az `onopen` **soha nem tüzelne** — ez tehát
   közvetett, de egyértelmű cáfolata annak, hogy a fejléc `null` lenne.

A hivatkozott `microsoft/playwright` #15353 issue állítása ellen ez a mérés Playwright
1.62.1 + Chromium ellen **nem reprodukálható**, amikor a `contentType` mezőt explicit
megadjuk a `fulfill()` hívásban (ahogy a projekt is tenné). Az issue eredeti körülményei
(Playwright verzió, pontos hívási minta) nem ismertek, ezért nem állítható, hogy az issue
"téves" volt — csak az, hogy a jelenlegi, pinelt verzió ellen, a dokumentált
`contentType`/`headers` opcióval a hiba nem jelentkezik.

### 2.9 Kontroll: mockolás nélkül a valódi szerver jele érkezik-e meg?

Igen — `page.route()` regisztráció nélkül a kliens ténylegesen a `server.mjs` valódi
`/events` végpontjának 599-es hibáját kapja, `onopen` nem tüzel, `onerror` igen. Ez zárja
ki, hogy a 2.1-2.8 mérések véletlenül a valódi szerverre futottak volna rá a mock helyett.

---

## 3. Végső döntés: melyik utat kövesse a frontend e2e teszt az SSE csatornán

**Hibrid megoldás, mérés alapján, nem feltételezésből:**

1. **`page.route()` + `route.fulfill({ contentType: 'text/event-stream' })` HASZNÁLHATÓ** és
   **használandó** minden olyan teszthez, ami egyetlen, lezárt SSE-válaszon belüli
   viselkedést ellenőriz: kapcsolat megnyitása, `data:` keretek feldolgozása és a DOM
   frissülése rájuk, `id:` mező hatása az adott üzenet `lastEventId` mezőjére, `event:`
   nevesített keretek kezelése, `Content-Type` beállítás. Ez a "minden mockolva legyen"
   szabály (a felhasználó kérése) alá tartozó tesztek nagy részét lefedi, mérten működik.
2. **`page.route()` NEM HASZNÁLHATÓ** két konkrét, mérten bizonyított esetben:
   - A **`Last-Event-ID` alapú újracsatlakozás fejléc-szintű ellenőrzésére** (2.6):
     a második kapcsolat kérés-fejlécei a route rétegen nem tartalmazzák a
     `Last-Event-ID` fejlécet, holott a böngésző azt egy valódi szerver felé
     bizonyítottan (2.6 kontroll) helyesen elküldi.
   - **Egy már megnyitott, folyamatban lévő mockolt kapcsolatba menet közben beszúrt,
     új keret szimulálására** (2.7): a `route.fulfill()` egyszeri, lezárt aktus, a
     `Route` osztály típusa sem, a mért futásidejű viselkedés sem enged további írást.
   - **UTÓLAGOS KIEGÉSZÍTÉS (2026-09-05, `docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md` 4. szekció): egy HARMADIK eset is van.** Bármely állítás, aminek a kapcsolat NYITVA
     maradása az előfeltétele, `page.route()` mockon nem figyelhető meg: a
     `route.fulfill()` lezárt HTTP válasz, tehát az `EventSource` a keretek feldolgozása
     után azonnal `error` eseményt kap, a `readyState` kiesik `OPEN`-ből, és a
     `use-stream-connection.ts` `computePhase` függvénye a `reconnecting` ágra fut. A
     `replaying` fázis ("előzmények betöltése" felirat) így csak egy meg nem figyelhető
     pillanatra áll fenn: két erre írt teszt `element(s) not found` hibával, 5000 ms
     assertion timeout után bukott el `page.route()` mockon, és elsőre zölden futott le a
     kapcsolatot nyitva hagyó `node:http` teszt szerveren.
3. **A 2. pont alá eső tesztekhez** (elsősorban: a `Last-Event-ID`-alapú
   újracsatlakozás forgatókönyve, és bármi, ami valódi, menet közbeni streamelt
   push-t igényel) **egy célra írt, könnyű `node:http` teszt szerver** az út — ez
   méréssel igazoltan működik (2.6 kontroll mérés, illetve a 2.10 alatti önálló
   demonstráció), és megfelel a projekt "tilos a kézi timeout" szabályának: a
   demonstrációs teszt kizárólag `expect(locator).toHaveText(...)` web-first
   assertion-nel várja meg a DOM végállapotát (`message:2:101:reconnected-with-100`
   mintázat), `page.waitForTimeout()` nélkül, és zöld.

Ez a döntés **kifejezetten kimondandó a SPEC-007-ben**: a "minden mockolva legyen, mint egy
unit tesztben" szabály **alól a `GET /events` Last-Event-ID-alapú újracsatlakozás-tesztje
kivétel**, mert ez a konkrét viselkedés `page.route()`-tal nem figyelhető meg (2.6). Minden
más SSE-vezérelt UI-teszt (kapcsolat, üzenet-feldolgozás, nevesített esemény,
Content-Type) `page.route()`-tal mockolható és mockolandó is.

### 2.10 A könnyű teszt szerver + web-first assertion demonstrációja

Egy második, önálló mérés (`server2.mjs` + `diag7-realserver.spec.ts`, ugyanabban a
harness-ban): egy minimális `node:http` szerver, ami az első `/real-events-2` hívásra
`id: 100\ndata: first\n\n` törzset ad (100 ms retry-jal), a másodikra pedig a kapott
`Last-Event-ID` fejléc értékét visszaépíti egy `reconnected-with-<érték>` üzenetbe. A
kliens oldali DOM egy `#status` elemet frissít minden `onmessage`-re. A teszt egyetlen
assertion-ből áll: `await expect(page.locator('#status')).toHaveText(/^message:2:101:reconnected-with-100$/)`
— nincs `waitForTimeout`, nincs fix várakozás, tisztán web-first assertion retry. Zöld
teszt, tehát a `docs/research/2026-08-29-playwright-teszt-szabalyok.md` 9. szekciójában
felvázolt "(b) valós vagy célra írt könnyű teszt szerver" út **működőképesnek bizonyult**,
és összhangban van a projekt timeout-tilalmával.

---

## 4. Mi NEM MEGERŐSÍTETT

- Az eredeti `microsoft/playwright` #15353 issue lezárásának pontos oka (megoldódott-e
  később a Playwrightban, vagy elavultként zárták) továbbra sem ellenőrizhető — ez a
  dokumentum ezt nem is próbálja eldönteni, mert a saját mérés (2.8) közvetlenül,
  a jelenlegi pinelt verzió ellen ad választ, függetlenül attól, mi történt az issue-ban.
- A `page.route()` réteg által "lenyelt" fejlécek (`last-event-id`, `cache-control`,
  `pragma`, `sec-fetch-*`, `accept-encoding`) pontos belső oka (melyik Chromium/CDP réteg
  vágja le őket) nincs vizsgálva és nincs is szükség rá a döntéshez — a mért,
  megfigyelhető viselkedés (hiányoznak) önmagában elég a 3. szekció döntéséhez.
- Firefox és WebKit ellen nem futott mérés, mert az `apps/web/playwright.config.ts`
  jelenleg kizárólag Chromiumot definiál; ha ez a jövőben bővül, a mérést meg kell
  ismételni azokra a motorokra is.

---

## 5. Lezárás

A `.claude/CLAUDE.md` 11. szekciójának SSE mockolási nyitott kérdése **lezárható**. A
"Mi zárná le" mezőben megkövetelt saját, dokumentált mérés megtörtént, a döntés
egyértelmű és nem feltételezésből, hanem 10 lefuttatott Playwright teszt (plusz 3
diagnosztikai melléktesztfutás) kimeneteiből származik. A szabálykönyvet és a SPEC-007-et
ez a döntés szerint kell frissíteni: `page.route()` mockolás az alapeset, kivéve a
`Last-Event-ID`-alapú újracsatlakozás tesztjét, ahol könnyű `node:http` teszt szerver +
web-first assertion az út.
