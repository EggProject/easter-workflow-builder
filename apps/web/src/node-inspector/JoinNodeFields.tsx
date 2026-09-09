import { JoinMergeSettingsSchema, type AgentStepConfig, type JoinNodeConfig } from '@easter-workflow-builder/protocol';
import { SelectField, TextAreaField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
import { AgentStepConfigFields } from './AgentStepConfigFields.tsx';
import { JsonTextAreaField } from './JsonTextAreaField.tsx';
import { useFieldError } from './use-field-error.ts';

export interface JoinNodeFieldsProperties {
  readonly config: JoinNodeConfig;
  readonly onChange: (nextConfig: JoinNodeConfig) => void;
  /**
   * Az `ai_synthesis` mód a teljes `AgentStepConfig`-ot szerkeszti, aminek
   * saját `providerId` mezője van (AC17) - ugyanaz a leírás, mint az
   * `agent_step` node esetében.
   */
  readonly inheritedProviderDescription: string;
}

/**
 * Az `ai_synthesis` módra váltáskor felvett, érvényes alapértelmezett
 * `AgentStepConfig` - a `join` node NEM hoz létre új node-ot, csak módot
 * vált egy MÁR LÉTEZŐ node-on, tehát ennek a konstansnak kizárólag ez az
 * egyetlen fogyasztója van.
 */
const DEFAULT_AGENT_STEP_SETTINGS: AgentStepConfig = {
  promptTemplate: '',
  // eslint-disable-next-line unicorn/no-null -- az `AgentStepConfig` nullázható mezői a dróton ténylegesen `null` értéket hordozzák (SPEC-005).
  providerId: null,
  // eslint-disable-next-line unicorn/no-null -- lásd fent.
  modelId: null,
  // eslint-disable-next-line unicorn/no-null -- lásd fent.
  effort: null,
  // eslint-disable-next-line unicorn/no-null -- lásd fent.
  thinking: null,
  allowedTools: [],
  disallowedTools: [],
  // eslint-disable-next-line unicorn/no-null -- lásd fent.
  permissionMode: null,
  // eslint-disable-next-line unicorn/no-null -- lásd fent.
  maxTurns: null,
  // eslint-disable-next-line unicorn/no-null -- lásd fent.
  maxBudgetUsd: null,
  // eslint-disable-next-line unicorn/no-null -- lásd fent.
  systemPrompt: null,
  agents: {},
  // eslint-disable-next-line unicorn/no-null -- lásd fent.
  skills: null,
  mcpServers: {},
  enabledEngineHooks: [],
  // eslint-disable-next-line unicorn/no-null -- lásd fent.
  cwd: null,
  additionalDirectories: [],
  // eslint-disable-next-line unicorn/no-null -- lásd fent.
  sandbox: null,
  agentTools: [],
  sessionMode: 'isolated',
  // eslint-disable-next-line unicorn/no-null -- lásd fent.
  structuredOutput: null,
};

/**
 * `as const`, hogy a `SelectField` értéktípusa a három módra szűküljön: így
 * a mód kezelője kimerítő `switch` lehet, aminek nincs sosem futó ága
 * (`.claude/CLAUDE.md` 5. szekció, 100 százalékos lefedettség). A `satisfies`
 * őrzi, hogy minden felsorolt érték valóban `JoinNodeConfig` mód legyen.
 */
const MODE_OPTIONS = [
  { value: 'merge', label: 'összefésülés' },
  { value: 'script', label: 'szkript' },
  { value: 'ai_synthesis', label: 'AI szintézis' },
] as const satisfies readonly { readonly value: JoinNodeConfig['mode']; readonly label: string }[];

/**
 * A `join` node szerkesztett mezői: `mode` és a módhoz tartozó `settings`
 * (SPEC-008 5.1). A `merge` mód beállítása `Record<string, unknown>`
 * (nincs Zod sémája a mezőin), tehát nyers JSON szerkesztőn megy; a
 * `script` mód a közös `ScriptConfig` alakot hordozza; az `ai_synthesis`
 * mód a teljes `AgentStepConfig`-ot, a `agent_step` node-dal AZONOS
 * `AgentStepConfigFields` komponensen át.
 *
 * CSOPORTOSÍTÁS: a mód választó és a módhoz tartozó egyetlen beállítás
 * elöl áll, panel nélkül - a `merge` és a `script` módnak összesen két
 * mezője van. Az `ai_synthesis` mód a saját panelezését az
 * `AgentStepConfigFields`-től örökli, tehát a mód választó után ugyanaz a
 * "elöl a prompt, panelben a felülírások" tagolás jelenik meg.
 */
export function JoinNodeFields(properties: Readonly<JoinNodeFieldsProperties>): ReactElement {
  const { config, onChange, inheritedProviderDescription } = properties;
  const modeError = useFieldError('mode');
  const sourceError = useFieldError('settings.source');

  function handleModeChange(nextMode: JoinNodeConfig['mode']): void {
    const { onUnhandledError } = config;
    switch (nextMode) {
      case 'merge': {
        onChange({ type: 'join', mode: 'merge', settings: {}, onUnhandledError });
        break;
      }
      case 'script': {
        onChange({ type: 'join', mode: 'script', settings: { source: '', runtime: 'expression' }, onUnhandledError });
        break;
      }
      case 'ai_synthesis': {
        onChange({ type: 'join', mode: 'ai_synthesis', settings: DEFAULT_AGENT_STEP_SETTINGS, onUnhandledError });
        break;
      }
    }
  }

  const modeSelect = (
    <SelectField
      size="sm"
      label="Összefésülés módja"
      error={modeError}
      options={MODE_OPTIONS}
      value={config.mode}
      onChange={handleModeChange}
    />
  );

  if (config.mode === 'merge') {
    return (
      <>
        {modeSelect}
        <JsonTextAreaField
          label="Összefésülési beállítás (nyers JSON - nincs sémája a mezőin)"
          value={config.settings}
          onChange={(nextValue) => {
            const parsed = JoinMergeSettingsSchema.safeParse(nextValue);
            if (parsed.success) {
              onChange({ ...config, settings: parsed.data });
            }
          }}
        />
      </>
    );
  }

  if (config.mode === 'script') {
    return (
      <>
        {modeSelect}
        <TextAreaField
          size="sm"
          label="Forrás (source)"
          value={config.settings.source}
          error={sourceError}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            onChange({ ...config, settings: { ...config.settings, source: event.target.value } });
          }}
        />
      </>
    );
  }

  return (
    <>
      {modeSelect}
      <AgentStepConfigFields
        fieldPathPrefix="settings."
        config={config.settings}
        onChange={(nextSettings) => {
          onChange({ ...config, settings: nextSettings });
        }}
        inheritedProviderDescription={inheritedProviderDescription}
      />
    </>
  );
}
