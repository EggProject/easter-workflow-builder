/**
 * A workflow lépéshez külön-külön bekapcsolható, saját folyamatban futó
 * (in-process MCP) eszközök azonosítói. Azért itt él és nem a `agent-tools`
 * csomagban, mert a képességleíró mondja meg, melyik providernél ajánlott
 * bekapcsolni egy eszközt, tehát a szótár a leíró réteg része. Az `agent-tools`
 * csomag innen veszi át, így csak egy forrás van.
 */
export type AgentToolId = 'web_search' | 'web_fetch' | 'understand_image';
