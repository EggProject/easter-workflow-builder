/**
 * A központi MCP szerver definíció tárolt alakja (SPEC-009 6.1, O-31): a
 * Beállításokon szerkesztett lista egy eleme, amire a lépés név szerint
 * hivatkozik (`mcp-server-reference.ts`). A három ág a lépés régi
 * `StorableMcpServer` uniójából indul, de saját típus: az a régi mező miatt
 * bájtra változatlan marad (O-42), ez pedig a `stdio` ágon az `envBindings`
 * mezővel bővül. Titkot egyik ág sem hordoz, csak env változó NEVET.
 *
 * A név nem része az alaknak: a tábla elsődleges kulcsa
 * (`mcp-server-definition-table.ts`), a REST útvonal paramétere.
 */
export interface StdioMcpServerDefinition {
  readonly type: 'stdio';
  readonly command: string;
  readonly args: readonly string[];
  /**
  A szerver folyamatának deklarált env változó nevei (SPEC-009 6.1).
  */
  readonly envNames: readonly string[];
  /**
  Az alapértelmezett hozzárendelés: deklarált név -> szerver oldali név. Egy deklarált név
  hiányzó bejegyzése azonos nevet jelent (6.4 feloldási sorrend 3. szintje).
  */
  readonly envBindings: Readonly<Record<string, string>>;
}

export interface SseMcpServerDefinition {
  readonly type: 'sse';
  readonly url: string;
  /**
  Az `Authorization` fejléc teljes értékét adó szerver oldali env változó NEVE, vagy `null` (nincs fejléc).
  */
  readonly authEnvName: string | null;
}

export interface HttpMcpServerDefinition {
  readonly type: 'http';
  readonly url: string;
  /**
  Az `Authorization` fejléc teljes értékét adó szerver oldali env változó NEVE, vagy `null` (nincs fejléc).
  */
  readonly authEnvName: string | null;
}

export type McpServerDefinition = StdioMcpServerDefinition | SseMcpServerDefinition | HttpMcpServerDefinition;
