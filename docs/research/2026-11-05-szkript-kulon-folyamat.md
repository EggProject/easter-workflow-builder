# A JavaScript szkript lépés külön operációs rendszer folyamatban (SPEC-017, PLAN-018)

Dátum: 2026-11-05. Spec: [`../spec/SPEC-017-szkript-kulon-folyamat.md`](../spec/SPEC-017-szkript-kulon-folyamat.md),
terv: [`../plan/PLAN-018-szkript-kulon-folyamat.md`](../plan/PLAN-018-szkript-kulon-folyamat.md). Előzmény:
[`2026-11-04-szkript-csomopont.md`](2026-11-04-szkript-csomopont.md) (a továbbiakban: SPEC-014 research).

A user döntése (2026-11-04), a kérdés és a válasz szó szerint: "A JavaScript szkript lépés maradék kockázatai: a
futó számítást csak a határidő állítja meg (a kézi leállítás nem), a motor ismert hibái, és egy szűk fájlrendszer
verseny. Mi legyen?" = "Külön folyamatban fusson": "Saját spec: minden szkript külön folyamatban, így a kézi leállítás
is azonnal hat; több munka."

## 1. Módszer

**Futtatókörnyezet.** Node `v26.7.0`, Linux `aarch64` sandbox, 4 CPU, 3906 MB memória, swap nélkül. A csomag verziók
változatlanok (SPEC-014 research 3. szekció), új függőség nincs.

**Mérő eszköz.** [`../../apps/server/measurement/script-process-measurement.ts`](../../apps/server/measurement/script-process-measurement.ts),
futtatás: `node --env-file=<titkot tartalmazó próba fájl> apps/server/measurement/script-process-measurement.ts`. Csak
`MEASUREMENT <json>` sorokat ír, képet nem. A 4. szekció számai két 2026-11-05-i futásból valók (M-1 ... M-5 az elsőből, M-6 és M-7 a javítás utáni másodikból), tíz ismétléssel.

**Forrásellenőrzés.** Minden állítás elsődleges forrás plusz két független megerősítés; ahol ez nincs meg, a 3.
szekció saját mérése zárja le, vagy "nem ellenőrzött" jelölést kap.

## 2. Források

| #   | Állítás                                                                                                | Elsődleges forrás                                                                                                                                                   | Megerősítés                                                                                                                                                                                                                      | Állapot                                   |
| --- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| C1  | a `fork` `execArgv` alapértéke a `process.execArgv` ("Default: `process.execArgv`")                    | <https://nodejs.org/api/child_process.html> (`fork`)                                                                                                                | <https://stackoverflow.com/questions/48510870/prevent-fork-from-adding-inspect-brk>, <https://stackoverflow.com/questions/34096458/passing-node-flags-args-to-child-process>                                                     | ellenőrzött; a `--env-file` öröklése: 3.1 |
| C2  | a `fork` `env` alapértéke a `process.env` ("Default: `process.env`")                                   | <https://nodejs.org/api/child_process.html>                                                                                                                         | független megerősítés nincs                                                                                                                                                                                                      | saját mérés zárja: 3.1                    |
| C3  | a `SIGKILL` nem kapható el, nem blokkolható és nem hagyható figyelmen kívül                            | <https://man7.org/linux/man-pages/man7/signal.7.html> ("The signals SIGKILL and SIGSTOP cannot be caught, blocked, or ignored.")                                    | <https://sourceware.org/glibc/manual/latest/html_node/Basic-Signal-Handling.html>, <https://www.daemon-systems.org/man/signal.7.html>                                                                                            | ellenőrzött                               |
| C4  | a gyerek `'disconnect'` eseménye az IPC csatorna lezárásakor sül el                                    | <https://nodejs.org/api/process.html> ("the `'disconnect'` event will be emitted when the IPC channel is closed")                                                   | <https://github.com/nodejs/node/issues/43930>                                                                                                                                                                                    | a szülő halálára saját mérés zárja: 3.2   |
| C5  | az `ArrayBuffer` háttértára a V8 heapen kívül áll                                                      | <https://v8.dev/blog/v8-release-83> ("Backing stores of `ArrayBuffer`s are allocated outside V8's heap")                                                            | <https://electronjs.org/blog/v8-memory-cage>, <https://zeroexp.dev/library/node-heap-statistics>                                                                                                                                 | ellenőrzött; a WebAssembly memória: 3.3   |
| C6  | a V8 alapértelmezett heap korlátja a rendszer erőforrásaitól függ                                      | <https://nodejs.org/api/v8.html> (`heap_size_limit`: "either the default limit, determined by system resources, or the value passed to the `--max_old_space_size`") | <https://nodejs.org/learn/diagnostics/memory/understanding-and-tuning-memory>, <https://stackoverflow.com/questions/79250132/how-does-node-v8-determine-its-max-heap-size>                                                       | ellenőrzött; képlet nincs dokumentálva    |
| C7  | a folyamat határ egy motor memória hibájának hatását a folyamatra korlátozza, de önmagában nem elég    | <https://www.chromium.org/developers/design-documents/multi-process-architecture/>                                                                                  | <https://developers.cloudflare.com/workers/reference/security-model/>, <https://docs.n8n.io/deploy/host-n8n/configure-n8n/set-up-task-runners> (a belső mód "insecure by design": ugyanaz az uid, fájlrendszer és környezet)     | ellenőrzött                               |
| C8  | a TOCTOU teljes ellenszere a fájlleíró alapú, komponensenkénti feloldás (`openat2` `RESOLVE_BENEATH`)  | <https://man7.org/linux/man-pages/man2/openat2.2.html>                                                                                                              | <https://cmu-sei.github.io/secure-coding-standards/sei-cert-c-coding-standard/rules/input-output-fio/fio45-c/>, <https://codeql.github.com/codeql-query-help/cpp/cpp-toctou-race-condition/>, <https://lwn.net/Articles/796868/> | ellenőrzött                               |
| C9  | a Node `fs` API-ban nincs `openat` vagy `RESOLVE_BENEATH` megfelelő                                    | <https://github.com/nodejs/node/issues/31110> (lezárva, nem valósult meg)                                                                                           | <https://github.com/libuv/libuv/issues/4167> (nincs `uv_fs_openat`)                                                                                                                                                              | nem ellenőrzött (hiány nem bizonyítható)  |
| C10 | az `O_NOFOLLOW` csak az utolsó útvonal elemre hat                                                      | <https://man7.org/linux/man-pages/man2/open.2.html> ("Symbolic links in earlier components of the pathname will still be followed")                                 | <https://lwn.net/Articles/796868/>, <https://cmu-sei.github.io/secure-coding-standards/sei-cert-c-coding-standard/rules/posix-pos/pos35-c/>                                                                                      | ellenőrzött                               |
| C11 | a Node 26 alapból futtatja a csak törölhető szintaxisú `.ts` fájlt, a `node_modules` alattit nem       | <https://nodejs.org/api/typescript.html> ("Stability: 2 - Stable")                                                                                                  | <https://nodejs.org/learn/typescript/run-natively>, <https://nodejs.org/learn/typescript/publishing-a-ts-package>                                                                                                                | ellenőrzött                               |
| C12 | a virtuális memória korlát (`ulimit -v`, `RLIMIT_AS`) mellett a WebAssembly memória foglalása elbukhat | <https://nodejs.org/en/blog/release/v20.15.0> (10 GB-os virtuális memória kalitka)                                                                                  | <https://github.com/nodejs/node/pull/52766>, <https://github.com/nodejs/node/issues/56596>                                                                                                                                       | ellenőrzött                               |

## 3. Saját mérések a források réseire

### 3.1 A gyerek kapcsolói és környezete (C1, C2)

Szülő: `node --env-file=t.env`, a fájlban egy `SECRETX=abc` sor. Gyerek alapértékkel (`fork(entry, ['child'])`): az
`execArgv` `["--env-file=t.env"]`, a `SECRETX` a gyerek környezetében áll, és a szerver 33 neve mind öröklődik.
Gyerek `execArgv: []` és `env: { TZ: 'UTC' }` mellett: az `execArgv` `[]`, a környezetben egyetlen név, a `TZ`. Tehát
explicit megadás nélkül a `start:server` script `--env-file-if-exists=.env` kapcsolója és a szerver teljes környezete
(a provider kulcsok is) a szkript folyamatba kerülne.

A mérő eszköz M-5 sora a Linux `/proc/<pid>/environ` fájlból méri a valódi `spawnScriptChild` folyamatot: a három név
`TZ`, `NODE_CHANNEL_FD` és `NODE_CHANNEL_SERIALIZATION_MODE`. Az utóbbi kettőt maga a Node teszi be az IPC csatornához;
titkot nem hordoznak. Ugyanott az alapértékű `fork` gyereke a szerver 34 nevéből 36-ot kap (a kettő többlet ugyanez).

**Az időzóna.** A sandbox `new Date(0).getTimezoneOffset()` értéke a folyamat `TZ` változóját követi: `TZ=Asia/Tokyo`
alatt `-540`, `TZ=Europe/Budapest` alatt `-60`, üres környezettel (`env -i`) `0`. A `TZ` ezért átmegy, ha a szerveren
be van állítva; enélkül a szkript a rendszer alapértelmezett időzónáját látja, mint a szerver.

### 3.2 A szülő halála (C4)

Egy tétlen gyerek `'disconnect'` figyelője fájlba írja az időpontot és kilép. A szülőt `kill -9` állítja le: a jelölő
fájl megjelent, és a gyerek folyamat egy másodpercen belül nem létezett. **Ez csak szabad eseményhurokra igaz:** a
független átvizsgálás (6. szekció) mérte, hogy `while (true) {}` alatt a gyerek a szülő halála után a lépés határidejéig
(ott 30 s) árván, teljes CPU terheléssel fut, mert az esemény a szinkron ciklus alatt nem sülhet el.

**A `process.ppid` friss.** Egy unoka folyamat szinkron ciklusban a `process.ppid` értékét figyeli, a szülőjét `SIGKILL`
állítja le: 286 ms után az érték `1`-re változott (a ciklus közben, eseményhurok nélkül). Egymillió olvasás 185 ms, tehát
az interrupt kezelőbe tett olvasás költsége elhanyagolható. A javítás ezért a szkript interrupt kezelőjében a határidő
mellett a szülő azonosítójának változását is figyeli (`serve-script-child.ts`, `run-script.ts`); a hatás az M-6.

### 3.3 A WebAssembly memória és a V8 heap korlát (C5)

`node --max-old-space-size=32` alatt egy `WebAssembly.Memory` 500 MB-ra nőtt, miközben a `heap_size_limit` 128 MB volt.
A `--max-old-space-size` tehát a sandbox memóriáját nem korlátozza; azt a lépés saját `WebAssembly.Memory` maximuma
korlátozza (SPEC-014 5.4 "Memória").

**A lépés memória korlátja mint heap korlát.** A szkript folyamat egy `return 1;` szkripttel `--max-old-space-size=8`
és `=16` mellett `SIGABRT`-tal leállt, `=32` mellett lefutott; a futás végén a `heapUsed` 17,0 MB volt. A SPEC-014
`memoryLimitMb` tartománya 16-tól indul, tehát a lépés korlátja heap korlátként a tartomány alján minden szkriptet
megbuktatna.

### 3.4 A T-5 regresszió a régi kódon

Az `apps/server/src/script-end-to-end/script-end-to-end.spec.ts` "REGRESSZIÓ (SPEC-014 7.2 T-5, SPEC-017)" tesztje
(`while (true) {}`, `timeoutMs: 60_000`, a lépés futó állapota után `POST /api/runs/:runId/interrupt`) a `9acafec`
kódján (a szerver szálán futó QuickJS) 60 066 ms után bukott (a Vitest 5000 ms-os korlátja), mert a ciklus alatt sem a
lépés állapotát lekérő `GET`, sem a megszakító `POST` nem kapott választ. Az új kódon zöld.

### 3.5 A gazda `fetch` és a `NODE_EXTRA_CA_CERTS`

Saját aláírású tanúsítványú helyi HTTPS szerver, a szerver folyamat `NODE_EXTRA_CA_CERTS=<a tanúsítvány>` értékkel
indul (a független átvizsgálás próbája, 6. szekció). A szerver folyamatában futó régi út sikeres, a külön folyamatos út
az üres környezettel `a hálózati kérés nem sikerült (TypeError)`. A `NODE_EXTRA_CA_CERTS` átadása után mindkét út
sikeres; a változó nélkül mindkettő hibát ad (saját mérés 2026-11-05).

## 4. A mérések (M-1 ... M-7)

| #   | Mit mér                                                                                   | Eredmény (10 ismétlés, min / medián / max)                                                                                                        |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| M-1 | indítási költség, `return 1;`                                                             | a szerver folyamatában 3,9 / 7,3 / 18,4 ms; külön folyamatban 138,0 / 140,2 / 143,4 ms                                                            |
| M-2 | a kézi leállítás azonnalisága `while (true) {}` alatt, 60 000 ms-os határidővel           | a jeltől az `aborted` eredményig 0,1 / 0,1 / 0,3 ms; a jeltől a folyamat kilépéséig 3,5 / 4,4 / 5,0 ms; mind a tíz `aborted`                      |
| M-3 | a memória                                                                                 | a 16 MB-os sandbox túllépése a külön folyamatban is elkapható (`out of memory`); a V8 alapértelmezett heap korlátja ezen a gépen 2049,5 MB        |
| M-4 | a szerver túlélése: a CPU kötött szkript folyamata kívülről `SIGSEGV`-t kap               | a lépés `script_evaluation_failed` ("a szkript folyamata válasz nélkül leállt (jelzés: SIGSEGV)"), a mérő folyamat él, és a következő lépés lefut |
| M-5 | a szkript folyamat környezete                                                             | `TZ`, `NODE_CHANNEL_FD`, `NODE_CHANNEL_SERIALIZATION_MODE` (3.1)                                                                                  |
| M-6 | árva folyamat: a `while (true) {}` szkript szülője `SIGKILL`-t kap, 60 000 ms-os határidő | a szkript folyamat 11 ms alatt megszűnt (a javítás előtt a határidőig futott, 6. szekció)                                                         |
| M-7 | tíz egyszerre várakozó szkript folyamat RSS-e                                             | folyamatonként 102,6 / 106,5 / 109,9 MB, összesen 1062 MB                                                                                         |

Az M-1 különbsége (a medián szerint kb. 133 ms) a Node folyamat indítása, a TypeScript forrás betöltése és a QuickJS
modul példányosítása a gyerekben; lépésenként egyszer jelentkezik.

## 5. Döntések

1. **`child_process.fork`, nem `worker_threads`.** A `worker_threads` a SPEC-014 5.1 szerint kizárt (csak heap és stack
   korlát, fájlrendszer és hálózat izoláció nincs, S-3), és a user döntése külön folyamatot mond.
2. **A gyerek kapcsolói és környezete explicit** (`execArgv: []`, `env` csak `TZ`), 3.1 alapján.
3. **A határidő és a kézi leállítás a folyamat megölése** (`SIGKILL`, C3). A gyerek saját határideje (interrupt kezelő
   és gazda oldali időzítő) ugyanarra az időpontra áll (a kérés `deadlineMs` mezője), tehát bármelyik ér előbb célba,
   az eredmény ugyanaz a `script_timed_out` mondat.
4. **Nincs `--max-old-space-size` kapcsoló.** A lépés `memoryLimitMb` értéke heap korlátként a tartomány alján nem fut
   (3.3), más értékre nincs dokumentált szabály (szabálykönyv 4. szekció 1. pont), a V8 alapértelmezése a rendszer
   erőforrásaiból jön (C6). A folyamat szintű hatás így: a gazda oldali foglalás (az olvasási plafon pufferei) a V8
   alapértelmezett korlátján a szkript folyamatot állítja le, nem a szervert (M-4 mintája). Nyitva: SPEC-017 7. szekció.
5. **A fordítás (`compileScript`) a szerver folyamatában marad**: szkript kódot nem futtat (`compileOnly`, SPEC-014
   research Q-7), és a QuickJS ismert hibái (SPEC-014 research 4. szekció) futásidejű függvényekben állnak.
6. **A CEL ág helyben marad**: fájl és hálózat hozzáférése nincs (nyelvi garancia, SPEC-014 S-12), a kiértékelése
   szinkron és rövid, és az időkorlátjáról a SPEC-010 O-2 user döntése szól ("most nincs korlát").
7. **TOCTOU**: a teljes ellenszer (C8) a Node `fs` API-ban nem érhető el (C9), az `O_NOFOLLOW` a köztes elemeket nem
   védi (C10). A folyamat határ ezen nem változtat, mert a gyerek ugyanazzal a felhasználóval fut (C7, n8n). A maradék
   változatlanul a külső folyamat linkcseréje.

## 6. A független adverzariális átvizsgálás (2026-11-05)

Egy független átvizsgálás a `fd7f2b1` fejen, saját próbákkal. Talált tételek és sorsuk:

| #   | Súly     | Tétel                                                                                                                                                                    | Sors                                                                                                       |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 1   | magas    | CPU kötött szkript mellett a szerver `kill -9`-e után a szkript folyamat árván, teljes CPU-val a határidőig fut (próba: 30 s-os határidővel a határidőig élt)            | javítva: a `ppid` figyelés az interrupt kezelőben (3.2, M-6), unit teszt                                   |
| 2   | magas    | az üres környezet a `fetch`-et megváltoztatja (`NODE_EXTRA_CA_CERTS`, proxy)                                                                                             | a `NODE_EXTRA_CA_CERTS` átmegy (3.5); a proxy és a tanúsítvány tár kapcsolói: SPEC-017 7. T-3, user döntés |
| 3   | magas    | lépésenként kb. 107 MB RSS, párhuzamossági korlát nélkül (próba: 20 lépés 2156 MB; a szerver folyamatában 20 lépés 33,6 MB többlet)                                      | mérve (M-7), kimondva (SPEC-017 4.5), korlát: SPEC-017 7. T-4, user döntés                                 |
| 4   | közepes  | a "szerver környezete elzárt" állítás hamis: a kitört kód a `/proc/<ppid>/environ` fájlt olvashatja (próba: a szülő titka olvasható, a `mem` `EACCES`, `ptrace_scope` 1) | a SPEC-017 4.8 és a SPEC-014 5.10 1. pontja javítva                                                        |
| 5   | közepes  | a `fork` szinkron kivétele (a Node 26.7.0 forrása szerint például `ENOMEM`) elutasított ígéretet adott                                                                   | javítva: `try`, `script_evaluation_failed`, unit teszt                                                     |
| 6   | alacsony | a végponttól végpontig T-5 teszt az új kódon a ciklus előtt szakított meg                                                                                                | javítva: a szkript jelzőfájlt ír, a teszt annak megjelenése után szakít meg                                |
| 7   | alacsony | a valódi folyamatos T-5 unit teszt a `SIGKILL` elhagyására is zöld maradt                                                                                                | javítva: a teszt a szkript folyamat `exit` eseményét is várja                                              |

Az átvizsgálás megerősítette: a T-5 végponttól végpontig teszt a régi kódon bukik (60 070 ms), a nagy IPC kimenet
(150 futás 3 MB, 10 futás 20 MB) versenyhelyzet nélkül megy át, és a szabályos leállás a szkript folyamatokat megöli.

## 7. Nyitva

- A szkript folyamat heap korlátjának értéke (5. szekció 4. pont): nincs rá dokumentált szabály.
- A proxy változók és a tanúsítvány tár kapcsolói (SPEC-017 7. T-3), a párhuzamos szkript folyamatok száma (T-4).
- A Node `fs` `openat` hiánya (C9) nem bizonyítható, csak két issue utal rá.
- macOS alatt a mérések nem futottak; a `/proc/<pid>/environ` mérés (M-5) Linux specifikus.
