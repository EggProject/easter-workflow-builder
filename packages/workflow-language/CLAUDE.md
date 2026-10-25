# packages/workflow-language

## Mi ez a mappa

A workflow felhasználó által írt két nyelve: a Mustache sablon (szöveg előállítása a futás
adataiból) és a CEL kifejezés (feltétel, ágválasztás, ciklus kilépés). A csomag a két külső
könyvtárat egyetlen, a motor és a szerkesztő számára közös, böngészőbiztos réteggé fogja be.
Nem tartozik ide a motor logikája: a motor a nyelvet port mögött éri el, és erre a csomagra
nem függ (SPEC-010 3.1).

## Fájlok

| Mappa                    | Tartalom                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/mustache-template/` | a Mustache sablon renderelő (T-010-8): a `createMustacheTemplateRenderer()` gyártó függvény, a `StrictWriter` (saját `Writer`: escape nélküli szöveggé alakítás, hiányzó név hiba, kikapcsolt saját gyorsítótár), az `OwnPropertyContext` (saját adat tulajdonságra szűkített, függvényt nem hívó név feloldás), a feloldó, a szöveggé alakító és a hibaleíró függvény, a hiányzó név hibaosztálya; a `mustache-template-renderer.ts` típus-only (a gyártó függvény eredményének alakja), ezért nincs `.spec.ts` párja |
| `src/cel-expression/`    | a CEL kifejezés kiértékelő (T-010-9 ... T-010-10): a `RUN_CONTEXT_VARIABLE_NAMES` konstans (a hét `RunContext` név), a `createCelEnvironment()` (a SPEC-010 7.1 környezet), a `createCelExpressionEvaluator()` gyártó függvény (egyelőre a 7.2 `compile`, az `evaluate` a T-010-10-ben), a hibakódonként saját magyar mondatot adó hibaleíró és az `isCelError` guard; a `cel-expression-evaluator.ts` típus-only (a gyártó függvény eredményének alakja), ezért nincs `.spec.ts` párja                                |
| `src/index.ts`           | barrel, csak nevesített újraexport (SPEC-002 6.6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Függőségi irány

L1 réteg (SPEC-002 4. szekció). Workspace függőség: `core` és `typeguards` (mindkettő L0).
Külső függőség: `mustache` és `@marcbachmann/cel-js`, pontos verzióval, tartomány nélkül, a
`@types/mustache` pedig `devDependencies` helyen (SPEC-010 3.4, 4.). A verziók egyetlen forrása
a `docs/research/2026-08-26-toolchain.md`. A `packages/engine` ettől a csomagtól nem függ; az
`apps/server` és az `apps/web` igen (SPEC-010 3.4).

## Szabályok

**Node beépített modult (`node:*`) egyetlen fájl sem importálhat.** A csomagot az `apps/web` is
érték szinten importálja, tehát a barrel minden modulja a böngésző modulgráfjába kerül
(SPEC-010 16. szekció 8. kritérium). Az `apps/web/src/browser-safe-imports/` regressziós teszt őrzi.

A `mustache` és a `@marcbachmann/cel-js` csomagot a workspace-ben kizárólag ez a csomag
importálhatja (SPEC-010 16. szekció 7. kritérium).

**A Mustache modul szintű állapotához a csomag nem nyúl.** A renderelés saját `StrictWriter`
példányon fut, kikapcsolt gyorsítótárral; a modul szintű render és parse függvény, a modul
gyorsítótára és escape függvénye érintetlen (SPEC-010 6.1, 6.3, 16. szekció 63. kritérium).

**A `StrictWriter` és az `OwnPropertyContext` a könyvtár forrásszintű viselkedésére épül** (a
`render` a kapott `Context` példányt változatlanul használja, M-134), nem dokumentált bővítési
pontra. A `StrictWriter` két felülírt metódusának paraméter típusa ezért csak típusszinten szűkebb
a bázisénál, futásidejű őr nélkül; a könyvtár frissítése előtt a PLAN-010 F0 Mustache mérése
regresszióként fut (SPEC-010 6.6).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-010-sablon-es-kifejezes-nyelv.md`](../../docs/spec/SPEC-010-sablon-es-kifejezes-nyelv.md), 3. és 4. szekció
- [`../../docs/plan/PLAN-010-sablon-es-kifejezes-nyelv.md`](../../docs/plan/PLAN-010-sablon-es-kifejezes-nyelv.md), T-010-7, T-010-8, T-010-9
- [`../../docs/research/2026-10-21-spec010-blokkolo-meresek.md`](../../docs/research/2026-10-21-spec010-blokkolo-meresek.md), 2., 3. és 7. szekció
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4., 5. és 6. szekció
