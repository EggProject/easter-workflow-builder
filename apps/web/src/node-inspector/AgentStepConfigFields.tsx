import {
  EngineHookIdSchema,
  ProviderIdSchema,
  SessionModeSchema,
  ThinkingModeSchema,
  AgentToolIdSchema,
  type AgentStepConfig,
} from '@easter-workflow-builder/protocol';
import { Checkbox, SelectField, TextField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
import { AgentsFieldEditor } from './AgentsFieldEditor.tsx';
import { SandboxField } from './SandboxField.tsx';
import { StructuredOutputField } from './StructuredOutputField.tsx';
import { SystemPromptField } from './SystemPromptField.tsx';
import { TextAreaField } from './TextAreaField.tsx';
import { describeUnknownValue } from './describe-unknown-value.ts';
import { fromNumberFieldValue, toNumberFieldValue } from './nullable-number-field-value.ts';
import { fromTextFieldValue, toTextFieldValue } from './nullable-text-field-value.ts';
import { fromStringListFieldValue, toStringListFieldValue } from './string-list-field-value.ts';
import './node-inspector.css';

const SPEC_009_SCOPE_REASON = 'a SPEC-009 hatóköre (skill feltöltés / MCP konfiguráció), itt csak olvasható';

export interface AgentStepConfigFieldsProperties {
  readonly config: AgentStepConfig;
  readonly onChange: (nextConfig: AgentStepConfig) => void;
  /**
   * A `providerId` `null` értéke esetén megjelenő szöveg, ami megnevezi,
   * melyik providert örökli a lépés (AC17) - a `describe-inherited-
   * provider.ts` adja, a `NodeInspector` konténerben lekérdezett workflow és
   * globális beállítás alapján.
   */
  readonly inheritedProviderDescription: string;
}

function MultiCheckboxSelector<TOption extends string>(
  properties: Readonly<{
    legend: string;
    options: readonly TOption[];
    selected: readonly TOption[];
    onToggle: (option: TOption, isChecked: boolean) => void;
  }>,
): ReactElement {
  const { legend, options, selected, onToggle } = properties;
  return (
    <fieldset>
      <legend>{legend}</legend>
      {options.map((option) => (
        <Checkbox
          key={option}
          label={option}
          checked={selected.includes(option)}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onToggle(option, event.target.checked);
          }}
        />
      ))}
    </fieldset>
  );
}

/**
 * Az `AgentStepConfig` teljes szerkesztő felülete, három csoportban
 * (SPEC-008 5.2): az `agent_step` node és a `join` `ai_synthesis` módja
 * egyaránt ezt használja. A `skills` és az `mcpServers` mező olvasható, nem
 * szerkeszthető - a panel ezt ki is mondja (AC16). Az `agents` mező a
 * `AgentsFieldEditor` saját, kulcsonkénti szerkesztőjén megy.
 */
export function AgentStepConfigFields(properties: Readonly<AgentStepConfigFieldsProperties>): ReactElement {
  const { config, onChange, inheritedProviderDescription } = properties;

  function setField<TKey extends keyof AgentStepConfig>(key: TKey, fieldValue: AgentStepConfig[TKey]): void {
    onChange({ ...config, [key]: fieldValue });
  }

  return (
    <div className="agent-step-config-fields">
      <fieldset>
        <legend>prompt és provider</legend>
        <TextAreaField
          label="Prompt sablon"
          value={config.promptTemplate}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            setField('promptTemplate', event.target.value);
          }}
        />
        <SystemPromptField
          value={config.systemPrompt}
          onChange={(nextValue) => {
            setField('systemPrompt', nextValue);
          }}
        />
        <SelectField
          aria-label="Provider felülírás"
          options={[
            { value: '', label: 'nincs felülírás (öröklés)' },
            ...ProviderIdSchema.options.map((option) => ({ value: option, label: option })),
          ]}
          value={config.providerId ?? ''}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            // A "nincs felülírás" opció értéke maga is üres string, és egy DOM
            // szinten érvénytelen érték natív `<select>`-en happy-dom alatt
            // (mért viselkedés) szintén üres stringre esik vissza - a két eset
            // ezért egyetlen `.find` hívással, egy ágban kezelhető: külön "raw
            // === ''" elágazás után a `matched !== undefined` false ága
            // típusilag garantáltan sosem futna (`.claude/CLAUDE.md` 5.
            // szekció), mert minden nem-üres `raw` a `ProviderIdSchema.options`
            // egyik eleméből jön, sosem tetszőleges sztringből.
            const matched = ProviderIdSchema.options.find((option) => option === event.target.value);
            // eslint-disable-next-line unicorn/no-null -- a `providerId: ProviderId | null` `null` értéke jelenti a "nincs felülírás" (üres vagy DOM szinten érvénytelen) állapotot.
            setField('providerId', matched ?? null);
          }}
        />
        {config.providerId === null && <p className="node-inspector__reason">{inheritedProviderDescription}</p>}
        <TextField
          label="Modell azonosító"
          value={toTextFieldValue(config.modelId)}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setField('modelId', fromTextFieldValue(event.target.value));
          }}
        />
        <SelectField
          aria-label="Session mód"
          options={SessionModeSchema.options.map((option) => ({ value: option, label: option }))}
          value={config.sessionMode}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            const matched = SessionModeSchema.options.find((option) => option === event.target.value);
            if (matched !== undefined) {
              setField('sessionMode', matched);
            }
          }}
        />
      </fieldset>

      <fieldset>
        <legend>futási korlátok</legend>
        <TextField
          type="number"
          label="Max. körök száma"
          value={toNumberFieldValue(config.maxTurns)}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setField('maxTurns', fromNumberFieldValue(event.target.value));
          }}
        />
        <TextField
          type="number"
          label="Max. büdzsé (USD)"
          value={toNumberFieldValue(config.maxBudgetUsd)}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setField('maxBudgetUsd', fromNumberFieldValue(event.target.value));
          }}
        />
        <TextField
          label="Effort"
          value={toTextFieldValue(config.effort)}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setField('effort', fromTextFieldValue(event.target.value));
          }}
        />
        <SelectField
          aria-label="Thinking mód"
          options={[
            { value: '', label: 'nincs megadva' },
            ...ThinkingModeSchema.options.map((option) => ({ value: option, label: option })),
          ]}
          value={config.thinking ?? ''}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            // Lásd a `providerId` mező fenti indoklását: a "nincs megadva" és a
            // DOM szinten érvénytelen eset happy-dom alatt egyaránt üres
            // stringre esik vissza, tehát egyetlen `.find` hívás fedi mindkét
            // esetet - egy külön "raw === ''" elágazás után a `matched !==
            // undefined` false ága garantáltan sosem futna.
            const matched = ThinkingModeSchema.options.find((option) => option === event.target.value);
            // eslint-disable-next-line unicorn/no-null -- a `thinking: ThinkingMode | null` "nincs megadva" (üres vagy DOM szinten érvénytelen) ága.
            setField('thinking', matched ?? null);
          }}
        />
        <TextField
          label="Jogosultsági mód"
          value={toTextFieldValue(config.permissionMode)}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setField('permissionMode', fromTextFieldValue(event.target.value));
          }}
        />
        <MultiCheckboxSelector
          legend="Bekapcsolt motor hookok"
          options={EngineHookIdSchema.options}
          selected={config.enabledEngineHooks}
          onToggle={(option, isChecked) => {
            setField(
              'enabledEngineHooks',
              isChecked
                ? [...config.enabledEngineHooks, option]
                : // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- az `EngineHookId` ma egyetlen elemű enum, a típusrendszer ezért mindig hamisnak látja az összehasonlítást; érték szinten helyes és egy jövőbeli második elemre értelmes marad.
                  config.enabledEngineHooks.filter((existing) => existing !== option),
            );
          }}
        />
      </fieldset>

      <fieldset>
        <legend>eszközök és környezet</legend>
        <TextAreaField
          label="Engedélyezett eszközök"
          value={toStringListFieldValue(config.allowedTools)}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            setField('allowedTools', fromStringListFieldValue(event.target.value));
          }}
        />
        <TextAreaField
          label="Tiltott eszközök"
          value={toStringListFieldValue(config.disallowedTools)}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            setField('disallowedTools', fromStringListFieldValue(event.target.value));
          }}
        />
        <MultiCheckboxSelector
          legend="Beépített agent eszközök"
          options={AgentToolIdSchema.options}
          selected={config.agentTools}
          onToggle={(option, isChecked) => {
            setField(
              'agentTools',
              isChecked ? [...config.agentTools, option] : config.agentTools.filter((existing) => existing !== option),
            );
          }}
        />
        <TextField
          label="Munkakönyvtár (cwd)"
          value={toTextFieldValue(config.cwd)}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setField('cwd', fromTextFieldValue(event.target.value));
          }}
        />
        <TextAreaField
          label="További engedélyezett könyvtárak"
          value={toStringListFieldValue(config.additionalDirectories)}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            setField('additionalDirectories', fromStringListFieldValue(event.target.value));
          }}
        />
        <SandboxField
          value={config.sandbox}
          onChange={(nextValue) => {
            setField('sandbox', nextValue);
          }}
        />
        <StructuredOutputField
          value={config.structuredOutput}
          onChange={(nextValue) => {
            setField('structuredOutput', nextValue);
          }}
        />
      </fieldset>

      <fieldset>
        <legend>SPEC-009 hatóköre</legend>
        <div className="field">
          <span className="field__label">Skillek</span>
          <p>{describeUnknownValue(config.skills)}</p>
          <p className="node-inspector__reason">{SPEC_009_SCOPE_REASON}</p>
        </div>
        <div className="field">
          <span className="field__label">MCP szerverek</span>
          <p>{describeUnknownValue(config.mcpServers)}</p>
          <p className="node-inspector__reason">{SPEC_009_SCOPE_REASON}</p>
        </div>
      </fieldset>

      <fieldset>
        <legend>agents</legend>
        <AgentsFieldEditor
          value={config.agents}
          onChange={(nextValue) => {
            setField('agents', nextValue);
          }}
        />
      </fieldset>
    </div>
  );
}
