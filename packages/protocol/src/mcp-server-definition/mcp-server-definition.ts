import { z } from 'zod';
import { EnvironmentVariableNameSchema } from './environment-variable-name.ts';

/**
 * A központi MCP szerver definíció `stdio` ága, a `packages/db`
 * `mcp-server-definition.ts` szándékos mirror sémája (SPEC-009 6.1; a mezők
 * jelentése ott áll). A nevek az env változó név alakján mennek át, és az
 * `envBindings` kulcsa csak deklarált név lehet: egy nem deklarált névre
 * szóló hozzárendelés a definíció ellentmondása. A finomítás a `z.infer`
 * eredményét nem változtatja, tehát a `db` párjával szembeni sodródás védelem
 * típusszintű ága változatlan.
 */
export const StdioMcpServerDefinitionSchema = z
  .strictObject({
    type: z.literal('stdio'),
    command: z.string(),
    args: z.array(z.string()).readonly(),
    envNames: z.array(EnvironmentVariableNameSchema).readonly(),
    envBindings: z.record(EnvironmentVariableNameSchema, EnvironmentVariableNameSchema).readonly(),
  })
  .superRefine((definition, context) => {
    for (const declaredName of Object.keys(definition.envBindings)) {
      if (!definition.envNames.includes(declaredName)) {
        context.addIssue({
          code: 'custom',
          path: ['envBindings', declaredName],
          message: 'A hozzárendelés kulcsa nem deklarált változó név.',
        });
      }
    }
  })
  .readonly();

export type StdioMcpServerDefinition = z.infer<typeof StdioMcpServerDefinitionSchema>;

export const SseMcpServerDefinitionSchema = z
  .strictObject({
    type: z.literal('sse'),
    url: z.string(),
    authEnvName: EnvironmentVariableNameSchema.nullable(),
  })
  .readonly();

export type SseMcpServerDefinition = z.infer<typeof SseMcpServerDefinitionSchema>;

export const HttpMcpServerDefinitionSchema = z
  .strictObject({
    type: z.literal('http'),
    url: z.string(),
    authEnvName: EnvironmentVariableNameSchema.nullable(),
  })
  .readonly();

export type HttpMcpServerDefinition = z.infer<typeof HttpMcpServerDefinitionSchema>;

/**
 * A központi MCP szerver definíció három ága (SPEC-009 6.1): a `PUT
 * /api/mcp-servers/:name` kérés törzse és a lista elemének `definition` mezője.
 * Titkot egyik ág sem hordoz, csak env változó NEVET.
 */
export const McpServerDefinitionSchema = z.discriminatedUnion('type', [
  StdioMcpServerDefinitionSchema,
  SseMcpServerDefinitionSchema,
  HttpMcpServerDefinitionSchema,
]);

export type McpServerDefinition = z.infer<typeof McpServerDefinitionSchema>;
