/**
 * A kimenő Agent SDK `mcpServers` opció egy eleme, ahogy a motor a központi
 * MCP szerver definícióból (SPEC-009 6.1) összeállítja: a 6.4 táblázat három
 * sora. A `stdio` ág az SDK `McpStdioServerConfig`, a `sse` és a `http` ág a
 * `McpSSEServerConfig` és a `McpHttpServerConfig` részhalmaza (telepített
 * `sdk.d.ts`); mindkét alak mérve `connected` állapotot ad (M-139,
 * `docs/research/2026-10-28-spec-009-blokkolo-meresek.md` 3. szekció).
 *
 * Az `env` és a `headers` már a feloldott **értéket** hordozza, ezért ez az
 * objektum csak a kimenő `Options`-ba kerül: naplóba, `run_event` sorba és
 * pillanatképbe soha (SPEC-009 6.4, AC19).
 */
export type OutgoingMcpServer =
  | {
      readonly type: 'stdio';
      readonly command: string;
      readonly args: readonly string[];
      readonly env: Readonly<Record<string, string>>;
    }
  | {
      readonly type: 'sse' | 'http';
      readonly url: string;
      readonly headers?: { readonly Authorization: string };
    };
