# packages/workflow-language

## Mi ez a mappa

A workflow felhasználó által írt két nyelve: a Mustache sablon (szöveg előállítása a futás
adataiból) és a CEL kifejezés (feltétel, ágválasztás, ciklus kilépés). A csomag a két külső
könyvtárat egyetlen, a motor és a szerkesztő számára közös, böngészőbiztos réteggé fogja be.
Nem tartozik ide a motor logikája: a motor a nyelvet port mögött éri el, és erre a csomagra
nem függ (SPEC-010 3.1).

## Fájlok

| Mappa                    | Tartalom                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `src/mustache-template/` | a Mustache sablon renderelő és ellenőrző (T-010-8); egyelőre nem létezik                                                   |
| `src/cel-expression/`    | a CEL kifejezés kiértékelő és ellenőrző (T-010-9 ... T-010-11); egyelőre nem létezik                                       |
| `src/index.ts`           | barrel, csak nevesített újraexport; az `IS_WORKFLOW_LANGUAGE_PLACEHOLDER` az első valódi exportnál törlendő (SPEC-002 6.6) |

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

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-010-sablon-es-kifejezes-nyelv.md`](../../docs/spec/SPEC-010-sablon-es-kifejezes-nyelv.md), 3. és 4. szekció
- [`../../docs/plan/PLAN-010-sablon-es-kifejezes-nyelv.md`](../../docs/plan/PLAN-010-sablon-es-kifejezes-nyelv.md), T-010-7
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4., 5. és 6. szekció
