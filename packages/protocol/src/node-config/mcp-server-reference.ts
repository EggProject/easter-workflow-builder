import { z } from 'zod';

/**
 * A lépés hivatkozása egy központi MCP szerver definícióra, a `packages/db`
 * `mcp-server-reference.ts` mirror sémája (SPEC-009 6.2, O-42 (b); a mezők
 * jelentése ott áll). Kizárólag neveket hordoz, értéket soha. A név szabályt
 * itt sem szűkíti: a `db` oldal sem teszi, és egy szabálytalan kulcs egyetlen
 * központi definícióval sem egyezhet (a központi definíció mentése
 * kényszeríti ki a szabályt, `mcp-server-definition` téma).
 */
export const McpServerReferenceSchema = z
  .strictObject({
    envBindings: z.record(z.string(), z.string()).readonly(),
    authEnvName: z.string().nullable(),
  })
  .readonly();

export type McpServerReference = z.infer<typeof McpServerReferenceSchema>;
