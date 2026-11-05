# SPEC-017: Host és Origin ellenőrzés (CSRF és DNS rebinding védelem)

|          |                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz  | végrehajtva (PLAN-018): a termékdöntés a user 2026-11-04-i válasza; a technikai döntések forrásból lezárva (5. szekció)                                                         |
| Dátum    | 2026-11-05                                                                                                                                                                      |
| Előzmény | [`SPEC-006`](SPEC-006-szerver-alkalmazas.md) 3.5 és 5.7, [`SPEC-009`](SPEC-009-beallitasok-es-agent-konfiguracio.md) 11. szekció kockázati sora ("hatókörön kívül, külön spec") |
| Bemenet  | [`../research/2026-11-05-host-origin-ellenorzes.md`](../research/2026-11-05-host-origin-ellenorzes.md)                                                                          |
| Kimenet  | a szerver minden kérésen ellenőrzi a `Host` fejlécet és a kérés forrását; idegen kérésre `403`, `forbidden` kóddal                                                              |
| Terv     | [`../plan/PLAN-018-host-origin-ellenorzes.md`](../plan/PLAN-018-host-origin-ellenorzes.md)                                                                                      |

---

## 1. Cél és hatókör

A szerver a `127.0.0.1` címre köt és nem kér bejelentkezést (SPEC-006 3.5), de a kérés forrását nem
ellenőrizte: egy böngészőben megnyitott idegen oldal a felhasználó gépén futó szerverre írhatott (CSRF), és DNS
rebindinggel olvashatott is. A research 3.3 mérése szerint a javítás előtt egy idegen originről küldött
egyszerű `POST` workflow-t hozott létre.

**A user döntése (2026-11-04), szó szerint.** A kérdés: "A helyi szerver nem ellenőrzi, honnan jön a kérés:
egy rosszindulatú weboldal a böngésződön át elérheti, és futtatást indíthat (CSRF, DNS rebinding). Mi legyen?"
A válasz: "Host és Origin ellenőrzés": "Csak a saját felületed kéréseit fogadja el; bejelentkezés nem kell."

### Amit eldönt

1. Hol fut az ellenőrzés és milyen kérésekre (5.1).
2. A `Host` fejléc szabályát (5.2).
3. A felület engedett originjét és a forrását a konfigurációban (5.3).
4. A kérés forrás szabályát (`Origin`, `Sec-Fetch-Site`, `Referer`) és az elutasítás alakját (5.4).

### Amit NEM dönt el

- Hitelesítést (bejelentkezés, token, munkamenet): a user döntése szerint nem kell.
- A CORS szabályt: a SPEC-006 5.7 változatlan, a CORS fejléc továbbra is csak a megadott
  `EASTER_STREAM_DEV_ORIGIN` mellett és csak a `STREAM_PATH` útvonalon megy ki.
- A `Content-Type` ellenőrzését: az egyszerű (`text/plain`) kérés CSRF útját az `Origin` szabály zárja (5.4),
  külön tartalomtípus szabály nem kell.
- Statikus felület kiszolgálást: a szerver továbbra sem szolgál ki felületet (SPEC-012 4.5).

## 2. Kiindulási állapot

- A fejlesztői elrendezés (SPEC-008 3., SPEC-012 4.): a felület a Vite dev szerveren (`http://localhost:5173`),
  a REST hívás a Vite `/api` proxyján a szerverre (`http://127.0.0.1:3001`), az SSE közvetlenül a szerverre.
- A próba eszköz (`apps/server/measurement`, SPEC-012 5.) a Node `fetch` hívásával éri el a saját gyermek
  szerverét, `EASTER_SERVER_PORT=0` mellett az operációs rendszer által kiosztott porton.

## 3. Megerősített tények

A források és a mérések részletesen: research 2. és 3. szekció.

| Tény                                                                                                                                 | Forrás                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| DNS rebindingnél a böngésző a támadó nevét küldi a `Host` fejlécben; a helyi szerver védelme ennek ellenőrzése                       | research 2.1 (Vite GHSA-vg6x-rcgg-rjx6, Vite `allowedHosts`, MCP transports)   |
| Az `Origin` engedett listával, egyszerű egyenlőséggel ellenőrizendő; a `null` idegen                                                 | research 2.2                                                                   |
| A `Sec-Fetch-Site` `same-origin` és `none` értéke átengedhető, a `same-site` és a `cross-site` nem; ismeretlen érték figyelmen kívül | research 2.3                                                                   |
| `Origin` és `Sec-Fetch-Site` nélkül a kérés nem (2020 utáni) böngészőből jön                                                         | research 2.4                                                                   |
| A Node `fetch` nem küld `Origin`, `Sec-Fetch-Site` és `Referer` fejlécet, a `Host` fejlécet a célból építi                           | research 3.1, saját mérés                                                      |
| A Vite proxy szabálya a `Host` fejlécet a célra írja, az `Origin` fejlécet változatlanul adja tovább                                 | research 3.2, a telepített `vite@8.2.2` forrása                                |
| A felület SSE kérése `Origin: http://localhost:5173`, és a Vite proxyn át érkező `POST` is ezt az `Origin` fejlécet hordozza         | research 3.3, valódi Chromium mérés; a SPEC-012 research 14.6 mérése az SSE-re |

## 4. Fogalmak

- **Felület origin:** az az origin, amelyről a felhasználó böngészője a felületet megnyitja (a Vite dev szerver
  címe).
- **Helyi név:** a `127.0.0.1` és a `localhost`; a szerver más néven nem érhető el böngészőből (SPEC-006 3.5).

## 5. Döntések

### 5.1 Hol és mire

Az ellenőrzés **minden kérésre** lefut, az útvonal illesztése és a törzs olvasása előtt, a `GET /events` SSE
végpontra is (`apps/server/src/request-source-check/`, a `createHttpServer` `handleRequest` függvényének első
lépése). Ez szűkebb a "csak állapotot módosító kérés" szabálynál (Go `CrossOriginProtection`, research 2.4):
a szerver csak a saját felületének szolgál, és a `GET` kérésekre is egyforma szabály egyetlen elágazás nélküli
belépési pontot ad.

### 5.2 `Host`

A `Host` fejléc a két helyi név egyike és a **kapcsolat helyi portja** (`socket.localPort`): a beállított port,
`EASTER_SERVER_PORT=0` mellett az operációs rendszer által kiosztott (SPEC-012 5.1). A várt alakot a WHATWG URL
szerializálás adja (`new URL('http://<név>:<port>').host`), ami az alapértelmezett portot elhagyja, ahogy a
böngésző is. A név kis- és nagybetűtől független. Hiányzó fejléc, más név (DNS rebinding), más port, `[::1]`
(a szerver nem hallgat IPv6 címen) és `localhost` aldomain elutasít. A helyi nevek listája a kódban áll
(`loopback-host-names.ts`), nem konfigurálható, ugyanazért, amiért a bind cím sem (SPEC-006 3.5 2. pont).

### 5.3 A felület engedett originje

Pontosan egy érték: az `EASTER_STREAM_DEV_ORIGIN`, ha meg van adva, különben a forrásolt alapérték
`http://localhost:5173` (`DEFAULT_SERVER_CONFIG.uiOrigin`; ugyanaz az érték és forrás, mint a web
`DEFAULT_FRONTEND_CONFIG.apiOrigin` alapértékéé: SPEC-012 research 10.3 és 14.6). Új env változó nincs.

- A megadott értéknek **pontosan egy szerializált originnek** kell lennie (a WHATWG URL `origin` mezője
  változatlanul adja vissza), különben a szerver nem indul (`invalid_env_variable`). Záró perjel, útvonal,
  `null`, `*` és nagybetűs séma érvénytelen: ezekkel a böngésző `Origin` fejléce sosem egyezne.
- A CORS fejléc ettől független: alapértéke továbbra sincs (SPEC-006 5.7 4. pont, SPEC-012 4.2).
- Az érték nem kerül a naplóba (SPEC-006 7.4: a `devOrigin` értéke sem).

### 5.4 A kérés forrása és az elutasítás

Sorrendben, az első döntő szabály számít (research 2.2 ... 2.5):

| #   | Feltétel                                                         | Eredmény                                                                               |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | van `Origin`                                                     | átmegy, ha pontosan a felület origin; különben elutasít (`null` és ismételt fejléc is) |
| 2   | nincs `Origin`, a `Sec-Fetch-Site` `same-origin` vagy `none`     | átmegy (a Vite proxyn át érkező saját `GET`)                                           |
| 3   | nincs `Origin`, a `Sec-Fetch-Site` `same-site` vagy `cross-site` | elutasít                                                                               |
| 4   | az előzők nem döntöttek, van `Referer`                           | átmegy, ha az originje a felület origin                                                |
| 5   | egyik fejléc sincs                                               | átmegy: nem böngésző kliens (próba eszköz, `curl`)                                     |

A `Host` szabály (5.2) az 5.4 előtt dönt. Az 5. sor eltér az OWASP "Standard Headers" szakaszától, a Go és
Valsorda szabályát követve; az indok research 2.4.

**Elutasításkor** a válasz `403`, `{ code: 'forbidden', message }` törzzsel, a `protocol`
`httpStatusForErrorCode` leképezésén (SPEC-006 18. kritérium). Az üzenet a hibaosztályt zárójelben hordozza
(`host_not_allowed`, `origin_not_allowed`, SPEC-005 8.3), a kapott fejléc értékét nem visszhangozza (SPEC-006
3.5 4. pont). A kérés törzsét a szerver olvasás nélkül eldobja, a kezelő nem fut, a stream nem nyílik, CORS
fejléc nem megy ki. A napló `warn` sort kap a hibaosztállyal.

**A `forbidden` a `ProtocolErrorCode` hetedik kódja** (SPEC-005 8.2), `403` státusszal; a kliens saját magyar
mondatot rendel hozzá (SPEC-007 8.4): "A szerver elutasította a kérést, mert nem a beállított felület címéről
érkezett." A saját felületen ez csak eltérő beállításnál fordul elő (a felület más címen nyílt meg, mint az
engedett origin). `errorClass` nem jár hozzá: a két hibaosztály nem a motor szótárából jön (SPEC-005 8.5).

## 6. Tesztelés

- Unit: `is-allowed-host-header`, `is-allowed-request-source`, `find-request-source-rejection` minden ágra;
  `server-config` az engedett origin alapértékére, a megadott értékre és az érvénytelen alakokra; a `protocol`
  kód és státusz; a kliens mondata.
- Szerver szintű (`create-http-server.spec.ts`, valódi `node:http` kérés tetszőleges `Host` fejléccel): a Vite
  proxy `POST` és `GET` alakja, a közvetlen SSE kapcsolat, a próba eszköz `fetch` hívása átmegy; idegen `Host`
  (`POST` és SSE), idegen `Origin` (egyszerű `text/plain` `POST` és SSE), `Origin` nélküli `cross-site` kérés
  `403`, a kezelő nem fut; a `warn` napló sor; nagy törzs mellett is megjön a válasz.
- E2e: a `forbidden` kód magyar mondata a danger `Alert` blokkban (`rest-error-paths.spec.ts`, `page.route()`).
- Mérés (nem kapu): `apps/web/measurement/request-source-check.ts`, valódi Chromium, Vite proxy és szerver,
  előtte és utána (research 3.3).

## 7. Nyitott kérdések

### 7.1 Termékdöntés (user)

| #   | Kérdés                                | Döntés                                                                                  |
| --- | ------------------------------------- | --------------------------------------------------------------------------------------- |
| O-1 | CSRF és DNS rebinding ellen mi legyen | **lezárva** (user döntés 2026-11-04): "Host és Origin ellenőrzés", bejelentkezés nélkül |

### 7.2 Technikai

| #   | Kérdés                                                                            | Mi a viselkedés addig                                                                                               | Mi zárná le                                                                    |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| T-1 | A Firefox és a Safari a DNS rebinding lapot átengedi-e a szerverig (research 2.7) | a szerver a `Host` szabállyal böngészőtől függetlenül elutasít; a kérdés csak a böngésző saját védelmére vonatkozik | Firefox és WebKit projekt a Playwright konfigurációban és a mérés megismétlése |

## 8. Elfogadási kritériumok

1. Idegen `Host` fejlécű kérés (`POST` és `GET /events`) `403`, `forbidden`, `host_not_allowed`; a kezelő nem
   fut, a stream nem nyílik, a válasz a nevet nem visszhangozza.
2. Idegen `Origin` fejlécű kérés (egyszerű `text/plain` `POST` és `GET /events`) `403`, `forbidden`,
   `origin_not_allowed`; a kezelő nem fut, CORS fejléc nincs.
3. `Origin` nélküli, `Sec-Fetch-Site: cross-site` kérés `403`.
4. A saját felület kérései átmennek: a Vite proxy `POST` (`Host` a szerveré, `Origin` a felületé,
   `Sec-Fetch-Site: same-origin`) és `GET` (`Origin` nélkül), a közvetlen SSE (`Sec-Fetch-Site: cross-site`,
   `Origin` a felületé), CORS fejléccel.
5. A próba eszköz `fetch` hívása (fejlécek nélkül) átmegy; a próba eszköz meglévő tesztjei zöldek.
6. Az engedett origin az `EASTER_STREAM_DEV_ORIGIN` vagy az alapérték; az érvénytelen alak indításkor
   `invalid_env_variable`; az érték nem kerül a naplóba.
7. A `forbidden` kód `403` státusszal a `protocol` szótárában, a kliens magyar mondatával, unit és e2e teszttel.
8. A mérés (research 3.3) előtte és utána: a CSRF jelenet előtte írt, utána nem; a DNS rebinding jelenet a
   böngésző védelme nélkül előtte írt és olvasott, utána `403`; a saját felület mindkét esetben működik.
9. Átvezetve: SPEC-005 8.2, SPEC-006 3.5, 5.7 és új 5.8, SPEC-007 8.4, SPEC-009 11. szekció kockázati sora,
   `.env.example`, `README.md`, `apps/server/CLAUDE.md`, `apps/web/CLAUDE.md`, szabálykönyv 7. és 13. szekció.
10. Kilenc kapu zöld, unit lefedettség 100 százalék, e2e küszöb nem romlik.

## 9. Kapcsolódó dokumentumok

- [`../plan/PLAN-018-host-origin-ellenorzes.md`](../plan/PLAN-018-host-origin-ellenorzes.md)
- [`../research/2026-11-05-host-origin-ellenorzes.md`](../research/2026-11-05-host-origin-ellenorzes.md)
- [`SPEC-006-szerver-alkalmazas.md`](SPEC-006-szerver-alkalmazas.md) 3.5, 5.7, 5.8
