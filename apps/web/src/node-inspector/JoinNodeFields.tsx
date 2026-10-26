import type { JoinNodeConfig } from '@easter-workflow-builder/protocol';
import { SelectField, TextAreaField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
import { AgentStepConfigFields } from './AgentStepConfigFields.tsx';
import { DEFAULT_AGENT_STEP_SETTINGS } from './default-agent-step-settings.ts';
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

type SelectedJoinMode = NonNullable<JoinNodeConfig['mode']>;

/**
 * `as const`, hogy a `SelectField` értéktípusa a három módra szűküljön: így
 * a mód kezelője kimerítő `switch` lehet, aminek nincs sosem futó ága
 * (`.claude/CLAUDE.md` 5. szekció, 100 százalékos lefedettség). A `satisfies`
 * őrzi, hogy minden felsorolt érték valóban `JoinNodeConfig` mód legyen. A
 * választatlan (`mode: null`, SPEC-008 O-33) állapotnak nincs opciója: a
 * felhasználó a három mód közül választ, és amíg nem választott, a mező
 * értéke egyik opcióval sem egyezik, ezért a helyőrző felirat látszik.
 * Választás után üresre visszaállni nem lehet (user döntés 2026-10-14).
 */
const MODE_OPTIONS = [
  { value: 'merge', label: 'összefésülés' },
  { value: 'script', label: 'szkript' },
  { value: 'ai_synthesis', label: 'AI szintézis' },
] as const satisfies readonly { readonly value: SelectedJoinMode; readonly label: string }[];

/**
 * A `join` node szerkesztett mezői: `mode` és a módhoz tartozó `settings`
 * (SPEC-008 5.1). A `merge` módnak nincs beállítása (user döntés
 * 2026-10-26: a `settings` mező kikerült); a `script` mód a közös
 * `ScriptConfig` alakot hordozza; az `ai_synthesis` mód a teljes
 * `AgentStepConfig`-ot, a `agent_step` node-dal AZONOS
 * `AgentStepConfigFields` komponensen át.
 *
 * CSOPORTOSÍTÁS: a mód választó és a módhoz tartozó egyetlen beállítás
 * elöl áll, panel nélkül - a `script` módnak összesen két mezője van, a
 * `merge` módnál csak a mód választó áll. Az `ai_synthesis` mód a saját panelezését az
 * `AgentStepConfigFields`-től örökli, tehát a mód választó után ugyanaz a
 * "elöl a prompt, panelben a felülírások" tagolás jelenik meg. A
 * választatlan (`mode: null`) állapotban is csak a mód választó áll, mert a
 * beállítás a módtól függ; a mentési séma a mező alatt jelez (SPEC-008 5.4,
 * O-33).
 */
export function JoinNodeFields(properties: Readonly<JoinNodeFieldsProperties>): ReactElement {
  const { config, onChange, inheritedProviderDescription } = properties;
  const modeError = useFieldError('mode');
  const sourceError = useFieldError('settings.source');

  function handleModeChange(nextMode: SelectedJoinMode): void {
    const { onUnhandledError } = config;
    switch (nextMode) {
      case 'merge': {
        onChange({ type: 'join', mode: 'merge', onUnhandledError });
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
      placeholder="Válassz…"
      options={MODE_OPTIONS}
      value={config.mode ?? ''}
      onChange={handleModeChange}
    />
  );

  if (config.mode === null || config.mode === 'merge') {
    return modeSelect;
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
