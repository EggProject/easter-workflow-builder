/**
 * Az MCP `tools/call` válasz alakja, ahogy a csomag előállítja. Szándékosan a
 * saját, szűk típusunk, nem a `@modelcontextprotocol/sdk` importált típusa: az
 * a csomag csak tranzitív függőség, közvetlenül nem deklaráljuk. Az Agent SDK
 * `tool()` helperje a hozzárendeléskor ellenőrzi, hogy ez az alak illeszkedik-e
 * az általa várt `CallToolResult` típusra.
 *
 * Az index szignatúra nem lazítás, hanem illeszkedés: az MCP séma átengedi az
 * ismeretlen kulcsokat, és enélkül a hozzárendelés nem fordulna le.
 */
export interface ToolCallResult {
  content: { type: 'text'; text: string }[];
  isError: boolean;
  [key: string]: unknown;
}
