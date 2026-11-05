# Host és Origin ellenőrzés: források és mérések (SPEC-017)

|             |                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| Dátum       | 2026-11-05                                                                                                     |
| Spec        | [`../spec/SPEC-017-host-origin-ellenorzes.md`](../spec/SPEC-017-host-origin-ellenorzes.md)                     |
| Előzmény    | SPEC-009 11. szekció kockázati sora ("CSRF és DNS rebinding ... hatókörön kívül, külön spec")                  |
| User döntés | 2026-11-04, "Host és Origin ellenőrzés": "Csak a saját felületed kéréseit fogadja el; bejelentkezés nem kell." |

## 1. A kiinduló állapot (a `9acafec` fej)

- A szerver a `127.0.0.1` címre köt (SPEC-006 3.5), hitelesítés nincs, a `Host`, az `Origin` és a
  `Content-Type` fejlécet nem nézi (`apps/server/src/http-server/create-http-server.ts`, a `handleRequest`
  függvény a `9acafec` fejen).
- A CORS engedély kizárólag a `STREAM_PATH` útvonalra szól, a konfigurált `EASTER_STREAM_DEV_ORIGIN`
  értékre (`resolve-cors-headers.ts`). A CORS a válasz olvasását korlátozza, a kérés végrehajtását nem.

## 2. Források

Minden állítás elsődleges forrással és legalább két független megerősítéssel; ami ennél kevesebbet kapott,
az a 2.7 pontban "nem ellenőrzött" jelöléssel áll.

### 2.1 A DNS rebinding ellen a `Host` fejléc ellenőrzése a védelem

- Elsődleges: Vite GHSA-vg6x-rcgg-rjx6, "[3]: Lack of validation on the Host header for HTTP requests":
  a helyi dev szervert bármely weboldal elérte, a javítás a `server.allowedHosts`
  (<https://github.com/vitejs/vite/security/advisories/GHSA-vg6x-rcgg-rjx6>).
- Megerősítés 1: a Vite `server.allowedHosts` dokumentációja: "Setting `server.allowedHosts` to `true`
  allows any website to send requests to your dev server through DNS rebinding attacks"
  (<https://vite.dev/config/server-options#server-allowedhosts>).
- Megerősítés 2: az MCP Streamable HTTP "Security Warning": "Servers MUST validate the `Origin` header on all
  incoming connections to prevent DNS rebinding attacks", és "When running locally, servers SHOULD bind only
  to localhost" (<https://modelcontextprotocol.io/specification/2025-06-18/basic/transports>).

### 2.2 Az `Origin` fejléc ellenőrzése a CSRF ellen, egyszerű egyenlőséggel

- Elsődleges: OWASP CSRF Prevention Cheat Sheet, "Checking the Origin Header": "If the Origin header is
  present, verify that its value matches the target origin", és "Missing headers and Origin: null are not
  evidence of a same-origin request"
  (<https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html>).
- Megerősítés 1: Filippo Valsorda, "Cross-Site Request Forgery" (2025-08-13), 2. lépés: "If the Origin
  header matches an allow-list of trusted origins, allow the request. Trusted origins should be configured as
  full origins ... and compared by simple equality", és "`null` must be treated as an indication of a
  cross-origin request" (<https://words.filippo.io/csrf/>).
- Megerősítés 2: a Go `net/http` `CrossOriginProtection` forrása (`AddTrustedOrigin`, `isRequestExempt`)
  (<https://go.dev/src/net/http/csrf.go>).

### 2.3 A `Sec-Fetch-Site` értékei és kezelésük

- Elsődleges: W3C Fetch Metadata Request Headers, a négy érték: `cross-site`, `same-origin`, `same-site`,
  `none` (<https://w3c.github.io/webappsec-fetch-metadata/#sec-fetch-site-header>).
- Megerősítés 1: MDN `Sec-Fetch-Site` ("Baseline ... since March 2023"; "requests that are not accepted
  should be rejected with a `403` response code"; "only included in requests to potentially trustworthy URLs")
  (<https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Site>).
- Megerősítés 2: OWASP "Fetch Metadata headers": `same-origin` engedett, `none` a felhasználó saját
  navigációja; "If any of the headers above contain values not listed in the specification ... servers
  should ignore those headers"; a `localhost` és a `127.0.0.0/8` potenciálisan megbízható cél, tehát a
  böngésző a fejlécet ide is küldi (ugyanaz az URL, mint 2.2).
- A Go `CrossOriginProtection.Check` ugyanígy dönt: `same-origin` és `none` átmegy, minden más
  `Sec-Fetch-Site` érték elutasít (<https://go.dev/src/net/http/csrf.go>, a `Check` függvény).

### 2.4 Ha sem `Origin`, sem `Sec-Fetch-Site` nincs: a kérés nem böngészőből jön

- Elsődleges: a Go `CrossOriginProtection.Check`: "Neither Sec-Fetch-Site nor Origin headers are present.
  Either the request is same-origin or not a browser request." és `return nil`
  (<https://go.dev/src/net/http/csrf.go>).
- Megerősítés 1: Filippo Valsorda: "If neither the Sec-Fetch-Site nor the Origin headers are present, allow
  the request. These requests are not from (post-2020) browsers, and can't be affected by CSRF."
  (<https://words.filippo.io/csrf/>).
- Megerősítés 2: MDN `Origin`: a böngésző a nem `GET`/`HEAD` same-origin kérésekre és minden cross-origin
  kérésre küldi (kivétel a `no-cors` `GET`/`HEAD`), "Baseline ... since July 2020"
  (<https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Origin>); a Fetch szabvány "append a
  request `Origin` header" lépése (<https://fetch.spec.whatwg.org/#origin-header>).
- **Eltérés az OWASP szövegétől, kimondva.** Az OWASP "Using Standard Headers to Verify Origin" szakasza azt
  írja: "If neither header establishes a trusted source origin, reject the protected state-changing request".
  A SPEC-017 a Go és Valsorda szabályát követi, mert a próba eszköz és minden nem böngésző kliens e
  fejlécek nélkül jön (3.1 mérés), és egy ilyen kliens a helyi gépen fut, tehát a CSRF fenyegetés (a
  böngésző mint megtévesztett közvetítő) rá nem értelmezhető. Az OWASP Fetch Metadata szakasza maga is
  megengedi a "Fail-open (compatibility-first)" választást a fejlécek hiányára.

### 2.5 A `Referer` mint tartalék

- Elsődleges: OWASP "Checking the Referer Header if Origin Header Is Not Present" (ugyanaz az URL, mint 2.2).
- Megerősítés 1: MDN `Origin`: "The `Origin` header is similar to the `Referer` header, but does not disclose
  the path" (2.4 MDN URL).
- Megerősítés 2: a Referer alakja egy URL, aminek az originje a WHATWG URL szerint képezhető
  (<https://url.spec.whatwg.org/#origin>), és az MDN `Referer` leírása (<https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referer>).
- A Go algoritmus a `Referer` fejlécet nem nézi; a SPEC-017 a `Sec-Fetch-Site` nélküli régi böngésző
  `Origin` nélküli kérésére használja, az OWASP sorrendje szerint.

### 2.6 A státusz `403`, a `localhost` név

- `403`: RFC 9110 15.5.4 "the server understood the request but refuses to fulfill it"
  (<https://www.rfc-editor.org/rfc/rfc9110.html#name-403-forbidden>); megerősítés: az MDN `Sec-Fetch-Site`
  idézett mondata (2.3), és a Vite GHSA javítás leírása, ahol a nem engedett host kérése elutasítást kap (2.1).
- `localhost`: RFC 6761 6.3, a név a loopback címre oldódik (<https://www.rfc-editor.org/rfc/rfc6761#section-6.3>);
  megerősítés: a W3C Secure Contexts "potentially trustworthy origin" algoritmusa a `localhost` nevet és a
  `127.0.0.0/8` tartományt egyformán kezeli (<https://w3c.github.io/webappsec-secure-contexts/>), és az OWASP
  "Requirements" pontja ugyanezt írja (2.2 URL).

### 2.7 Nem ellenőrzött

- Hogy a Firefox és a Safari a 3.3 szerinti DNS rebinding lapot ugyanúgy átengedi-e a szerverig, mint a
  Chromium a Local Network Access ellenőrzés kikapcsolása mellett: nem mértük, mert a Playwright konfiguráció
  kizárólag Chromiumot definiál (szabálykönyv 11.).

## 3. Saját mérések

### 3.1 A Node `fetch` fejlécei (Node v26.7.0)

Egy `node:http` szerver a kapott fejléceket írta ki. A Node `fetch` `POST` és `GET` kérése: `host`,
`connection`, `content-type`, `accept`, `accept-language`, `sec-fetch-mode: cors`, `user-agent: node`,
`accept-encoding`; **nincs `origin`, nincs `sec-fetch-site`, nincs `referer`**. A megadott `host` fejlécet a
`fetch` figyelmen kívül hagyja (a kérés a cél címéből építi). Következmény: a próba eszköz (`apps/server/measurement`,
`fetch` alapú) kérései a 2.4 szabály szerint átmennek, és a szerver szintű teszt a `Host` fejlécet csak
`node:http` kéréssel tudja beállítani.

### 3.2 A Vite proxy a `Host` fejlécet a célra írja, az `Origin` fejlécet változatlanul továbbítja

A telepített `vite@8.2.2` `dist/node/chunks/node.js`:

- 19204-19207. sor: a sztring alakú proxy szabály `{ target: opts, changeOrigin: true }` objektummá válik.
- 18275. sor (a beépített `http-proxy-3`): `if (options.changeOrigin) outgoing.headers.host = ...` a cél
         host és port.
- 19186-19197. sor: az `Origin` fejlécet kizárólag a `rewriteWsOrigin` opció írja át, ami a `vite.config.ts`
  szabályában nincs.

Tehát a proxyn át érkező kérés `Host` fejléce a szerver címe (`127.0.0.1:3001`), az `Origin` fejléce a
felületé (`http://localhost:5173`). A 3.3 mérés `sajat-felulet` jelenete ezt a javított szerveren igazolja.

### 3.3 Valódi Chromium, valódi Vite proxy, valódi szerver

Eszköz: `apps/web/measurement/request-source-check.ts` (a futtatás módja a fájl fejlécében). A Vite middleware
módban fut a repó `vite.config.ts` fájljával, egy szabad porton figyelő `node:http` szerverre kötve (a
`listenOnLoopback` közös útján); a proxy szabály middleware módban is felkerül (a telepített `vite@8.2.2`
`dist/node/chunks/node.js` 26636. sora). Chromium
151.0.7922.34 (a Playwright 1.62.1 `browsers.json` szerint), a szerver gyermek folyamat ideiglenes
adatbázissal. "Előtte": a `9acafec` munkapéldány szervere (`MEASURE_SERVER_ROOT`); "utána": e branch szervere.
A `createdOnServer` a jelenet alatt létrejött workflow-k száma.

| Jelenet                                                                                         | Előtte                                                                                                                                                                | Utána                                                     |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `sajat-felulet` (Vite originről `GET`, `POST` a proxyn, közvetlen kereszt-origin `GET /events`) | `GET` 200, `POST` 200, `stream_ready` megjött, 1 új workflow                                                                                                          | ugyanaz                                                   |
| `csrf` (idegen origin, `no-cors` `POST`, `text/plain` JSON törzs)                               | **1 új workflow**                                                                                                                                                     | 0 új workflow                                             |
| `dns-rebinding`, alap Chromium                                                                  | a Chromium blokkolja (Local Network Access: "The request client is not a secure context and the resource is in more-private address space `loopback`"), 0 új workflow | ugyanaz                                                   |
| `dns-rebinding`, `--disable-features=LocalNetworkAccessChecks`                                  | **`POST` 200, 1 új workflow, a lista olvasható**                                                                                                                      | `POST` 403, lista 403 (`host_not_allowed`), 0 új workflow |

Megjegyzések:

- A `sajat-felulet` jelenet SSE kérése `fetch` hívás `cors` módban (a lint `isolated-functions` szabálya a lapon
  futó függvényben az `EventSource` nevet nem engedi): a Fetch szabvány szerint ugyanaz az `Origin` fejléc és
  ugyanaz a CORS ellenőrzés jár hozzá, mint az `EventSource` kéréséhez; az `EventSource` `Origin` fejlécét a
  SPEC-012 research 14.6 mérése rögzítette.
- A CSRF jelenet a javítás előtt a felhasználó adatbázisába írt egy idegen lapról, a böngésző
  alapbeállításával: ez a SPEC-009 kockázati sorának mért igazolása.
- A Chromium Local Network Access ellenőrzése a DNS rebinding jelenetet a javítás előtt is megfogta. Ez
  böngészőfüggő védelem (2.7), a szerver nem építhet rá; a kapcsoló kikapcsolásával mért sor mutatja a
  szerver saját védelmét.

## 4. Következtetés a specnek

A SPEC-017 5. szekciójának szabálya a fenti forrásokon áll: `Host` a helyi nevekre és a kapcsolat portjára
(2.1, 2.6), utána `Origin` egyenlőség (2.2), `Sec-Fetch-Site` (2.3), `Referer` (2.5), fejléc nélkül átengedés
(2.4), elutasításkor `403` (2.6). A 3.2 és a 3.3 mérés szerint a fejlesztői elrendezés (Vite proxy, közvetlen
SSE) a szabály mellett változatlanul működik, és a próba eszköz kérései (3.1) átmennek.
