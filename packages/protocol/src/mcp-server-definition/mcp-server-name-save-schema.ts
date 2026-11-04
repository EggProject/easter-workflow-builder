import { McpServerNameSchema } from './mcp-server-name.ts';

// A névszabályon átmenő, mégis elvesző vagy hibát okozó nevek (mérve, telepített
// `@anthropic-ai/claude-agent-sdk` 0.3.245 és a beágyazott CLI 2.1.245,
// `docs/research/2026-10-28-plan-012-vegrehajtas.md` 4. szekció "MCP és izoláció"):
// a `__proto__` kulcsot az SDK `mcpServers` gyűjtése (`sI={}` objektum literálra írás)
// eldobja, a `constructor` kulccsal a CLI a teljes `--mcp-config` értéket elutasítja
// ("Invalid MCP configuration"), a `prototype` kulcsot a CLI csendben kihagyja. Az
// `Object.prototype` többi tagjának neve (`toString`, `hasOwnProperty`, `valueOf`, ...)
// mérve rendben átmegy, ezért nem tiltott.
const RESERVED_MCP_SERVER_NAMES: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * A központi MCP szerver definíció nevének mentési szabálya (SPEC-009 6.1 "A
 * nevek szabálya"): a `McpServerNameSchema` alakja, plusz a három fenntartott
 * név tilalma. Csak az írás oldala szigorodik: a `McpServerDefinitionRecordSchema`
 * olvasó sémája a `McpServerNameSchema` alakon marad.
 */
export const McpServerNameSaveSchema = McpServerNameSchema.refine((name) => !RESERVED_MCP_SERVER_NAMES.has(name));
