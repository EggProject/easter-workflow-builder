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
