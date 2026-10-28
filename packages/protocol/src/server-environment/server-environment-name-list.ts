import { z } from 'zod';
import { EnvironmentVariableNameSchema } from '../mcp-server-definition/environment-variable-name.ts';

/**
 * A `GET /api/server-environment-names` válasza (SPEC-009 6.2, O-32 (a)): a
 * szerver folyamat környezetének változó NEVEI, név szerint növekvő
 * sorrendben. Kizárólag neveket hordoz, értéket soha; az elemek a központi
 * MCP definíció névszabályán (`EnvironmentVariableNameSchema`) mennek át, mert
 * a hozzárendelés szerver oldali neve csak ilyen lehet (6.1).
 */
export const ServerEnvironmentNameListSchema = z.array(EnvironmentVariableNameSchema).readonly();

export type ServerEnvironmentNameList = z.infer<typeof ServerEnvironmentNameListSchema>;
