# SPEC-002 F5-F7 zárás: mért tények

Mérés dátuma: 2026-08-27, a `feat/spec-001-monorepo` ágon, a T-002-24 (`check-dependency-graph.sh`)
commit után, közvetlenül a T-002-25 lépésben. Minden szám ezen a futtatáson mérve, becslés
nincs (PLAN-002, T-002-25 elfogadási kritérium).

## Csomagszám

```
$ git ls-files '*/package.json' | grep -v node_modules | wc -l
32
```

Bontás könyvtár szerint:

```
$ ls -d packages/*/ | wc -l
26
$ ls -d apps/*/ | wc -l
2
$ ls -d tooling/*/ | wc -l
3
$ ls -d tools/*/ | wc -l
1
```

26 + 2 + 3 + 1 = 32. Megegyezik a SPEC-002 Definition of Done 3. pontjával ("A workspace 32
csomagból áll").

## `turbo run typecheck` idő, hideg és meleg cache (SPEC-001 AC6, SPEC-002 34. kritérium)

A mérés a `tooling/scripts/typecheck.sh` wrapper mögötti pontos parancsot futtatja
(`node_modules/.bin/turbo run typecheck --continue=always --summarize=true
--output-logs=errors-only`), a `.turbo/cache` könyvtár törlése után.

**Hideg cache** (`rm -rf .turbo/cache` után, első futás, mind a 32 csomag frissen fordul):

```
Tasks:    32 successful, 32 total
Cached:    0 cached, 32 total
Time:    1m5.663s
```

**Meleg cache** (közvetlenül utána, másodszorra, változatlan forrásfán):

```
Tasks:    32 successful, 32 total
Cached:    32 cached, 32 total
Time:    486ms >>> FULL TURBO
```

A második futás teljes cache találatot ad (`FULL TURBO`, mind a 32 taskra). Ez igazolja a
SPEC-002 34. elfogadási kritérium első felét.

## Cache invalidáció pontossága, egy `result` fájl módosításával (SPEC-002 34. kritérium)

A `packages/result/src/outcome/outcome.ts` fájl végére egy komment sort fűzve (tartalmi
változás, nem csak `mtime`, mert a Turborepo a fájl tartalmát hasheli, nem az időbélyeget - ezt
egy önmagában végzett `touch` próba igazolta: puszta `touch` mellett a második futás továbbra is
`FULL TURBO` maradt), majd a fájlt visszaállítva (`git checkout --`), a `turbo run typecheck`
újrafuttatása:

```
Tasks:    32 successful, 32 total
Cached:    22 cached, 32 total
Time:    36.894s
```

A 10, frissen lefutott (nem cache-ből jövő) csomag, a turbo run JSON összegzőjéből
(`jq -r '.tasks[] | select(.cache.status != "HIT") | .package'`):

```
@easter-workflow-builder/agent-tool-bundle
@easter-workflow-builder/env-reader
@easter-workflow-builder/firecrawl-client
@easter-workflow-builder/http-client
@easter-workflow-builder/image-source
@easter-workflow-builder/minimax-client
@easter-workflow-builder/result
@easter-workflow-builder/tool-understand-image
@easter-workflow-builder/tool-web-fetch
@easter-workflow-builder/tool-web-search
```

Ez pontosan a `result` csomag (SPEC-002 4. szekció) tranzitív függő halmaza, plusz maga a
`result`: az `env-reader` és a `http-client` (L1, közvetlenül függ), a `minimax-client`, a
`firecrawl-client`, az `image-source` (L2, az előző háromtól függ), a `tool-web-search`, a
`tool-web-fetch`, a `tool-understand-image` (L3, ezekből építkezik), és az `agent-tool-bundle`
(L4, mindhárom eszköz csomagból és az `env-reader`/`http-client`/`image-source`-ből is függ). A
`provider-registry`, az `agent` és a `server` **nem** futott újra, mert egyikük `package.json`-ja
sem deklarálja ténylegesen az érintett csomagok egyikét sem (az `agent-tool-bundle` az `agent`
csomag `package.json`-jában még nincs felvéve, lásd `packages/agent/CLAUDE.md`). Ez igazolja a
SPEC-002 34. elfogadási kritérium második felét: pontosan a függő csomagok taskja fut újra, sem
kevesebb, sem több.

## Normalizált JSON diff (a `providerRegistry` szétbontás tartalmi azonossága)

Ezt a T-002-10 lépés már külön dokumentálta, önálló fájlban:
[`2026-08-27-spec002-provider-registry-diff.md`](2026-08-27-spec002-provider-registry-diff.md).
Rövid összegzés innen: a szétbontás előtti (`b91f150` commit) és utáni `providerRegistry` fa
kanonikus JSON alakra hozva bitre azonos (`diff` kimenete üres, MD5 ellenőrzőösszeg egyezik,
mindkét oldal 1624 sor). Ez a T-002-25 lépésben nem ismételt mérés, csak hivatkozott tény.

## Nyitva jelölt kérdés: `engine` és `agent` rétegszám ütközése

**Ez nem a végrehajtási környezet korlátja, hanem a SPEC-002 szövegében talált,
tartalmi ellentmondás - explicit nyitva jelölve, a Definition of Done 8. pontja szerint, de a
"végrehajtási környezet igazolt korlátja" hivatkozás itt nem alkalmazható, mert ez a kérdés
dokumentum-belső, nem futtatókörnyezeti.**

A SPEC-002 4. szekció "Rétegbesorolás, mind a 32 csomagra" táblázata az `engine`-t és az
`agent`-et **azonos** L4 rétegbe sorolja. A közvetlenül fölötte álló szöveg viszont ezt írja:
"Az `engine` L4, mert a `db` és az `agent` fölött áll" - ami azt sugallja, hogy az `engine`
szigorúan az `agent` fölött áll, nem vele azonos rétegen. A két állítás egymásnak ellentmond.

A tényleges, `package.json`-ban is meglévő `engine -> agent` függés (`dependencies` mezőben) a
SPEC-001 óta változatlan, a SPEC-002 kifejezetten nem tervezi újra ("Nem tervezi meg ... az
`engine`, az `agent` ... csomagok tartalmát", SPEC-002 1. szekció). A T-002-24 lépésben épített
`tooling/scripts/check-dependency-graph.sh`, ami a SPEC-002 4. szekció "Rétegbesorolás"
táblázatát kódolja le szó szerint, ezt a valós élt helyesen, egy sorban jelzi:

```
$ bun run check:graph
not-strictly-decreasing-layer: 'engine' (L4) -> 'agent' (L4): nem szigorúan csökkenő rétegszám felé mutat
```

Ez az egyetlen talált eltérés a teljes 32 csomagos gráfon - a script minden más csomagpárra
(réteg-hozzárendelés megléte, eszköz csomag helye, a többi 30 csomag éle) nulla eltérést ad.

**A felbontás nem ennek a lépésnek a hatásköre.** Vagy az `agent` rétegszámát kell eggyel
csökkenteni (L3-ra) a táblázatban, vagy a szöveges indoklást kell a táblázathoz igazítani (azaz
elfogadni, hogy `engine` és `agent` azonos rétegen áll, és az `engine -> agent` élt másképp kell
kezelni). Mindkettő tartalmi döntés, ami a SPEC-002 hatókörén kívül esik, és egy jövőbeli
specifikációra vár. Részletek és a döntésig szóló dokumentáció:
[`../../packages/engine/CLAUDE.md`](../../packages/engine/CLAUDE.md), "Ellentmondás a
SPEC-002-ben, nyitva jelölve".
