import { z } from 'zod';

// Az SDK az eszköznév előtagjában (`mcp__<szerver>__<eszköz>`) a `[a-zA-Z0-9_-]` halmazon kívüli jeleket
// `_`-re cseréli (SPEC-009 2.2, `docs/research/2026-10-26-spec-009-forrasok.md` 10.3); a szabály ezt a
// halmazt engedi, tehát csere nem történik, és két különböző név sem ütközhet cserével.
const MCP_SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]+$/u;

/**
 * A központi MCP szerver definíció neve (SPEC-009 6.1 "A nevek szabálya"): a
 * `mcpServers` opció kulcsa és a lépés hivatkozásának kulcsa. A `PUT /api/mcp-servers/:name`
 * útvonal paramétere ezen a sémán megy át, a felület ugyanezzel ellenőrizhet.
 */
export const McpServerNameSchema = z.string().regex(MCP_SERVER_NAME_PATTERN);

export type McpServerName = z.infer<typeof McpServerNameSchema>;
