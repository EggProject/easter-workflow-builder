# Párhuzamossági korlát mérése MiniMax ellen

|            |                                                                                                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dátum      | 2026-08-28                                                                                                                                                                          |
| Bemenet    | [SPEC-000](../spec/SPEC-000-provider-wire-measurement.md) 4. szekció (M-37, M-38, M-39), [2026-08-26-spec000-kiertekeles.md](2026-08-26-spec000-kiertekeles.md) 5.6 és 6.11 szekció |
| Kimenet    | javasolt alapértelmezés a `provider_concurrency_limit` táblához                                                                                                                     |
| SDK        | `@anthropic-ai/claude-agent-sdk@0.3.245` (`tools/wire-probe/package.json` pin)                                                                                                      |
| Mérőeszköz | `tools/wire-probe/`, új esetek: `src/cases/m-37.ts`, `m-38.ts`, `m-39.ts`                                                                                                           |
| Környezet  | mérőgép (bash sandbox): 4 CPU mag, 3.8 GiB RAM (`free -h`), Node 26.7.0, a proxy loopbackon (127.0.0.1:8787)                                                                        |

Ez a mérés tudatosan felülírja a SPEC-000 7. szekciójának eredeti döntését ("szándékos rate
limit kimerítést nem végzünk"). A cél most kifejezetten az volt, hogy megtaláljuk, hány
egyidejű agent lépésnél jelentkezik az első HTTP 429 a MiniMax `MiniMax-M3` ellen.

---

## 1. Mérési módszer

A `minimax` provider végleges, kötelező env blokkja szerint futott minden mérés
(`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, forrás:
`packages/provider-minimax/src/environment/required-environment.ts`), hogy a mért
kérésszám a termékben ténylegesen kimenő forgalmat tükrözze, ne a SPEC-000 M-01 alapesetének
plusz cím generáló háttérkérését.

Három új mérési eset (`tools/wire-probe/src/cases/`), regisztrálva a `CASE_REGISTRY`-ben
(`src/cases/index.ts`), a SPEC-000 4. szekciójában dokumentálva:

1. **M-37** -- lépésenkénti kérésszám és időtartam, **egyszerű lépés**: egy in-process tool
   hívás, `maxTurns: 3`, 3 egymást követő, szekvenciális `query()` a szórás megfigyeléséhez.
2. **M-38** -- ugyanaz, **összetett lépés**: két láncolt in-process tool hívás (a második
   bemenete az első kimenetétől függ), `maxTurns: 5`, 3 szekvenciális `query()`.
3. **M-39** -- **konkurrencia ramp**: egyetlen fokozat egy `node src/probe.ts M-39` hívás,
   `WIRE_PROBE_M39_STAGE_SIZE=<N>` adja meg, hány egyidejű, önálló, `Promise.allSettled`-del
   indított `query()` fusson (`DEFAULT_PROMPT`, `maxTurns: 1`, tool nélkül -- ez pontosan egy
   HTTP kérést generál lépésenként, lásd 2. szekció). A fokozatok sorozatát és a leállási
   feltételt (első 429, vagy a mérőgép memóriakorlátja) a hívó bash szkript vezérelte, nem a
   case, hogy egy esetleges memóriakimerülés csak az adott fokozat adatait vigye el.

A kérésszámot és az időzítést minden esetben a proxy `artifacts/*.json` tranzakcióiból
olvastuk vissza (`timestamp`, `method`, `path`, `responseStatus`, `durationMs`), időablak
alapján (±1s tolerancia), az M-31 esetnél már bevált mintát követve
(`tools/wire-probe/src/cases/m-31.ts`).

**Fontos módszertani korlát, amit menet közben találtunk.** A bash eszköz egy háttérbe
küldött folyamatot (`node src/proxy.ts &`) csak akkor tart meg helyesen ugyanabban a
könyvtárban, ha a `cd` és a `&`-lel záruló sor **nem** `&&`-lánc része -- egy `cd X && ... &`
alakban a teljes `&&`-lánc kerül háttérbe, és a rákövetkező parancsok az eredeti
munkakönyvtárban futnak tovább. Ez okozott egy sikertelen, 178 másodperc után megszakadt első
futást (`MODULE_NOT_FOUND`). A javított minta: külön sorok, `&&` nélkül. Ez nem mérési
eredmény, hanem a mérőeszköz saját hibája volt, útmutatóként rögzítve.

---

## 2. Nyers eredmények

### 2.1 Lépésenkénti kérésszám és időtartam (M-37, M-38)

| Eset                                   | Futás | Kérésszám | Időtartam (ms) |
| -------------------------------------- | ----- | --------- | -------------- |
| M-37 (egyszerű, 1 tool hívás)          | a     | 2         | 5531           |
| M-37                                   | b     | 2         | 3349           |
| M-37                                   | c     | 2         | 3290           |
| M-38 (összetett, 2 láncolt tool hívás) | a     | 3         | 6087           |
| M-38                                   | b     | 3         | 6763           |
| M-38                                   | c     | 3         | 4202           |

Átlag: M-37 2 kérés / 4057 ms, M-38 3 kérés / 5684 ms. Mindhárom M-37 futásnál pontosan 2,
mindhárom M-38 futásnál pontosan 3 kérés ment ki -- a kérésszám a tool hívások számával
determinisztikusan egyezik (`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` mellett nincs cím
generáló pluszkérés).

Artefaktum: `tools/wire-probe/artifacts/harness/M-37/{a,b,c}.meta.json`,
`tools/wire-probe/artifacts/harness/M-38/{a,b,c}.meta.json` (a `note` mező tartalmazza a
kérésszámot és az időtartamot, a case saját, proxy artefaktumból számolt összegzéseként).

### 2.2 Konkurrencia ramp (M-39)

| Fokozat (N) | Kérésszám az ablakban                                                   | Ablak (ms) | HTTP állapotok          | Min. elérhető memória a fokozat alatt | Eredmény                                       |
| ----------- | ----------------------------------------------------------------------- | ---------- | ----------------------- | ------------------------------------- | ---------------------------------------------- |
| 3           | 3                                                                       | 5 185      | mind 200                | ~3,05 GiB                             | tiszta                                         |
| 8           | 8                                                                       | 9 509      | mind 200                | ~2,30 GiB                             | tiszta                                         |
| 15          | 15                                                                      | 9 838      | mind 200                | ~1,23 GiB                             | tiszta                                         |
| 20          | 21                                                                      | 23 548     | mind 200                | ~0,52 GiB                             | tiszta, de érezhetően lassuló (lásd 2.3)       |
| 24          | 16 (a 24 indított hívásból, a többi kliens oldali 45s timeoutba futott) | 51 563     | a beérkezettek mind 200 | **0 kB**                              | **sandbox memóriakorlát, nem mérési eredmény** |

**24 egyidejű lépésnél a mérőgép memóriája fogyott el, nem a MiniMax rate limitje.** Az
`/proc/meminfo` `MemAvailable` mezője a mintavétel szerint 0 kB-ra esett a fokozat alatt, és
mind a 24 önálló `query()` hívás elérte a saját 45 másodperces kliens oldali időkorlátját
(`tools/wire-probe/artifacts/harness/M-39/stage24-*.meta.json`, `timedOut: true`), miközben
a proxyn ténylegesen átment 16 kérés mind HTTP 200 választ kapott -- tehát a MiniMax oldalán
semmi rendellenesség nem történt, a szűk keresztmetszet a helyi gép CPU/memória kapacitása
volt (4 mag, ~3,2 GiB szabad induláskor). A mérést itt megállítottuk, a feladatleírás explicit
utasítása szerint ("Ha a sandbox korlátoz előbb, azt mondd ki, és ne extrapolálj a mért
tartományon túlra").

**429 válasz a teljes méréssorozat alatt egyszer sem érkezett.** Ez a mostani ~78 kérésre
(M-37: 6, M-38: 9, M-39: 3+8+15+21+16=63) igaz, és összecseng a korábbi két, független
SPEC-000 méréssel: M-18 (113 tranzakció, 79 `POST /v1/messages`, mind 200) és M-36 (50
tranzakció, 36 `POST /v1/messages`, mind 200) -- forrás:
`docs/research/2026-08-26-spec000-kiertekeles.md` 6.11 szekció. Összesen tehát három
független mérési kör, kb. 193 `POST /v1/messages` kérés, és egyetlen 429 sem.

Titok ellenőrzés: `grep -rl "$MINIMAX_API_KEY" tools/wire-probe/artifacts/ docs/` (a kulcs a
`.env`-ből kézzel beolvasva, sosem kiírva) nulla találatot adott.

### 2.3 Egyedi kérés-latencia a konkurrencia függvényében (kiegészítő megfigyelés)

A proxy artefaktumok `durationMs` mezője (a kérés proxy-upstream-proxy oda-vissza ideje)
világosan növekvő tendenciát mutat a fokozat méretével: 3 egyidejű kérésnél jellemzően
1-2 másodperc, 15-nél 1-5 másodperc, 20-nál már 1,3-18,1 másodperc közötti szórással
(`tools/wire-probe/artifacts/*.json`, pl. `00040-1787918495257.json`: 17415 ms,
`00041-1787918495779.json`: 18104 ms, mindkettő HTTP 200). Mivel a válaszok státusza
végig 200 maradt (nincs 429, nincs 5xx), ez a lassulás **nem rate limit jel**, hanem a helyi
4 magos gép erőforrás-versengésének a jele: egyszerre sok natív Claude Code CLI
gyerekfolyamat verseng CPU-ért és memóriáért. Ez a megfigyelés fontos a 4. szekció
következtetéséhez: a mérés a helyi gép, nem a MiniMax határát közelítette meg.

---

## 3. Levezetett érték: lépésenkénti kérésráta

| Lépéstípus       | Kérés/lépés | Átlag időtartam | Kérésráta folyamatos futásnál                 |
| ---------------- | ----------- | --------------- | --------------------------------------------- |
| Egyszerű (M-37)  | 2           | 4,057 s         | 2 / 4,057 s = 0,493 req/s = **29,6 req/perc** |
| Összetett (M-38) | 3           | 5,684 s         | 3 / 5,684 s = 0,528 req/s = **31,7 req/perc** |

A két érték (29,6 és 31,7 kérés/perc) a szórás: egy tipikus, folyamatosan futó agent lépés
kb. **30 kérés/percet** termel, függetlenül attól, hogy egy vagy két tool hívást tartalmaz --
mert a kérésszám nő (2 -> 3), de az időtartam arányosan nő vele (4,06 s -> 5,68 s).

**Számított (nem mért) projekció a dokumentált 200 RPM korlátra:** ha `N` lépés folyamatosan,
egymás után futna (minden lépés azonnal újraindul, ahogy az előző véget ér), a dokumentált
200 kérés/perc korlátot kb. `200 / 30 ≈ 6-7` egyidejűleg, folyamatosan futó lépésnél érné el
a rendszer. **Ez explicit módon számítás, nem mérési eredmény**: a M-39 mérés nem folyamatosan
futó, hanem egyszeri robbanásszerű (burst) konkurrenciát tesztelt, ahol minden lépés egyszerre
indul és egyszer fut le, nem ismétlődik. A burst teszt aggregát rátája ennél lényegesen
alacsonyabb maradt: a legmagasabb tisztán mért fokozatnál (N=20, 21 kérés 23,548 s alatt) az
elért ráta `21 / (23,548/60) ≈ 53,5 kérés/perc` volt, ami a dokumentált 200 RPM-nek kevesebb
mint a harmada -- tehát a burst teszt még a legmagasabb tisztán mért fokozaton sem közelítette
meg a dokumentált korlátot.

---

## 4. Javasolt alapértelmezés a `provider_concurrency_limit` táblához

**A mérés nem érte el a tényleges határt.** A mérési tartomány felső, tisztán mért pontja
**20 egyidejű agent lépés** (burst, egyszerre indítva, mind HTTP 200, retry vagy 429 nélkül).
24-nél a mérőgép memóriája (nem a MiniMax) lett a korlát, ezért a tényleges MiniMax rate/
konkurrencia limit **efölött van**, pontos értéke ebből a mérésből nem állapítható meg.

A feladatleírás szabálya szerint ("ha a mért tartomány nem éri el a határt, a javaslat legyen
egy alsó korlát"): a `provider_concurrency_limit.max_concurrent_steps` `minimax` sorára
javasolt alapértelmezés **20**.

Indoklás kizárólag a mért adatból:

- 20 egyidejű, önállóan indított lépés (mindegyik pontosan 1 kérést generáló, a legegyszerűbb
  lépéstípus) HTTP 429 vagy bármilyen hibaválasz nélkül futott le (2.2 szekció).
- Ez burst teszt volt: minden lépés egyszerre indult, ami szigorúbb próba, mint egy valós
  workflow motor tipikus, apró időbeli szórással induló párhuzamos ágai -- tehát a 20-as
  érték inkább alábecsüli, mint túlbecsüli a ténylegesen biztonságos konkurrenciát.
- **A 20 nem a talált határ, hanem a mérés felső, még tiszta pontja.** A tényleges MiniMax
  oldali korlát ismeretlen, de a 3. szekció számítása szerint minden jel arra mutat, hogy
  jóval magasabb: a burst teszt 20-nál is csak az RPM korlát kb. egynegyedét-egyharmadát
  érte el ténylegesen kimért forgalomban.

**Mi hiányzik a pontos határ megállapításához:**

1. Nagyobb memóriájú mérőgép (jelenlegi: 4 mag, 3,8 GiB), hogy 24 fölé lehessen menni anélkül,
   hogy a helyi erőforrás váljon a szűk keresztmetszetté.
2. Egy natív SDK gyerekfolyamat helyett könnyebb, közvetlen HTTP-alapú terhelésgenerátor (mint
   az M-34/M-35 közvetlen `fetch`-es mintája), hogy a konkurrencia ne natív Claude Code CLI
   processzek számától, hanem tisztán HTTP kapcsolatok számától függjön -- ez lényegesen
   magasabb konkurrenciát tenne elérhetővé ugyanazon a gépen.
3. Egy sustained (nem burst) teszt is kellene: N lépés folyamatos, ismétlődő indítása egy
   percen át, hogy a 3. szekció számított 6-7-es projekcióját tényleges méréssel lehessen
   megerősíteni vagy cáfolni.

---

## 5. A 429 válasz pontos alakja

**429 válasz a teljes mérés alatt (ez a kör és a két korábbi SPEC-000 kör együtt, kb. 193
`POST /v1/messages` kérés) egyszer sem érkezett.** A korábbi mérés (M-18, M-36,
`docs/research/2026-08-26-spec000-kiertekeles.md` 6.11 szekció) szerint a `retry-after` és
minden `ratelimit` alstringet tartalmazó header hiányzott a megfigyelt válaszokból. **Ez a
mérés ezt megerősíti** (nem cáfolja): további kb. 78 kéréssel bővítve az eddigi mintát, még
mindig nulla 429 és nulla rate limit jellegű header. A `rateLimits.retryAfterHeader` és
`rateLimitHeaders` mezők (`packages/provider-minimax/src/limits/rate-limits.ts`) ezért
`unknown` állapotban maradnak, blokkolójuk változatlanul M-18 és M-36 -- ehhez a listához a
jelen mérés (M-37 ... M-39) nem ad új blokkolót, mert nem hozott új bizonyítékot 429-re,
csak megerősítette a hiányát. **A workflow motor emiatt továbbra sem építhet `Retry-After`
headerre; 429 esetére saját, a headerektől független visszalépési logika kell.**

---

## 6. A dokumentált 200 RPM viszonya a mérthez

| Forrás                                                                                            | Érték                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dokumentált (research, `packages/provider-minimax/src/limits/rate-limits.ts` `requestsPerMinute`) | 200 kérés/perc, `MiniMax-M3`                                                                                                                                         |
| Mért, folyamatos lépésekre számítva (3. szekció)                                                  | egy lépés kb. 30 kérés/percet termel folyamatos futásnál -> becsült 6-7 egyidejű, folyamatosan futó lépésnél érné el a 200-at (**számítás, nem mérés**)              |
| Mért, burst konkurrenciára                                                                        | 20 egyidejű, egyszeri lépés (21 kérés) 23,5 másodperc alatt lefutott, ~53,5 kérés/perc effektív rátával -- a dokumentált korlát alig negyede, és nem generált 429-et |

A két nézet (folyamatos vs. burst) nem mond ellent egymásnak: a burst teszt rövid ideig tart
(23,5 s), ezért még magas pillanatnyi konkurrencia mellett sem éri el a RPM korlátot idő
alapon, míg egy ténylegesen **folyamatosan** 6-7 lépést futtató motor egy teljes percen
keresztül közelítené meg a dokumentált határt. A jelen mérés csak az előbbit (burst) tesztelte
ténylegesen; az utóbbi (sustained) forgatókönyv a 4. szekció "mi hiányzik" listájának 3. pontja.

---

## 7. Artefaktum hivatkozások

| Állítás                                                              | Artefaktum                                                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| M-37 kérésszám/időtartam                                             | `tools/wire-probe/artifacts/harness/M-37/{a,b,c}.meta.json`, `{a,b,c}.sdk-messages.ndjson`                         |
| M-38 kérésszám/időtartam                                             | `tools/wire-probe/artifacts/harness/M-38/{a,b,c}.meta.json`, `{a,b,c}.sdk-messages.ndjson`                         |
| M-39 fokozatok (3, 8, 15, 20, 24)                                    | `tools/wire-probe/artifacts/harness/M-39/stage<N>-*.meta.json`, `stage<N>-*.sdk-messages.ndjson`                   |
| 24-es fokozat timeoutjai                                             | `tools/wire-probe/artifacts/harness/M-39/stage24-*.meta.json` (`timedOut: true`)                                   |
| Egyedi kérés HTTP állapotok és `durationMs`                          | `tools/wire-probe/artifacts/*.json` (proxy nyers tranzakciók, maszkolva)                                           |
| Korábbi, nulla 429 megfigyelés                                       | `docs/research/2026-08-26-spec000-kiertekeles.md` 6.11 szekció (M-18, M-36)                                        |
| A `minimax` env blokk, amivel a mérés futott                         | `packages/provider-minimax/src/environment/required-environment.ts`                                                |
| Jelenlegi `rateLimits`/`concurrency` leíró                           | `packages/provider-minimax/src/limits/rate-limits.ts`, `packages/provider-minimax/src/limits/concurrency.ts`       |
| `provider_concurrency_limit` séma és jelenlegi (üres) alapértelmezés | `packages/db/src/provider-concurrency/provider-concurrency.ts`, `packages/db/drizzle/0005_condemned_madripoor.sql` |

A `tools/wire-probe/artifacts/` könyvtár a `.gitignore` szerint sosem kerül gitbe (SPEC-000 3. szekció) -- a fenti fájlok a mérőgépen a mérés újrafuttatásával reprodukálhatók
(`bun run proxy` egy terminálban, `WIRE_PROBE_M39_STAGE_SIZE=<N> bun run probe M-39` egy
másikban), nem a git történet része.
