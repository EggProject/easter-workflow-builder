# packages/workflow-language

## Mi ez a mappa

A workflow felhasználó által írt két nyelve: a Mustache sablon (szöveg előállítása a futás
adataiból) és a CEL kifejezés (feltétel, ágválasztás, ciklus kilépés). A csomag a két külső
könyvtárat egyetlen, a motor és a szerkesztő számára közös, böngészőbiztos réteggé fogja be.
Nem tartozik ide a motor logikája: a motor a nyelvet port mögött éri el, és erre a csomagra
nem függ (SPEC-010 3.1).

## Fájlok

| Mappa                       | Tartalom                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/mustache-template/`    | a Mustache sablon renderelő (T-010-8, T-010-10): a `createMustacheTemplateRenderer()` gyártó függvény, a `StrictWriter` (saját `Writer`: escape nélküli szöveggé alakítás, hiányzó név hiba, nem JSON érték hiba, kikapcsolt saját gyorsítótár), az `OwnPropertyContext` (saját adat tulajdonságra szűkített, függvényt nem hívó név feloldás), a feloldó, a szigorú szöveggé alakító (tömb és sima objektum JSON, minden más nem JSON érték hiba) és a mélyen szigorú `copyJsonValue` (minden beágyazott elem és mező, körkörös hivatkozás is hiba; a közös hivatkozás megmarad, a másolás egy híváson belüli memoizálással a szerkezet méretével arányos, O-16; a kiírás a bejárt adat tiszta másolatából áll, egy `Proxy` `get` csapdája nem írhatja felül; a túl nagy kiírás `JSON.stringify` `RangeError` kivételét a `render` `Outcome` hibaágra viszi) a `JsonValue` típussal és a hibaleíró függvény, a hiányzó név és a nem JSON értékre mutató név hibaosztálya; a `mustache-template-renderer.ts` és a `json-value.ts` típus-only, ezért nincs `.spec.ts` párjuk |
| `src/cel-expression/`       | a CEL kifejezés kiértékelő (T-010-9, T-010-10): a `RUN_CONTEXT_VARIABLE_NAMES` konstans (a hét `RunContext` név), a `createCelEnvironment()` (a SPEC-010 7.1 környezet), a `createCelExpressionEvaluator()` gyártó függvény (a 7.2 `compile` és a 7.3 ... 7.4 `evaluate`), a 7.3 bemeneti leképezés (`toCelContext`), a 7.4 eredmény normalizálás (`normalizeCelResult`, a közös hivatkozást megőrző memoizálással, O-15), a hibakódonként (fordítási és futásidejű kódra) saját magyar mondatot adó hibaleíró és az `isCelError` guard; a `cel-expression-evaluator.ts` típus-only (a gyártó függvény eredményének alakja), ezért nincs `.spec.ts` párja                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/greppable-invariants/` | megvalósítás nélküli regressziós téma (T-010-11): greppes invariáns tesztek a csomag határairól, a `mustache` és a `@marcbachmann/cel-js` kizárólagos importálója ez a csomag, a termékkódban nincs `node:` import és `process`, `globalThis`, `require`, `import(` hivatkozás, a `Mustache` azonosító csak a `Writer`, `Context` és `TemplateCache` tagra mutat (a modul szintű `render`, `parse`, `templateCache`, `escape` semmilyen alakban nem érhető el), a `render` név csak metódushívás, tulajdonság vagy metódus definíció, és a hívás nem ad `partials` argumentumot, a barrel csak nevesített újraexport és a két könyvtárból nem szivárogtat (SPEC-010 16. szekció 3., 7., 8., 11., 29., 30., 63.)                                                                                                                                                                                                                                                                                                                                                             |
| `src/error-sentence-form/`  | megvalósítás nélküli regressziós téma: a `compile`, `evaluate` és `render` minden hibamondata (a CEL mondattábla minden kódja, a tartalék és normalizáló mondatok, a sablon fordítási hibái és a név megnevező mondatok, ponttal záruló névvel is) nem üres és nem zárul ponttal, mert az `apps/web` `toEditorSentence` feltétel nélkül tesz pontot a végére (SPEC-010 10., O-19)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `src/secret-prohibition/`   | megvalósítás nélküli regressziós téma (T-010-20): futtatott teszt egy titkot tartalmazó env változóval, a valódi `mustache` és `@marcbachmann/cel-js` könyvtáron; a `process`, `process.env` és `globalThis` nevekre (és a `constructor`, `__proto__` láncra) hivatkozó sablon és kifejezés sem adhat olyan kimenetet vagy hibaszöveget, ami a titok értékét tartalmazza, pozitív kontrollal együtt (SPEC-010 5.2, 16. szekció 28.)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/index.ts`              | barrel, csak nevesített újraexport (SPEC-002 6.6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## Függőségi irány

L1 réteg (SPEC-002 4. szekció). Workspace függőség: `core` és `typeguards` (mindkettő L0).
Külső függőség: `mustache` és `@marcbachmann/cel-js`, pontos verzióval, tartomány nélkül, a
`@types/mustache` pedig `devDependencies` helyen (SPEC-010 3.4, 4.). A verziók egyetlen forrása
a `docs/research/2026-08-26-toolchain.md`. A `packages/engine` ettől a csomagtól nem függ. Két
workspace csomag függ tőle: az `apps/server` (PLAN-010 T-010-13) és az `apps/web` (T-010-17)
(SPEC-010 3.4).

## Szabályok

**Node beépített modult (`node:*`) egyetlen termékkód fájl sem importálhat** (a `.spec.ts` fájlok
igen, a `src/greppable-invariants/` téma is `node:fs` modullal olvas). A csomagot az `apps/web`
érték szinten importálja, tehát a barrel minden modulja a böngésző modulgráfjába kerül
(SPEC-010 16. szekció 8. kritérium). A `src/greppable-invariants/` téma és az
`apps/web/src/browser-safe-imports/` regressziós teszt is őrzi: az utóbbi az `apps/web` függőségi
zárt halmazát vizsgálja, és a T-010-17 óta a csomagot is.

A `mustache` és a `@marcbachmann/cel-js` csomagot a workspace-ben kizárólag ez a csomag
importálhatja (SPEC-010 16. szekció 7. kritérium); a `src/greppable-invariants/` téma őrzi.

**A Mustache modul szintű állapotához a csomag nem nyúl.** A renderelés saját `StrictWriter`
példányon fut, kikapcsolt gyorsítótárral; a modul szintű render és parse függvény, a modul
gyorsítótára és escape függvénye érintetlen (SPEC-010 6.1, 6.3, 16. szekció 63. kritérium); a `src/greppable-invariants/` téma őrzi.

**A `StrictWriter` és az `OwnPropertyContext` a könyvtár forrásszintű viselkedésére épül** (a
`render` a kapott `Context` példányt változatlanul használja, M-134), nem dokumentált bővítési
pontra. A `StrictWriter` két felülírt metódusának paraméter típusa ezért csak típusszinten szűkebb
a bázisénál, futásidejű őr nélkül; a könyvtár frissítése előtt a PLAN-010 F0 Mustache mérése
regresszióként fut (SPEC-010 6.6).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-010-sablon-es-kifejezes-nyelv.md`](../../docs/spec/SPEC-010-sablon-es-kifejezes-nyelv.md), 3. és 4. szekció
- [`../../docs/plan/PLAN-010-sablon-es-kifejezes-nyelv.md`](../../docs/plan/PLAN-010-sablon-es-kifejezes-nyelv.md), T-010-7, T-010-8, T-010-9, T-010-10, T-010-11, T-010-20
- [`../../docs/research/2026-10-21-spec010-blokkolo-meresek.md`](../../docs/research/2026-10-21-spec010-blokkolo-meresek.md), 2., 3., 7. és 10. szekció
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4., 5. és 6. szekció
