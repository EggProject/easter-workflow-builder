import { z } from 'zod';
import { recordWithoutPrototypeKey } from './record-without-prototype-key.ts';

/**
 * A lépés hivatkozása egy központi MCP szerver definícióra, a `packages/db`
 * `mcp-server-reference.ts` mirror sémája (SPEC-009 6.2, O-42 (b); a mezők
 * jelentése ott áll). Kizárólag neveket hordoz, értéket soha. A név szabályt
 * itt sem szűkíti: a `db` oldal sem teszi, és egy szabálytalan kulcs egyetlen
 * központi definícióval sem egyezhet (a központi definíció mentése
 * kényszeríti ki a szabályt, `mcp-server-definition` téma). Az `envBindings`
 * ÉRTÉKE és az `authEnvName` env változó név alakját a mentési séma
 * (`NodeConfigSaveSchema`) ellenőrzi, az olvasó séma nem (T-012-27). Az
 * `envBindings` saját `__proto__` kulcsa mindkét sémán elbukik, a `db`
 * guardjával egyezően (`recordWithoutPrototypeKey`).
 */
const EnvironmentBindingsSchema = z.record(z.string(), z.string()).readonly();

export const McpServerReferenceSchema = z
  .strictObject({
    envBindings: recordWithoutPrototypeKey(EnvironmentBindingsSchema),
    authEnvName: z.string().nullable(),
  })
  .readonly();

export type McpServerReference = z.infer<typeof McpServerReferenceSchema>;
