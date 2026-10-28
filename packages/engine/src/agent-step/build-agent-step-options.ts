import type { AgentStepConfig } from '@easter-workflow-builder/db';
import type { AgentStepCapabilityDecisions } from './agent-step-capability-decisions.ts';
import type { ThinkingMode } from '@easter-workflow-builder/provider-capability';
import type { AgentStepOptions } from './agent-step-options.ts';
import type { SessionBinding } from './session-binding.ts';
import type { SkillLibrarySnapshot } from '../engine-port/skill-library-snapshot.ts';
import type { OutgoingMcpServer } from '../mcp-server-resolution/outgoing-mcp-server.ts';

/**
 * A `buildAgentStepOptions` bemenete. A hat mező hat, egymástól független
 * forrásból jön, és mind a hat **készen** érkezik: a lépés tárolt configja,
 * a leírótól függő döntések (`validateAgentStepCapabilities`), a kimenő env
 * blokk (`buildOutgoingEnvironment`, a `processEnvironment` porton át), a
 * feloldott MCP szerverek (`resolveMcpServers`, a `database` és a
 * `processEnvironment` porton át), a session kötés (`resolveSessionBinding`)
 * és a skill könyvtár állapota (a `skillLibrary` porton át). Így az
 * összeállítás maga tiszta függvény marad: sem portot, sem adatbázist nem
 * érint.
 */
export interface BuildAgentStepOptionsInput {
  readonly config: AgentStepConfig;
  readonly decisions: AgentStepCapabilityDecisions;
  readonly environmentBlock: Readonly<Record<string, string>>;
  readonly mcpServers: Readonly<Record<string, OutgoingMcpServer>>;
  readonly sessionBinding: SessionBinding;
  readonly skillLibrary: SkillLibrarySnapshot;
}

/**
 * A session mezők (SPEC-004 6.3 táblázat): `isolated` módban egyáltalán nem
 * kerül ki sem `resume`, sem `forkSession` mező (29. elfogadási kritérium),
 * `continued` módban mindkettő kimegy.
 */
function sessionFields(
  binding: SessionBinding,
): Record<string, never> | { readonly resume: string; readonly forkSession: boolean } {
  return binding.mode === 'isolated' ? {} : { resume: binding.resume, forkSession: binding.forkSession };
}

/**
 * A skill mezők (SPEC-009 5.1, 5.3): a `skills: null` lépésen sem `plugins`,
 * sem `skills` nem megy ki (O-40 (a)). Különben a `plugins` a skill könyvtár
 * gyökerére mutat, a `skills` pedig `<plugin>:<név>` alakú lista: a tárolt
 * puszta név a plugin névvel minősítve, mert a puszta név egy azonos nevű CLI
 * beépített skillt is engedélyezne (M-136 6a), a tárolt `'all'` pedig a
 * könyvtár aktuális neveinek explicit listája, mert az SDK `'all'` értéke a
 * beépítetteket is engedélyezné (M-136 2c, 4a; research
 * `2026-10-28-spec-009-blokkolo-meresek.md` 2. szekció).
 */
function skillFields(
  skills: AgentStepConfig['skills'],
  library: SkillLibrarySnapshot,
):
  | Record<string, never>
  | {
      readonly plugins: NonNullable<AgentStepOptions['plugins']>;
      readonly skills: NonNullable<AgentStepOptions['skills']>;
    } {
  if (skills === null) {
    return {};
  }
  const names = skills === 'all' ? library.skillNames : skills;
  return {
    plugins: [{ type: 'local', path: library.rootDirectory }],
    skills: names.map((name) => `${library.pluginName}:${name}`),
  };
}

/**
 * A strukturált kimenet mezője (SPEC-004 11.3 táblázat 2. sora, F-7): az
 * egyetlen stratégia, az `sdk_output_format` (SPEC-011 O-9), a kérés SDK
 * `outputFormat` mezőjén viszi a JSON Schema dokumentumot
 * (`{ type: 'json_schema', schema }`, agent-sdk research 1. szekció).
 *
 * Ha a lépés nem vár strukturált kimenetet, a mező nem kerül ki.
 */
function structuredOutputFields(
  config: AgentStepConfig,
): Record<string, never> | { readonly outputFormat: NonNullable<AgentStepOptions['outputFormat']> } {
  const structuredOutput = config.structuredOutput;
  if (structuredOutput === null) {
    return {};
  }
  return { outputFormat: { type: 'json_schema', schema: structuredOutput.schema } };
}

/**
 * A `thinking` mező (SPEC-004 11.3 táblázat 8. sora, SPEC-013 5.2): a motor `ThinkingMode` értékét
 * az SDK objektum alakjára képezi, mert az SDK a mezőt objektumként olvassa (`thinking.type`). Az
 * `always_on` módnak nincs SDK ága, ezért a mező elmarad, és a modell saját alapértéke érvényes;
 * egyik valódi leíró sem engedi ezt a módot. Ha a döntés `undefined`, a mező szintén elmarad.
 */
function thinkingFields(
  mode: ThinkingMode | undefined,
): Record<string, never> | { readonly thinking: NonNullable<AgentStepOptions['thinking']> } {
  switch (mode) {
    case 'adaptive': {
      return { thinking: { type: 'adaptive' } };
    }
    case 'disabled': {
      return { thinking: { type: 'disabled' } };
    }
    case 'always_on':
    case undefined: {
      return {};
    }
  }
}

/**
 * A kimenő Agent SDK `Options` objektum összeállítása (SPEC-004 5.2 4. pont).
 *
 * Három csoportból áll:
 *
 * 1. **Mindig kimenő mezők.** A `model` a leíró döntéséből jön (11.3 5. sor),
 *    a `disallowedTools` a lépés saját listája **plusz** a leíró szerint nem
 *    működő szerver oldali toolok kliens neve (12. sor), az
 *    `includePartialMessages` a 13. sor, az `env` a
 *    `provider-environment` téma blokkja (10. és 11. sor), a
 *    `persistSession` pedig minden lépésnél `true` (6.3, 32. elfogadási
 *    kritérium). A `settingSources: []` és a `strictMcpConfig: true` az
 *    izoláció (SPEC-009 7.1, O-20 (a)): a lépés nem olvassa a szerver gép
 *    user, project és local beállítás forrását (`~/.claude/settings.json`, a
 *    `cwd` alatti `.claude/` és `CLAUDE.md`, az ott felfedezett skillek), és
 *    csak a kimenő `mcpServers` MCP szervereit látja. Az auto memory
 *    kikapcsolása nem itt, hanem a kimenő `env` blokkban áll
 *    (`buildOutgoingEnvironment`, O-39).
 * 2. **A lépés configjából átemelt, elhagyható mezők.** Mindegyik tárolt alakja
 *    `null`-lal jelzi a hiányt (SPEC-003 4.4), és a `null` érték itt nem
 *    kiküldött `null`-t, hanem **hiányzó mezőt** jelent.
 * 3. **A session, a skill és a strukturált kimenet mezői**, a segédfüggvények
 *    szerint.
 * 4. **Az `mcpServers` mező** (SPEC-009 6.3, 6.4): a lépés
 *    `mcpServerReferences` hivatkozásaiból a motor `mcp-server-resolution`
 *    témája oldja fel, a központi definíciókból és a `processEnvironment`
 *    portból; üres eredménynél a mező nem megy ki, tehát a hivatkozás nélküli
 *    lépés `Options` objektuma változatlan. A lépés régi `mcpServers` mezőjét
 *    (`StorableMcpServer`) a motor nem képezi le (SPEC-009 6.2, O-42 (b)). A
 *    mező az env és fejléc **értékeket** hordozza, ezért az `Options`
 *    objektumot a motor nem naplózza és nem írja eseménybe (AC19).
 */
export function buildAgentStepOptions(input: BuildAgentStepOptionsInput): AgentStepOptions {
  const config = input.config;
  const decisions = input.decisions;

  return {
    model: decisions.model.outgoingModel,
    allowedTools: config.allowedTools,
    disallowedTools: [...config.disallowedTools, ...decisions.disallowedServerTools.disallowedTools],
    additionalDirectories: config.additionalDirectories,
    agents: config.agents,
    env: input.environmentBlock,
    includePartialMessages: decisions.includePartialMessages,
    persistSession: true,
    settingSources: [],
    strictMcpConfig: true,
    ...thinkingFields(decisions.thinking),
    ...(decisions.effort !== undefined && { effort: decisions.effort }),
    ...(config.permissionMode !== null && { permissionMode: config.permissionMode }),
    ...(config.maxTurns !== null && { maxTurns: config.maxTurns }),
    ...(config.maxBudgetUsd !== null && { maxBudgetUsd: config.maxBudgetUsd }),
    ...(config.systemPrompt !== null && { systemPrompt: config.systemPrompt }),
    ...skillFields(config.skills, input.skillLibrary),
    ...(Object.keys(input.mcpServers).length > 0 && { mcpServers: input.mcpServers }),
    ...(config.cwd !== null && { cwd: config.cwd }),
    ...(config.sandbox !== null && { sandbox: config.sandbox }),
    ...sessionFields(input.sessionBinding),
    ...structuredOutputFields(config),
  };
}
