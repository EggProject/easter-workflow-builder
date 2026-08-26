# PLAN-000: Provider drótszintű mérés végrehajtási terv

| | |
|---|---|
| Státusz | tervezet |
| Dátum | 2026-08-26 |
| Spec | [`../spec/SPEC-000-provider-wire-measurement.md`](../spec/SPEC-000-provider-wire-measurement.md) |
| Branch | `feat/spec-000-provider-wire-measurement` |

Ez a terv a SPEC-000-t sorban végrehajtható, egyenként ellenőrizhető lépésekre bontja, az előkészítéstől a PR nyitásig.

## 1. Előfeltételek

| Feltétel | Elvárt érték | Ellenőrzés |
|---|---|---|
| Feature branch | `feat/spec-000-provider-wire-measurement` | `git rev-parse --abbrev-ref HEAD` |
| Node.js runtime | 26.7.0 | `node -v` |
| Bun (csak csomagkezelő) | 1.4.0 | `bun -v` |
| Agent SDK | `@anthropic-ai/claude-agent-sdk@0.3.245`, pontos verzióra pinelve | `node_modules/@anthropic-ai/claude-agent-sdk/package.json` `version` mezője |
| API kulcs | `MINIMAX_API_KEY` a repo gyökér `.env` fájljában, gitbe soha | `git check-ignore -v .env` |
| Upstream | `https://api.minimax.io/anthropic` elérhető a fejlesztői gépről | `curl -s -o /dev/null -w '%{http_code}'` a hello végpontra |

A verziók forrása [`../research/2026-08-26-toolchain.md`](../research/2026-08-26-toolchain.md). Más verziót ebben a munkában nem használunk, és nem is találunk ki.

A `main` védett, közvetlen push tiltott. A `.env` és a proxy futásidejű naplója nem kerülhet gitbe, a maszkolt artefaktumok viszont igen (SPEC-000 3. szekció).

## 2. Todo lépések

Modell oszlop jelentése: a lépést végrehajtó subagent `model` beállítása. `sonnet` a részletes specifikáció alapján végzett kódolásra és a recon jellegű feladatokra, `opus` az architektúrára, a kiértékelésre és az adverzariális ellenőrzésre. A mező soha nem hagyható üresen.

### F1 fázis: előkészítés

| ID | Leírás | Függőség | Modell | Elfogadási kritérium |
|---|---|---|---|---|
| T-000-1 | Feature branch `feat/spec-000-provider-wire-measurement` kiválasztása a `main` friss állapotáról. | nincs | sonnet | `git rev-parse --abbrev-ref HEAD` a branch nevét adja, `git status --porcelain` üres, a `main` ref nem mozdult. |
| T-000-2 | A toolchain verziók ellenőrzése a research fájl rögzített értékei ellen. | T-000-1 | sonnet | `node -v` = `v26.7.0`, `bun -v` = `1.4.0`, eltérés esetén a lépés leáll és nem indul kódolás. |
| T-000-3 | Workspace gyökér `package.json` és strict `tsconfig.json` létrehozása, az Agent SDK telepítése `0.3.245` pontos verzióra pinelve. | T-000-2 | sonnet | A `bun.lock` és a telepített `package.json` egyaránt `0.3.245`-öt mutat, a `tsconfig.json`-ban nincs lazított strict kapcsoló. |
| T-000-4 | `.env` létrehozása a `MINIMAX_API_KEY` bejegyzéssel, és `.gitignore` kiegészítése a `.env` fájllal plusz a proxy futásidejű naplójának útvonalával. | T-000-3 | sonnet | `git check-ignore -v .env` és a naplóútvonal is találatot ad, `git status --porcelain` egyiket sem listázza. |
| T-000-5 | A telepített SDK típusdefiníciójából az `Options.effort`, `Options.thinking`, `outputFormat`, `permissionMode`, `maxTurns`, `hooks.Stop` és a kimenő token korlát opció pontos neveinek és enum értékeinek kiolvasása. | T-000-3 | sonnet | Minden felsorolt opcióhoz rögzítve van a `.d.ts` fájl útja és sorszáma, továbbá a pontos értékkészlet; egyetlen érték sem tippelt, és mindegyik bekerül a mérési `meta.json` sablonba. |
| T-000-6 | A `docs/measurements/2026-08-26-minimax/` artefaktum gyökér és a `tools/wire-proxy/` könyvtár létrehozása, mindkettőben `CLAUDE.md` a könyvtár szerepével és a fájlnév konvencióval. | T-000-4 | sonnet | Mindkét könyvtár létezik `CLAUDE.md`-vel, és a `CLAUDE.md` felsorolja a SPEC-000 3. szekció szerinti hét artefaktum fájlnevet. |

### F2 fázis: eszközépítés

| ID | Leírás | Függőség | Modell | Elfogadási kritérium |
|---|---|---|---|---|
| T-000-7 | A logoló reverse proxy architektúrájának megtervezése: bájtszintű továbbítás, `host` header átírás, teljes útvonal lefedés, SSE soronkénti rögzítés, retry tilalom, memóriában futó maszkolás. | T-000-6 | opus | A `tools/wire-proxy/CLAUDE.md` a SPEC-000 3. szekció mind a hat proxy követelményéhez megnevezi a konkrét megvalósítást és azt, hol sérülhet. |
| T-000-8 | A proxy implementálása a T-000-7 terv szerint, upstream `https://api.minimax.io/anthropic`, a lefoglalt loopback port a `meta.json`-ba írva. | T-000-7 | sonnet | `tsc --noEmit` hibátlan, a forrásban nincs `any` és nincs `as`, a proxy indulásnál kiírja és a `meta.json`-ba menti a ténylegesen lefoglalt portot. |
| T-000-9 | A maszkoló függvény unit tesztje: `authorization` és `x-api-key` header, a kulcs előfordulása a body-ban, és a kulcs előfordulása egy SSE sorban. | T-000-8 | sonnet | Vitest teszt zöld, mindhárom esetben a kimenetben `REDACTED` áll, és a teszt bizonyítja, hogy maszkolatlan tartalom nem jut a lemezre író függvényig. |
| T-000-10 | A proxy bájtazonosság öntesztje lokális echo upstream ellen, valós API hívás és költség nélkül. | T-000-9 | sonnet | A rögzített `request.body.json` bájtra egyezik a küldött törzzsel, és a `stream.ndjson` sorainak száma egyezik az echo által kiadott SSE sorok számával. |
| T-000-11 | A mérési harness váza: eseteket leíró tábla (`Options` delta plusz env delta), `query()` hívás, `sdk-messages.ndjson` rögzítés, `meta.json` írás a SPEC-000 3. szekció mezőivel. | T-000-10 | opus | A harness egy tetszőleges eset azonosítóval indítható, és a lokális echo upstream ellen létrehozza a teljes hétfájlos artefaktum készletet egy `M-XX/` alkönyvtárban. |
| T-000-12 | Az in-process MCP szerverek és a `Stop` hook segédek megírása az M-03, M-09 és M-10 esetek igényei szerint. | T-000-11 | sonnet | Az `emit_output` tool és a több argumentumú mérőtool `createSdkMcpServer`-rel regisztrálva, a `Stop` callback a `stop_hook_active` mezőt figyelve nem blokkol végtelenül, és ezt egy lokális teszt igazolja. |
| T-000-13 | Futásonkénti felső időkorlát és a retry tilalom beépítése a harnessbe, a korlát értéke a `meta.json`-ba kerül. | T-000-11 | sonnet | Időtúllépésnél a `meta.json`-ban `timedOut: true` és a korlát értéke szerepel, a harness nem indít újra hívást, és ezt egy szándékosan lassú lokális upstream igazolja. |
| T-000-14 | Token-takarékos összefoglaló script megírása a mérési eredményekhez (`scripts/measure-summary.sh`), ami esetenként csak státuszkódot, kérésszámot, hiányzó fájlt és hibaüzenetet ír. | T-000-11 | sonnet | 18 esetre futtatva a kimenet nem tartalmaz `request.body.json` vagy `stream.ndjson` tartalmat, csak összegzést és hibalistát, és a hibás eseteknél nem nulla a kilépési kód. |
| T-000-15 | M-01 alapú diff eszköz megírása: top-level body kulcsok, `anthropic-beta` elemek listája, `cache_control` blokkszám, `tools` tömb hossza, kimenő kérések darabszáma. | T-000-14 | sonnet | Két artefaktum könyvtárra futtatva sorokba szedett eltéréslistát ad, és azonos bemenetre üres diffet, ezt teszt igazolja. |

### F3 fázis: mérés

Minden lépés valós MiniMax API hívást indít. A futás előtt a proxy fut, a `MINIMAX_API_KEY` be van töltve, és a lépés végén a T-000-14 összefoglaló script lefut.

| ID | Leírás | Függőség | Modell | Elfogadási kritérium |
|---|---|---|---|---|
| T-000-16 | Az M-01 referencia futás végrehajtása és az artefaktumok rögzítése. | T-000-15 | sonnet | Az `M-01/` alatt megvan mind a hét fájl, a `request.body.json` top-level kulcslistája kiírva, a `meta.json` tartalmazza az SDK verziót, a modellt és a portot. |
| T-000-17 | Az M-02 és M-03 esetek futtatása a strukturált kimenet drótalakjának és a `tool_choice` értékeinek rögzítésére. | T-000-16 | sonnet | Mindkét eset alatt van rögzített tranzakció, M-03-nál minden kimenő kérés `tool_choice` mezője kigyűjtve, 400 esetén az `error.type` és `error.message` szó szerint mentve. |
| T-000-18 | Az M-04 két futása az `effort` legalacsonyabb és legmagasabb, T-000-5-ből kiolvasott értékével. | T-000-17 | sonnet | Két külön tranzakció rögzítve, mindkettőre kész a T-000-15 diff az M-01-hez, és az `effort` érték helye a body-ban megnevezve vagy hiánya kimondva. |
| T-000-19 | Az M-05 és M-06 esetek futtatása a `thinking` be- és kikapcsolt állapotára, streamelve. | T-000-18 | sonnet | A `thinking` body mező pontos JSON alakja szó szerint rögzítve mindhárom futásra, és a `stream.ndjson`-ból kigyűjtve a thinking jellegű event típusok listája. |
| T-000-20 | Az M-07 négy futása a háttér modellhívások feltérképezésére. | T-000-19 | sonnet | Futásonként rögzítve a `POST /v1/messages` kérések darabszáma, a nem felhasználói promptból származó kérések `model` mezője szó szerint, és a hozzájuk tartozó HTTP kód. |
| T-000-21 | Az M-08 env kapcsoló mátrix öt futása, futásonként egyetlen env eltéréssel. | T-000-20 | sonnet | Öt tranzakció rögzítve, mindegyikhez kész a T-000-15 diff az M-01-hez, és megszületik az env változó szerinti eltérés tábla nyers alakja. |
| T-000-22 | Az M-14 három futása az `anthropic-beta` header leltárhoz. | T-000-21 | sonnet | A header vesszővel tagolt értéklistája elemekre bontva rögzítve mind a három futásra, minden eltűnő elemhez megnevezve a vele együtt eltűnő body mező vagy kimondva, hogy nincs ilyen. |
| T-000-23 | Az M-09 futtatása a tool argumentum streaming alakjának megfigyelésére. | T-000-22 | sonnet | A `content_block_start` tool blokk `input` mezője és a rákövetkező delta típusok rögzítve, továbbá kész a bájtszintű összevetés az `sdk-messages.ndjson` és a tool callback által kapott JSON között. |
| T-000-24 | Az M-10 ismételt futásai a `Stop` hook kikényszerítés vizsgálatára, az ismétlésszám a `meta.json`-ban. | T-000-23 | sonnet | Futásonként rögzítve a körszám, a blokkoló `reason` üzenet role értéke a következő kérés `messages` tömbjében, és a `result` üzenet `subtype` értéke. |
| T-000-25 | Az M-11 és M-12 esetek futtatása: `[1m]` suffix kezelés, majd a nem-Messages végpontok leltára. | T-000-24 | sonnet | Az M-11 mindkét futásának `model` mezője szó szerint rögzítve, az M-12-ben minden megkeresett útvonalhoz megvan a HTTP kód és a válasz törzs, plusz a `supportedModels()` visszatérése. |
| T-000-26 | Az M-13 futtatása a kontextusablak és az auto-compact viselkedés megfigyelésére, felső körszám korláttal. | T-000-25 | sonnet | Rögzítve a compact előtti utolsó sikeres válasz `usage.input_tokens` értéke és a vele egyidejű `SDKContextUsage` mezők, vagy a `413` válasz; a leállás oka a `meta.json`-ban. |
| T-000-27 | Az M-15 három futása a prompt caching drótalakjához. | T-000-26 | sonnet | Rögzítve a `cache_control` blokkok száma és szekciója futásonként, valamint a válasz `usage` cache mezőinek értéke az első és a második futásnál. |
| T-000-28 | Az M-16 és M-17 esetek futtatása: kép bemenet, majd szerver oldali tool. | T-000-27 | sonnet | Az M-16-nál a kimenő content block típusa és mezői szó szerint rögzítve, az M-17-nél a `tools` tömb releváns elemének `type` és `name` mezője, mindkettőnél a HTTP kód. |

### F4 fázis: kiértékelés

| ID | Leírás | Függőség | Modell | Elfogadási kritérium |
|---|---|---|---|---|
| T-000-29 | Az M-18 passzív elemzés elvégzése az összes korábbi eset artefaktumából. | T-000-28 | opus | Elkészül a válasz header nevek halmaza, a `retry-after` és a rate limit jellegű headerek jelenléte kimondva, és minden 4xx vagy 5xx válasz törzsének alakja besorolva; 429 hiányában ez explicit `unknown` indoklással. |
| T-000-30 | Teljességi audit: minden M-01 ... M-18 esethez létezik a hétfájlos készlet, vagy a `meta.json`-ban indoklás a reprodukálhatatlanságra. | T-000-29 | opus | 18 sorból álló tábla, minden sor `teljes` vagy `indokolt hiány` állapotú, harmadik állapot nincs; a T-000-14 script nulla kilépési kóddal fut. |
| T-000-31 | Maszkolás audit: a `MINIMAX_API_KEY` értékére és a header maszkolásra futtatott keresés a commitolandó fájlokon. | T-000-30 | sonnet | A kulcs értékére futtatott keresés a `docs/measurements/**` és a `tools/wire-proxy/**` alatt nulla találat, és minden rögzített `authorization` plusz `x-api-key` érték `REDACTED`. |
| T-000-32 | A Q1-Q12 táblázat lezárása: soronként mérési eset azonosító és megfigyelés, vagy explicit `unknown` indoklással. | T-000-30 | opus | 12 sor mindegyike lezárt, minden lezárás konkrét artefaktum útvonalra hivatkozik, tippelt lezárás nincs. |
| T-000-33 | A `ProviderCapabilityDescriptor` típus implementálása a SPEC-000 5. szekció szerinti szerkezetben. | T-000-32 | sonnet | `tsc --noEmit` strict módban hibátlan, a fájlban nincs `any` és nincs `as`, az `isKnown` typeguard exportált. |
| T-000-34 | Típusszintű negatív minták megírása: üres bizonyítéklistás `known` mező, és `isKnown` nélküli `value` olvasás. | T-000-33 | sonnet | Mindkét szándékosan hibás minta fordítási hibát ad, a hibaüzenetek rögzítve, és a minták nem kerülnek a fordítandó termékkódba. |
| T-000-35 | A `minimax` leíró kitöltése a mérési eredményekből, `satisfies` operátorral kapcsolva. | T-000-34 | opus | Minden mező vagy `known` legalább egy bizonyítékkal, vagy `unknown` indoklással és blokkoló mérési eset azonosítóval; a `structuredOutput.defaultStrategy` M-02, M-03 és M-10 eredményére hivatkozik. |
| T-000-36 | Bizonyíték feloldás ellenőrzése: minden `measurement` hivatkozás létező M azonosítóra, minden `doc` elérhető URL-re, minden `research` létező szekcióra mutat. | T-000-35 | sonnet | Feloldatlan hivatkozás nulla darab, a lista és az eredmény kiírva. |
| T-000-37 | Adverzariális review: van-e olyan `known` mező, amit valójában nem támaszt alá rögzített tranzakció vagy dokumentáció. | T-000-36 | opus | Minden `known` mezőhöz megnevezhető a konkrét artefaktum útvonal vagy dokumentációs forrás; ahol nem, a mező `unknown`-ra kerül vissza a review során. |

### F5 fázis: zárás

| ID | Leírás | Függőség | Modell | Elfogadási kritérium |
|---|---|---|---|---|
| T-000-38 | A mérési jegyzőkönyv és a `CLAUDE.md` fájlok frissítése a `docs/measurements/2026-08-26-minimax/`, a `tools/wire-proxy/` és a `scripts/` könyvtárakban. | T-000-37 | sonnet | Mindhárom könyvtárban van naprakész `CLAUDE.md`, a jegyzőkönyv tartalmazza a Q1-Q12 lezáró táblát és a `videoInput` `unknown` indoklását. |
| T-000-39 | Lint, formázás és típusellenőrzés futtatása a token-takarékos wrapper scripteken keresztül. | T-000-38 | sonnet | Mindhárom parancs nulla kilépési kóddal fut, a wrapper kimenete csak összegzést és hibalistát tartalmaz. |
| T-000-40 | Commit a feature branchre, logikai egységenként (eszköz, artefaktumok, típus, dokumentáció). | T-000-39 | sonnet | `git status --porcelain` üres, a `.env` és a proxy napló nincs a commitban, a commit üzenetek a SPEC-000-re hivatkoznak. |
| T-000-41 | PR nyitása a `feat/spec-000-provider-wire-measurement` branchről a `main` ellen. | T-000-40 | sonnet | A PR létrejön, leírása hivatkozik a SPEC-000 6. szekció elfogadási kritériumaira, és felsorolja a nyitva maradt `unknown` mezőket. |

## 3. Mérési esetek végrehajtási sorrendje

Az esetek tartalmát a SPEC-000 4. szekció írja le, itt csak a futtatás rendje szerepel.

| Lépés | Esetek | Egy harness futásban | Külön beállítás igénye |
|---|---|---|---|
| T-000-16 | M-01 | igen | nincs, ez a referencia |
| T-000-17 | M-02, M-03 | igen, két külön `query()` | M-03-hoz in-process MCP szerver, magasabb `maxTurns`, promptot nem nyitó `permissionMode` |
| T-000-18 | M-04 | igen, két `query()` | futásonként eltérő `effort` érték a T-000-5-ben kiolvasott enumból |
| T-000-19 | M-05, M-06 | igen, három `query()` | modellváltás M3 és M2.7 között, plusz `MAX_THINKING_TOKENS=0` az M-06 (b) futásnál |
| T-000-20 | M-07 | igen, négy `query()` | futásonként eltérő env, az egyik futásnál `persistSession: true` |
| T-000-21 | M-08 | igen, öt `query()` | futásonként pontosan egy env változó eltérés az M-01 alaphoz képest |
| T-000-22 | M-14 | igen, három `query()` | az M-08 env deltái közül kettő ismétlődik, de az artefaktumok külön esetazonosító alá kerülnek |
| T-000-23 | M-09 | igen | több argumentumú in-process tool, `includePartialMessages: true` |
| T-000-24 | M-10 | igen, ismételt `query()` hívások | `Stop` hook, `emit_output` tool, felső körszám korlát |
| T-000-25 | M-11, M-12 | igen, három `query()` plusz az M-12 életciklus hívásai | M-12 nem `query()` szintű mérés, hanem indulás, `initializationResult()`, `supportedModels()`, `close()` |
| T-000-26 | M-13 | nem, önálló, hosszú futás | egyetlen session, `persistSession: true`, magas `maxTurns`, felső időkorlát |
| T-000-27 | M-15 | igen, három `query()` szigorúan egymás után | az első két futás azonos system prompttal, közvetlenül egymás után, a harmadik `DISABLE_PROMPT_CACHING=1` mellett |
| T-000-28 | M-16, M-17 | igen, két `query()` | M-16 streaming input módban base64 kép content blokkal, M-17 webkeresést engedő `allowedTools` |
| T-000-29 | M-18 | nincs futás | passzív elemzés az összes korábbi artefaktumból |

Env kezelés: az esetek env deltái a SPEC-000 közös alapbeállítása szerint az `Options.env` mezőn utaznak, tehát alapesetben egy harness processzen belül, futásonként eltérő értékkel adhatók át. Ha a T-000-11 vagy a T-000-21 során kiderül, hogy egy adott változót az SDK nem az `Options.env`-ből olvas, akkor az érintett futás külön processzben, process szintű env változóval megy, és ezt a `meta.json` rögzíti. Ezt nem feltételezzük előre, hanem méréssel döntjük el.

Az M-13 azért önálló, mert hosszú, sok körös session, és a többi eset artefaktumaitól függetlenül kell felső időkorláttal és körszám korláttal futnia. Az M-15 azért nem keverhető más esettel, mert a cache viselkedés a két azonos futás közvetlen egymásutániságától függ.

## 4. Költség és kockázat kezelés

A mérések valós MiniMax API hívások, tehát valós költséget és rate limit terhelést jelentenek.

Költségkorlátozás:

- Rövid promptok. Az alapbeállítás promptja tool nélkül megválaszolható kérdés, a hosszú bemenetet igénylő eseteket (M-13, M-15) kivéve nem növeljük a bemenetet.
- Kimenet korlátozása. A `maxTurns: 1` az esetek többségében egy körre szorítja a beszélgetést. A kimenő token korlát opció pontos nevét és értékkészletét a T-000-5 olvassa ki a telepített SDK típusdefiníciójából; addig konkrét számot nem rögzítünk, mert az tippelés lenne.
- Modellválasztás. Az alapmodell a SPEC-000 szerinti `MiniMax-M2.7`, és csak azok az esetek váltanak `MiniMax-M3`-ra, ahol a spec kifejezetten előírja (M-05, M-11, M-13, M-16). Fölösleges M3 futás nem indul.
- Minden lokálisan ellenőrizhető viselkedést (bájtazonosság, SSE sorrögzítés, maszkolás, időkorlát, harness fájlkészlet) a T-000-9, T-000-10, T-000-11 és T-000-13 lokális echo upstream ellen ellenőriz, valós API hívás nélkül.
- Ismétlés csak akkor, ha az artefaktum hiányos vagy sérült. Sikeres, rögzített tranzakciót nem futtatunk újra.

429 válasz esetén:

- A proxy nem retry-zik, a 429 válasz maga is artefaktum, és a teljes válasz headerkészletével együtt rögzül. Ez az M-18 bemenete.
- Ha a válasz tartalmaz `Retry-After` headert, a következő futás a benne szereplő idő letelte után indul. Ha nincs ilyen header, a futtatás manuálisan, emberi döntéssel folytatódik, mert a szükséges várakozási időre nincs dokumentált szabály, tehát számot nem rögzítünk.
- Szándékos rate limit kimerítést nem végzünk (SPEC-000 7. szekció). Ha a mérés alatt egyáltalán nem keletkezik 429, a `rateLimits` mezők `unknown` állapotban maradnak.
- Ismételt 429 esetén a mérés felfüggeszthető, és a `meta.json`-ban rögzítjük a felfüggesztés okát.

400 válasz esetén:

- A 400 nem hiba, hanem eredmény. Az `error.type` és az `error.message` szó szerint rögzül, és a hozzá tartozó kérdés ezzel lezártnak számít.
- A kérést nem módosítjuk azért, hogy 200-at kapjunk. Ha mégis módosítunk, az új futás új esetazonosítót kap, és az eredeti 400 artefaktum megmarad.
- Először a T-000-15 diffel eldöntjük, hogy a 400-at okozó body mező az SDK-tól vagy a mi eset konfigurációnktól származik. Ha a mi hibánk, a javított futás után a hibát a T-000-9 mintájára teszttel fedjük le a harnessben.

Egyéb kockázatok kezelése: a proxy transzport hatását, az SDK verzió frissítést, a szerver oldali csendes változást, a `[1m]` suffix nyitva maradó CLI kérdését és a timeout beragadást a SPEC-000 7. szekció táblázata kezeli; a terv ezekhez a T-000-13 időkorlátot és a `meta.json` transzport rögzítést rendeli.

## 5. Definition of Done

1. A `tools/wire-proxy/` mérőeszköz egyetlen paranccsal újrafuttatható, és minden mérési esethez létrejön a SPEC-000 3. szekció szerinti fájlkészlet a `docs/measurements/2026-08-26-minimax/M-<n>/` alatt (T-000-8, T-000-11, T-000-30).
2. Mind a 18 mérési esethez van legalább egy rögzített HTTP tranzakció, vagy a `meta.json`-ban indoklás a reprodukálhatatlanságra (T-000-30).
3. A Q1-Q12 táblázat minden sora lezárt: mérési eset azonosítóval és megfigyeléssel, vagy explicit `unknown` státusszal és indoklással (T-000-32).
4. A mérési könyvtárban a `MINIMAX_API_KEY` értékére futtatott keresés nulla találatot ad, és minden rögzített `authorization` plusz `x-api-key` érték `REDACTED` (T-000-31).
5. A `.gitignore` kizárja a proxy naplóját és a `.env` fájlt, a maszkolt artefaktumok viszont commitolva vannak (T-000-4, T-000-40).
6. A `ProviderCapabilityDescriptor` típus strict TypeScript beállítással fordul, nincs benne `any`, nincs `as`, és a leíró `satisfies` operátorral kapcsolódik (T-000-33, T-000-35).
7. A `Fact<T>` `known` ága nem üres bizonyítéklistát követel, és ezt egy szándékosan hibás minta fordítási hibája igazolja (T-000-34).
8. Az `isKnown` typeguard nélkül a `value` mező nem olvasható, ezt a típusellenőrző igazolja (T-000-34).
9. Minden `evidence` elem feloldható létező mérési esetre, elérhető URL-re vagy létező research szekcióra (T-000-36).
10. A kitöltött `minimax` leíróban egyetlen mező sem `known` állapotú méréssel eldöntendő kérdésben, amíg a hozzá tartozó mérés le nem zárult (T-000-35, T-000-37).
11. A `structuredOutput.defaultStrategy` értéke M-02, M-03 és M-10 eredményére hivatkozik, nem feltételezésre; ha mindkét stratégia használhatatlan, a mező `unknown` marad (T-000-35).
12. A `requiredEnv` lista minden eleme M-08 vagy M-14 diff táblázatának egy sorára, vagy a research fájl megerősített tényére hivatkozik (T-000-35).
13. A token-takarékos összefoglaló script létezik, és a 18 esetre futtatva összegzést plusz hibalistát ad, nyers artefaktum tartalom nélkül (T-000-14).
14. A lint, a formázás és a típusellenőrzés nulla kilépési kóddal fut a wrapper scripteken keresztül (T-000-39).
15. Minden érintett könyvtárban naprakész `CLAUDE.md` van (T-000-6, T-000-38).
16. A munka commitolva van a `feat/spec-000-provider-wire-measurement` branchen, és a PR nyitva a `main` ellen, a nyitva maradt `unknown` mezők felsorolásával (T-000-40, T-000-41).
