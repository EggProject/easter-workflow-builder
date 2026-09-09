import { z } from 'zod';

/**
 * Tárolható MCP szerver konfiguráció, a `packages/db` `storable-mcp-server.ts`
 * hármas uniójának mirror sémája (a titkot nem hordozó `envNames`/
 * `authEnvName` mezőkkel; a doksi ott áll, itt nem ismételjük). Az `sdk`
 * variáns itt sincs jelen, ugyanazon okból.
 */
export const StorableStdioMcpServerSchema = z
  .strictObject({
    type: z.literal('stdio'),
    command: z.string(),
    args: z.array(z.string()).readonly(),
    envNames: z.array(z.string()).readonly(),
  })
  .readonly();

export type StorableStdioMcpServer = z.infer<typeof StorableStdioMcpServerSchema>;

export const StorableSseMcpServerSchema = z
  .strictObject({
    type: z.literal('sse'),
    url: z.string(),
    authEnvName: z.string().nullable(),
  })
  .readonly();

export type StorableSseMcpServer = z.infer<typeof StorableSseMcpServerSchema>;

export const StorableHttpMcpServerSchema = z
  .strictObject({
    type: z.literal('http'),
    url: z.string(),
    authEnvName: z.string().nullable(),
  })
  .readonly();

export type StorableHttpMcpServer = z.infer<typeof StorableHttpMcpServerSchema>;

export const StorableMcpServerSchema = z.discriminatedUnion('type', [
  StorableStdioMcpServerSchema,
  StorableSseMcpServerSchema,
  StorableHttpMcpServerSchema,
]);

export type StorableMcpServer = z.infer<typeof StorableMcpServerSchema>;
