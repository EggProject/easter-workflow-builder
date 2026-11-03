/**
 * A két nem támogatott agent definíció mező indoka (SPEC-009 6.2, O-53, user döntés 2026-10-28): a
 * futás egyiket sem adja ki, a mentési séma elutasítja, a panel a tárolt értéket mutatja és
 * eltávolítható.
 */
const UNSUPPORTED_MEMORY_REASON =
  'nem támogatott mező: a gép agent memória könyvtárát töltené be, a futás nem adja ki; a mentéshez távolítsd el';
const UNSUPPORTED_AGENT_MCP_SERVERS_REASON =
  'a régi, közvetlen alak: a futás csak a név elemeit adja ki, a szerver objektumot nem, és az objektum elemmel a gráf nem menthető; az MCP szervert a fenti listából válaszd';

/**
 * Az `agents` mező egy bejegyzésének (`AgentDefinition`-szerű `unknown`
 * érték) szerkesztett mezőlistája - a `docs/research/
 * 2026-09-05-grafszerkeszto-es-transcript.md` 5. szekciójában mért,
 * **tizenhárom, két forrással fedett** mező (SPEC-008 5.2 "Az `agents` mező
 * űrlapja"). Az `agents` maga `Record<string, unknown>` marad a `db` és a
 * `protocol` oldalán is (sodródás védelem, `.claude/CLAUDE.md` 5. szekció),
 * tehát ehhez a tábla ad felületi típusbiztonságot, nem egy második
 * séma forrás.
 *
 * A `skills` sor a `SkillsField` vezérlőn szerkeszthető, a lépés szintű
 * mezővel azonos tárolt alakkal (SPEC-009 5.2). Az `mcpServers` sor olvasható,
 * a régi alakot megnevező szöveggel (SPEC-009 6.2, AC26); az MCP hivatkozás
 * (`mcpServerReferences`) NEM sora a táblának, mert nem SDK mező, a bejegyzés
 * panelje külön rajzolja a `McpServerReferencesField` vezérlőjével.
 */
export type AgentDefinitionFieldGroup =
  'kötelező' | 'modell és korlátok' | 'eszközök' | 'környezet' | 'skillek' | 'MCP szerverek';

export type AgentDefinitionFieldControl =
  | { readonly kind: 'text' }
  | { readonly kind: 'textarea' }
  | { readonly kind: 'number' }
  | { readonly kind: 'boolean' }
  | { readonly kind: 'string-list' }
  | { readonly kind: 'skills' }
  | { readonly kind: 'unsupported'; readonly reason: string };

export interface AgentDefinitionFieldDescriptor {
  readonly key: string;
  readonly label: string;
  readonly group: AgentDefinitionFieldGroup;
  readonly control: AgentDefinitionFieldControl;
  readonly required: boolean;
}

export const AGENT_DEFINITION_FIELD_TABLE = [
  { key: 'description', label: 'Leírás', group: 'kötelező', control: { kind: 'textarea' }, required: true },
  { key: 'prompt', label: 'Prompt', group: 'kötelező', control: { kind: 'textarea' }, required: true },
  { key: 'model', label: 'Modell', group: 'modell és korlátok', control: { kind: 'text' }, required: false },
  {
    key: 'maxTurns',
    label: 'Max. körök száma',
    group: 'modell és korlátok',
    control: { kind: 'number' },
    required: false,
  },
  {
    key: 'effort',
    label: 'Effort (szint neve vagy szám)',
    group: 'modell és korlátok',
    control: { kind: 'text' },
    required: false,
  },
  {
    key: 'permissionMode',
    label: 'Jogosultsági mód',
    group: 'modell és korlátok',
    control: { kind: 'text' },
    required: false,
  },
  {
    key: 'background',
    label: 'Háttérben fut',
    group: 'modell és korlátok',
    control: { kind: 'boolean' },
    required: false,
  },
  {
    key: 'tools',
    label: 'Engedélyezett eszközök',
    group: 'eszközök',
    control: { kind: 'string-list' },
    required: false,
  },
  {
    key: 'disallowedTools',
    label: 'Tiltott eszközök',
    group: 'eszközök',
    control: { kind: 'string-list' },
    required: false,
  },
  {
    key: 'memory',
    label: 'Memória hatóköre',
    group: 'környezet',
    control: { kind: 'unsupported', reason: UNSUPPORTED_MEMORY_REASON },
    required: false,
  },
  { key: 'initialPrompt', label: 'Kezdő üzenet', group: 'környezet', control: { kind: 'textarea' }, required: false },
  {
    key: 'skills',
    label: 'Skillek',
    group: 'skillek',
    control: { kind: 'skills' },
    required: false,
  },
  {
    key: 'mcpServers',
    label: 'MCP szerverek',
    group: 'MCP szerverek',
    control: { kind: 'unsupported', reason: UNSUPPORTED_AGENT_MCP_SERVERS_REASON },
    required: false,
  },
] as const satisfies readonly AgentDefinitionFieldDescriptor[];

/**
 * A mérésben NEM megerősített mező, csak a telepített `.d.ts` fájlban
 * szerepel, hivatalos doksi nem fedi (M-90). Ezek NEM tagjai a fenti
 * tizenhármas listának - a panel olvashatóan mutatja, megnevezett okkal.
 */
export const UNCONFIRMED_AGENT_DEFINITION_FIELD_REASON =
  'nem megerősített mező: csak a telepített .d.ts fájlban szerepel, hivatalos dokumentáció nem fedi (M-90)';

export const UNCONFIRMED_AGENT_DEFINITION_FIELD_KEYS = [
  'criticalSystemReminder_EXPERIMENTAL',
  'observer',
  'observerMessage',
] as const;
