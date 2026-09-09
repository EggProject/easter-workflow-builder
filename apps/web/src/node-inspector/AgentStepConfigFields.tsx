import {
  EngineHookIdSchema,
  ProviderIdSchema,
  SessionModeSchema,
  ThinkingModeSchema,
  AgentToolIdSchema,
  type AgentStepConfig,
} from '@easter-workflow-builder/protocol';
import { Accordion, AccordionItem, Checkbox, SelectField, TextAreaField, TextField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
import { AgentsFieldEditor } from './AgentsFieldEditor.tsx';
import { InspectorFieldGroup } from './InspectorFieldGroup.tsx';
import { SandboxField } from './SandboxField.tsx';
import { StructuredOutputField } from './StructuredOutputField.tsx';
import { SystemPromptField } from './SystemPromptField.tsx';
import { describeUnknownValue } from './describe-unknown-value.ts';
import { fromNumberFieldValue, toNumberFieldValue } from './nullable-number-field-value.ts';
import { fromTextFieldValue, toTextFieldValue } from './nullable-text-field-value.ts';
import { fromStringListFieldValue, toStringListFieldValue } from './string-list-field-value.ts';
import { useFieldError } from './use-field-error.ts';
import './node-inspector.css';

const SPEC_009_SCOPE_REASON = 'a SPEC-009 hatóköre (skill feltöltés / MCP konfiguráció), itt csak olvasható';

export interface AgentStepConfigFieldsProperties {
  readonly config: AgentStepConfig;
  readonly onChange: (nextConfig: AgentStepConfig) => void;
  /**
   * A szerkesztett alak útvonal előtagja a node `config` gyökeréhez képest,
   * a mezőnkénti hibakereséshez. Az `agent_step` node-on üres sztring (az
   * `AgentStepConfig` MAGA a config), a `join` node `ai_synthesis` módjában
   * `settings.`, mert ott ugyanez az alak a `settings` mező alatt áll.
   * Kötelező prop, alapérték nélkül: egy alapérték olyan elágazást hozna,
   * amit csak az egyik hívó futtatna.
   */
  readonly fieldPathPrefix: string;
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
    title: string;
    options: readonly TOption[];
    selected: readonly TOption[];
    onToggle: (option: TOption, isChecked: boolean) => void;
  }>,
): ReactElement {
  const { title, options, selected, onToggle } = properties;
  return (
    <InspectorFieldGroup title={title}>
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
    </InspectorFieldGroup>
  );
}

/**
 * Az `AgentStepConfig` teljes szerkesztő felülete: az `agent_step` node és a
 * `join` `ai_synthesis` módja egyaránt ezt használja. A `skills` és az
 * `mcpServers` mező olvasható, nem szerkeszthető - a panel ezt ki is mondja
 * (AC16). Az `agents` mező a `AgentsFieldEditor` saját, kulcsonkénti
 * szerkesztőjén megy.
 *
 * CSOPORTOSÍTÁS (SPEC-008 5.2, felhasználói kérés 2026-09-09). Ez az
 * egyetlen olyan csomópont típus, aminek annyi mezője van, hogy tagolni
 * kell. A tagolás elve: ELÖL, panel nélkül az áll, amit a felhasználó
 * majdnem minden lépésen megír, panelbe pedig az, ami felülírás, tehát
 * alapesetben üresen marad.
 *
 * - ELÖL: a **prompt sablon** (a lépés lényege), a **rendszer prompt** és a
 *   **provider felülírás** az örökölt provider megnevezésével. Ez a három
 *   dönti el, hogy egyáltalán mit csinál a lépés.
 * - "Modell és futási korlátok" panel: modell azonosító, session mód, max.
 *   körök, max. büdzsé, effort, thinking mód, jogosultsági mód, motor
 *   hookok. **Mind felülírás**, a séma szerint `null`/üres alapértékkel,
 *   tehát a lépések többségén érintetlen marad.
 * - "Eszközök és környezet" panel: engedélyezett és tiltott eszközök,
 *   beépített agent eszközök, munkakönyvtár, további könyvtárak, sandbox,
 *   strukturált kimenet. Szintén mind felülírás, és a két JSON szerkesztő
 *   (sandbox, kimenet séma) különösen ritkán nyúlt.
 * - "Al-agentek (agents)" panel: saját, kulcsonkénti szerkesztő, ami
 *   nyitva sok helyet foglal, miközben a legtöbb lépésen üres.
 * - "Skillek és MCP szerverek (csak olvasható)" panel: itt semmit nem lehet
 *   szerkeszteni (SPEC-009 hatóköre), tehát a legkevésbé sem tartozik elöl.
 */
export function AgentStepConfigFields(properties: Readonly<AgentStepConfigFieldsProperties>): ReactElement {
  const { config, onChange, inheritedProviderDescription, fieldPathPrefix } = properties;
  const promptTemplateError = useFieldError(`${fieldPathPrefix}promptTemplate`);
  const systemPromptError = useFieldError(`${fieldPathPrefix}systemPrompt`);
  const providerIdError = useFieldError(`${fieldPathPrefix}providerId`);
  const modelIdError = useFieldError(`${fieldPathPrefix}modelId`);
  const sessionModeError = useFieldError(`${fieldPathPrefix}sessionMode`);
  const maxTurnsError = useFieldError(`${fieldPathPrefix}maxTurns`);
  const maxBudgetUsdError = useFieldError(`${fieldPathPrefix}maxBudgetUsd`);
  const effortError = useFieldError(`${fieldPathPrefix}effort`);
  const thinkingError = useFieldError(`${fieldPathPrefix}thinking`);
  const permissionModeError = useFieldError(`${fieldPathPrefix}permissionMode`);
  const allowedToolsError = useFieldError(`${fieldPathPrefix}allowedTools`);
  const disallowedToolsError = useFieldError(`${fieldPathPrefix}disallowedTools`);
  const cwdError = useFieldError(`${fieldPathPrefix}cwd`);
  const additionalDirectoriesError = useFieldError(`${fieldPathPrefix}additionalDirectories`);

  function setField<TKey extends keyof AgentStepConfig>(key: TKey, fieldValue: AgentStepConfig[TKey]): void {
    onChange({ ...config, [key]: fieldValue });
  }

  return (
    <>
      <TextAreaField
        size="sm"
        label="Prompt sablon"
        value={config.promptTemplate}
        error={promptTemplateError}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          setField('promptTemplate', event.target.value);
        }}
      />
      <SystemPromptField
        value={config.systemPrompt}
        error={systemPromptError}
        onChange={(nextValue) => {
          setField('systemPrompt', nextValue);
        }}
      />
      <SelectField
        size="sm"
        label="Provider felülírás"
        error={providerIdError}
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

      <Accordion>
        <AccordionItem title="Modell és futási korlátok">
          <div className="node-inspector__group">
            <TextField
              size="sm"
              label="Modell azonosító"
              value={toTextFieldValue(config.modelId)}
              error={modelIdError}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setField('modelId', fromTextFieldValue(event.target.value));
              }}
            />
            <SelectField
              size="sm"
              label="Session mód"
              error={sessionModeError}
              options={SessionModeSchema.options.map((option) => ({ value: option, label: option }))}
              value={config.sessionMode}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                const matched = SessionModeSchema.options.find((option) => option === event.target.value);
                if (matched !== undefined) {
                  setField('sessionMode', matched);
                }
              }}
            />
            <TextField
              size="sm"
              type="number"
              label="Max. körök száma"
              value={toNumberFieldValue(config.maxTurns)}
              error={maxTurnsError}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setField('maxTurns', fromNumberFieldValue(event.target.value));
              }}
            />
            <TextField
              size="sm"
              type="number"
              label="Max. büdzsé (USD)"
              value={toNumberFieldValue(config.maxBudgetUsd)}
              error={maxBudgetUsdError}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setField('maxBudgetUsd', fromNumberFieldValue(event.target.value));
              }}
            />
            <TextField
              size="sm"
              label="Effort"
              value={toTextFieldValue(config.effort)}
              error={effortError}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setField('effort', fromTextFieldValue(event.target.value));
              }}
            />
            <SelectField
              size="sm"
              label="Thinking mód"
              error={thinkingError}
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
              size="sm"
              label="Jogosultsági mód"
              value={toTextFieldValue(config.permissionMode)}
              error={permissionModeError}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setField('permissionMode', fromTextFieldValue(event.target.value));
              }}
            />
            <MultiCheckboxSelector
              title="Bekapcsolt motor hookok"
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
          </div>
        </AccordionItem>

        <AccordionItem title="Eszközök és környezet">
          <div className="node-inspector__group">
            <TextAreaField
              size="sm"
              label="Engedélyezett eszközök"
              value={toStringListFieldValue(config.allowedTools)}
              error={allowedToolsError}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                setField('allowedTools', fromStringListFieldValue(event.target.value));
              }}
            />
            <TextAreaField
              size="sm"
              label="Tiltott eszközök"
              value={toStringListFieldValue(config.disallowedTools)}
              error={disallowedToolsError}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                setField('disallowedTools', fromStringListFieldValue(event.target.value));
              }}
            />
            <MultiCheckboxSelector
              title="Beépített agent eszközök"
              options={AgentToolIdSchema.options}
              selected={config.agentTools}
              onToggle={(option, isChecked) => {
                setField(
                  'agentTools',
                  isChecked
                    ? [...config.agentTools, option]
                    : config.agentTools.filter((existing) => existing !== option),
                );
              }}
            />
            <TextField
              size="sm"
              label="Munkakönyvtár (cwd)"
              value={toTextFieldValue(config.cwd)}
              error={cwdError}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                setField('cwd', fromTextFieldValue(event.target.value));
              }}
            />
            <TextAreaField
              size="sm"
              label="További engedélyezett könyvtárak"
              value={toStringListFieldValue(config.additionalDirectories)}
              error={additionalDirectoriesError}
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
          </div>
        </AccordionItem>

        <AccordionItem title="Al-agentek (agents)">
          <AgentsFieldEditor
            value={config.agents}
            onChange={(nextValue) => {
              setField('agents', nextValue);
            }}
          />
        </AccordionItem>

        <AccordionItem title="Skillek és MCP szerverek (csak olvasható)">
          <div className="node-inspector__group">
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
          </div>
        </AccordionItem>
      </Accordion>
    </>
  );
}
