# Szkript csomópont: a QuickJS blokkoló mérései és a verzió pin (SPEC-014, PLAN-015)

Dátum: 2026-11-04. Lépés: PLAN-015 T-015-2. Spec: [`../spec/SPEC-014-szkript-csomopont.md`](../spec/SPEC-014-szkript-csomopont.md),
terv: [`../plan/PLAN-015-szkript-csomopont.md`](../plan/PLAN-015-szkript-csomopont.md). Ez a terv saját research fájlja:
a további lépések saját szekcióban ide vezetik a méréseiket és döntéseiket.

## 1. Módszer

**Futtatókörnyezet.** Node `v26.7.0`, Bun `1.4.0`, Linux sandbox, 4 CPU, 3906 MB memória, swap nélkül.

**Csomagok.** `quickjs-emscripten-core@0.32.0` és `@jitl/quickjs-wasmfile-release-sync@0.32.0` (a tranzitív
`@jitl/quickjs-ffi-types@0.32.0`-val), a repón kívüli eldobható könyvtárba telepítve
(`bun add quickjs-emscripten-core@0.32.0 @jitl/quickjs-wasmfile-release-sync@0.32.0`). A repó függőségei
változatlanok: a felvétel a T-015-6 lépése. A verzió és a csomag választás indoka a 3. szekcióban.

**A próbák.** A [`2026-11-04-szkript-csomopont/`](2026-11-04-szkript-csomopont/) mappában, a bizonyíték előállító
eszköz a repóban (szabálykönyv 12. szekció). Minden próba külön Node folyamat (`node q<n>-*.mjs`), mert több próba a
WebAssembly modult szándékosan hibára futtatja. A `futtat.sh` a telepített könyvtárba másolva sorban lefuttatja
mindet, és a `MEASUREMENT` sorokat a `kimenet.jsonl` fájlba gyűjti (a commitolt kimenet a 2026-11-04-i futásé, első
sora a környezet). A számok egy futásból valók; ahol a jelenség ingadozik, a próba ismétel (Q-3c, Q-3d).

**Forrásolvasás.** A pinelt bellard QuickJS forrása a variáns README-je szerinti commiton
(`f1139494d18a2053630c5ed3384a42bb70db3c53`, <https://github.com/bellard/quickjs>), a wrapper C rétege
(`c/interface.c`) és a variáns build sablonja (`templates/Variant.mk`) a `v0.32.0` tagen
(<https://github.com/justjake/quickjs-emscripten>), a telepített `dist` fájlok, és a Node `v26.7.0`
`lib/internal/abort_controller.js` forrása.

## 2. T-015-2 mérések

### Q-1: CPU kötött végtelen ciklus és az interrupt kezelő (T-2)

`runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + határidő))`, a szkript
`while (true) { i++ }`. Script: `q1-cpu-loop.mjs`.

| Határidő (ms) | Eltelt (ms) | Túllépés (ms) | Kezelő hívás | Hiba a sandboxban            |
| ------------- | ----------- | ------------- | ------------ | ---------------------------- |
| 100           | 101         | 1             | 378          | `InternalError: interrupted` |
| 500           | 501         | 1             | 3966         | `InternalError: interrupted` |
| 2000          | 2001        | 1             | 16048        | `InternalError: interrupted` |

A megszakítás a szkriptben nem kapható el: `try { while (true) {} } catch (e) {}` mellett is a kiértékelés hibája
`InternalError: interrupted` (a `catch` ág nem futott).

### Q-2: gazda ígéretre váró szkript és a lebontás (T-2)

A gazda függvény `context.newPromise()` ígéretét adja, amit sosem old fel; a szkript
`(async () => { await hostWait(); return 1; })()`, a gazda `executePendingJobs` után `resolvePromise`-ra vár,
`AbortSignal.timeout(300)` ellen versenyeztetve. Script: `q2-host-promise.mjs` (változat: A, B, C), `q2b-after-abort.mjs`.

| Változat | Lebontás                                       | Kimenet   | Eltelt (ms) | Kezelő hívás a várakozás alatt | Lebontás eredménye                                                                         |
| -------- | ---------------------------------------------- | --------- | ----------- | ------------------------------ | ------------------------------------------------------------------------------------------ |
| A        | a függő `deferred` felszabadítása nélkül       | `aborted` | 312         | 0                              | `RuntimeError: Aborted(Assertion failed: list_empty(&rt->gc_obj_list) ... JS_FreeRuntime)` |
| B        | `deferred.dispose()`, utána kontextus, runtime | `aborted` | 318         | 0                              | tiszta                                                                                     |
| C        | mint B, utána késői `deferred.resolve()`       | `aborted` | 312         | 0                              | tiszta; a késői `resolve` nem dob                                                          |

- Az interrupt kezelő a gazda ígéretre várakozás alatt egyszer sem hívódott (a kiértékelés alatt egyszer, a
  feladatsor alatt nullaszor). Ez a J-6 forrásból levont következtetésének mérése: igaz.
- A `resolvePromise` natív ígérete a lebontás után 500 ms alatt sem rendeződött (mindhárom változatban függő maradt).
- A késői `resolve` azért nem dob, mert a `QuickJSDeferredPromise.resolve` csak élő `resolveHandle` mellett hív
  (`resolveHandle.alive && ...`, telepített `quickjs-emscripten-core` `dist/chunk-V2S4ZYJR.mjs`).
- **A tiszta lebontás feltétele:** minden, a lépés alatt létrehozott handle (köztük a függő `deferred`) felszabadítása
  a runtime `dispose` előtt. Egy elhagyott handle a `JS_FreeRuntime` assertjét váltja ki (a próbák saját, el nem
  engedett handle-jei ugyanezt adták, Q-4c és Q-8 első futása). Az assert a gazdán elkapható
  `WebAssembly.RuntimeError`; a folyamat fut tovább.
- Q-2b: az assert után ugyanaz a modul egy egyszerű kiértékelésre (`1 + 1`) működött, és egy újonnan betöltött modul
  is. Hogy az abortált runtime memóriája a modulban marad-e, és a modul állapota minden szempontból ép-e, ebből nem
  dönthető el.
- **A határidő jele nem tartja életben a folyamatot:** a Node `AbortSignal.timeout` időzítője `unref` (Node `v26.7.0`
  `lib/internal/abort_controller.js` 215. sor, `timeout.unref()`). Egy életben tartó handle nélkül a próba
  `Detected unsettled top-level await` figyelmeztetéssel, 13-as kóddal kilépett az abort előtt; a szerverben a nyitott
  socketek tartják életben a folyamatot, a próba egy `setInterval`-lal.

### Q-3: mikrofeladatokkal pörgő szkript és az `executePendingJobs` (T-2)

Határidő 300 ms, a gazda egyetlen `executePendingJobs()` hívása. Script: `q3-microtask-loop.mjs`, `q3b-then-chain.mjs`,
`q3c-leak-repeat.mjs`, `q3d-fresh-module.mjs`.

| Változat                                                  | Eltelt (ms) | Kezelő hívás | Futott feladat | Az ígéret állapota | Lebontás |
| --------------------------------------------------------- | ----------- | ------------ | -------------- | ------------------ | -------- |
| `while (true) { await Promise.resolve(); }`               | 301         | 231          | 328571         | `rejected`         | tiszta   |
| `for (;;) { try { await null; } catch (e) {} }`           | 302         | 225          | 373333         | `rejected`         | tiszta   |
| `then` lánc (`spin = () => Promise.resolve().then(spin)`) | 332         | 152          | 219283         | `pending`          | assert   |

- Az ígéret lánc nem kerüli meg az időkorlátot: az interrupt kezelő az `executePendingJobs` hívásban is fut, és a
  határidő után a feladatsor megáll, mindhárom alakon.
- **A megszakított `then` lánc után a lebontás nem mindig tiszta.** A `JS_FreeRuntime` assertje jön, a handle-ök
  hibátlan kezelése mellett is (Q-3b: a véges, megszakítás nélküli lánc tiszta, a megszakított végtelen lánc assert).
  Ismételve: közös modulon 100 ms-os határidővel 20 próbából 2 (Q-3c); próbánként friss modulon 5 ms-mal 0/100,
  20 ms-mal 0/100, 100 ms-mal 100/100 (Q-3d). A jelenség a megszakítás helyétől függ; az okát forrásból nem
  azonosítottam (nem ellenőrzött).
- Q-3c: a 20 próba után a közös modul lineáris memóriája 16 MB-ról 40 MB-ra nőtt, és utána 200 rövid runtime mind
  hibátlanul futott. A friss modul betöltése (`newQuickJSWASMModuleFromVariant`) 1 ... 2 ms, az első 4 ms; minden
  betöltés külön WebAssembly memóriát kap (Q-3d `distinctMemory: true`).

### Q-4: a `setMemoryLimit` és a modul szintű plafon (T-3)

Script: `q4-memory-limit.mjs`, `q4b-limit-effect.mjs` (korlát MB-ban és foglalási alak), `q4c-usage.mjs`.

| `setMemoryLimit` | Foglalás                        | Eredmény a sandboxban          | Darab   | A modul memóriája utána | Gazda RSS (MB) |
| ---------------- | ------------------------------- | ------------------------------ | ------- | ----------------------- | -------------- |
| 16 MB            | `new Array(1e5).fill(1)` tömbök | `InternalError: out of memory` | 1935    | 2048 MB                 | 1541           |
| 128 MB           | ugyanaz                         | `InternalError: out of memory` | 1935    | 2048 MB                 | 1541           |
| nincs            | ugyanaz                         | `InternalError: out of memory` | 1935    | 2048 MB                 | 1541           |
| 16 MB            | 1 MB-os sztringek               | `InternalError: out of memory` | 2141    | 2048 MB                 | 2106           |
| 128 MB           | ugyanaz                         | `InternalError: out of memory` | 2141    | 2048 MB                 | 2106           |
| nincs            | ugyanaz                         | `InternalError: out of memory` | 2141    | 2048 MB                 | 2106           |
| 16 MB            | kis objektumok (`{ i, s }`)     | `InternalError: out of memory` | 466609  | 69 MB                   | 114            |
| 128 MB           | ugyanaz                         | `InternalError: out of memory` | 5314959 | 707 MB                  | 706            |

- **A `setMemoryLimit` nem bájtkorlát ebben a buildben.** A tömb és a sztring foglalás a korláttól függetlenül a
  modul plafonjáig (2048 MB) jutott; a kis objektumok darabszáma a korláttal arányos. Ok, a pinelt forrásból: a
  `js_def_malloc` a korlátot a `malloc_size` számlálón ellenőrzi, amit a `js_def_malloc_usable_size(ptr) +
MALLOC_OVERHEAD` növel; `EMSCRIPTEN` alatt a `js_def_malloc_usable_size` `0`-t ad, a `MALLOC_OVERHEAD` `8`
  (`quickjs.c` 58 ... 62. és 1717 ... 1750. sor). A wrapper az alapértelmezett foglalóval épít runtime-ot
  (`c/interface.c` 407. sor, `JS_NewRuntime()`). A korlát tehát foglalásonként 8 bájtot számol, a foglalt méretet
  nem: a kis objektumos sor a korlát / 8 nagyságrendű foglalásnál állt meg (Q-4b `mallocCount`). Q-4c: egy 100 MB-os
  sztring után a runtime `memory_used_size` értéke 64 bájttal nőtt, a modul memóriája 16 MB-ról 126 MB-ra.
- **A modul szintű plafon 2048 MB:** a modul `new WebAssembly.Memory({ initial: 256, maximum: 32768 })` lapot kér
  (telepített `emscripten-module.mjs`), a build `ALLOW_MEMORY_GROWTH=1` (`templates/Variant.mk`). A plafon elérésekor
  a sandboxban `InternalError: out of memory` jön (elkapható, Q-4 "tömb, elkapva"), a gazda folyamat fut tovább, a
  kontextus és egy új runtime ugyanazon a modulon használható marad (Q-4), a lebontás tiszta. A gazda folyamat RSS-e
  viszont a plafon közelébe nő (2106 MB), és a lineáris memória nem zsugorodik vissza.
- A memóriakorlát nélküli kis objektumos esetet nem mértem (150 s alatt nem futott le).

### Q-5: saját `WebAssembly.Memory` maximummal (T-3)

A build `IMPORTED_MEMORY=1` (`templates/Variant.mk`: "Allow passing WASM memory to Emscripten"), a betöltő a
`Module.wasmMemory` mezőt használja, ha meg van adva (telepített `emscripten-module.mjs`), és a
`newVariant(variant, { wasmMemory })` ezt adja át (`quickjs-emscripten-core` `newVariant`). Lépésenként friss modul,
`new WebAssembly.Memory({ initial: 256, maximum: <plafon> / 64 KiB })`. Script: `q5-wasm-memory-cap.mjs`.

| Plafon | Foglalás        | Eredmény a sandboxban          | Darab | A modul memóriája | Lebontás | A modul utána | Gazda RSS (MB) |
| ------ | --------------- | ------------------------------ | ----- | ----------------- | -------- | ------------- | -------------- |
| 128 MB | tömbök, elkapva | `InternalError: out of memory` | 112   | 126 MB            | tiszta   | működik       | 143            |
| 128 MB | sztringek       | `InternalError: out of memory` | 126   | 126 MB            | tiszta   | működik       | 183            |
| 128 MB | el nem kapva    | a kiértékelés hibája ugyanez   |       | 126 MB            | tiszta   | működik       | 145            |
| 256 MB | tömbök, elkapva | `InternalError: out of memory` | 229   | 248 MB            | tiszta   | működik       | 232            |
| 256 MB | sztringek       | `InternalError: out of memory` | 254   | 248 MB            | tiszta   | működik       | 306            |

A saját memória maximuma valódi bájtkorlát: a foglalás a plafonnál megáll, a hiba a sandboxban marad, a gazda és a
modul ép.

### Q-6: mély rekurzió és a `setMaxStackSize` (T-3)

Script: `q6-recursion.mjs` (stack méret), `q6b-recursion-margin.mjs` (stack méret és a gazda oldali előfogyasztott
hívási mélység). A QuickJS alapértéke 1 MB (`quickjs.h` `JS_DEFAULT_STACK_SIZE (1024 * 1024)`), a build árnyék stackje
5 MB (`templates/Variant.mk` `STACK_SIZE=5MB`).

**Alapértéken** (a `setMaxStackSize` hívása nélkül) mind az öt eset (farok és nem farok rekurzió, elkapott
rekurzió, sok argumentum, `JSON.parse` 1e6 mélységű tömbbel) a **gazdán** bukott:
`RangeError: Maximum call stack size exceeded` (a V8 natív stackje fogyott el a WebAssembly hívásokban, mielőtt a
QuickJS saját ellenőrzése jelzett volna), és a runtime lebontása a `JS_FreeRuntime` assertjét adta. A szkript a
hibát nem kaphatja el. Egy egyszerű kiértékelés ugyanazon a modulon utána működött.

| `setMaxStackSize` | Gazda mélység | A sandboxban maradt                                                           | A gazdára jutott                                               | Rekurziós mélység |
| ----------------- | ------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------- |
| 524288            | 0             | egyik sem                                                                     | mind az öt                                                     | nem mért          |
| 327680            | 0             | nem farok rekurzió                                                            | farok, elkapott, sok argumentum, `JSON.parse`                  | nem mért          |
| 262144            | 0             | farok, nem farok, elkapott, sok argumentum                                    | `JSON.parse`                                                   | nem mért          |
| 131072            | 0             | rekurzió, sok argumentum, `JSON.parse`, getter, Proxy, `toString`             | `JSON.stringify` mély, mély forrás elemzés                     | 742               |
| 131072            | 2000          | rekurzió, sok argumentum, getter, Proxy, `toString`                           | `JSON.parse`, `JSON.stringify`, forrás elemzés                 | 742               |
| 131072            | 5000          | rekurzió, getter, Proxy, `toString`                                           | sok argumentum, `JSON.parse`, `JSON.stringify`, forrás elemzés | 742               |
| 65536             | 0 ... 5000    | a forrás elemzésen és (2000, 5000 mélységen) a `JSON.stringify`-on kívül mind | mély forrás elemzés, `JSON.stringify`                          | 370               |
| 32768             | 0 ... 5000    | a mély forrás elemzésen kívül mind                                            | mély forrás elemzés                                            | 184               |
| 16384             | 0 ... 5000    | mind a kilenc eset                                                            | egyik sem                                                      | 91                |
| 8192              | 0 ... 5000    | mind a kilenc eset                                                            | egyik sem                                                      | 44                |

A "mély forrás elemzés" `eval("(".repeat(1e5) + "1" + ")".repeat(1e5))`, a `JSON.stringify` mély esete 1e5 mélységű
objektum. A README példa értéke (`runtime.setMaxStackSize(1024 * 320)`) a mérésben négy esetből a gazdára engedte a
hibát. A QuickJS stack ellenőrzése az árnyék stack mutatóját nézi, a V8 korlátja a natív WebAssembly hívási vermet;
a kettő aránya esetenként más, ezért a sandboxban maradás határa esetfüggő. A mérés csak a felsorolt eseteket fedi,
és csak a fő szálon, alapértelmezett Node stack mellett futott; egy `worker_threads` szálon vagy más
`--stack-size` mellett nem mértem.

### Q-9: a saját `WebAssembly.Memory` megengedett tartománya (a T-3 user döntéséhez)

Script: `q9-memory-bounds.mjs` (a sorai a `kimenet.jsonl` végén, egy külön, 2026-11-04-i futásból). A pinelt `emscripten-module.wasm` import szekciójának memória bejegyzése a bináris
formátum szerint kiolvasva: minimum 256 lap, maximum 32768 lap (64 KiB-os lapokkal 16 MB és 2048 MB). A saját memória
példányosítása a modullal:

| `initial` (lap) | `maximum` (lap) | Maximum (MB) | Eredmény                                                                                              |
| --------------- | --------------- | ------------ | ----------------------------------------------------------------------------------------------------- |
| 128             | 128             | 8            | `LinkError`: "memory import has 128 pages which is smaller than the declared initial of 256"          |
| 255             | 255             | 15,94        | `LinkError`, ugyanez                                                                                  |
| 256             | 256             | 16           | működik                                                                                               |
| 256             | 32768           | 2048         | működik                                                                                               |
| 256             | 32769           | 2048,06      | `LinkError`: "memory import has a larger maximum size 32769 than the module's declared maximum 32768" |
| 256             | 65536           | 4096         | `LinkError`, ugyanez                                                                                  |

- **A lépésenkénti memória korlát tartománya a pinelt buildben 16 ... 2048 MB.** A felső határ a modul saját,
  deklarált import maximuma, nem a gép memóriája: e fölötti `maximum`-mal a modul nem példányosítható. Az alsó határ
  a modul deklarált kezdő mérete. A hiba a gazdán, a modul betöltésekor jön (a szkript el sem indul).
- A mérő gép memóriája 3906 MB (`os.totalmem()`), tehát ezen a gépen a "teljes rendszermemória" és a modul plafonja
  közül a plafon a kisebb.

### Q-7: fordítás futtatás nélkül és a csomagolás (`script_compile_failed`)

Script: `q7-compile.mjs`. A `context.evalCode(code, filename, { compileOnly: true })` a pinelt verzióban létezik
(`ContextEvalOptions.compileOnly`, "compile but do not run", telepített `index.d.ts`), és a `JS_EVAL_FLAG_COMPILE_ONLY`
jelzőre képez.

| Törzs (az `(async () => {\n<törzs>\n})()` csomagolásban)   | `compileOnly` eredmény                |
| ---------------------------------------------------------- | ------------------------------------- |
| `const x = await Promise.resolve(input); return { y: 1 };` | siker                                 |
| `return {`                                                 | `SyntaxError: expecting ';'`          |
| `return await 1;`                                          | siker                                 |
| `sideEffect = 2; return 1;`                                | siker, a mellékhatás nem futott (`0`) |
| `}); sideEffect = 1; (async () => {`                       | siker                                 |

- A fordítás mellékhatás nélküli: a globális `sideEffect` a fordítások után `0`. A sikeres fordítás eredménye egy
  bytecode objektum handle, amit fel kell szabadítani.
- A szintaktikai hiba helye a csomagolt szövegben áll: `stack: "at script.js:4:2"` egy háromsoros törzs második sorának
  hibájára, tehát a sorszám a csomagoló első sora miatt eggyel eltolt.
- **A csomagolásból kitörő törzs** (`}); ...; (async () => {`) lefordul, mert a csomagolt szöveg érvényes program
  marad. Az `AsyncFunction` konstruktor (`Object.getPrototypeOf(async function () {}).constructor(törzs)`) sem véd:
  ugyanez a törzs a konstruktor hívásakor lefutott (`sideEffect` `1` lett). A kitörés ugyanabban a sandboxban fut,
  tehát a határt nem lépi át, de a "a törzs egy függvény törzse" alakot nem garantálja; a T-015-12 tétele.

### Q-8: a friss kontextus globális objektuma

Script: `q8-globals.mjs`. `Object.getOwnPropertyNames(globalThis)` 61 név:

`AggregateError`, `Array`, `ArrayBuffer`, `BigInt`, `BigInt64Array`, `BigUint64Array`, `Boolean`, `DataView`, `Date`,
`Error`, `EvalError`, `FinalizationRegistry`, `Float16Array`, `Float32Array`, `Float64Array`, `Function`, `Infinity`,
`Int16Array`, `Int32Array`, `Int8Array`, `InternalError`, `Iterator`, `JSON`, `Map`, `Math`, `NaN`, `Number`, `Object`,
`Promise`, `Proxy`, `RangeError`, `ReferenceError`, `Reflect`, `RegExp`, `Set`, `SharedArrayBuffer`, `String`,
`Symbol`, `SyntaxError`, `TypeError`, `URIError`, `Uint16Array`, `Uint32Array`, `Uint8Array`, `Uint8ClampedArray`,
`WeakMap`, `WeakRef`, `WeakSet`, `decodeURI`, `decodeURIComponent`, `encodeURI`, `encodeURIComponent`, `escape`,
`eval`, `globalThis`, `isFinite`, `isNaN`, `parseFloat`, `parseInt`, `undefined`, `unescape`.

Szimbólum kulcs: `Symbol(Symbol.toStringTag)`. Nincs: `console`, `fetch`, `require`, `process`, `setTimeout`,
`queueMicrotask`, `WebAssembly`, `std`, `os`, `Atomics`. A futtató unit tesztje erre a listára plusz a hét futás
kontextus névre, a `fetch`-re és a `files`-ra épülhet.

## 3. A verzió és a csomag választás

**Verzió.** `0.32.0` mindhárom csomagra (`quickjs-emscripten`, `quickjs-emscripten-core`,
`@jitl/quickjs-wasmfile-release-sync`): a registry `dist-tags.latest` értéke, kiadva 2026-02-16; a jsDelivr
`tags.latest` ugyanez; a GitHub tag `v0.32.0` (`df4efb9ef2`). A forrásokat a toolchain research fájl táblája rögzíti.

**Csomag.** `quickjs-emscripten-core` plusz `@jitl/quickjs-wasmfile-release-sync`, nem a teljes `quickjs-emscripten`.
Indok a README "Reducing package size" szakaszából: a fő csomag négy WebAssembly változatot hoz (debug és release,
sync és asyncify, "about 9.04mb"), és "you can switch to the `quickjs-emscripten-core` package ... and install one
(or more) variants a-la-carte"; a legkisebb felállás pontosan ez a kettő. A SPEC-014 5.2 az alap, szinkron változatot
írja elő, az asyncify változatot elveti, tehát a többi három változatra nincs szükség. Mért méret a próba
könyvtárában: `quickjs-emscripten-core` 832 KB, `@jitl/quickjs-wasmfile-release-sync` 692 KB,
`@jitl/quickjs-ffi-types` 108 KB; a teljes fő csomag a négy változattal 2,4 MB plusz a változatok (debug-sync 2,1 MB,
debug-asyncify 2,0 MB, release-asyncify 1,3 MB). A Q-5 út (`newVariant` a saját memóriával) a core csomag API-ja.

**A pinelt bellard QuickJS.** A variáns README-je: "Version 2025-09-13+f1139494 vendored to quickjs-emscripten on
2026-02-15"; a commit dátuma 2025-12-22 (`f1139494`, "regexp: removed alloca() is lre_exec() ..."). A README szerint
"quickjs-emscripten may switch to using quickjs-ng by default in the future", és a csomag verziója 1.0 alatti
("expect occasional breaking API changes", J-1).

## 4. T-4: a quickjs-ng 2026-os advisory-i és a pinelt bellard változat

A quickjs-ng security oldalán (<https://github.com/quickjs-ng/quickjs/security>, a GitHub API advisory listája,
lekérdezve 2026-11-04) tíz advisory áll 2026-ból. A bellard repó a pin után 15 olyan commitot kapott, amelynek üzenete
memóriabiztonsági vagy szivárgási javítást mond (a klónozott repó `git log f1139494..HEAD`, 2026-11-04-i fej `712e8c0`).

| quickjs-ng advisory                                                          | Súly     | A pinelt bellard kód                                                                                                                                                                                                                                                                                                                                        | Ítélet                                    |
| ---------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| GHSA-m53g-qx47-3h38, `toReversed`/`with`/`toSpliced`/`toSorted` másolás      | critical | a `js_allocate_fast_array` a `count = len` beállítás után nem inicializálja a slotokat, a `js_array_toReversed` lassú útja utána felhasználói gettert hívhat, a `js_array_mark` `count`-ig jár; a bellard `4c722ce` (2026-03-21) "modified js_allocate_fast_array() so that the array is fully initialized ... avoids several nasty bugs (#471)" a pin után | ugyanaz a minta a pinben, a javítás utána |
| GHSA-v647-xff9-jxf7, `build_backtrace` OOM use-after-free                    | low      | a bellard `cd97c2b` (2026-10-26) "fixed a use after free in build_backtrace() on out of memory (#529)" a pin után                                                                                                                                                                                                                                           | a javító commit a pin után van            |
| GHSA-9wv5-5cgr-grj6, `TypedArray.prototype.sort` túlcsordulás 32 biten       | high     | a bellard `0989d4c` (2026-03-21) a `TypedArray` sort túlcsordulását javítja átméretezésnél; hogy az ng 32 bites szorzás túlcsordulása ugyanaz-e, nem vetettem össze                                                                                                                                                                                         | nem ellenőrzött                           |
| GHSA-jp52-chwg-2p9p, `js_proxy_get_own_property_names` 32 bites túlcsordulás | high     | a pinelt függvényben nincs `len + extra_len` összeadás; a teljes logikát nem vetettem össze                                                                                                                                                                                                                                                                 | nem ellenőrzött                           |
| GHSA-r6vf-p8wr-4vg9, `set_array_length` use-after-free                       | high     | a pinelt `set_array_length` rövidítéskor felszabadít és `count = len`; az ng által leírt visszanövesztési út nem vetve össze                                                                                                                                                                                                                                | nem ellenőrzött                           |
| GHSA-52gx-967m-hxp3, `ArrayBuffer.prototype.transfer` külső pufferen         | high     | a bellard `75b5230` (2025-11-03, a pin előtt) és `f838177` (2026-06-02, a pin után) módosította; a wrapper `JS_NewArrayBuffer` hívást is tartalmaz saját felszabadítóval (`c/interface.c` 536. sor)                                                                                                                                                         | nem ellenőrzött                           |
| GHSA-rxpx-wj25-jhqq, RegExp OOM írás                                         | high     | az érintett ng tartomány `>= 0.15.1`, az ng saját újabb kódja                                                                                                                                                                                                                                                                                               | nem ellenőrzött                           |
| GHSA-3jf7-4qfx-xc2h, `JSON.stringify` rope                                   | medium   | a pinelt kódban van rope (`JS_TAG_STRING_ROPE`); a `space` kezelését nem vetettem össze                                                                                                                                                                                                                                                                     | nem ellenőrzött                           |
| GHSA-wm7w-r6qf-3c9w, `Atomics.store` szivárgás                               | medium   | az `Atomics` a kontextusban nem létezik (Q-8)                                                                                                                                                                                                                                                                                                               | a sandboxból nem érhető el                |
| GHSA-crgj-9jv8-xfhq, ígéret feloldó OOM use-after-free                       | low      | modul kiértékelés útja; a futtató modult nem tölt be                                                                                                                                                                                                                                                                                                        | nem ellenőrzött                           |

További, a pin utáni bellard javítások a kontextusban elérhető részen: `5022f2b` (2026-03-21) "fixed use-after-free via
re-entrant GC in FinalizationRegistry weak reference cleanup (#494)" (a `FinalizationRegistry` a kontextusban van,
Q-8), `841dd03` `TypedArray.prototype.with` és `68caa5f` `TypedArray` konstruktor puffer túlcsordulás.

**Megállapítás.** A pinelt bellard pillanatkép legalább két, az ng advisory-kkal azonos függvényt érintő hibát
tartalmaz, amelyet a bellard repó a pin után javított (`4c722ce`, `cd97c2b`), és további, a sandboxból elérhető
memóriabiztonsági javítások is a pin utániak. A `quickjs-emscripten` legfrissebb kiadása (0.32.0) ezt a pint hozza,
újabb nincs. **Kimondott korlát:** hogy ezek a hibák a WebAssembly lineáris memóriáján belül maradnak-e, vagy a
gazdára hatnak, nem ellenőrzött (SPEC-014 5.10 1. pont változatlanul).

## 5. Mit jelent ez a SPEC-014 5.4 pontjaira

**Kettős időkorlát (T-2).** Mérve igazolt: a CPU kötött kód az interrupt kezelővel a határidőn belül 1 ms-mal megáll
(Q-1), a gazda ígéretre várakozás alatt a kezelő nem fut (Q-2), tehát a gazda oldali `AbortSignal` ág szükséges, és a
mikrofeladat lánc az `executePendingJobs` hívásban is megáll (Q-3). Pontosítások a T-015-6 számára:

1. A futó gazda hívások ígéretét (`deferred`) és minden handle-t a lebontás előtt fel kell szabadítani (Q-2 B).
2. A runtime `dispose` hívása a megszakított `then` lánc után a handle-ök hibátlan kezelése mellett is
   `WebAssembly.RuntimeError` assertet adhat (Q-3b ... Q-3d), tehát a lebontás hibáját el kell kapni. A lépésenként
   friss modul (Q-3d, betöltés 1 ... 2 ms) ezt egy eldobható modulra korlátozza.
3. Az `AbortSignal.timeout` időzítője `unref`: a folyamatot nem tartja életben (Q-2); a unit tesztben ezzel számolni
   kell.

**Memória (T-3).** **A spec mechanizmusa a mérésen elbukik:** a `setMemoryLimit(128 * 1024 * 1024)` ebben a buildben
nem korlátozza a foglalt bájtokat (Q-4), egy szkript a korlát mellett is 2048 MB-ig foglal, és a gazda RSS-e
ugyanennyit nő. A folyamat nem áll le, a hiba a sandboxban `InternalError`, de egy lépés a gép memóriájának több mint
felét elviheti (a mérő gépen 3906 MB). A 128 MB-os bájtkorlát mérten elérhető lépésenként friss modullal és saját
`WebAssembly.Memory` maximummal (Q-5); ez a spec 5.4 életciklusának (lépésenként új runtime) bővítése lépésenként új
modulra, és a mechanizmus cseréje: a döntés a spec gazdájáé, ez a fájl nem írja át.

**Stack (T-3).** **A spec "mért korlát" ága a mérésen elbukik:** alapértéken a mély rekurzió a gazdán bukik (Q-6), és
nincs olyan `setMaxStackSize` érték, ami minden mért esetet a sandboxban tart és közben használható rekurziós mélységet
ad: a 16384 bájt az utolsó, amin mind a kilenc eset a sandboxban maradt, 91-es rekurziós mélységgel; a 131072 bájt
(742 mélység) mellett a mély forrás elemzés és a mély `JSON.stringify` a gazdára jut. A gazdára jutott hiba elkapható
`RangeError`, a folyamat fut tovább, a runtime lebontása assertet ad (a lépésenként friss modul ezt is egy eldobható
modulra korlátozza). Hogy melyik értéket válasszuk, vagy a gazdán elkapott `RangeError`-t a lépés hibájának tekintsük,
termék és kockázati döntés; ez a fájl nem dönti el.

**Fordítás (`script_compile_failed`).** A `compileOnly` mellékhatás nélkül fordít és a szintaktikai hibát adja (Q-7);
a csomagolásból kitörő törzs lefordul, ez a T-015-12 tétele.

**Globális nevek.** A 61 név a 2. szekció Q-8 pontjában; a `console` nincs, egyezik az 5.4 "Globális nevek" pontjával.

## 6. A user döntései a T-3 mérés nyomán (2026-11-04)

**Memória.** A kérdés: "a mérés szerint a tervezett 128 MB-os korlát a közös motorban nem hat, egy szkript kb. 2 GB
memóriát vihet el"; opciók: "Friss motor lépésenként (128 MB-ra korlátozott)" vagy "Közös motor, 2 GB". A user
válasza szó szerint: "friss motor lepesenkent es lehessen beallitani, de default teljes rendszermemoria". A
végrehajtás:

1. Minden JavaScript szkript lépés (és a futás indításakor a fordítási ellenőrzés) friss WebAssembly modult kap, saját,
   maximummal korlátozott `WebAssembly.Memory`-val (Q-5). A `setMemoryLimit` nem kerül a futtatóba, mert ebben a
   buildben nem bájtkorlát (Q-4).
2. A korlát csomópontonként beállítható (`memoryLimitMb`, egész MB, 1 MB = 1024 * 1024 bájt).
3. Az alapérték (üres mező, `null`) a teljes rendszermemória (`os.totalmem()`), de legfeljebb a modul plafonja: a
   kettő közül a kisebb, lefelé kerekítve egész MB-ra. A plafon fölötti érték a modulon nem példányosítható (Q-9),
   tehát a "teljes rendszermemória" a gyakorlatban ennél nem lehet több.
4. A beállított érték 16 és 2048 között lehet (Q-9 tartománya); ezen kívüli érték a mentéskor a mező alatti hibát ad, a
   meglévő pozitív egész szabály mintájára, mindkét oldalon, a sodródás védelemmel.

**Mély rekurzió.** A user választása: "Közepes, kb. 740 szint": `setMaxStackSize(131072)` (Q-6 131072 bájtos sora,
742 mélység). A gazdára kijutó `RangeError` (a Q-6 táblája szerint ezen az értéken a mély forrás elemzés és a mély
`JSON.stringify`) a lépés `script_evaluation_failed` hibája, és a modult eldobjuk (a lépésenkénti friss modul miatt a
következő lépés újat kap).

## 7. T-015-4: a motor validáció, az `unimplemented_node_type` sorsa és a lépések sorrendje

Lépés: PLAN-015 T-015-4 (2026-11-04). Módszer: kódolvasás a `f618229` fejen (a T-015-8 commitja, `22c9f11`, előtte
került be), és a T-015-2 próbáihoz telepített `quickjs-emscripten-core` 0.32.0 `dist/index.mjs` forrása.

### 7.1 Az `unimplemented_node_type` sorsa: törlendő

- Egyetlen előállító hely van: a `run-validation/validate-implemented-node-types.ts` `isExecutableNodeConfig`
  predikátuma, ami kizárólag a `script` node-ot és a `join` `script` módját utasítja el (a teljes repóban más
  `formatEngineErrorMessage('unimplemented_node_type', ...)` hívás nincs).
- Ha a két ág végrehajtható, a predikátum minden `WellFormedNodeConfig`-ra igazat ad, tehát a hibaág soha nem fut: a
  100 százalékos lefedettség mellett halott ág (szabálykönyv 5. szekció, "tilos olyan ágat bevezetni, ami ... sosem
  fut"). Ugyanígy az `ExecutableNodeConfig` és a `WellFormedNodeConfig` különbsége megszűnik.
- Tárolt adat nem hivatkozik rá: a hibaosztály a futás indításának 3. lépésében keletkezik, és a SPEC-004 4.8 menet 1 ... 5. lépése egyetlen adatot sem ír (`run-supervisor/create-run-supervisor.ts`, a `startRunInternals` doksija). Nincs
  `workflow_run.error_kind` vagy esemény, ami olvasáskor igényelné.
- **Döntés: törlés**, megtartási ok nincs. A törlés köre: a `validateImplementedNodeTypes` lépés és tesztjei, az
  `ExecutableNodeConfig` szűkítés (a hívók a `WellFormedNodeConfig`-ot kapják), a motor uniójának és guardjának tagja,
  a `ProtocolErrorClass` szótár tagja, az `apps/server` validációs osztály listája, a kliens magyar mondata, a
  `greppable-invariants` (21) listája, és a felület statikus szövegei (a T-015-10 köre, `has-script-node`,
  `script-unimplemented-error-class`).

### 7.2 Miért nem zöldíthető a T-015-4 önmagában: a lépések átrendezése

1. **A szűkítés megszüntetése a diszpécser `script` ágát igényli ugyanabban a commitban.** A `node-executor/execute-node.ts`
   `executeNode` és `executeJoinNode` függvénye egy `Promise`-t visszaadó, `default` ág nélküli `switch` az
   `ExecutableNodeConfig` `type`, illetve `mode` mezőjén. Ha a unió `script` tagot kap, a függvény vége elérhetővé
   válik, és a fordító "Function lacks ending return statement" hibát ad; a `switch-exhaustiveness-check` lint szabály
   ugyanezt jelzi. A `script` ág a T-015-5 végrehajtója.
2. **A JavaScript ág a `scriptRunner` port bekötését igényli.** A végrehajtó és a futás indításának fordítása a portot
   az `EngineDependencies` mezőjéből kapja; a mező kötelező (a meglévő portok mintája, `engine-dependencies.ts`: "Egyik
   mező sem opcionális"). Az `apps/server` `engine-assembly` témája valódi megvalósítás nélkül nem tudja kitölteni, a
   QuickJS függőség és a futtató viszont a T-015-6 lépése.
3. A köztes megoldások mind kizártak: egy opcionális port a motorban örökre kettős ágat hagyna; egy ideiglenes szerver
   oldali elutasítás vagy csonk később törlendő termékág; a `runtime: 'javascript'` ág ideiglenes `unimplemented_node_type`
   elutasítása ugyanígy később törlendő.

**Döntés (a lépések átrendezése, PLAN-015 4. szekció):**

- **T-015-4 (ez a lépés):** a `ScriptRunnerPort`, a `ScriptRunRequest` és a `ScriptRunResult` típusa az `engine-port`
  témában, a barrelből exportálva, de még nem az `EngineDependencies` mezője; a SPEC-004 3.2 port táblája; ez a
  döntés. Termékkód és ág nem változik.
- **T-015-6 előre kerül a T-015-5 elé:** a JavaScript futtató az `apps/server` oldalon, a port típusát
  `satisfies`-szal kielégítve, önállóan tesztelve, még a motorba kötés nélkül.
- **T-015-5 (a T-015-4 maradékával együtt, egy commitban):** a `validateImplementedNodeTypes` és az
  `unimplemented_node_type` törlése (7.1), a CEL `source` a `validateLanguageFields` kifejezés mezői közé (ugyanaz az
  `expression_evaluation_failed` osztály, mint a `branch` kifejezésnél), a JavaScript `source` fordítása a futás
  indításakor (`script_compile_failed`), a `scriptRunner` az `EngineDependencies` mezőjeként és az `apps/server`
  összeállításában, a diszpécser és a `join` `script` ága, a közös végrehajtó.

### 7.3 A `compile` aszinkron, és ennek következménye a futás indítására

- A SPEC-014 5.4 és a 6. szekció 1. pontja szerint a futás indításának fordítási ellenőrzése is saját, eldobott
  WebAssembly modulon fut. A modul példányosítása a telepített forrásban aszinkron: a
  `newQuickJSWASMModuleFromVariant` `await`-tel tölti be a modul betöltőt és az FFI-t (`quickjs-emscripten-core`
  0.32.0 `dist/index.mjs`). A port `compile` művelete ezért `Promise<Outcome<void>>`.
- **Következmény a T-015-5-re:** a futás indításának belső menete (`startRunInternals`) ma szinkron, és a
  `isAcceptingRuns` ellenőrzés és az első írás között nincs `await`. Ha a fordítás `await`-tel közé kerül, a szabályos
  leállás jele ebben az ablakban megérkezhet; a SPEC-004 10.2 1. pontja (mérve: SPEC-006 M-36) szerint a leállás után
  új futás nem indulhat. A T-015-5-ben a leállás ellenőrzését a fordítás után, az első írás előtt meg kell ismételni,
  és ezt teszttel kell lefedni. A gyerek futás indítása (`startChildRun`) már ma is `Promise`-t ad.
- **Lezárva a T-015-5-ben (2026-11-04).** A legkisebb helyes változtatás: a `RunSupervisor.startRun` és a
  belső `startRunInternals` aszinkron lett (`Promise<Outcome<...>>`), a szinkron 1 ... 4. lépés egy külön
  függvénybe került (`prepareRunStart`, változatlan sorrenddel), és a menet egyetlen `await` pontja a
  JavaScript források fordítása (`validateScriptSources`) EZUTÁN, az első írás (`startValidatedRun`) előtt. A
  fordítás után a leállás ellenőrzése megismétlődik; a változót egy függvény olvassa (`canStartRuns`), mert a
  közvetlen olvasást a fordító az első ellenőrzés szerint szűkítené (`no-unnecessary-condition`). Ha a gráfban
  nincs JavaScript forrás, a `validateScriptSources` port hívás nélkül tér vissza, de az `await` ekkor is egy
  mikrofeladat; a motor tesztjei (a kézikönyv a `startRun` visszatérése után kiolvasható) ezzel változatlanul
  zöldek. A `createEngine.startRun` és a `restartRun` a korábbi `Promise.resolve` burkolás helyett közvetlenül
  adja tovább az ígéretet, a `startChildRun` `async` lett. A fordítás a szinkron ellenőrzések után fut, tehát az
  olcsó hibák (gráf, nyelvi mezők, bemenet) a WebAssembly modul betöltése előtt buknak. Teszt: a
  `create-run-supervisor.spec.ts` "a fordítás alatt elkezdődött szabályos leállás" regressziója (a fordítás
  ígéretét a teszt a `stopAcceptingRuns` után oldja fel; a futás `engine_shutting_down`, sor és esemény nélkül).
- A `run` eredménye nem kivétel, hanem háromágú unió: `succeeded` (JSON kimenet), `failed` (a három futásidejű osztály
  egyike), `aborted` (a motor külső jele, SPEC-014 5.8: a lépés `cancelled` állapotban zár). A `null` alapértékeket
  (`timeoutMs`, `cwd`, `memoryLimitMb`) a futtató oldja fel, mert a rendszermemória (`os.totalmem()`) csak ott ismert.

## 8. T-015-6: a JavaScript futtató az `apps/server` oldalon

Lépés: PLAN-015 T-015-6 (2026-11-04), a `9410629` fejen. Helye: `apps/server/src/script-runner/`. A futtató a motor
`ScriptRunnerPort` típusát `satisfies`-szal teljesíti (`quickjs-script-runner.ts`), az `engine-assembly` bekötése a
T-015-5. Forrás: a telepített `quickjs-emscripten-core` 0.32.0 `dist/index.d.ts` (a sorszámok onnan) és a
`dist/chunk-V2S4ZYJR.mjs` (minifikált, a függvény nevével hivatkozva), a `@jitl/quickjs-wasmfile-release-sync` 0.32.0
`dist/emscripten-module.mjs`, és a unit tesztek valódi QuickJS-sel.

### 8.1 Döntések

1. **Függőség.** `quickjs-emscripten-core` és `@jitl/quickjs-wasmfile-release-sync`, pontosan `0.32.0`, az
   `apps/server` `dependencies` mezőjében (a két forrás a toolchain research táblájában már áll, 3. szekció).
2. **Friss modul minden híváshoz**, a fordításhoz is (`load-quickjs-module.ts`): `new WebAssembly.Memory({ initial:
256, maximum: memoryLimitMb * 16 })`, a `null` korlát `Math.min(Math.floor(os.totalmem() / 2 ** 20), 2048)` (6.
   szekció, Q-5, Q-9). A fordítás a `null` alapértéket kapja. `setMemoryLimit` nincs (Q-4).
3. **A futás kontextus átadása.** A gazda a hét név objektumát `JSON.stringify`-jal szöveggé alakítja; az `undefined`
   értékű nevet a `JSON.stringify` kihagyja, tehát a hiányzó név a sandboxban nem létezik (`typeof` `undefined`, és
   `"item" in globalThis` hamis). A sandbox egy előkészítő függvénye (`PRELUDE_SOURCE`) a szöveget `JSON.parse`-szal
   értelmezi és a neveket a globális objektumra teszi; a `JSON` és az `Object.keys` a szkript előtt rögzül, és a
   visszaadott függvény a kimenet `JSON.stringify` hívása. Globális nevet az előkészítő nem hagy hátra: a teszt szerint
   a kulcslista pontosan a Q-8 61 neve plusz a jelen lévő kontextus nevek.
4. **Az eredmény olvasása.** A sorrend `resolvePromise`, majd egy `executePendingJobs()`: a `resolvePromise` a
   QuickJS ígéretre `then` visszahívást köt (`chunk-V2S4ZYJR.mjs` `resolvePromise`), és a visszahívás maga is függő
   feladat, tehát a fordított sorrendben egy második `executePendingJobs` kellene. A `resolvePromise` a sandbox
   globális `Promise` nevét olvassa (`this.getProp(this.global, "Promise")`); a szkript ezt felülírhatja, de csak a
   saját lépését rontja el, a gazdát nem (a T-015-12 szökési kísérleteinek tétele).
5. **Kettős időkorlát.** (1) `setInterruptHandler(shouldInterruptAfterDeadline(határidő))`, egy jelzővel: ha a
   kezelő megszakított, a lépés bármely sandbox hibája `script_timed_out`. (2) `waitForSettlement`: saját, a végén
   törölt `setTimeout` a határidőre, a kérés jelének figyelőjével versenyeztetve. Nem `AbortSignal.timeout`, mert az
   `unref` (Q-2) és nem törölhető. A határidő a hívás kezdetétől számít, a modul betöltése is beleszámít.
6. **Mért ágak** (a tesztek, 100 ms alatti határidővel): a szinkron `while (true) {}` után a kiértékelés ígérete
   `InternalError: interrupted` hibával elutasított, és a `resolvePromise` visszahívása lefut (az (1) ág); a
   `for (;;) { await null; }` és a soha fel nem oldott `await new Promise(() => {})` után az ígéret függő marad, a (2)
   ág zár. A Q-2 gazda ígéretre várás esete gazda függvény nélkül, a soha fel nem oldott sandbox ígérettel
   reprodukálható; a gazda függvény ígéretének (`deferred`) lebontása a T-015-7 tétele.
7. **Hibák és üzenetek.** A sandbox hibájának szövege a QuickJS `dump` eredményéből a `name` és a `message`
   (`index.d.ts` 1566. sor, `any`, `unknown`-ként guarddal olvasva), a `stack` nem kerül bele; nem `Error` értékre
   rögzített mondat. A gazdára kijutó kivételből csak a típusneve (`describeErrorType`), az üzenete nem. A `failed` ág
   üzenete kisbetűs mondatrész hibaosztály nélkül (a CEL kiértékelő mintája, `describe-cel-error.ts`); a motor a
   T-015-5-ben a saját mondatába fűzi és a `formatEngineErrorMessage` adja hozzá az osztályt. A `compile` `Outcome`
   üzenete teljes mondat, a végén `(script_compile_failed)`.
8. **A sandbox mély rekurziójának hibája** `InternalError: stack overflow`, nem `RangeError` (mérve a unit tesztben,
   `setMaxStackSize(131072)` mellett); elkapható. A mély `JSON.stringify` (1e5 mélység) a kimenet szerializálásakor a
   gazdán `RangeError` (Q-6), `script_evaluation_failed`, és a következő lépés friss modulon hibátlanul fut. A mély
   forrás elemzés (`"(".repeat(1e5)`) a fordításban is a gazdára jut: `script_compile_failed`.
9. **Lebontás** (`dispose-quietly.ts`): minden handle pontosan egyszer kerül a listába, a lebontás sorrendje
   handle-ök, kontextus, runtime, a hibája elkapott. A tesztekben a gazdára kijutó `RangeError` esetén kívül minden
   lebontás tiszta volt.
10. **A `DisposableResult` szűkítése** `result.error !== undefined` alakkal (`index.d.ts` 795 ... 813. sor: a
    `DisposableSuccess` `error?: undefined`).

### 8.2 Nyitva marad

- **A lebontási assert a konzolra ír.** A `JS_FreeRuntime` assertje után az Emscripten modul az `Aborted(...)` sort a
  `console.error`-ra írja (`emscripten-module.mjs`: `D=console.error.bind(console)`, felülírható a `printErr`
  mezővel). A `newVariant` `emscriptenModule` opciójának típusa (`EmscriptenModuleLoaderOptions`,
  `@jitl/quickjs-ffi-types` 0.32.0) a `printErr` mezőt nem tartalmazza, tehát `as` nélkül nem adható át. A szerverben
  ez a gazdára kijutó hiba után egy stderr sor, a lépés eredményét nem változtatja; a teljes Vitest kimenetében egy
  sor. Nem javítottam.
- **A `cwd` mezőt a futtató még nem olvassa:** a `files` gazda függvény a T-015-7.
- **Időtartam (mérve, a T-015-6 kapu futásának teljes Vitest menetében, 8412 teszt).** A `run-script.spec.ts` 24
  tesztje együtt 526 ms; a leghosszabb egyedi teszt a gazdára kijutó `RangeError` esete, 114 ms, a három időkorlát
  teszt 51 ... 52 ms (50 ms-os határidővel). Az 5000 ms-os korláttól messze van, időzített bomba nincs.

## 9. T-015-7: a `fetch` és a `files` gazda függvény

Lépés: PLAN-015 T-015-7 (2026-11-04), a `530d6b9` fejen. Helye: `apps/server/src/script-runner/`. Forrás: a
telepített `quickjs-emscripten-core` 0.32.0 forrása (a `dist/chunk-V2S4ZYJR.mjs.map` beágyazott `src/context.ts`,
`src/deferred-promise.ts` és `src/lifetime.ts`), a Node `v26.7.0` beépített `fetch`-ének undici `8.9.0` forrása
(`process.versions.undici`; <https://github.com/nodejs/undici/blob/v8.9.0/lib/web/fetch/index.js>), a Node `fs`
dokumentációja (<https://nodejs.org/api/fs.html>), a POSIX `open` leírása
(<https://pubs.opengroup.org/onlinepubs/9799919799/functions/open.html>), és a unit tesztek valódi QuickJS-sel, helyi
`node:http` szerverrel és ideiglenes könyvtárral.

### 9.1 Döntések

1. **A sandbox ígéret.** A gazda függvény `context.newPromise()` handle-jét adja vissza; a könyvtár a visszaadott
   handle-t maga szabadítja fel (`src/context.ts`: a visszatérési értéket a hívás `scope.manage` alá veszi), a
   `resolve` és a `reject` a két feloldó handle-t (`src/deferred-promise.ts`). A még nem rendezett ígéret a lépés
   `pendingCalls` halmazában áll, és a lebontás a handle-ök, a kontextus és a runtime előtt szabadítja fel (Q-2 B); a
   `QuickJSDeferredPromise.dispose` idempotens.
2. **A lépés jele.** `AbortSignal.any([kérés jele, lépés vége])`: a lépés vége a `finally` első utasítása, a
   lebontás előtt. A hálózati kérés ezen a jelen szakad meg (a határidő után a lépés vége, a külső megszakításkor a
   kérés jele), és a rendezés első lépése a jel ellenőrzése: a jel után érkező gazda eredmény semmit nem ír a
   sandboxba, tehát felszabadított handle-be sem (Q-2 C), és szkript kód sem fut a külső megszakítás után.
3. **Az argumentumok és az eredmény JSON alakban mennek át** (SPEC-014 5.5). Az argumentumot a szkript előtt
   rögzített sandbox `JSON.stringify` olvassa szöveggé (a gazda oldalon `unknown`, utána typeguard); a `context.dump`
   nem használható, mert ígéret argumentum esetén felszabadítja a handle-t (`src/context.ts` `dump`), amit a hívó
   függvény nem tehet meg. A JSON alakkal nem bíró argumentum (függvény) `undefined`. Az eredmény JSON szövegét a
   szkript előtt rögzített sandbox `JSON.parse` alakítja értékké, a sandbox memória korlátja alatt.
4. **A rendezés után a függő feladatok futnak** (`executePendingJobs`): a szkript folytatása itt, az interrupt kezelő
   alatt fut. Az itt a gazdára kijutó hiba (a mély `JSON.stringify` `RangeError`-ja, Q-6) a lépés
   `script_evaluation_failed` hibája: a futtató a szkript ígéretét és ezt a jelzést versenyezteti.
5. **`fetch`.** Kizárólag `http:` és `https:` (`URL.parse`, a séma halmazban). A `redirect: 'manual'` a Node-ban a
   tényleges 3xx választ adja: az undici forrása szerint "On the web this would return an `opaqueredirect` response,
   but that doesn't make sense server side" (`lib/web/fetch/index.js` 1228 ... 1234. sor), és a teszt a `302`
   státuszt és a `location` fejlécet látja. A második argumentum csak `method`, `headers` (szöveg értékek) és `body`
   (szöveg) mezőt tartalmazhat, az ismeretlen kulcs `TypeError` (`isSandboxFetchInit`, zárt kulcslista). A gazda
   ezen kívül csak a `redirect` és a `signal` mezőt adja; a teszt szerint a kérésben nincs `authorization` és
   `cookie` fejléc. A válasz `{ status, headers, body }`, a fejlécek a `Headers` bejárásából (kisbetűs név), a törzs
   `response.text()`. A hálózati hiba `TypeError: a hálózati kérés nem sikerült (<gazda hiba típusneve>)`.
6. **`files`.** A gyökér `path.resolve(cwd ?? process.cwd())`. Az útvonal szöveg, nem abszolút (az abszolút útvonal a
   gyökér alatt is elutasított), és a `path.resolve(gyökér, útvonal)` a gyökér plusz elválasztó előtag alatt áll
   (`/` gyökérnél az előtag maga a gyökér); a gyökér maga csak a `list` számára elfogadott. Utána az útvonal és a
   gyökér `fs.realpath` alakja is összevetve (Node doksi: "Determines the actual location of path"), és a művelet a
   feloldott útvonalon fut. **Írás:** létező célnál a cél feloldott alakja, nem létezőnél a szülő könyvtáré
   ellenőrzött, és az új fájl a `wx` jelzővel jön létre. A Node doksi szerint "On POSIX, if the path is a symbolic
   link, using O_EXCL returns an error even if the link is to a path that does not exist", a POSIX szerint "If
   O_EXCL and O_CREAT are set, and path names a symbolic link, open() shall fail and set errno to [EEXIST]": a
   gyökéren kívüli, nem létező célra mutató (függő) link ezért `EEXIST`, a teszt szerint a gyökéren kívül nem jön
   létre fájl. A `list` a `readdir` neveit adja a `readdir` sorrendjében.
7. **Hibaüzenetek** (a sandboxban, a lépés üzenetében `a szkript hibát dobott: <név>: <üzenet>` alakban, ha a szkript
   nem kapja el): `TypeError: az útvonal szöveg kell legyen`; `Error: az útvonal nem lehet abszolút: <útvonal>`;
   `Error: az útvonal a hozzáférés gyökerén kívülre mutat: <útvonal>`; `Error: a fájl művelet nem sikerült (<kód>):
<útvonal>`; `TypeError: a beírandó tartalom szöveg kell legyen`; `TypeError: a fetch címe szöveg kell legyen`;
   `TypeError: a fetch címe nem érvényes URL: <cím>`; `TypeError: a fetch csak http: és https: címet fogad, ez <séma>
séma`; `TypeError: a fetch beállítása csak method, headers és body mezőt tartalmazhat, szöveg értékkel`. Az
   `<útvonal>` mindig a szkript saját bemenete: a Node fájl hiba `message` mezője (ami a gazda abszolút útvonalát
   tartalmazza) nem kerül át, csak a `code`. Az argumentum olvasásának sandbox hibája (például dobó getter a második
   argumentumban) a hívás helyén, a saját nevével és üzenetével dobódik.
8. **A TOCTOU** (az ellenőrzés és a használat közötti linkcsere) kimondott, nem javított (SPEC-014 5.4, 5.10 3.).

### 9.2 Tesztek

`fetch-for-sandbox.spec.ts` (helyi szerver: GET, POST törzzsel és fejléccel, hitelesítő fejléc és süti nélkül, 302,
`file:`, `data:`, `ftp:`, érvénytelen és nem szöveg cím, nem dokumentált beállítás, hálózati hiba, megszakítás a
szerver oldali bontással), `read-text-in-root.spec.ts`, `write-text-in-root.spec.ts`, `list-in-root.spec.ts`
(ideiglenes könyvtár: `..`, abszolút út, kifelé mutató fájl és könyvtár link, függő link, gyökérre mutató link,
`ENOENT`, `ENOTDIR`), `start-host-call.spec.ts` (teljesülés, elutasítás, a jel utáni késői eredmény a lebontás után,
a gazdára kijutó hiba), és az `install-host-functions.spec.ts` a valódi futtatón át: a határidőn függő válasz
`script_timed_out` és a szerver a kapcsolat bontását látja; a külső megszakítás `aborted`, ugyanígy; a `cwd: null`
gyökere a `process.cwd()` (csak listázás); a várt gazda hívás utáni mély `JSON.stringify` `script_evaluation_failed`;
a nem várt gazda hívás késői eredménye a lebontás után nem dob. A globális kulcslista tesztje a `fetch` és a `files`
névvel bővült.

### 9.3 A CPU kötött szkript és a külső megszakítás (a T-015-5 jelzése)

A kért javítás: az interrupt kezelő a kérés jelére is szakítson meg. **Mérve: ez a gazda egy szálán nem hat.** A
QuickJS a gazda szálán, szinkron fut (SPEC-014 5.4 "Párhuzamosság"), tehát a szinkron ciklus alatt az eseményhurok
áll: a kérés jelét megszakító kód (egy HTTP kérés kezelője, egy időzítő, a motor `fail_run` ága) a ciklus alatt el sem
indulhat. Próba: a kezelő feltétele kiegészítve `|| request.signal.aborted`-dal, `while (true) {}` 1500 ms-os
határidővel, a jel abortja egy 20 ms-os időzítőn: az eredmény `script_timed_out` 1503 ms után, és az időzítő a
lépés végéig nem sült el. A javítás tehát a megszakítás előtt bukó, utána zöld tesztet nem kaphat, és a kezelő ága
a 100 százalékos lefedettség mellett sosem futó ág volna (szabálykönyv 5. szekció). A kódba nem került. A jelenlegi
viselkedést a `run-script.spec.ts` "a CPU kötött szkript alatt a kérés jele nem ér célba" tesztje rögzíti.

Ami a gazda egy szálán megoldható, a 9.1 2. pontja: a külső megszakítás után a lépés jele azonnal lejár, és a később
érkező gazda eredmény már nem indít szkript kódot (különben egy `await fetch(...); while (true) {}` szkript a
megszakítás után a határidőig futna). **Nyitva:** a CPU kötött szakasz külső megszakítása csak más szálon futó
QuickJS-sel (például `worker_threads`) volna lehetséges; ez architektúra és termék döntés, nem ennek a lépésnek a köre.

### 9.4 Nyitva marad

- A válasz törzsének mérete nincs korlátozva a gazda oldalon (`response.text()`); a sandboxba a `JSON.parse` a modul
  memória korlátja alatt hozza át. A spec nem ad rá szabályt. **Lezárva a T-015-12-ben** (10. szekció, F4): a törzs és a
  `readText` fájlja a lépés memória korlátjáig olvasott.
- A `Headers` bejárása a több `set-cookie` fejlécet külön elemként adja, az `Object.fromEntries` ezek közül az
  utolsót tartja meg (nem ellenőrzött forrással, a teszt nem fedi).
- A 8.2 szekció "a `cwd` mezőt a futtató még nem olvassa" pontja ezzel lezárult.

## 10. T-015-12: adverzariális átvizsgálás

A vizsgált változás: `git diff ef9821d..866898b` (a SPEC-014 munka `e8b3ae5..866898b`). A kísérletek a valódi
`runScript` és `compileScript` ellen futottak, eldobható próba scripttel (`node` a TypeScript forráson, illetve
ideiglenes, nem commitolt `.spec.ts`), helyi `node:http` szerverrel és ideiglenes könyvtárral; külső hálózati hívás nem
volt. A gép: 4 mag, 3,9 GB memória, swap nélkül, Node 26.7.0.

### 10.1 Talált hibák, súly szerint, javítással

| #   | Súly     | Hiba                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Kísérlet (a javítás előtt)                                                                                                                                                                                                                                                              | Javítás, commit                                                                                                                                                                                                                                   | Regressziós teszt                                                                                                                                                                                                                       |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | kritikus | A CPU határidő megkerülhető volt: a gazda függvény argumentumát a gazda a sandbox `JSON.stringify`-jával olvassa, tehát a szkript `toJSON`-ja a gazda hívásán belül fut; az ott érkező megszakítást a könyvtár elkapható hibaként dobja vissza (`quickjs-emscripten-core` 0.32.0 `errorToHandle`: gazda hibából új `Error`), és a szkript ciklusban elkapva a határidőn túl is futott. A szinkron ciklus a gazda szálát foglalja, tehát a szerver korlát nélkül állt. | `while (Date.now() < +2000 ms) { try { fetch({ toJSON() { for (;;) {} } }) } catch {} }` 300 ms-os határidővel: `succeeded`, 2017 ms; ugyanez `files.readText`-tel 2003 ms. A korlát nélküli változat végtelen.                                                                         | A határidő utáni gazda hívás az argumentum olvasása nélkül elutasított (`install-host-functions.ts`, `HostCallScope.isInterrupted`); a megszakítás így a szkript saját kódjában, elkaphatatlanul érkezik. `66ca28c`                               | `run-script.spec.ts`: "a(z) %s argumentumában megszakított kód elkapása után a szkript nem fut tovább a határidőn túl" (négy gazda függvény)                                                                                            |
| F2  | kritikus | A szkript a saját `Promise`-ának felülírásával a gazdán kezeletlen ígéret elutasítást váltott ki: a `resolvePromise` a futás idejű `Promise.resolve` és `then` értéket hívja, és a `then` hibáját a gazda ígéret végrehajtójában dobja; a `waitForSettlement` `void promise.then(...)` hívása ezt nem kezelte. A Node alapból kilép kezeletlen elutasításra (saját mérés: `exit 1`).                                                                                  | `Promise.prototype.then = function () { throw new Error("x"); }; return 1;` önálló `node` folyamatban a `runScript` hívással: a folyamat `exit 1`-gyel kilépett. A `globalThis.Promise` felülírása ugyanígy.                                                                            | Az elutasítás a lépés `script_evaluation_failed` hibája (`run-script.ts` `evaluatedCompletion`). `8d5722a`                                                                                                                                        | `run-script.spec.ts`: "a(z) %s felülírása azonnal script_evaluation_failed, kezeletlen elutasítás nélkül"                                                                                                                               |
| F4  | kritikus | A `fetch` válasz törzsét (`response.text()`) és a `readText` fájlját (`readFile`) a gazda korlát nélkül olvasta a saját memóriájába; a lépés `memoryLimitMb` korlátja csak a sandbox memóriájára hat.                                                                                                                                                                                                                                                                 | Végtelen válasz törzs 128 MB-os korláttal: 1000 ms alatt 1504 MB, 3000 ms alatt 2 GB fölötti gazda RSS; 300 MB-os válasz: a folyamat `FATAL ERROR: Zone Allocation failed - process out of memory` hibával leállt (`exit 134`). `files.readText("zero")` a `/dev` gyökéren: 639 MB RSS. | A törzs és a fájl legfeljebb a lépés memória korlátjáig olvasott (`read-capped-bytes.ts`), a hosszabb elkapható `TypeError`, illetve `Error`; a korlátnál hosszabb tartalom a sandboxba amúgy sem fér, tehát sikeres eset nem változik. `b914cd4` | `install-host-functions.spec.ts`: "a lépés memória korlátjánál hosszabb válasz törzs elkapható TypeError, a gazda nem olvassa végig (T-015-12)", "a lépés memória korlátjánál nagyobb fájl olvasása elkapható hiba (T-015-12)"          |
| F3  | közepes  | Az 1 ms-os határidő `script_evaluation_failed` ("a gazda oldalon megszakadt (QuickJSUnwrapError)") lett `script_timed_out` helyett: az interrupt kezelő az előkészítő kód előtt állt be, és az előkészítő kódban érkező megszakítás gazda hibaként jelent meg.                                                                                                                                                                                                        | `while (true) {}` `timeoutMs: 1` mellett: `script_evaluation_failed`, 15 ms.                                                                                                                                                                                                            | Az interrupt kezelő közvetlenül a szkript előtt áll be. `66ca28c`                                                                                                                                                                                 | `run-script.spec.ts`: "az 1 ms-os határidő is script_timed_out: az interrupt kezelő csak a szkript előtt áll be (T-015-12)"                                                                                                             |
| F5  | alacsony | A dobott érték leírásában (getter) a határidőig futó kód `script_evaluation_failed` lett: a jelzés a leírás előtt döntött.                                                                                                                                                                                                                                                                                                                                            | `throw { name: "x", get message() { for (;;) {} } }` 50 ms-mal: `script_evaluation_failed`.                                                                                                                                                                                             | A jelzés a leírás után dönt. `66ca28c`                                                                                                                                                                                                            | `run-script.spec.ts`: "a dobott érték leírásában (getter) futó és megszakított kód is script_timed_out (T-015-12)"                                                                                                                      |
| F6  | alacsony | A másodperces időkorlát mező alatt a séma ezredmásodperces mondata állt ("legfeljebb 2147483647 lehet"), illetve az egész szám mondat egy tört másodperc értékre (a T-015-10 jelzése).                                                                                                                                                                                                                                                                                | A `graph-script-node.spec.ts` korábbi állítása ezt a mondatot rögzítette.                                                                                                                                                                                                               | A mező alatt a saját, másodperces mondat áll (`timeout-seconds-field-error-message.ts`), a `structured-output-schema-rejected-message.ts` mintájára; a szabály nem változott. `ccde481`                                                           | `ScriptConfigFields.spec.tsx`: "a négy mező hibája az előtaggal együtt a saját mezője alatt jelenik meg, aria kötéssel"; e2e `graph-script-node.spec.ts`: "az időkorlát mentési hibái a mező alatt állnak: ..." (9/9 zöld, 3 workerrel) |

A javítás után ugyanazok a kísérletek: F1 végtelen változatai (négy alak, a getterben és a `toJSON` kimenetben futó
gazda hívással együtt) 200 ms-os határidővel mind 0,32 s alatt zártak; F2 `script_evaluation_failed`, a folyamat fut
tovább; F4 végtelen törzs 128 MB-tal 229 MB csúcs RSS, 1024 MB-tal 1144 MB, `/dev/zero` 128 MB-tal 198 MB, mindhárom
elkapható hibával.

### 10.2 Kísérletek, amelyek nem találtak hibát

- **Kitörés a csomagolásból** (`}); ...; (async () => {`, Q-7): lefordul és fut, de a kitörő kód ugyanabban a
  kontextusban, ugyanazokkal a nevekkel fut, mint a törzs; új képességet nem ad. Nem hiba.
- **Prototípus szennyezés:** az `Object.prototype.toJSON` a szkript saját kimenetét változtatja meg ("pwn"), a gazda
  argumentum olvasását csak a szkript saját adatán; a következő lépés friss modulon fut, átszivárgás nincs.
- **A gazda `JSON.stringify` és `JSON.parse`** a szkript előtt rögzített sandbox függvény, a felülírás nem hat rájuk.
- **Memória határok:** `memoryLimitMb` 16 és 2048 mellett a modul példányosul, 16 MB-on a foglalás elkapható
  `InternalError: out of memory`. A `timeoutMs` 2147483647 fut.
- **Útvonal:** `..`, abszolút, `..\\` (Linuxon fájlnév), `%2e%2e` (fájlnév), null bájt (`ERR_INVALID_ARG_VALUE`),
  kifelé mutató fájl link, szülő könyvtár link (olvasás és írás), függő link írása (`EEXIST`, `wx`), gyökérre mutató
  link, a gyökér maga link (`rootalias`): mind elutasítva vagy hibával, a gyökéren kívüli tartalom nem olvasható. A
  `files.list(".")` és a `files.list("")` a gyökeret listázza; a `readText(".")` "a gyökéren kívülre mutat" mondatot ad
  (a gyökér mint fájl elutasított, a mondat pontatlan, de nem szivárogtat). Relatív `cwd` a szerver munkakönyvtárához
  képest oldódik fel; nem létező `cwd`: `ENOENT`, a gazda útvonala nélkül.
- **Hálózat:** a gazda `fetch` (undici) automatikus fejlécei: `accept: */*`, `accept-language: *`, `sec-fetch-mode:
cors`, `user-agent: node`, `accept-encoding: gzip, deflate`; süti és hitelesítő fejléc nincs. `file:` és `data:`
  séma elutasítva, a 302 nem követve, a lassú válasz a határidőn megszakad.
- **Napló:** a szerver naplózója a szkript hibáját nem írja; a hibaüzenet a lépés `errorMessage` mezőjébe kerül (a
  REST `list-step-runs` és `get-run` adja ki), a gazda abszolút útvonala nélkül.
- **Hibaosztályok és motor:** mind az öt 5.7 osztály keletkezik (10.4 tábla, AC4); a `fail_run` és a megszakítás a
  futó JavaScript lépést a leállítás jelén állítja le (`create-run-supervisor.spec.ts`).

### 10.3 Maradék kockázatok és nyitott tételek

- **Titok a fájl hozzáférésen át (mérve).** A `cwd` a `/proc/self` vagy a `/` könyvtárra állítva a
  `files.readText("environ")` a szerver folyamat indulási környezeti változóit adja (saját mérés: a `PATH=` benne
  van). A SPEC-014 5.10 4. pontjának "a környezeti változók nem érhetők el" mondata ezért pontatlan volt, a spec
  javítva. **Lezárva** (user döntés 2026-11-04, "/proc és /dev tiltva"): 11.2.
- **A gazda memóriája a korlát többszöröse lehet.** A törzs a korlátig olvasott, de a gazda a puffert, a szöveget és a
  JSON szöveget egyszerre tartja, a sandbox WebAssembly memóriája mellett. 3,9 GB-os gépen az alapértelmezett 2048 MB-os
  korláttal egy 300 MB-os válasz a folyamatot leállította (`Zone Allocation failed`). Egy, a memória korlátnál kisebb
  gazda oldali olvasási plafon termékdöntés (új szám, forrás nélkül nem választható). **Lezárva** (user döntés
  2026-11-04, "Igen, iparági alapértékkel"): 50 MB, 11.3.
- **A `readText` nem kapja a lépés jelét:** egy nevesített cső (FIFO) megnyitása a gyökér alatt a lépés vége után is
  blokkolhat egy libuv szálat. A szkript FIFO-t nem tud létrehozni; nem javítva, nem ellenőrzött mélységben.
- **T-4, a pinelt QuickJS ismert hibái (maradék kockázat, kimondva).** A pinelt bellard pillanatkép (4. szekció)
  legalább két, a pin után javított memóriabiztonsági hibát tartalmaz az ng advisory-kkal azonos függvényekben, és
  újabb `quickjs-emscripten` kiadás nincs. A WebAssembly biztonsági modellje szerint a lineáris memória elérése régió
  szinten határellenőrzött, és a modul "can't escape the sandbox without going through appropriate APIs"
  (<https://webassembly.org/docs/security/>, egy forrás); a lineáris memórián belüli felülírás viszont lehetséges, tehát
  egy motor hiba a sandboxon belül tetszőleges állapotot és a gazda felé menő hívások argumentumait befolyásolhatja. A
  gazda felé menő út a négy gazda függvény és a `resolvePromise` feloldó függvényei: ugyanaz a képesség, amit a szkript
  amúgy is megkap. Hogy a glue kód (a `quickjs-emscripten` JavaScript oldala) egy sérült lineáris memóriából olvasott
  értékre hogyan reagál, nem ellenőrzött. Ellensúly változatlanul: a szkriptet a workflow készítő írja.
- **T-4 felületek eltávolíthatósága (mérve, nem bevezetve).** A kontextus a `newContext({ intrinsics })` opcióval a
  `TypedArrays` csoport nélkül is létrehozható (`quickjs-emscripten-core` 0.32.0 `DefaultIntrinsics`, `IntrinsicsFlags`:
  a csoporttal az `ArrayBuffer` is eltűnik), az `Array.prototype.toReversed`, `with`, `toSpliced`, `toSorted`, a
  `FinalizationRegistry` és a `WeakRef` pedig az előkészítő kódban törölhető (saját mérés: mind a hat `delete` igaz,
  utána `typeof` `undefined`, a globális nevek száma 44). Ez a szkript nyelvi felületének szűkítése, tehát termékdöntés. **Lezárva** (user döntés 2026-11-04, "A hat név törlése"): 11.1; a `TypedArrays` csoport
  marad.

### 10.4 A SPEC-014 8. szekció kritériumai

| #   | Ítélet                                                        | Bizonyíték                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | teljesül                                                      | `apps/server/src/script-end-to-end/script-end-to-end.spec.ts` "a CEL és a JavaScript szkript lépés lefut, a join script módja a joinInputs listát kapja, a futás succeeded"; `execute-node.spec.ts` "join script módban az executeJoinScript fut: ..." és "script ágon az executeScript fut: ..."; az `unimplemented_node_type` törölve (a kódban nulla találat), a kimerítő lista: `is-engine-error-kind.spec.ts` "mind az ötvenkilenc ágra igazat ad"                                                                                                                                              |
| 2   | teljesül                                                      | `run-script.spec.ts` "a hét név JSON értékként látszik", "a hiányzó név nem kerül a globális objektumra"; `execute-join-script.spec.ts` "a settings szkriptje a joinInputs listát a kontextusban kapja, a sor join típusú, és join_resolved esemény íródik script móddal"                                                                                                                                                                                                                                                                                                                            |
| 3   | teljesül                                                      | `run-script.spec.ts` "a nem JSON eredmény script_output_not_json: %s", "a JSON szöveggé nem alakítható eredmény script_output_not_json: %s"; `execute-script.spec.ts` "a tárolhatatlan kimenet step_output_not_storable osztállyal zárja a lépést"                                                                                                                                                                                                                                                                                                                                                   |
| 4   | teljesül                                                      | `script-end-to-end.spec.ts` "a fordíthatatlan JavaScript forrás indítása 422 script_compile_failed, a csomópont és a mező nevével, futás sor nélkül", "a JavaScript futásidejű hibája a lépést script_evaluation_failed osztállyal zárja, a futás failed"; `compile-script.spec.ts` "a szintaktikai hiba script_compile_failed, a QuickJS hibájának szövegével"; `execute-script.spec.ts` `it.each` a három lépés osztályra; `protocol-error-class-message.spec.ts` "a teszt táblázata a protokoll szótár minden tagját lefedi, pontosan egyszer"; `error-class-drift-protection` "futásidőben: ..." |
| 5   | teljesül                                                      | `run-script.spec.ts` "a globális objektum kulcslistája pontosan a QuickJS 61 neve, a fetch, a files és a jelen lévő kontextus nevek"; a CEL nyelvi garanciája a SPEC-010 S-12 (a CEL ágon nincs gazda függvény, `execute-script.spec.ts` "CEL ág: a kifejezés eredménye a lépés kimenete, a scriptRunner nem hívott")                                                                                                                                                                                                                                                                                |
| 6   | teljesül (a T-015-12 javításával, F1, F3)                     | `run-script.spec.ts` "a CPU kötött végtelen ciklust az interrupt kezelő állítja meg", "a soha fel nem oldott ígéretre váró szkriptet a gazda határideje állítja meg", "az 1 ms-os határidő is script_timed_out: ...", "a(z) %s argumentumában megszakított kód elkapása után ..."; `script-sandbox-limits.spec.ts` "a user döntése szerinti stack méret és a spec szerinti alapértelmezett határidő"; `node-config-drift-protection` "a JavaScript szkript timeoutMs felső határa a protokoll mentési sémáján és a db isNodeConfig guardján is ugyanúgy dönt"                                        |
| 7   | teljesül, kimondott maradék kockázattal (10.3, gazda memória) | `run-script.spec.ts` "a memória túllépés a sandboxban elkapható", "az el nem kapott memória túllépés script_evaluation_failed", "a gazdára kijutó RangeError script_evaluation_failed, és utána egy új lépés hibátlanul fut"; `script-sandbox-limits.spec.ts` "a modul plafonja pontosan a deklarált 32768 lap"; `node-config-drift-protection` "a JavaScript szkript memoryLimitMb tartománya a protokoll mentési sémáján és a db isNodeConfig guardján is ugyanúgy dönt"; a gazda oldali olvasás korlátja: F4 tesztjei                                                                             |
| 8   | teljesül                                                      | `install-host-functions.spec.ts` "az átirányítást nem követi", "a nem HTTP séma elutasítása el nem kapva script_evaluation_failed, elkapva a szkript kezeli", "a .. kivezetés és az abszolút útvonal elutasítva, a hibaüzenetben a gazda gyökere nincs", "a gyökéren kívülre mutató szimbolikus link olvasásra és írásra (szülő könyvtár link) elutasítva", "a null cwd gyökere a szerver folyamat munkakönyvtára (csak listázás)"                                                                                                                                                                   |
| 9   | teljesül                                                      | e2e `graph-script-node.spec.ts` "a runtime választó CEL kifejezésen áll és három JavaScript mező nincs; ...", "az üres source mentéskor a mező alatt jelez, PUT nélkül; kitöltés után a mentés lefut", "a JavaScript ágon is kötelező a source: üresen a mező alatt jelez, PUT nélkül"; `node-config-drift-protection` "a szkript source mezője a JavaScript ágon is kötelező mindkét oldalon (SPEC-014 5.9)"                                                                                                                                                                                        |
| 10  | teljesül                                                      | `docs/research/2026-08-26-toolchain.md` `quickjs-emscripten-core` és `@jitl/quickjs-wasmfile-release-sync` 0.32.0 sor, két forrással (npm registry, jsDelivr, GitHub tag)                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 11  | a T-015-13-ban                                                | a merge kapu (kilenc kapu a fejen, teljes e2e, `coverage:e2e:report`); a T-015-12 commitjai előtt a kilenc kapu helyben zöld volt                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 12  | teljesül                                                      | `866898b` (T-015-11 átvezetés: SPEC-003, SPEC-004, SPEC-008, SPEC-014, csomag `CLAUDE.md`-k, szabálykönyv, H-13)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

## 11. A 10.3 nyitott tételeinek lezárása: a user három döntése (2026-11-04)

A 10.3 három termékkérdésére a user döntése, szó szerint: (1) a QuickJS ismert hibái (T-4): "A hat név törlése"; (2) a
fájl hozzáférés: "/proc és /dev tiltva"; (3) a gazda oldali olvasási plafon: "Igen, iparági alapértékkel". Az átvezetés
a SPEC-014 5.3, 5.4 ("Eltávolított nevek", "Fájl", "A `/proc` és a `/dev` tiltása", "Olvasási plafon"), 5.9, 5.10, 7.1
(O-7, O-8, O-9) és 8. szekciójában, a PLAN-015 T-015-14 ... T-015-16 lépésében áll.

### 11.1 A hat név helye és törlése (T-015-14)

Saját mérés a pinelt modulon (`quickjs-emscripten-core` 0.32.0, `@jitl/quickjs-wasmfile-release-sync`): a
`toReversed`, `with`, `toSpliced` és `toSorted` saját tulajdonsága az `Array.prototype`-nak; a `toReversed`, `with` és
`toSorted` a `TypedArray` közös prototípusának (`Object.getPrototypeOf(Uint8Array.prototype)`) saját tulajdonsága, a
`toSpliced` ott nem létezik, és az egyes típusos tömbök (`Uint8Array.prototype`) saját tulajdonságai között egyik sincs;
a `FinalizationRegistry` és a `WeakRef` a globális objektum tulajdonsága. Mind a hét tulajdonság `configurable: true`.
A törlés az előkészítő kódban, a szkript előtt fut (`run-script.ts` `PRELUDE_SOURCE`).

Igazolás (`run-script.spec.ts`, "a pinelt QuickJS ismert hibáit hordozó hat név" csoport): a hat név az `Array`, mind a
tizenkét típusos tömb példányán és a globális objektumon `undefined`; a globális objektumból tulajdonság leírókon és
prototípus láncon át bejárt gráfban (getter hívás nélkül) egyik natív függvény sem található; az `eval`, a `Function`
konstruktor és a `Reflect.get` sem éri el őket; a megmaradt `sort`, `reverse`, `at` működik. A törlés nélküli
előkészítő kóddal (a `ef3ff9a` állapota) a csoport három tiltó tesztje és a globális kulcslista tesztje elbukik
(saját futtatás, 4 bukott, 33 zöld). A globális nevek száma 61-ről 59-re csökkent.

### 11.2 A `/proc` és a `/dev` tiltása (T-015-15)

- Mentés: a `protocol` mentési sémája a `cwd` abszolút alakját lexikálisan normalizálja (`isForbiddenScriptCwd`), a
  tiltott érték a `cwd` (`join` `script` módban a `settings.cwd`) útvonalán hibát ad. Igazolás:
  `node-config-save-schema.spec.ts`, `is-forbidden-script-cwd.spec.ts`, e2e `graph-script-node.spec.ts` (három érték,
  PUT nélkül, a mező alatt).
- Futás: a gyökér a szkript indítása előtt (`is-forbidden-script-root.ts`, lexikálisan és `fs.realpath` után), a
  `readText`, `writeText` és `list` útvonala a lexikális és a feloldott alakon (`is-forbidden-host-path.ts`). Igazolás:
  `run-script.spec.ts` ("a /proc és a /dev gyökér tiltása"), `read-text-in-root.spec.ts`, `list-in-root.spec.ts`,
  `write-text-in-root.spec.ts` (a `/dev`-re mutató szimbolikus link a `/` gyökér alatt, létező és új célra is). A `/`
  gyökér alatt a `proc/self/environ` olvasása ma elkapható hiba (a 10.3 mérésében a `PATH=` olvasható volt).
- TOCTOU, ami marad: az ellenőrzés a feloldott, link nélküli útvonalon történik, és a művelet ugyanazt a feloldott
  útvonalat nyitja meg (a meglévő minta). Ha az ellenőrzés és a megnyitás között egy KÜLSŐ folyamat a feloldott útvonal
  egy könyvtár elemét `/proc` vagy `/dev` alá mutató linkre cseréli, a megnyitás azt követi. A szkript maga linket nem
  tud létrehozni. Nem ellenőrzött, hogy a Node `fs` API-ján kívül (például `openat2` `RESOLVE_BENEATH`) lenne-e a
  Node 26 alatt elérhető, link követést tiltó megnyitás; a projekt ezt nem vezette be.
- A relatív `cwd` (például `../../proc`) a mentéskor nem dönthető el (a séma a böngészőben is fut), csak futáskor.

### 11.3 Az olvasási plafon alapértéke és forrásai (T-015-16)

A választott alapérték: **50 MB** (1 MB = 1024 * 1024 bájt) mindkét gazda olvasásra, csomópontonként felülírható
(`fetchResponseLimitMb`, `fileReadLimitMb`, egész 1 ... 2048), a hatályos plafon a beállított érték és a lépés memória
korlátja közül a kisebb.

| Plafon                 | Elsődleges forrás                                                                                                                                                                                          | Megerősítés 1                                                                                                                                                                                 | Megerősítés 2                                                                                                                                                                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| hálózati válasz, 50 MB | Google Apps Script "Quotas for Google Services", "Current limitations": "URL Fetch response size 50 MB / call" (<https://developers.google.com/apps-script/guides/services/quotas>, lekérdezve 2026-11-04) | GLUKIT "Limits & Quotas - Google Apps Script": "URL Fetch response size 50 MB / call" (<https://glukit.com/google-apps-script/limits.html>)                                                   | Justin Poehnelt "UrlFetchApp: The Unofficial Documentation", "Response Size 50 MB ... Scripts will throw an exception if exceeded" (<https://justin.poehnelt.com/posts/definitive-guide-to-urlfetchapp/>); továbbá Stack Overflow 58402500 a dokumentációt idézi |
| fájl olvasás, 50 MB    | Axellero sandbox `readFile` csomópont: "maxSize ... Maximum file size to read in bytes (default: 50MB)" (<https://docs.axellero.io/docs/nodes/sandbox/file-system/read-file>)                              | Google Apps Script blob olvasás: "the maximum size of the blob for Google Apps Script is 50 MB (52,428,800 bytes)" (<https://groups.google.com/g/google-apps-script-community/c/jxLTqkXKqWE>) | MBS Tech Nexus Blog: a `DriveApp.getBlob()` 50 MB-os korlátja (<https://technexus-blog.mbs.jp/2025/05/drive-apiresumable-uploadgooglegcs.html>); a Windmill közösségi kiadás kötetei fájlonként 50 MB (<https://www.windmill.dev/docs/core_concepts/volumes.md>) |

Miért ez: a vizsgált futtatók közül egyedül az Apps Script dokumentálja a szkript saját, kimenő `fetch` hívásának
válasz korlátját; a többi talált érték más dolgot korlátoz, és eltér: AWS Lambda szinkron hívás kérés és válasz
payload 6 MB (<https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html>), ez a függvény saját
be- és kimenete, nem a függvényből indított kérés válasza; Pipedream a naplók és a lépés exportok együttes méretét
6 MB-ra korlátozza (<https://pipedream.com/docs/workflows/limits>); a Val Town a worker memóriáját (4 GiB) korlátozza,
`fetch` válasz korlátot nem ad (<https://www.val.town/limits>). **Nem ellenőrzött:** az Apps Script blob olvasás 50
MB-os korlátja a hivatalos kvóta oldalon nem szerepel (a két megerősítés közösségi mérés és blog); hivatalos
dokumentáció csak az írás oldali párjára van (`DriveApp.createFile(name, content)`: kivétel, ha a tartalom 50 MB-nál
nagyobb, <https://developers.google.com/apps-script/reference/drive/drive-app>). A fájl plafon elsődleges forrása
ezért a sandbox futtató `readFile` dokumentált alapértéke.

Mérés (saját, ezen a gépen: 4 mag, 3,9 GB memória, swap nélkül, Node 26.7.0): az
`install-host-functions.spec.ts` "a 300 MB-os válasz az alapértelmezett olvasási plafonon (50 MB) elkapható TypeError
..." tesztje a plafon nélküli alapértékkel (az alapérték ideiglenesen 2048 MB-ra állítva, ami a korábbi, memória korlát
szerinti viselkedés `memoryLimitMb: null` mellett) a vitest workert `FATAL ERROR: Zone Allocation failed - process out
of memory` hibával leállította; az 50 MB-os alapértékkel a szkript `TypeError`-t kap, a teszt szerver a 300 MB-nak csak
a töredékét küldte el, és a következő lépés hibátlanul fut. A 300 MB-os (ritka) fájl a `readText`-en ugyanígy elkapható
hiba. A két mező egymástól független (a `fetchResponseLimitMb: 1` a fájl olvasást nem érinti), unit teszttel.

Ami marad (SPEC-014 5.10 5.): a gazda a plafon többszörösét tarthatja egyszerre (puffer, szöveg, JSON szöveg), több
párhuzamos lépés plafonja összeadódik, és a 2048 MB-ig emelhető plafon a gép memóriáját továbbra is meghaladhatja.

### 11.4 A kritérium tábla változása

| #   | Ítélet                                         | Új bizonyíték                                                                                                                                                                                                      |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 5   | teljesül                                       | `run-script.spec.ts` "a globális objektum kulcslistája pontosan a QuickJS 59 megmaradt neve, ...", a hat név csoport négy tesztje (11.1)                                                                           |
| 7   | teljesül, kimondott maradék kockázattal (11.3) | `install-host-functions.spec.ts` a 300 MB-os válasz és fájl, a két mező felülírása; `node-config-drift-protection` "a JavaScript szkript két olvasási plafonjának tartománya ..."; `script-sandbox-limits.spec.ts` |
| 8   | teljesül, kimondott TOCTOU maradékkal (11.2)   | a 11.2 tesztjei (gyökér és útvonal, lexikálisan és `fs.realpath` után)                                                                                                                                             |
| 9   | teljesül                                       | e2e `graph-script-node.spec.ts` a tiltott munkakönyvtár (három érték) és a két olvasási plafon mező alatti hibája, PUT nélkül; `ScriptConfigFields.spec.tsx`                                                       |
| 11  | a T-015-13-ban                                 | a merge kapu a végső fejen (PR leírás)                                                                                                                                                                             |
