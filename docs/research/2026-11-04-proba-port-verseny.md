# A `run-probe.spec.ts` billegő `ECONNREFUSED` hibája: port verseny

Dátum: 2026-11-04. Ág: `fix/lista-mezo-enter-es-probe-teszt`. Minden szám saját, most futtatott mérés a
fejlesztői sandboxban (Linux, 4 mag, `ip_local_port_range` = `32768 60999`).

## 1. A jelenség

Az `apps/server/measurement/run-probe.spec.ts` a teljes `bun run test` futásban néhányszor `ECONNREFUSED`
hibával bukott, újrafuttatva zöld volt.

## 2. A régi kód útja

A `runProbe` a `findFreePort` segítségével `listen(0)` hívással kért portot az operációs rendszertől,
**felszabadította**, és a számot `EASTER_SERVER_PORT` néven adta a gyermek szervernek. A gyermek (a hamis
ágenses szerver vagy a valódi `main.ts`) a teljes szerver modulfa betöltése után kötött rá. A
`startProbeServer` a `GET /api/providers` `200` válaszára várt ezen a porton, és **bárki** `200` válaszát a
saját gyermekének tekintette.

## 3. Mérések

1. **Az ablak hossza.** Ideiglenes naplózással (nem commitolt) a port kiválasztása és a gyermek első `200`
   válasza között egy teljes `vitest run` futásban (745 fájl, 7991 teszt, zöld) hat próbán 0,76 ... 1,04 s telt
   el. Ennyi ideig a port szabad, és a gyermek még nem kötött rá.
2. **A kiosztott portok.** Ugyanebben a futásban minden `listen(0)` által kiosztott port páratlan volt és a
   fenti tartományba esett: a párhuzamos Vitest munkafolyamatok (az `apps/server` tesztjeinek `listen(0)`
   szerverei, köztük a valódi útvonal kezelőkkel futók) ugyanebből a készletből kapnak portot.
3. **Kiváltott ütközés, régi kód.** Egy repón kívüli segéd 300 párhuzamos, 100 ms életű `listen(0)` HTTP
   szervert forgatott, amelyek minden kérésre `200` választ adtak. Közben a `run-probe.spec.ts` öt futásából
   négy bukott (40 tesztből 6): a napló szerint az idegen szerver a kiválasztott porton már 90 ms után `200`
   választ adott a `GET /api/providers` kérésre (a saját gyermek ekkor még be sem töltött), a próba neki küldte
   a `PUT /api/settings` és a `POST /api/workflows` kérést, és a válasz sémahibával bukott.
4. **Pontos tünet, régi kód.** Ugyanez a segéd úgy, hogy minden szerver az első válasza után azonnal bezár (mint
   egy párhuzamos teszt, ami leállítja a saját szerverét): hat futásból hat bukott (48 tesztből 11), mind
   `connect ECONNREFUSED 127.0.0.1:<port>` hibával. Ez a jelentett tünet.
5. **Új kód, ugyanazzal a terheléssel.** A 3. pont segédjével 8 futás (72 teszt), a 4. pont segédjével 6 futás
   (54 teszt): egyetlen bukás sem, és a segéd szerverei egyetlen kérést sem kaptak.

## 4. Gyökérok

A szabad port kiválasztása (`listen(0)`, majd bezárás) és a gyermek kötése között kb. 1 s ablak van, amiben egy
párhuzamosan futó teszt `listen(0)` szervere ugyanazt a portot kaphatja. Ha ez egy valódi útvonal kezelős
teszt szerver, a próba `200` választ kap tőle, vele beszél, és amikor az a teszt leállítja a szerverét, a
következő kérés `ECONNREFUSED`. A természetes (terhelés nélküli) futásban az ütközés partnerét nem figyeltük
meg; a mechanizmust a 3. és 4. pont igazolja, a konkrét partner teszt **nem ellenőrzött**.

## 5. Javítás

A port választását a kötést végző folyamat végzi: a hamis ágenses szerver `EASTER_SERVER_PORT=0` értéket kap,
`listen(0)` után a stdout első sorában jelenti a lekötött portot (`probe-port-report.ts`), és a
`startProbeServer` erre a portra csatlakozik (`ProbeServerCommand` `reports-port` ága). Választás és kötés
között nincs ablak, tehát a port nem vehető el. Nem időkorlát emelés és nem újrapróbálás.

Regressziós teszt: a `run-probe.spec.ts` "a portot a szerver maga köti le és jelenti" esete; a régi
`runProbe` mellett `Expected "0", Received "39355"` hibával bukik. A `start-probe-server.spec.ts` a jelentés
útját, a hibás első sort, a megszakítást és a kiosztott port ágát fedi.

## 6. Ami nyitva marad

- A valódi `src/main.ts` csak pozitív portot fogad (`readServerConfig`, `readPositiveIntegerOrDefault`), ezért a
  valódi próba (`real-provider-probe.ts`, `assigned-port` ág) továbbra is előre választ portot, tehát ott az
  ablak megmarad. Ez kézi, user engedélyes futás, nem a tesztkészlet része. A lezáráshoz termék döntés kell
  (például `EASTER_SERVER_PORT=0` engedése és a lekötött port jelentése); addig a viselkedés változatlan.
- Ugyanez a minta (szabad port kérése, bezárás, majd kötés) áll az `apps/server/src/startup-sequence/`
  `run-startup-sequence.spec.ts` és `continue-startup-with-database.spec.ts` tesztjeiben is, ugyanazon okból
  (a `runStartupSequence` csak pozitív portot fogad). Ott billegést nem mértünk.
