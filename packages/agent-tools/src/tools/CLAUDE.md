# packages/agent-tools/src/tools

## Mi ez a mappa

A három MCP eszköz definíciója és a lépésenként kapcsolható eszközkészlet összeállítója. Ide
**nem** tartozik HTTP hívás, séma validáció és formázás: ez a réteg csak összeköti az alsóbb
rétegeket az Agent SDK `tool` és `createSdkMcpServer` helperjével.

## Fájlok

| Fájl                                 | Tartalom                                                        |
| ------------------------------------ | --------------------------------------------------------------- |
| `agent-tool-dependencies.ts`         | `AgentToolDependencies`                                         |
| `default-agent-tool-dependencies.ts` | `defaultAgentToolDependencies`, a Node beépített megvalósításai |
| `agent-tools-server-name.ts`         | `AGENT_TOOLS_SERVER_NAME`                                       |
| `agent-tool-reference.ts`            | `agentToolReference`, a teljes `mcp__...` eszköznév             |
| `create-web-search-tool.ts`          | `createWebSearchTool`                                           |
| `create-web-fetch-tool.ts`           | `createWebFetchTool`                                            |
| `create-image-understanding-tool.ts` | `createImageUnderstandingTool`                                  |
| `create-agent-tool.ts`               | `createAgentTool`, azonosító szerinti teljes switch             |
| `agent-tool-bundle.ts`               | `AgentToolBundle`                                               |
| `create-agent-tool-bundle.ts`        | `createAgentToolBundle`, a csomag fő belépési pontja            |

Minden viselkedést hordozó fájl mellett `*.test.ts` van, a lefedettség kizárás nélkül teljes.

## Függőségi irány

A csomag minden alsóbb rétegétől függ, valamint a `providers` csomag `AgentToolId` típusától
és az `@anthropic-ai/claude-agent-sdk` `tool` és `createSdkMcpServer` helperjétől.

## Szabályok

**Lapos séma.** Minden eszköz bemeneti sémája csak kötelező szöveges mezőket tartalmaz, nincs
benne felsorolás, tömb és beágyazott objektum. Indok: a mérésünk szerint egy visszautasított
tool séma nem eredményez újrapróbálkozást, tehát a bonyolultabb séma azonnali és javíthatatlan
hibát okozna.

**Az eszköz nem dob kivételt.** Minden hibaág `errorToolResult` válasz, hogy az agent
dönthessen a folytatásról, például egy másik eszköz kipróbálásáról.

**Az eszközleírás angolul van.** Ez a szöveg a modellnek szóló prompt, nem kommentár: az
Agent SDK beépített eszközeinek leírásával azonos nyelven marad. A kommentek és a
dokumentáció ettől függetlenül magyarul vannak.

**Az eszközök nem alkotnak monolit szervert.** A `createAgentToolBundle` a lépés által
kiválasztott azonosítókból állítja össze a szervert, tehát ami nincs kiválasztva, az nem is
kerül be a modell eszközlistájába.

## Kapcsolódó dokumentumok

- [`../../../../docs/research/2026-08-26-agent-sdk-minimax.md`](../../../../docs/research/2026-08-26-agent-sdk-minimax.md), In-process MCP tool szekció
- [`../../../../docs/research/2026-08-26-agent-tools.md`](../../../../docs/research/2026-08-26-agent-tools.md)
