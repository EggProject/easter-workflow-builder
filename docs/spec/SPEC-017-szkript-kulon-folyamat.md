# SPEC-017: A JavaScript szkript lépés külön operációs rendszer folyamatban

|          |                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz  | végrehajtva (PLAN-018); a 7. szekció T-1 és T-2 tétele kimondott korláttal nyitva                                                     |
| Dátum    | 2026-11-05                                                                                                                            |
| Előzmény | [`SPEC-014`](SPEC-014-szkript-csomopont.md) 5.4, 5.8, 5.10, 7.2 T-4 és T-5                                                            |
| Bemenet  | [`../research/2026-11-05-szkript-kulon-folyamat.md`](../research/2026-11-05-szkript-kulon-folyamat.md) (források C1 ... C12, mérések) |
| Terv     | [`../plan/PLAN-018-szkript-kulon-folyamat.md`](../plan/PLAN-018-szkript-kulon-folyamat.md)                                            |

---

## 1. Cél és hatókör

**A user döntése (2026-11-04)**, a kérdés és a válasz szó szerint: "A JavaScript szkript lépés maradék kockázatai: a
futó számítást csak a határidő állítja meg (a kézi leállítás nem), a motor ismert hibái, és egy szűk fájlrendszer
verseny. Mi legyen?" = "Külön folyamatban fusson": "Saját spec: minden szkript külön folyamatban, így a kézi leállítás
is azonnal hat; több munka."

### Amit eldönt

1. A JavaScript szkript lépés (a `script` node és a `join` `script` módja, `runtime: 'javascript'`) lépésenként új
   operációs rendszer folyamatban fut (4.1).
2. A szülő és a szkript folyamat kommunikációját (4.2), a szkript folyamat környezetét (4.3).
3. Az időkorlátot és a kézi leállítást a folyamat megölésével (4.4).
4. A memória korlátot a folyamat szintjén (4.5).
5. A fordítás és a CEL ág helyét (4.6), a fájl és hálózat szabályok és a TOCTOU maradék sorsát (4.7), a QuickJS
   hibák kockázatának változását (4.8).

### Amit NEM dönt el

- A SPEC-014 szkript szemantikáját (bemenet, kimenet, hibaosztályok, gazda függvények, korlátok, a hat törölt név): az
  változatlan, a futtató csak más folyamatban fut.
- Operációs rendszer szintű sandboxot (más felhasználó, seccomp, namespace): Docker és konténer tilos (`.claude/CLAUDE.md` 7. szekció), a többi a user döntésén túl esik.

## 2. Kiindulási állapot (`9acafec`)

| Mi                  | Mai állapot                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| A futtató helye     | a szerver folyamatának fő szála (`apps/server/src/script-runner/run-script.ts`), SPEC-014 5.4 "Párhuzamosság"                       |
| Kézi leállítás      | CPU kötött kód alatt nem ér célba, a lépés a határidőn áll meg (SPEC-014 5.8, 7.2 T-5; mérve: research 3.4, a régi kódon 60 066 ms) |
| Szolgáltatás kiesés | a CPU kötött szkript a határidőig az egész szervert (HTTP, SSE, a többi futás) foglalja (SPEC-014 5.10 5.)                          |
| Összeomlás          | egy, a gazdára kijutó hiba vagy a gazda memória kifogyása a szerver folyamatot állítja le (SPEC-014 research 10.3)                  |
| QuickJS hibák       | a hat név törölve, a többi nem ellenőrzött tétel marad, a motor a szerver folyamatában (SPEC-014 5.10 1., 7.2 T-4)                  |

## 3. Megerősített tények

A teljes lista a research 2. szekciójában (C1 ... C12), a rések saját mérése a 3. szekcióban.

- A `fork` `execArgv` alapértéke a szülő `process.execArgv`-je (C1), az `env` alapértéke a `process.env` (C2); mérve:
  alapértékkel a szülő `--env-file` kapcsolója és a fájlból betöltött titok is a gyerekbe kerül (research 3.1).
- A `SIGKILL` nem kapható el és nem hagyható figyelmen kívül (C3).
- A szülő halálakor a gyerek `'disconnect'` eseményt kap (C4, mérve: research 3.2).
- A `--max-old-space-size` a V8 heapre hat; az `ArrayBuffer` háttértára a heapen kívül áll (C5), és mérve a
  `WebAssembly.Memory` is túlnő rajta (research 3.3).
- A folyamat határ egy motor hiba hatását a folyamatra korlátozza, de ugyanazzal a felhasználóval, fájlrendszerrel és
  környezettel futó gyerek kitörése a szülő jogait kapja (C7).
- A TOCTOU teljes ellenszere fájlleíró alapú, komponensenkénti feloldás (C8); a Node `fs` API-ban ennek megfelelőjét
  nem találtuk (C9, nem ellenőrzött), az `O_NOFOLLOW` csak az utolsó elemre hat (C10).

## 4. Döntések

### 4.1 Folyamat lépésenként

- Minden JavaScript szkript lépés új folyamatot indít `child_process.fork`-kal (nem `worker_threads`: SPEC-014 5.1), a
  belépési pont `apps/server/src/script-runner/script-child-entry.ts`, a Node natív type strippingjével (C11), mint a
  szerver `main.ts`-e.
- A folyamat pontosan egy kérést szolgál ki, a válasz elküldése után kilép; a szülő minden döntés után `SIGKILL`-t küld
  (a már kilépett folyamatnak a Node nem küld jelzést).
- A szülő halálakor a szkript folyamat a `'disconnect'` eseményre kilép (4.2), tehát árva nem marad.
- A SPEC-014 5.4 "Életciklus" (friss WebAssembly modul lépésenként) változatlan, most a szkript folyamatán belül.

### 4.2 Kommunikáció

- A Node IPC csatornája, `serialization: 'json'`. A szülő egy kérést küld (`SandboxRunRequest`: a forrás, a futás
  kontextus JSON szövege, a feloldott fájl gyökér, a feloldott időkorlát és az abszolút határidő, a három korlát mező),
  a gyerek egy választ (`ScriptRunResult` `succeeded` vagy `failed` ága).
- Mindkét oldal az `unknown` üzenetet typeguarddal ellenőrzi (`isSandboxRunRequest`, `isScriptRunResult`, zárt
  kulcslista). A nem várt alakú kérésre és válaszra `script_evaluation_failed`.
- A fájl gyökeret (`cwd`, üresen a szerver munkakönyvtára, SPEC-014 O-5) a szülő oldja fel, hogy a gyerek
  munkakönyvtára ne számítson.

### 4.3 Környezet

- `execArgv: []`: a szerver kapcsolói (köztük a `start:server` `--env-file-if-exists=.env` kapcsolója) nem öröklődnek.
- `env`: a szerver környezete nem öröklődik; egyetlen név megy át, ha a szerveren be van állítva: a `TZ`, mert a
  sandbox `Date` értéke azt követi (research 3.1). A Node saját IPC változóit (`NODE_CHANNEL_FD`,
  `NODE_CHANNEL_SERIALIZATION_MODE`) maga a Node teszi be (mérve, M-5).
- `stdio`: a három szabványos csatorna eldobva, csak az IPC él (a szkript nem ír naplót, SPEC-014 5.4).
- A szkript a sandboxból `process`-t eddig sem ért el; a változás a QuickJS kitörés esetére szól (4.8): a kitört kód
  a szkript folyamat környezetét látná, abban titok nincs.

### 4.4 Időkorlát és kézi leállítás

- A határidő a lépés indulásától számít (a folyamat indítása is beleszámít), `timeoutMs` vagy 60 000 ms (SPEC-014
  5.4). A szülő a határidőn a folyamatot `SIGKILL`-lel megöli, a lépés `script_timed_out`.
- A gyerek saját határideje (az interrupt kezelő és a gazda oldali időzítő, SPEC-014 5.4) ugyanarra az abszolút
  időpontra áll (`deadlineMs`), és ugyanazt a mondatot adja; bármelyik ér előbb célba, az eredmény azonos.
- A motor jele (megszakítás, `fail_run`, szabályos leállás, SPEC-014 5.8) a folyamatot azonnal megöli, a szkript
  kódjától függetlenül, CPU kötött ciklus alatt is; a lépés `aborted` (a motor `cancelled` vagy `interrupted` állapotban
  zárja). Mérve (M-2): a jeltől az eredményig medián 0,1 ms, a folyamat kilépéséig medián 4,4 ms. Ez lezárja a
  SPEC-014 7.2 T-5 tételét.
- A szerver eseményhurka a CPU kötött szkript alatt szabad: a SPEC-014 5.4 "Párhuzamosság" kimondott korlátja és az
  5.10 5. pont első mondata a JavaScript útra megszűnik.
- A válasz nélküli kilépés (összeomlás, a gazda memória kifogyása, külső jelzés) `script_evaluation_failed` a kilépési
  kóddal vagy a jelzéssel; a szerver fut tovább (M-4). Az indítás vagy a csatorna hibája szintén
  `script_evaluation_failed`.

### 4.5 Memória a folyamat szintjén

- A sandbox memóriája változatlanul a lépés `WebAssembly.Memory` maximuma (`memoryLimitMb`, SPEC-014 5.4); a
  `--max-old-space-size` erre nem hat (research 3.3).
- A gazda oldali foglalás (a `fetch` és a `readText` puffere az olvasási plafonig, SPEC-014 5.4) a szkript folyamat V8
  heapjében és külső memóriájában áll. A szkript folyamat nem kap `--max-old-space-size` kapcsolót: a lépés
  `memoryLimitMb` értéke heap korlátként a tartomány alján (16 MB) már a folyamat indulását megbuktatja (research 3.3),
  más értékre nincs dokumentált szabály. A heap korlát így a V8 alapértelmezése (C6). A kifogyás a szkript folyamatot
  állítja le, nem a szervert (4.4 utolsó pontja). Nyitva: 7. szekció T-1.

### 4.6 A fordítás és a CEL ág

- A `compileScript` (`script_compile_failed`, SPEC-014 5.7) a szerver folyamatában marad: futtatás nélküli fordítás
  (`compileOnly`, SPEC-014 research Q-7), szkript kódot nem futtat, és a pinelt QuickJS ismert hibái futásidejű
  függvényekben állnak (SPEC-014 research 4. szekció).
- A CEL ág (`runtime: 'expression'`) helyben marad: fájl és hálózat hozzáférése nincs (nyelvi garancia, SPEC-014
  S-12), és az időkorlátjáról a SPEC-010 O-2 user döntése szól ("most nincs korlát").

### 4.7 Fájl, hálózat és a TOCTOU maradék

- A `fetch` és a `files` gazda függvény szabályai (O-5, O-6, a `/proc` és `/dev` tiltás, az olvasási plafon) szó
  szerint változatlanok; a gazda függvények a szkript folyamatában futnak.
- A folyamatban lévő hálózati kérés a folyamat megölésekor megszakad (unit teszt: a teszt szerver a kapcsolat
  bezárását látja).
- **TOCTOU.** A teljes ellenszer (`openat2` `RESOLVE_BENEATH` vagy fájlleíró alapú, komponensenkénti feloldás, C8) a
  Node `fs` API-ban nem érhető el (C9, nem ellenőrzött), az `O_NOFOLLOW` a köztes elemeket nem védi (C10). A folyamat
  határ ezen nem változtat, mert a szkript folyamat ugyanazzal a felhasználóval fut (C7). A maradék tehát a SPEC-014 5.4
  szerinti: egy KÜLSŐ, a gyökérbe írni képes folyamat az ellenőrzés és a megnyitás között linkre cserélheti a feloldott
  útvonal egy könyvtár elemét; a szkript maga linket nem tud létrehozni. Nyitva: 7. szekció T-2.

### 4.8 A QuickJS hibák kockázata

A pinelt QuickJS motor ismert hibái (SPEC-014 7.2 T-4) a folyamat határral a szkript folyamatára szűkülnek: egy
memória hibát kihasználó kód a szkript folyamat memóriáját és jogait kapja, nem a szerverét (C7: a Chromium
többfolyamatos architektúrája és a Cloudflare Workers modellje ugyanezért futtatja a motort külön folyamatban). Ami a
kitört kód elől elzárt a szerver folyamathoz képest: a szerver memóriája (adatbázis kapcsolat, futás állapot, a
memóriában tartott titkok), a szerver környezeti változói (4.3) és a szerver eseményhurka. Ami nem: a fájlrendszer és
a hálózat a szerver felhasználójának jogaival (C7, n8n: ugyanazzal az uid-del futó gyerek "insecure by design"), tehát
a SPEC-014 5.10 2.-4. pontja változatlan. A T-4 tétele ezzel pontosítva marad nyitva (SPEC-014 7.2).

## 5. Tesztelés

- Unit, hamis folyamattal: a kérés leképezése, a válasz, a nem várt alakú válasz, a válasz nélküli kilépés (kód és
  jelzés), az indítás hibája, a már megszakított jel (folyamat sem indul), a jel futás közben, a határidő; minden ágon
  `SIGKILL`.
- Unit, valódi folyamattal: siker, **a T-5 regressziója** (a kézi leállítás `while (true) {}` alatt, 60 000 ms-os
  határidővel, a Vitest 5000 ms-os korlátján belül `aborted`), a határidő CPU kötött ciklusra, a függő hálózati kérés
  kapcsolata a leállításkor megszakad, a kívülről megölt folyamat a lépés hibája és utána új lépés fut, a sandbox
  memória túllépése elkapható.
- A szkript folyamat oldala hamis csatornával: kérés, nem várt alakú kérés, `'disconnect'`, IPC nélküli indítás.
- A `spawnScriptChild` a `fork` hívás opcióira (`execArgv: []`, `env` csak `TZ`, `stdio`, `serialization`).
- Végponttól végpontig (`script-end-to-end`): a futás megszakítása a CPU kötött JavaScript lépés alatt a lépést
  `cancelled` állapotban zárja (a régi kódon a teszt 60 066 ms után bukott, research 3.4).
- A SPEC-014 `runScript` tesztjei a szkript folyamat függvényén változatlan állításokkal; a jel tesztjei a folyamat
  szintre kerültek.

## 6. Mérések

A research 4. szekciója (M-1 ... M-5), a mérő eszköz `apps/server/measurement/script-process-measurement.ts`.
Röviden: a külön folyamat lépésenként kb. 133 ms indítási többletet ad (M-1); a kézi leállítás CPU kötött ciklus alatt
azonnali (M-2); a sandbox memória korlátja a folyamatban is hat (M-3); a kívülről megölt szkript folyamat mellett a
szerver fut (M-4); a környezetben titok nincs (M-5).

## 7. Nyitott kérdések

| #   | Kérdés                                                       | Mi a viselkedés addig                                                                                                                                 | Mi zárná le                                                                                                                             |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| T-1 | A szkript folyamat V8 heap korlátja (`--max-old-space-size`) | nincs kapcsoló, a V8 alapértelmezése (C6); a kifogyás a szkript folyamatot állítja le, a lépés `script_evaluation_failed`, a szerver fut tovább (4.5) | user döntés egy értékről vagy szabályról (a lépés `memoryLimitMb` értéke heap korlátként a 16 MB-os alsó határon nem fut, research 3.3) |
| T-2 | TOCTOU a fájl hozzáférésben                                  | a SPEC-014 5.4 ellenőrzése a feloldott útvonalon; a külső folyamat linkcseréje marad (4.7)                                                            | a Node `fs` fájlleíró relatív megnyitása (`openat`, `RESOLVE_BENEATH`) vagy a szkript folyamat más felhasználóval                       |

## 8. Elfogadási kritériumok

1. A JavaScript szkript lépés lépésenként külön folyamatban fut, a válasz után a folyamat kilép, és minden döntés
   után `SIGKILL`-t kap (unit teszt hamis és valódi folyamattal).
2. A kézi leállítás CPU kötött ciklus alatt azonnal hat (a T-5 regressziója unit és végponttól végpontig tesztben; a
   régi kódon bukik).
3. A határidő CPU kötött ciklusra és gazda ígéretre várakozásra is `script_timed_out` (a SPEC-014 6. kritériuma
   változatlan).
4. A szkript folyamat `execArgv`-je üres, a környezetében a szerver változói közül csak a `TZ` áll (unit teszt és M-5).
5. A szkript folyamat válasz nélküli leállása a lépés `script_evaluation_failed` hibája, a szerver fut tovább (unit
   teszt és M-4); a szülő halálakor a szkript folyamat kilép (research 3.2).
6. A memória korlát (`memoryLimitMb`) a külön folyamatban is hat (unit teszt és M-3); a heap korlát sorsa kimondva
   (4.5, T-1).
7. A fordítás és a CEL ág helye indokolva (4.6); a TOCTOU maradék forrással kimondva (4.7); a QuickJS hibák
   kockázatának változása forrással kimondva (4.8).
8. A SPEC-014 7.2 T-4 és T-5 sora, az 5.4 "Párhuzamosság", az 5.8 és az 5.10 1., 3. és 5. pontja átvezetve.
9. Kilenc kapu zöld, unit lefedettség 100 százalék, e2e küszöb nem romlik.

## 9. Kapcsolódó dokumentumok

- [`../plan/PLAN-018-szkript-kulon-folyamat.md`](../plan/PLAN-018-szkript-kulon-folyamat.md)
- [`../research/2026-11-05-szkript-kulon-folyamat.md`](../research/2026-11-05-szkript-kulon-folyamat.md)
- [`SPEC-014-szkript-csomopont.md`](SPEC-014-szkript-csomopont.md)
