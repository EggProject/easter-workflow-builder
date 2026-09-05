import { z } from 'zod';

/**
 * A lépésenként bekapcsolható in-process MCP eszközök azonosítója, drótszintű
 * felsorolásként. Szándékos duplikáció, ugyanazon okból, mint a
 * `provider-id.ts`.
 */
export const AgentToolIdSchema = z.enum(['web_search', 'web_fetch', 'understand_image']);

export type AgentToolId = z.infer<typeof AgentToolIdSchema>;
