import type { McpServerDefinition } from '@easter-workflow-builder/protocol';

/**
 * A központi MCP szerver három ága (SPEC-009 6.1).
 */
export type McpServerType = McpServerDefinition['type'];

/**
 * A szerkesztő modális űrlap-állapota: mindhárom ág mezői egyszerre élnek,
 * hogy a típusváltás ne dobja el a már beírt értéket; a mentéskor a
 * `buildMcpServerDefinition` csak a kiválasztott ág mezőit veszi.
 */
export interface McpServerDraft {
  readonly name: string;
  readonly type: McpServerType;
  readonly command: string;
  readonly args: readonly string[];
  /**
   * A deklarált változó nevek (`stdio`).
   */
  readonly envNames: readonly string[];
  /**
   * Deklarált név -> szerver oldali név (`stdio`); a hiányzó bejegyzés azonos
   * nevet jelent.
   */
  readonly envBindings: Readonly<Record<string, string>>;
  readonly url: string;
  /**
   * A `sse` és `http` ág `Authorization` fejlécét adó szerver oldali név; az
   * üres szöveg a "nincs" (a definícióban `null`).
   */
  readonly authEnvName: string;
}
