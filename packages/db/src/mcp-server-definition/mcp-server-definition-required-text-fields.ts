import type { McpServerDefinition } from './mcp-server-definition.ts';

type RequiredTextFieldTable = {
  readonly [Type in McpServerDefinition['type']]: readonly Exclude<
    keyof Extract<McpServerDefinition, { readonly type: Type }>,
    'type'
  >[];
};

/**
 * A központi MCP szerver definíció kötelező szöveg mezői áganként (SPEC-009
 * 6.1, a node config kötelező szöveg mező szabályának mintájára,
 * `.claude/CLAUDE.md` 5. szekció): a `stdio` ág `command`, a `sse` és a
 * `http` ág `url` mezője nem lehet üres vagy csak szóközből álló. A
 * `saveDefinition` írás oldali ellenőrzése ebből dolgozik; az olvasó guard
 * (`isMcpServerDefinition`) nem.
 *
 * A `packages/protocol` mentési sémája ugyanezt a táblát tartja, szándékos
 * duplikátumként; a két tábla típusszintű egyenlőségét és mezőnkénti
 * futásidejű viselkedését az `apps/server` `mcp-server-definition-drift-protection`
 * regressziós tesztje őrzi.
 */
export const MCP_SERVER_DEFINITION_REQUIRED_TEXT_FIELDS = {
  stdio: ['command'],
  sse: ['url'],
  http: ['url'],
} as const satisfies RequiredTextFieldTable;
