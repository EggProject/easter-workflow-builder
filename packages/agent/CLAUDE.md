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

| Mappa                | Felelősség                                                                                                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `query-runner/`      | a futtató port három típusa (`AgentQueryRequest`, `AgentQuery`, `AgentQueryRunner`), az SDK függvény port-kompatibilis alakja, a `createAgentQueryRunner` adapter, és a fordítási idejű őr, ami az SDK illeszkedését ellenőrzi                                                       |
| `sdk-message-shape/` | a `messages: AsyncIterable<unknown>` folyamból a motor által ténylegesen kiolvasott három dolog typeguardja: a `system` `init` üzenet `session_id`-je, a `result` üzenet öt lehetséges `subtype` értéke, és a `structured_output` mező jelenléte (SPEC-004 3.3, 2. szekció F-3 tény) |
| `sdk-version/`       | a telepített Agent SDK verzió egyetlen forrása (`INSTALLED_AGENT_SDK_VERSION`), amit az összeállítás a motornak átad; a `package.json` pinjével való egyezését regressziós teszt őrzi                                                                                                |

A `query-runner/` hat típus-only fájljához nincs `.spec.ts` (SPEC-002 6.3 pont); az egyetlen
futásidejű sort tartalmazó fájl a `create-agent-query-runner.ts`, aminek a `.spec.ts` párja
mellette áll.

Az `sdk-message-shape/` három típus-only fájlja (`sdk-system-init-message.ts`,
`sdk-result-subtype.ts`, `sdk-result-message.ts`) mellé nem tartozik `.spec.ts` (SPEC-002 6.3
pont); a másik négy fájl futtatható sort tartalmaz (három typeguard és a `hasStructuredOutput`
segédfüggvény), mindegyik a `.spec.ts` párjával együtt.

Az `sdk-version/` egyetlen fájlja egy konstans, a `.spec.ts` párja pedig **regressziós teszt**: a
konstans értékét a csomag `package.json` fájljában pinelt SDK verzióhoz méri, tehát egy frissítés,
ami a konstanst elfelejti átvezetni, a `bun run test` kapun bukik. Az érték futásidejű kiolvasása a
`node_modules` alól nem járható: az SDK `exports` térképe nem teszi közzé a saját `package.json`
fájlját (mérés: a csomag `exports` mezője hat bejegyzést sorol, `./package.json` nincs köztük).

## Függőségi irány

Az `agent` a `core`, a `logger`, a `provider-registry` és az `agent-tool-bundle` csomagtól
függhet (SPEC-002 4. szekció), L4 réteg. A `package.json` ma a `core`, a `logger`, a
`provider-registry` és a `typeguards` workspace csomagot listázza, plusz külső függőségként az
Agent SDK-t. A `typeguards` (L0) felvétele az `sdk-message-shape/` téma typeguardjaihoz kellett
(`isRecord`, `isString`); ugyanez a minta a `packages/db` csomagban is áll, ami szintén nem
szerepelt a SPEC-002 4. szekció "cél csomagtérkép" pillanatképében, mégis felvette a `typeguards`
függőséget, mert a "kötelező a meglévő typeguardot használni, nem újraírni" szabály (gyökér
`CLAUDE.md` 7., `.claude/CLAUDE.md` 5.) erősebb, mint egy tervezési pillanatkép. Az
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
