# packages/agent-tool-bundle

## Mi ez a mappa

A lépésenként kapcsolható eszközkészlet összeállítása: az azonosítókból in-process MCP szerver
konfiguráció és `allowedTools` lista, a `query()` hívás `mcpServers` és `allowedTools`
mezőjébe közvetlenül illeszthető alakban. A `packages/agent-tools` csomag szétbontásából jött
létre (SPEC-002 5.17 szekció, a csomag maga megszűnt). Ide **nem** tartozik egyetlen eszköz
sémája, leírása vagy hibaüzenete sem: ez a csomag nem tudja, mit csinál egy eszköz, csak azt,
hogy melyik azonosítóhoz melyik gyártófüggvény tartozik.

## Fájlok

| Mappa                | Felelősség                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `tool-reference/`    | az MCP név összerakása a szervernévből és az eszköz azonosítójából                             |
| `tool-dependencies/` | a futásidejű függőség objektum típusa (`AgentToolDependencies`) és az alapértelmezett példánya |
| `tool-factory/`      | az egyetlen hely, ami tudja, melyik azonosítóhoz melyik gyártófüggvény tartozik                |
| `tool-bundle/`       | a kész készlet alakja (`AgentToolBundle`) és összeállítása                                     |

A `tool-dependencies/agent-tool-dependencies.ts` és a `tool-bundle/agent-tool-bundle.ts`
típus-only fájl, nincs hozzájuk `.spec.ts` (SPEC-002 6.3 pont).

## Függőségi irány

Az `@easter-workflow-builder/agent-tool-id`, az `@easter-workflow-builder/tool-web-search`, az
`@easter-workflow-builder/tool-web-fetch` és az `@easter-workflow-builder/tool-understand-image`
csomagtól függ, plusz az `@easter-workflow-builder/env-reader` (az `EnvironmentReader` típus),
az `@easter-workflow-builder/http-client` (a `FetchFunction` típus) és az
`@easter-workflow-builder/image-source` (a `ReadFileFunction` típus) csomagtól, valamint a
`@anthropic-ai/claude-agent-sdk` külső csomagtól, L4 réteg (SPEC-002 4. szekció). Ez az egyetlen
csomag, ami mindhárom eszközt ismeri, ezért ez az egyetlen hely, ahol a három futásidejű
függőség egy objektumban (`AgentToolDependencies`) áll.

## Szabályok

**A `createAgentTool` teljes switch, kihagyás nélkül.** Fordítási időben garantálja, hogy új
`AgentToolId` felvétele nem maradhat kezeletlenül (`@typescript-eslint/switch-exhaustiveness-check`).

**Ismétlődő azonosító nem duplikálja az eszközt.** A `createAgentToolBundle` a kiválasztott
azonosítókat egyedivé szűri, mielőtt a szervert összeállítja.

**A közös `AgentToolDependencies` objektumból a hívott gyártófüggvény a saját szűk interfészének
megfelelő mezőket structural typing útján kapja meg.** A `web_search` és a `web_fetch` eszköz
csak a `fetchFunction` és az `environment` mezőt olvassa, az `understand_image` mindhármat -
ez a "a segéd soha nem lakik egy csomagban a kész toollal" elv következménye a függőség
objektumra is (SPEC-002 5.14 szekció).

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 5.17 szekció
