import { JoinMergeSettingsSchema, type AgentStepConfig, type JoinNodeConfig } from '@easter-workflow-builder/protocol';
import { SelectField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
import { AgentStepConfigFields } from './AgentStepConfigFields.tsx';
import { JsonTextAreaField } from './JsonTextAreaField.tsx';
import { TextAreaField } from './TextAreaField.tsx';

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

const MODE_OPTIONS = [
  { value: 'merge', label: 'összefésülés' },
  { value: 'script', label: 'szkript' },
  { value: 'ai_synthesis', label: 'AI szintézis' },
];

/**
 * A `join` node szerkesztett mezői: `mode` és a módhoz tartozó `settings`
 * (SPEC-008 5.1). A `merge` mód beállítása `Record<string, unknown>`
 * (nincs Zod sémája a mezőin), tehát nyers JSON szerkesztőn megy; a
 * `script` mód a közös `ScriptConfig` alakot hordozza; az `ai_synthesis`
 * mód a teljes `AgentStepConfig`-ot, a `agent_step` node-dal AZONOS
 * `AgentStepConfigFields` komponensen át.
 */
export function JoinNodeFields(properties: Readonly<JoinNodeFieldsProperties>): ReactElement {
  const { config, onChange, inheritedProviderDescription } = properties;

  function handleModeChange(event: ChangeEvent<HTMLSelectElement>): void {
    const { onUnhandledError } = config;
    const nextMode = event.target.value;
    if (nextMode === 'merge') {
      onChange({ type: 'join', mode: 'merge', settings: {}, onUnhandledError });
      return;
    }
    if (nextMode === 'script') {
      onChange({ type: 'join', mode: 'script', settings: { source: '', runtime: 'expression' }, onUnhandledError });
      return;
    }
    if (nextMode === 'ai_synthesis') {
      onChange({ type: 'join', mode: 'ai_synthesis', settings: DEFAULT_AGENT_STEP_SETTINGS, onUnhandledError });
    }
  }

  const modeSelect = (
    <SelectField
      aria-label="Összefésülés módja"
      options={MODE_OPTIONS}
      value={config.mode}
      onChange={handleModeChange}
    />
  );

  if (config.mode === 'merge') {
    return (
      <fieldset>
        <legend>összefésülés</legend>
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
      </fieldset>
    );
  }

  if (config.mode === 'script') {
    return (
      <fieldset>
        <legend>összefésülés</legend>
        {modeSelect}
        <TextAreaField
          label="Forrás (source)"
          value={config.settings.source}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            onChange({ ...config, settings: { ...config.settings, source: event.target.value } });
          }}
        />
      </fieldset>
    );
  }

  return (
    <fieldset>
      <legend>összefésülés</legend>
      {modeSelect}
      <AgentStepConfigFields
        config={config.settings}
        onChange={(nextSettings) => {
          onChange({ ...config, settings: nextSettings });
        }}
        inheritedProviderDescription={inheritedProviderDescription}
      />
    </fieldset>
  );
}
