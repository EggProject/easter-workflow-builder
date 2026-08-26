# tools/wire-probe/src/cases

## Mi ez a mappa

A SPEC-000 4. szekciójában felsorolt egyes mérési esetek (M-01 ... M-36) implementációja,
egy fájl esetenként, plusz az esetek típusos összesítő registrye. Ide tartozik, hogy egy adott
eset milyen `Options`-szal és milyen prompttal hívja meg a harnesst. Ide **nem** tartozik a
`query()` tényleges lefuttatása, a fájlba írás vagy a titok-maszkolás (ez a `../harness/` és a
`../proxy/` felelőssége), és nem tartozik ide a CLI-szintű eset-kiválasztás sem (az a
`../probe.ts`-ben van).

## Fájlok

| Fájl                    | Tartalom                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `index.ts`              | típusos registry: `CASE_REGISTRY` (eset azonosító -> `MeasurementCase`) és `CASE_IDS` |
| `m-01.ts` ... `m-36.ts` | egy-egy SPEC-000 mérési eset, `MeasurementCase` implementáció                         |

## Függőségi irány

Az esetfájlok a `../harness/types.ts` (`MeasurementCase`, `CaseContext`, `CaseRunOutcome`),
a `../harness/runner.ts` (`buildBaseOptions`, `executeQuery`, `DEFAULT_PROMPT`) és a
`../harness/sdk-constants.ts` exportjaitól függhetnek, valamint közvetlenül a
`@anthropic-ai/claude-agent-sdk` csomagtól (`query`, `createSdkMcpServer`, `tool`, típusok) és a
`zod`-tól, ahol egy eset saját in-process toolt regisztrál. A `../proxy/` mappától **tilos**
közvetlenül függeni: a titok-maszkolást és a tranzakció-rögzítést kizárólag a harness éri el.

## Szabályok

- Egy eset egy fájl, a fájl neve `m-<kétjegyű sorszám>.ts`, az exportált konstans neve `M<kétjegyű sorszám>` (pl. `m-09.ts` -> `M09`).
- Minden eset `id` mezője egyezzen a `CASE_REGISTRY` kulcsával és a fájl sorszámával.
- Az eset `question` mezője a SPEC-000 4. szekció kérdés-azonosítójára (Q1-Q12) mutasson, nem szabad prózában megismételni, mit mér.
- Új eset felvételekor az `index.ts` importja és a `CASE_REGISTRY` bejegyzése ugyanabban a commitban készül.

## Kapcsolódó dokumentumok

- [`../../../../docs/spec/SPEC-000-provider-wire-measurement.md`](../../../../docs/spec/SPEC-000-provider-wire-measurement.md)
- [`../../../../docs/research/2026-08-26-agent-sdk-minimax.md`](../../../../docs/research/2026-08-26-agent-sdk-minimax.md)
