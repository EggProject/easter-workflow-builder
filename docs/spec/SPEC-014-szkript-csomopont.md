# SPEC-014: A szkript csomópont és a `join` szkript módjának végrehajtása

|          |                                                                                                                                                                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz  | jóváhagyott: a 7.1 szekció O-1 ... O-6 termékkérdése mind lezárva (user döntés 2026-11-04)                                                                                                                                                                        |
| Dátum    | 2026-11-03, átvezetve 2026-11-04                                                                                                                                                                                                                                  |
| Előzmény | [`SPEC-003`](SPEC-003-domain-perzisztencia.md) 4.3, [`SPEC-004`](SPEC-004-vegrehajto-motor.md) 4.7, 5. szekció 10. sora, [`SPEC-008`](SPEC-008-graf-szerkeszto-es-futas-nezet.md) 5.1, O-43, [`SPEC-010`](SPEC-010-sablon-es-kifejezes-nyelv.md) 7. és 8. szekció |
| Bemenet  | [`../research/2026-11-03-szkript-kimenet-ertektipus.md`](../research/2026-11-03-szkript-kimenet-ertektipus.md) 2., 3., 8. és 9. szekció; a hiányleltár H-13 tétele                                                                                                |
| Kimenet  | a `script` node és a `join` `script` mód futtatható, CEL és JavaScript nyelven; a felület tiltása és figyelmeztetése megszűnik                                                                                                                                    |
| Terv     | [`../plan/PLAN-015-szkript-csomopont.md`](../plan/PLAN-015-szkript-csomopont.md)                                                                                                                                                                                  |

---

## 1. Cél és hatókör

A user döntése (SPEC-009 14.6 O-23, 2026-10-26): a szkript csomópont végrehajtása "saját spec, később"; a
mai korlát (a futás elutasítja, a felület tiltja) addig érvényes (user döntés 2026-10-21, "Rövid szöveg",
"Letiltás okkal"). Ez a spec azt írja le, mi kell a végrehajtáshoz.

**A user döntései (2026-11-04), szó szerint:**

- Nyelv: először "Kifejezés nyelv, CEL", majd mivel a hozzáférésre "Hálózatot vagy fájlt is" válaszolt, és ez
  CEL-lel nem megy, a tisztázó kérdésre: "CEL + JavaScript". Mindkettő választható: CEL az egyszerű
  adatműveletekhez, JavaScript, ha hálózat vagy fájl kell.
- Hozzáférés: "Hálózatot vagy fájlt is", kizárólag a JavaScript úton.
- A `join` szkript módja: "Igen, ugyanazzal a nyelvvel", tehát CEL és JavaScript is.
- A JavaScript időkorlátja: "de meg lehessen adni nagyobb idokorlatot mert peldaul automatizalt ellenorzes stb
  is futhat". Alapérték 60 másodperc (iparági alapérték, n8n 3.0, S-9), csomópontonként megadható nagyobb érték.

### Amit eldönt

1. A két futtatót: CEL a meglévő kifejezés kiértékelőn, JavaScript QuickJS WebAssembly sandboxban (5.1, 5.2).
2. Az adat modellt: a `runtime` szerinti diszkriminált unió, a JavaScript ág időkorlát mezővel (5.3).
3. A JavaScript sandbox gazda felületét: hálózat, fájl, és a korlátok (memória, idő) (5.4).
4. A bemenetet, a kimenetet és a hibaosztályokat (5.5 ... 5.7).
5. A motor, a szerkesztő és a futás nézet változását (5.8, 5.9).
6. A biztonsági kockázatokat, kimondva (5.10).

### Amit NEM dönt el

- A CEL kiértékelési idő korlátját: a SPEC-010 O-2 user döntése ("most nincs korlát") érvényes, a 60
  másodperces korlát kizárólag a JavaScript útra szól.
- A fájl hozzáférés könyvtárát és a hálózat címkészletét a user döntötte el (O-5: csomópontonként megadott
  könyvtár, üresen a szerver munkakönyvtára; O-6: bármely cím, a helyi gépet is); a spec ezeket a döntéseket
  vezeti át.
- Új provider vagy agent képesség: a szkript nem AI lépés, provider hívás nincs.

## 2. Kiindulási állapot

| Réteg      | Mai állapot                                                                                                                                           | Hely (`bbed64c`)                                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db`       | `ScriptConfig { source: string; runtime: 'expression' }`, a `script` node és a `join` `script` mód tárolható                                          | `packages/db/src/workflow-graph/node-config/script-config.ts:7-10`; `node-config.ts:80-85, 160-166`                                               |
| `protocol` | `ScriptConfigSchema` `z.literal('expression')` futásidővel                                                                                            | `packages/protocol/src/node-config/script-config.ts:7-12`                                                                                         |
| `engine`   | a futás indítása `unimplemented_node_type` hibát ad; a diszpécserben nincs `script` ág, mert a validáció típusszinten szűkít (`ExecutableNodeConfig`) | `packages/engine/src/run-validation/validate-implemented-node-types.ts:10-56`                                                                     |
| `apps/web` | a kártya rövid figyelmeztetése, a panel `role="alert"` mondata, a "Futás indítása" gomb tiltása okkal                                                 | `apps/web/src/node-inspector/ScriptNodeFields.tsx:24-45`; `apps/web/src/graph-editor/GraphEditorScreen.tsx:252, 737, 821`                         |
| CEL        | hét név a környezetben, köztük a `joinInputs`; a `branch` a befecskendezett `expressionEvaluator` porton értékel ki                                   | `packages/workflow-language/src/cel-expression/run-context-variable-names.ts:7-15`; `packages/engine/src/node-executor/execute-branch.ts:125-131` |
| `engine`   | az agent lépés `cwd` és `additionalDirectories` mezője a fájl hozzáférés meglévő mintája                                                              | `packages/db/src/workflow-graph/agent-step-config/agent-step-config.ts:73-74`                                                                     |

A `runtime: 'expression'` jelentése mostantól kimondva: a CEL kifejezés nyelv (SPEC-010). Az érték neve nem
változik, mert a pillanatkép és a sodródás védelem már erre áll, és a változtatás nem adna információt.

## 3. Megerősített tények

A teljes forráslista a research 3. szekciójában (S-1 ... S-12) és 8. szekciójában (J-1 ... J-16). A
döntéshez szükséges kivonat:

- A `node:vm` hivatalosan nem biztonsági mechanizmus (S-1); a Node permission model "seat belt", és a
  hálózatra csak be vagy ki kapcsolható (S-2, J-11).
- Az `isolated-vm` karbantartási módban van, natív buildet igényel (S-4, S-5).
- A `quickjs-emscripten` 0.32.0 WebAssembly alapú, natív build nélküli; az alap változat a bellard QuickJS-t
  használja (J-1, J-2). A kontextusban nincs `fetch`, időzítő, `require` és fájlrendszer, mindent a gazda tesz
  be (J-4, J-5). A memória korlátot a gazda állítja, alapból nincs korlát, túllépéskor a sandboxban
  `InternalError` keletkezik, nem folyamatleállás (J-7). Mérve (PLAN-015 T-015-2, `../research/2026-11-04-szkript-csomopont.md` Q-4): a
  `setMemoryLimit` ebben a buildben foglalásonként 8 bájtot számol, nem a foglalt méretet, és a tényleges plafon a
  modul 2048 MB-os WebAssembly memóriája; a 7.2 T-3 sora. A modul saját `WebAssembly.Memory`-val 16 ... 2048 MB
  maximummal példányosítható, e fölött `LinkError` (Q-9).
- Az interrupt kezelő csak futó bytecode alatt hívódik, tehát egy gazda ígéretre váró szkriptet nem állít
  meg (J-6; mérve: a várakozás alatt nulla kezelő hívás, `../research/2026-11-04-szkript-csomopont.md` Q-2).
- Az asyncify változat egyszerre csak egy felfüggesztett hívást bír, és kontextusonként új WebAssembly modult
  épít; az ígéret alapú út az alap modulon fut (J-3).
- A Deno permission rendszere a hivatalos doksi szerint nem egyetlen védelmi réteg nem megbízható kódra, és a
  bináris 80-96 MB (J-9, J-10).
- Iparági minta: az n8n a Code node modul importját alapból tiltja, és a felhasználó által írt kódot külön
  folyamatban futtatja (J-12); a Windmill a fájl hozzáférést a job könyvtárára szűkíti (J-13).
- Iparági memória alapérték: 128 MB (Cloudflare Workers izolátum, AWS Lambda alapérték, az `isolated-vm`
  alapértéke, J-14).
- A Node `setTimeout` 2147483647 ms fölötti késleltetést 1 ms-re állít (J-16).

## 4. Fogalmak

- **Szkript lépés**: a `script` node egy lefutása, vagy a `join` node `script` módú lefutása.
- **Futás kontextus**: a SPEC-010 7.3 `RunContext` hét neve (`input`, `steps`, `item`, `itemIndex`,
  `iteration`, `joinInputs`, `error`).
- **Gazda függvény**: a motor által a JavaScript sandbox globális objektumára tett függvény (hálózat, fájl).

## 5. Döntések

### 5.1 Izoláció: ami kizárt, forrásból

| Megoldás                           | Döntés | Indok                                                                                                                                |
| ---------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `node:vm`                          | kizárt | a Node doksi szerint nem biztonsági mechanizmus, az időkorlát megkerülhető (S-1)                                                     |
| Node permission model alfolyamaton | kizárt | "seat belt", nem véd rosszindulatú kód ellen (S-2); a hálózat csak be vagy ki kapcsolható, cím szerinti szűrés nincs (J-11)          |
| `worker_threads` önmagában         | kizárt | csak heap és stack korlát, fájlrendszer és hálózat izoláció nincs dokumentálva (S-3)                                                 |
| `isolated-vm`                      | kizárt | karbantartási mód, natív build, a folyamat leállhat memória túllépésnél (S-4, S-5)                                                   |
| Deno alfolyamat                    | kizárt | 80-96 MB külső bináris, glibc platformokra; a doksi szerint több védelmi réteg kell; az `--allow-run` megkerülő út (J-9, J-10, J-13) |
| Docker vagy más konténer           | kizárt | projekt szabály (`.claude/CLAUDE.md` 7. szekció)                                                                                     |

### 5.2 A két futtató

| Szempont       | CEL (`runtime: 'expression'`)                                                                      | JavaScript (`runtime: 'javascript'`)                                                                                                                                                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Futtató        | a meglévő `expressionEvaluator` port (`@marcbachmann/cel-js`, SPEC-010)                            | új `scriptRunner` port, megvalósítása az `apps/server` oldalon `quickjs-emscripten` alap (szinkron) változattal, az `expressionEvaluator` mintájára (SPEC-004 3.2)                                                                                                                  |
| Új függőség    | nincs                                                                                              | `quickjs-emscripten-core` és `@jitl/quickjs-wasmfile-release-sync` `0.32.0` (a teljes `quickjs-emscripten` helyett, `../research/2026-11-04-szkript-csomopont.md` 3. szekció), pinelve, a toolchain research fájlba vezetve, két forrásból (`.claude/CLAUDE.md` 4. szekció 4. pont) |
| Mit ér el      | kizárólag a futás kontextust (S-12, nyelvi garancia)                                               | a futás kontextust, a `fetch` és a `files` gazda függvényt (5.4); `require`, `process`, időzítő, modul betöltő nincs                                                                                                                                                                |
| Időkorlát      | nincs (SPEC-010 O-2): a szinkron kiértékelés alatt a szerver mást nem szolgál ki, kimondott korlát | alapérték 60 000 ms, csomópontonként felülírható (5.3, 5.4)                                                                                                                                                                                                                         |
| Memória korlát | a parse idejű `limits` alapértékei (SPEC-010 M-125)                                                | lépésenként friss WebAssembly modul saját `WebAssembly.Memory` maximummal, csomópontonként beállítható (`memoryLimitMb`), alapból a teljes rendszermemória, legfeljebb a modul 2048 MB-os plafonja (5.4, user döntés 2026-11-04)                                                    |
| Aszinkron kód  | nincs                                                                                              | a gazda függvények ígéretet adnak (`newPromise`), a szkript `await`-tel használja; a futtató az ígéret alapú utat használja, nem az asyncify változatot (J-3)                                                                                                                       |

Az asyncify változat elvetésének oka: egyszerre egy felfüggesztett hívás, és kontextusonként új WebAssembly
modul (J-3); párhuzamos ágakon egyszerre több szkript lépés futhat (SPEC-004 7.2), és egy szkript több
gazda hívást is indíthat egyszerre (`Promise.all`).

### 5.3 Adat modell

- `db`: a `ScriptConfig` diszkriminált unió lesz a `runtime` mezőn:
  `{ runtime: 'expression'; source: string }` vagy
  `{ runtime: 'javascript'; source: string; timeoutMs: number | null; cwd: string | null; memoryLimitMb: number | null }`.
  A `timeoutMs` `null` jelentése az alapérték (60 000 ms), a `null` a meglévő konvenció a hiányra (az `undefined`
  nem éli túl a JSON oszlopot, `agent-step-config.ts` `PresetSystemPrompt` doksija).
- A `cwd` a fájl hozzáférés gyökere (O-5), az agent lépés `cwd` mezőjének mintájára; a `null` a szerver folyamat
  munkakönyvtára. A mező nem kötelező szöveg mező: üresen is menthető.
- A `timeoutMs` pozitív egész, legfeljebb 2147483647 (J-16: a Node időzítő e fölött 1 ms-re állítana, tehát a
  korlát azonnal lejárna). A pozitív egész szabály a meglévő `isPositiveInteger` és a mentési séma duplikátuma
  szerint, a felső határral bővítve, mindkét oldalon, az `apps/server` `node-config-drift-protection`
  témájában mezőnként futásidejű ággal (`.claude/CLAUDE.md` 5. szekció, O-37 precedens).
- A `memoryLimitMb` a lépés memória korlátja egész MB-ban (1 MB = 1024 * 1024 bájt); a `null` az alapérték (5.4
  "Memória"). Egész, legalább 16 és legfeljebb 2048: a pinelt modul ezen kívül nem példányosítható (research Q-9). A
  szabály mindkét oldalon áll (`db` guard és `protocol` mentési séma), az `apps/server` `node-config-drift-protection`
  témájában mezőnként futásidejű ággal, a `timeoutMs` mintájára; a tartományon kívüli érték a mentéskor a mező alatti
  hibát ad.
- A user kérése a nagyobb érték megadhatósága; a szabály a kisebb értéket sem tiltja, mert a pozitív egész
  szabály a projektben minden időkorlát mezőn ugyanaz, és egy alsó határra nincs forrás.
- Zárt kulcslista mindkét ágra (`isRecordWithKnownKeys`, `z.strictObject`), a `protocol` oldalon
  `z.discriminatedUnion('runtime', ...)` (`.claude/CLAUDE.md` 5. szekció).
- A `GRAPH_DOCUMENT_VERSION` nem nő: tárolt adat nincs (user, korábban: "nincs meg adatbazis!!!! nincs mit
  migralni!!"), a commitolt v1 pillanatkép fixtúrában nincs `script` node, és a `runtime: 'expression'` ág alakja
  változatlan (SPEC-003 5.2).

### 5.4 A JavaScript sandbox gazda felülete

**Életciklus.** Szkript lépésenként új WebAssembly modul, benne új QuickJS runtime és kontextus, a lépés végén (siker,
hiba, időkorlát) felszabadítva (`dispose`), a modul eldobva (user döntés 2026-11-04, "friss motor lepesenkent"). Egy
lépés állapota nem szivároghat át a következőbe. A futás indításának fordítási ellenőrzése is saját, eldobott modulon
fut. A lebontás hibája (a `JS_FreeRuntime` assertje, research Q-2, Q-3) elkapott, és a lépés eredményét nem
változtatja meg, mert a modul úgyis eldobott.

**Globális nevek.** A futás kontextus hét neve (5.5), plusz `fetch` és `files`. Semmi más nem kerül a globális
objektumra (J-4, J-5); a `console` sem, mert a lépés kimenete a visszatérési érték, a napló nem része a
specnek. A QuickJS `eval` intrinsic a kontextusban marad (J-5): csak a sandbox saját kódjára hat.

**A szkript alakja.** A `source` egy aszinkron függvény törzse; a `return` értéke a kimenet. A futtató a
törzset `async` függvénybe csomagolja, az ígéretet a `resolvePromise` úton olvassa ki, és a függő feladatokat
`executePendingJobs` hívással futtatja (J-3).

**Hálózat.** `fetch(url, { method, headers, body })` ígéretet ad `{ status, headers, body }` alakú válaszra,
ahol a `body` szöveg. A gazda a Node beépített `fetch`-ét hívja, a lépés határidejéhez kötött `AbortSignal`-lal.
Kizárólag `http:` és `https:` séma (az OWASP SSRF lap szerint a nem HTTP sémák külön kockázatot hordoznak,
J-15). Átirányítás követése nincs (`redirect: 'manual'`, J-15); a szkript a `status` és a `location` fejléc
alapján maga dönt. Címszűrés nincs (O-6 user döntés): a szkript bármely címet elérhet, a helyi gépet is. A második
argumentum csak a `method`, a `headers` (szöveg értékek) és a `body` (szöveg) mezőt tartalmazhatja, más kulcs
`TypeError`; a válasz `headers` mezője a `Headers` bejárása kisbetűs névvel. A kérés a kérés jelén és a lépés végén
(határidő, lebontás) szakad meg, a jel után érkező eredmény a sandboxot nem érinti (research
`2026-11-04-szkript-csomopont.md` 9.1).

**Fájl.** `files.readText(path)`, `files.writeText(path, text)`, `files.list(path)`, mindegyik ígéretet ad. A
`path` relatív a hozzáférés gyökeréhez, ami a JavaScript ág `cwd` mezője, üresen a szerver folyamat
munkakönyvtára (O-5 user döntés). A gazda a feloldott útvonalat `path.resolve` után a gyökér
előtagjára ellenőrzi (a gyökér végén útvonal elválasztóval), majd `fs.realpath` után újra, hogy egy szimbolikus
link ne vezessen ki (J-15); a gyökéren kívüli út `script_evaluation_failed` hibát ad a sandboxban. Ez a
szintaktikai ellenőrzés nem véd az ellenőrzés és a használat közötti linkcsere ellen (TOCTOU, nem ellenőrzött
forrással, 5.10). Az abszolút `path` a gyökér alatt is elutasított; az írás létező célnál a cél, nem létezőnél a
szülő könyvtár `fs.realpath` alakját ellenőrzi, és az új fájlt `wx` jelzővel hozza létre, ami a függő szimbolikus
linkre is hibát ad. A `list` a bejegyzések nevét adja. A hibaüzenet a szkript saját útvonalát és a Node hibakódot
mondja (`a fájl művelet nem sikerült (ENOENT): a.txt`), a gazda abszolút gyökerét nem (research 9.1 7. pont).

**Időkorlát.** A határidő a lépés indulásától számít, `timeoutMs` vagy 60 000 ms. Két ága van, mert az
interrupt kezelő a gazda ígéretre várakozás alatt nem fut (J-6): (1) CPU kötött kódra
`setInterruptHandler(shouldInterruptAfterDeadline(...))`; (2) a gazda oldalon egy, a határidőre beállított
`AbortSignal.timeout` megszakítja a folyamatban lévő gazda hívásokat és a teljes kiértékelés várakozását. Bármelyik
ág lejár, a lépés `script_timed_out` osztállyal bukik, és a runtime felszabadul.

**Memória.** A user döntése (2026-11-04), szó szerint: "friss motor lepesenkent es lehessen beallitani, de default
teljes rendszermemoria". A korlát a lépés saját `WebAssembly.Memory` objektumának maximuma
(`new WebAssembly.Memory({ initial: 256, maximum })`, átadva a `newVariant(variant, { wasmMemory })` úton, research
Q-5): a foglalás a maximumnál megáll, a sandboxban `InternalError: out of memory` jön, amit a szkript elkaphat; ha nem
kapja el, a lépés `script_evaluation_failed`. A gazda folyamat és a többi lépés nem érintett. A `setMemoryLimit` nem
használt, mert ebben a buildben nem bájtkorlát (research Q-4).

- A maximum a csomópont `memoryLimitMb` mezője, MB-ban, 16 ... 2048 (5.3).
- Üresen (`null`) a teljes rendszermemória (`os.totalmem()`), de legfeljebb a modul plafonja (2048 MB): a kettő közül a
  kisebb, lefelé kerekítve egész MB-ra. A plafont a pinelt modul import deklarációja adja, e fölötti maximummal a modul
  nem példányosítható (research Q-9), tehát a teljes rendszermemória a gyakorlatban legfeljebb ennyi.
- A 2048 fölötti vagy 16 alatti beállított érték a mentéskor a mező alatti hibát ad (5.9); a motor a guard miatt ilyen
  értéket nem kap.

**Stack.** `setMaxStackSize(131072)` (user döntés 2026-11-04: "Közepes, kb. 740 szint", research Q-6: 742 rekurziós
mélység). Ezen az értéken a mért esetek többsége (rekurzió, sok argumentum, `JSON.parse`, getter, Proxy, `toString`) a
sandboxban `RangeError`-t ad, amit a szkript elkaphat; a mély forrás elemzés és a mély `JSON.stringify` a gazdán
(`RangeError: Maximum call stack size exceeded`) bukik. A gazdára kijutó `RangeError` a lépés `script_evaluation_failed`
hibája, és a modult eldobjuk.

**Párhuzamosság.** A szkript lépés nem foglal párhuzamossági helyet (nincs provider hívás, SPEC-004 7.2). A
QuickJS a gazda szálán fut, tehát a CPU kötött szkript a 60 másodperces határig az eseményhurkot foglalja:
kimondott korlát, ugyanúgy, mint a CEL lassú kifejezésénél (SPEC-010 O-2).

### 5.5 Bemenet

A szkript a futás kontextus hét nevét látja, ugyanazzal a leképezéssel, mint a `branch` kifejezése
(SPEC-010 7.3); a JavaScript úton a nevek a sandbox globális objektumán JSON értékként állnak (a gazda a JSON
szöveget a kontextusban értelmezi, nem objektum hivatkozást ad át). A `join` `script` módban a `joinInputs` a
beérkezett ág kimenetek listája, ugyanaz a lista, amit a `merge` mód kimenetként ad (SPEC-004 5.6). A `script`
node-nál a `joinInputs` hiányzó név, mint minden nem `join` csomópontnál (SPEC-010 7.3 táblázata).

### 5.6 Kimenet

A szkript eredménye a lépés kimenete, a SPEC-010 7.4 normalizálás szerint. A JavaScript úton a visszatérési
értéket a sandboxban `JSON.stringify` alakítja szöveggé, a gazda `JSON.parse`-szal olvassa vissza; ha az érték
nem JSON (függvény, `undefined`, körkörös hivatkozás, `BigInt`), a lépés `script_output_not_json` osztállyal
bukik. A tárolási korlát a meglévő `step_output_not_storable` (SPEC-010 O-21) mindkét úton. A lépés után a
vezérlés a csomópont egyetlen névtelen kimenő élén megy tovább (SPEC-008 5.1 táblázata).

### 5.7 Hibaosztályok

| Eset                               | CEL                                                                                                                 | JavaScript                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| fordítási hiba a futás indításakor | a meglévő nyelvi mező ellenőrzés (`validateLanguageFields`), ugyanazzal az osztállyal, mint a `branch` kifejezésnél | új osztály: `script_compile_failed` (a törzs a QuickJS-ben lefordul-e, futtatás nélkül)                                                    |
| futásidejű hiba                    | `expression_evaluation_failed` (meglévő)                                                                            | új osztály: `script_evaluation_failed` (dobott kivétel, gyökéren kívüli út, el nem kapott memória túllépés, a gazdára kijutó `RangeError`) |
| időkorlát                          | nincs (SPEC-010 O-2)                                                                                                | új osztály: `script_timed_out`                                                                                                             |
| nem JSON kimenet                   | nem fordulhat elő (a CEL értéke JSON leképezhető, SPEC-010 7.4)                                                     | új osztály: `script_output_not_json`                                                                                                       |
| tárolhatatlan kimenet              | `step_output_not_storable` (meglévő)                                                                                | ugyanaz                                                                                                                                    |

A `script_compile_failed` REST hiba is (a futás indítása utasítja el), tehát a `protocol` `ProtocolErrorClass`
szótárába és a kliens magyar mondatai közé kerül, az `error-class-drift-protection` téma őrzésével
(`.claude/CLAUDE.md` 5. szekció, SPEC-005 8.5). A másik három lépés szintű osztály a motor uniójában áll, és a
`handledErrorKinds` szűrő (SPEC-004 8.2) név szerint kezelheti őket.

### 5.8 Motor

- A `validateImplementedNodeTypes` a `script` node-ot és a `join` `script` módot többé nem utasítja el; az
  `unimplemented_node_type` osztály más típusra ma nem keletkezik, tehát a guard ága és a hibaosztály a 100
  százalékos lefedettség miatt törlendő, vagy kimondott okkal megtartandó (a halott ág tilalma,
  `.claude/CLAUDE.md` 5. szekció). A PLAN-015 T-015-4 dönti el a kód olvasásával.
- A diszpécser új `script` ága és a `join` beágyazott `switch`-ének `script` ága egy közös végrehajtót hív,
  ami a `runtime` szerint kimerítő `switch`-csel választ a két port között.
- A futás indításának ellenőrzése a JavaScript `source` fordítását a `scriptRunner` port fordító műveletén
  futtatja (`script_compile_failed`), a CEL `source` a meglévő nyelvi mező ellenőrzésen megy.
- A `fail_run` és a megszakítás a futó szkript lépést a határidő `AbortSignal`-jának megfelelő jellel állítja
  le; a lépés `cancelled` állapotban zár, ugyanúgy, mint a sorból kivett testvér.

### 5.9 Felület

- A kártya figyelmeztetése (O-43), a panel `role="alert"` mondata és a "Futás indítása" gomb tiltása okkal
  megszűnik.
- A `runtime` választó a meglévő `SelectField` ("CEL kifejezés", "JavaScript"), a `source` mező a meglévő
  `TextAreaField` (design system `.textarea`, `.claude/CLAUDE.md` 11. szekció). JavaScript esetén megjelenik az
  időkorlát mező (`TextField` `type="number"`, másodpercben, mert a döntés is másodpercben szól (O-4); a tárolt
  érték ezredmásodperc, a mező értékének ezerszerese), üresen az alapérték (`null`). A felületen ma nincs
  `timeoutMs` mező, tehát nincs követendő minta. JavaScript esetén a "Munkakönyvtár (cwd)" `TextField` is
  megjelenik (az agent lépés mintájára), üresen `null`. JavaScript esetén a "Memória korlát (MB)" `TextField`
  `type="number"` is megjelenik, üresen `null` (alapérték: a rendszermemória, legfeljebb 2048 MB); a 16 ... 2048
  tartományon kívüli érték a mentéskor a mező alatti hibát ad.
- A mentési séma a `source` mezőt a kötelező szöveg mezők közé veszi fel (a meglévő `required-text-field-paths`
  tábla mindkét oldalon, a sodródás védelemmel), mert üres szkript nem futtatható. A hiba a mező alatt.
- A futás nézet a szkript lépést a meglévő csomópont állapot jelvényekkel mutatja; új transcript sor típus
  nem kell, mert a lépés nem ad SDK eseményt.

### 5.10 Biztonsági kockázatok, kimondva

1. **A sandbox határa a WebAssembly és a QuickJS.** A wrapperre nincs ismert CVE (J-8), de a README szerint nem
   auditált, és a QuickJS motorban (a quickjs-ng ágon 2026-ban több kritikus és magas súlyú) memóriabiztonsági
   hibák voltak (J-8). Hogy egy motor hiba a WebAssembly lineáris memóriájában marad-e, nem ellenőrzött.
   Ellensúly: a szkriptet a workflow készítő írja, az agent kimenet csak adatként (JSON) jut be, kódként nem.
2. **A hálózat a szerver hálózati helyzetéből indul.** A szkript elérheti a helyi szolgáltatásokat, a saját
   szerverünket (`3001`) és belső címeket (SSRF, J-15). Egy agent kimenetéből (prompt injekció) összerakott URL
   ezt kihasználhatja. A címszűrés hiánya az O-6 user döntése, a kockázat kimondott és elfogadott.
3. **A fájl hozzáférés írni is tud.** A gyökér alatt a szkript felülírhat bármit, és a szintaktikai ellenőrzés
   nem véd a TOCTOU linkcsere ellen (5.4). A gyökér az O-5 user döntése szerint csomópontonként megadott
   (`cwd`), üresen a szerver munkakönyvtára; a kockázat kimondott és elfogadott.
4. **Titok.** A gazda `fetch` nem ad hozzá hitelesítő fejlécet és sütit, és a környezeti változók nem érhetők el
   a sandboxból (nincs `process`). A szerző saját figyelmeztetése szerint egy hitelesített gazda `fetch`
   kiadása a sandbox értelmét veszi el (J-4).
5. **Szolgáltatás kiesés.** A CPU kötött szkript a határidőig az eseményhurkot foglalja (5.4), a nagyobb
   `timeoutMs` ezt arányosan növeli. A memória alapértéke a rendszermemória (legfeljebb 2048 MB) lépésenként: több
   párhuzamos szkript lépés együtt a gép memóriáját meghaladó foglalást kísérelhet meg (a user döntése az alapértékről,
   kimondott kockázat).

## 6. Tesztelés

- Unit: a végrehajtó mindkét futtatóval (siker, hiba), a `join` `script` mód a `joinInputs` listával, a
  tárolási korlát, a futás indítás ellenőrzés (fordítási hiba mindkét nyelven).
- JavaScript futtató: időkorlát CPU kötött kódra és gazda ígéretre váró kódra (mindkét ág), memória túllépés,
  nem JSON kimenet, a globális objektum kulcslistája (csak a hét név, `fetch`, `files` és a nyelvi beépítettek),
  gyökéren kívüli út (`..`, abszolút út, szimbolikus link), átirányítás nem követése, nem HTTP séma elutasítása.
  A hálózat helyi `node:http` szerverrel, a fájl ideiglenes könyvtárral; valódi külső hívás nincs.
- Valós `:memory:` adatbázis, hamis agent nélkül is futtatható, mert provider hívás nincs.
- e2e: a szerkesztő tiltása megszűnik, a `runtime` választó, az időkorlát mező, a `source` kötelező mező hibája
  a mező alatt; `page.route()` mockkal.
- Valódi API hívás nem kell.

## 7. Nyitott kérdések

### 7.1 Termékdöntések (user)

| #   | Kérdés                                        | Döntés vagy opciók                                                                                                                               | Mi a viselkedés addig | Mi zárná le |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- | ----------- |
| O-1 | Milyen nyelven írja a felhasználó a szkriptet | **lezárva** (user döntés 2026-11-04): "CEL + JavaScript", mindkettő választható                                                                  |                       |             |
| O-2 | Mit érhet el a szkript                        | **lezárva** (user döntés 2026-11-04): "Hálózatot vagy fájlt is", csak a JavaScript úton                                                          |                       |             |
| O-3 | Kell-e a `join` `script` módja                | **lezárva** (user döntés 2026-11-04): "Igen, ugyanazzal a nyelvvel"                                                                              |                       |             |
| O-4 | JavaScript időkorlát                          | **lezárva** (user döntés 2026-11-04): 60 másodperc alapérték, csomópontonként nagyobb megadható ("de meg lehessen adni nagyobb idokorlatot ...") |                       |             |
| O-5 | Melyik könyvtárat érheti el a fájl hozzáférés | **lezárva** (user döntés 2026-11-04): (a) csomópontonként megadott könyvtár, üresen a szerver munkakönyvtára ("Csópontonként megadott")          |                       |             |
| O-6 | Milyen címeket érhet el a hálózat             | **lezárva** (user döntés 2026-11-04): (a) bármely cím, a helyi gépet is ("Bármit, a helyi gépet is")                                             |                       |             |

### 7.2 Technikai, nyitva

| #   | Kérdés                                                                           | Mi a viselkedés addig                                                                                                                                                                                                                                                                                                                                                                                 | Mi zárná le                                                                                                 |
| --- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| T-1 | A QuickJS memória korlát értéke                                                  | **lezárva**: a 128 MB-os `setMemoryLimit` helyett lépésenként friss modul saját `WebAssembly.Memory` maximummal, csomópontonként beállítva, alapból a rendszermemória, legfeljebb 2048 MB (user döntés 2026-11-04, 5.4 "Memória")                                                                                                                                                                     |                                                                                                             |
| T-2 | Az interrupt kezelő gazda ígéretre várakozás alatt (S-7, J-6)                    | **lezárva** (mérés, `../research/2026-11-04-szkript-csomopont.md` Q-1 ... Q-3, 5. szekció): a várakozás alatt a kezelő nem fut, a gazda oldali `AbortSignal` ág kell; a CPU kötött kód és a mikrofeladat lánc a határidőn megáll; a tiszta lebontáshoz minden handle (a függő `deferred` is) felszabadítandó, és a megszakított `then` lánc után a `dispose` assertet adhat, ezért a hibája elkapandó |                                                                                                             |
| T-3 | A WebAssembly modul szintű memória plafon és a mély rekurzió hatása (J-8)        | **lezárva** (mérés: research Q-4 ... Q-6, Q-9; user döntés 2026-11-04, research 6. szekció): memória az 5.4 "Memória" pontja szerint (friss modul lépésenként, beállítható, alapból a rendszermemória, legfeljebb a 2048 MB-os modul plafon); stack `setMaxStackSize(131072)` ("Közepes, kb. 740 szint"), a gazdára kijutó `RangeError` a lépés `script_evaluation_failed` hibája, a modul eldobva    |                                                                                                             |
| T-4 | A pinelt bellard QuickJS változat érintett-e a quickjs-ng 2026-os hibáiban (J-8) | **mérve, kimondott korláttal nyitva** (`../research/2026-11-04-szkript-csomopont.md` 4. szekció): a pin (`f1139494`, 2025-12-22) legalább két, az ng advisory-kkal azonos függvényt érintő hibát tartalmaz, amit a bellard repó a pin után javított, és újabb `quickjs-emscripten` kiadás nincs; hogy a hiba a lineáris memórián belül marad-e, nem ellenőrzött (5.10 1.)                             | egy újabb pint hozó `quickjs-emscripten` kiadás, vagy a lineáris memórián belül maradás forrásolt igazolása |

## 8. Elfogadási kritériumok

1. A `script` node és a `join` `script` mód mindkét nyelven futtatható, a futás indítása nem ad
   `unimplemented_node_type` hibát; az `unimplemented_node_type` sorsa (törlés vagy megtartás) kimondva és
   tesztelve.
2. A szkript a futás kontextus hét nevét a SPEC-010 7.3 leképezéssel látja; a `join` `script` módban a
   `joinInputs` a `merge` móddal azonos lista.
3. A szkript eredménye a lépés kimenete, a SPEC-010 7.4 normalizálással; a nem JSON JavaScript kimenet
   `script_output_not_json`, a korlát fölötti kimenet `step_output_not_storable`.
4. A fordítási hiba a futás indításakor, a futásidejű hiba a lépésen jelentkezik, az 5.7 táblázat osztályaival;
   a `script_compile_failed` a `protocol` szótárában és a kliens magyar mondatai között, a drift védelemmel.
5. A CEL szkript nem ér el fájlrendszert és hálózatot (nyelvi garancia); a JavaScript sandbox globális
   objektumán csak az 5.4 nevei állnak (unit teszt a kulcslistára).
6. A JavaScript lépés a határidőn (alapból 60 000 ms, a `timeoutMs` szerint felülírva) `script_timed_out`
   osztállyal bukik, CPU kötött és gazda ígéretre váró kódra is; a `timeoutMs` pozitív egész, legfeljebb
   2147483647, mindkét oldalon, a sodródás védelemmel.
7. A memória korlát a lépés saját `WebAssembly.Memory` maximuma (`memoryLimitMb`, alapból a rendszermemória, legfeljebb
   2048 MB, 16 ... 2048 mindkét oldalon a sodródás védelemmel); a túllépés és a gazdára kijutó `RangeError` a lépés
   hibája, a szerver folyamat fut tovább (unit teszt); a `setMaxStackSize` 131072.
8. A fájl és a hálózat gazda függvénye az O-5 és az O-6 user döntése szerint működik (a gyökér a `cwd`, címszűrés nincs); a gyökéren kívüli út és a
   szimbolikus link kivezetése elutasítva, átirányítás nincs követve, csak `http:` és `https:`.
9. A szerkesztő tiltása és figyelmeztetése megszűnt; `runtime` választó, időkorlát mező; a `source` kötelező
   mező a mentéskor, a hiba a mező alatt; a sodródás védelem mindkét oldalon.
10. A `quickjs-emscripten` verziója pinelve, a toolchain research fájlban két forrással.
11. Kilenc kapu zöld, unit lefedettség 100 százalék, e2e küszöb nem romlik.
12. A SPEC-003 4.3, SPEC-004 4.7 és 5. szekció, SPEC-008 5.1 és O-43, a csomagok `CLAUDE.md` fájljai és a
    hiányleltár H-13 sora átvezetve.

## 9. Kapcsolódó dokumentumok

- [`../plan/PLAN-015-szkript-csomopont.md`](../plan/PLAN-015-szkript-csomopont.md)
- [`../research/2026-11-03-szkript-kimenet-ertektipus.md`](../research/2026-11-03-szkript-kimenet-ertektipus.md)
- [`SPEC-010-sablon-es-kifejezes-nyelv.md`](SPEC-010-sablon-es-kifejezes-nyelv.md)
