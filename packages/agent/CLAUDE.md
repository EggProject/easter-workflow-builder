# packages/agent

## Mi ez a mappa

Az Agent SDK adapter réteg. A motorba befecskendezett futtató port **típusa** itt él, nem a
motorban: az `agent` (L4) nem importálhat a motorból (L5), mert az kört adna, viszont az L5 felől
az L4 él megengedett (SPEC-004 3.3).

A csomag nem tud workflow gráfról, futásról, lépésről és adatbázisról (SPEC-004 3.1). Az SDK-t
**nem importálja futásidőben**: az adapter a `query()` függvényt paraméterként kapja, tehát a
teszt valós API hívás nélkül fedi minden ágát. A csomag `dependencies` mezőjében az SDK a pinelt
verzióval szerepel, mert a port alakja ahhoz a verzióhoz igazodik, és ezt egy típus import fedezetű,
fordítási idejű ellenőrzés őrzi.

## Fájlok

| Mappa           | Felelősség                                                                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `query-runner/` | a futtató port három típusa (`AgentQueryRequest`, `AgentQuery`, `AgentQueryRunner`), az SDK függvény port-kompatibilis alakja, a `createAgentQueryRunner` adapter, és a fordítási idejű őr, ami az SDK illeszkedését ellenőrzi |

A `query-runner/` hat típus-only fájljához nincs `.spec.ts` (SPEC-002 6.3 pont); az egyetlen
futásidejű sort tartalmazó fájl a `create-agent-query-runner.ts`, aminek a `.spec.ts` párja
mellette áll.

## Függőségi irány

Az `agent` a `core`, a `logger`, a `provider-registry` és az `agent-tool-bundle` csomagtól
függhet (SPEC-002 4. szekció), L4 réteg. A `package.json` ma a `core`, a `logger` és a
`provider-registry` workspace csomagot listázza, plusz külső függőségként az Agent SDK-t. Az
`agent-tool-bundle` felvétele a naplózási és eszközkötési tárgykör későbbi specifikációjának a
feladata.

## Szabályok

**Az SDK csak típus szinten kerülhet a csomagba.** Az adapter a `query()` függvényt paraméterként
kapja; futásidejű `import { query } from '@anthropic-ai/claude-agent-sdk'` sem a termékkódban,
sem a tesztben nem állhat, mert az tesztben valós API hívást és tokenégetést kockáztatna.

**A port nem duplikálja az SDK `Options` típusát.** Az `AgentQueryRequest.options` szándékosan
`Readonly<Record<string, unknown>>`, mert az SDK mezőlistája verziónként bővül. A típusos
szűkítést a motor végzi.

**Az `AgentQuery.messages` elemtípusa `unknown`.** A nyers üzenetet a `db` csomag `appendSdkEvent`
bemenete is így fogadja és maga normalizál, tehát a motor egyetlen sora sem függ az SDK
típusdefiníciójától.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-004-vegrehajto-motor.md`](../../docs/spec/SPEC-004-vegrehajto-motor.md), 2. szekció (F-1, F-2), 3.2 és 3.3 szekció
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció
- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
