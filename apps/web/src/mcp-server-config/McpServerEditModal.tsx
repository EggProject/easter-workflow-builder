import type { McpServerDefinition, McpServerDefinitionRecord } from '@easter-workflow-builder/protocol';
import {
  Alert,
  Button,
  FieldErrorVisibilityContext,
  Modal,
  SelectField,
  TagInput,
  TextField,
  type SelectFieldOption,
} from '@easter-workflow-builder/ui';
import { useId, useState, type ChangeEvent, type ReactElement, type SubmitEvent } from 'react';
import type { RequestState } from '../request-state/request-state.ts';
import { useRequestState } from '../request-state/use-request-state.ts';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';
import { buildMcpServerDefinition } from './build-mcp-server-definition.ts';
import { createMcpServerDraft } from './create-mcp-server-draft.ts';
import { findMcpServerDraftErrors } from './find-mcp-server-draft-errors.ts';
import { MCP_TAG_INPUT_LABELS } from './mcp-tag-input-labels.ts';
import type { McpServerDraft, McpServerType } from './mcp-server-draft.ts';
import { readEnvironmentBinding } from './read-environment-binding.ts';
import { ServerEnvironmentNameSelect } from './ServerEnvironmentNameSelect.tsx';
import './mcp-server-config.css';

export interface McpServerEditModalProperties {
  /**
   * A szerkesztett szerver; `undefined` esetén új szerver. A hívó csak akkor
   * rajzolja a modálist, amikor nyitva van, ezért az állapot minden
   * megnyitáskor tisztán indul.
   */
  readonly record: McpServerDefinitionRecord | undefined;
  /**
   * A betöltött lista nevei: új szerver azonos nevű mentése felülírás.
   */
  readonly existingNames: readonly string[];
  readonly environmentNames: RequestState<readonly string[]>;
  readonly saveServer: (
    name: string,
    definition: McpServerDefinition,
  ) => Promise<RouteOutcome<McpServerDefinitionRecord>>;
  readonly onClose: () => void;
}

const TYPE_OPTIONS: readonly SelectFieldOption<McpServerType>[] = [
  { value: 'stdio', label: 'stdio (helyi parancs)' },
  { value: 'sse', label: 'sse (távoli szerver)' },
  { value: 'http', label: 'http (távoli szerver)' },
];

/**
 * Az MCP szerver hozzáadásának és szerkesztésének modálisa (SPEC-009 3.1 5.
 * pont, 6.1, 6.2): név, típus (`stdio`, `sse`, `http`) és az ág mezői. Az
 * `args` és a deklarált változó nevek `TagInput` (O-19); a deklarált nevekhez
 * a szerver oldali név a szerver környezetének neveiből választható (O-32), az
 * `Authorization` fejlécet adó változó is. A hibaüzenet a mező alatt áll
 * (`.claude/CLAUDE.md` 11. szekció): érintett és érvénytelen, vagy már volt
 * sikertelen beküldési kísérlet; érvénytelen értékre a `PUT` nem megy ki. A
 * név szerkesztésben nem módosítható, mert a lépések név szerint
 * hivatkoznak rá; új szervernél egy már létező név a figyelmeztetés mellett
 * "Felülírás" gombbal menthető (a `PUT` teljes cserét végez). A szerver
 * elutasítása danger `Alert`.
 */
export function McpServerEditModal(properties: Readonly<McpServerEditModalProperties>): ReactElement {
  const { record, existingNames, environmentNames, saveServer, onClose } = properties;
  const formId = useId();
  const [draft, setDraft] = useState<McpServerDraft>(() => createMcpServerDraft(record));
  const [isSubmitAttempted, setIsSubmitAttempted] = useState(false);
  const [isEnvironmentNamesTouched, setIsEnvironmentNamesTouched] = useState(false);
  const request = useRequestState<McpServerDefinitionRecord>();

  const isEdit = record !== undefined;
  const errors = findMcpServerDraftErrors(draft);
  const hasErrors = Object.values(errors).some((error) => error !== undefined);
  const isOverwrite = !isEdit && existingNames.includes(draft.name);
  const isSaving = request.state.status === 'pending';
  const hasEnvironmentSelects = draft.type === 'stdio' ? draft.envNames.length > 0 : true;

  function update(change: Partial<McpServerDraft>): void {
    setDraft((previous) => ({ ...previous, ...change }));
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (hasErrors) {
      setIsSubmitAttempted(true);
      return;
    }
    void request.run(async () => {
      const outcome = await saveServer(draft.name, buildMcpServerDefinition(draft));
      if (outcome.kind === 'ok') {
        onClose();
      }
      return outcome;
    });
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={isEdit ? 'MCP szerver szerkesztése' : 'MCP szerver hozzáadása'}
      closeButtonLabel="Bezárás"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Mégse
          </Button>
          <Button type="submit" form={formId} isLoading={isSaving} disabled={isSaving}>
            {isOverwrite ? 'Felülírás' : 'Mentés'}
          </Button>
        </>
      }
    >
      <FieldErrorVisibilityContext.Provider value={isSubmitAttempted}>
        {/* `noValidate`: a beküldés ellenőrzése a saját szabályon megy (a
            hibaüzenet a MEZŐ ALATT áll, 11. szekció). */}
        <form id={formId} className="mcp-server-form" noValidate onSubmit={handleSubmit}>
          <TextField
            label="Név"
            autoComplete="off"
            value={draft.name}
            readOnly={isEdit}
            error={isEdit ? undefined : errors.name}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              update({ name: event.target.value });
            }}
          />
          {isEdit && (
            <p className="mcp-server-form__hint">
              A név nem módosítható, mert a lépések és az agent definíciók név szerint hivatkoznak rá.
            </p>
          )}
          <SelectField
            label="Típus"
            options={TYPE_OPTIONS}
            value={draft.type}
            onChange={(type) => {
              update({ type });
            }}
          />
          {draft.type === 'stdio' ? (
            <>
              <TextField
                label="Parancs"
                autoComplete="off"
                value={draft.command}
                error={errors.command}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  update({ command: event.target.value });
                }}
              />
              <div className="field">
                <span className="field__label">Argumentumok</span>
                <TagInput
                  ariaLabel="Argumentumok"
                  placeholder="Argumentum, majd Enter"
                  labels={MCP_TAG_INPUT_LABELS}
                  value={draft.args}
                  onChange={(nextArguments) => {
                    update({ args: nextArguments });
                  }}
                />
              </div>
              <div className="field">
                <span className="field__label">Deklarált környezeti változók</span>
                <TagInput
                  ariaLabel="Deklarált környezeti változók"
                  placeholder="Változó neve, majd Enter"
                  labels={MCP_TAG_INPUT_LABELS}
                  value={draft.envNames}
                  onChange={(nextEnvironmentNames) => {
                    setIsEnvironmentNamesTouched(true);
                    update({ envNames: nextEnvironmentNames });
                  }}
                />
                {(isEnvironmentNamesTouched || isSubmitAttempted) && errors.envNames !== undefined && (
                  <span className="field__error" role="alert">
                    {errors.envNames}
                  </span>
                )}
              </div>
              {draft.envNames.map((declaredName) => (
                <ServerEnvironmentNameSelect
                  key={declaredName}
                  size="md"
                  label={`Szerver oldali változó: ${declaredName}`}
                  noneLabel={`azonos név (${declaredName})`}
                  environmentNames={environmentNames}
                  value={readEnvironmentBinding(draft.envBindings, declaredName)}
                  onChange={(serverName) => {
                    update({ envBindings: { ...draft.envBindings, [declaredName]: serverName } });
                  }}
                />
              ))}
            </>
          ) : (
            <>
              <TextField
                label="URL"
                autoComplete="off"
                value={draft.url}
                error={errors.url}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  update({ url: event.target.value });
                }}
              />
              <ServerEnvironmentNameSelect
                size="md"
                label="Authorization fejléc: szerver oldali változó"
                noneLabel="nincs"
                environmentNames={environmentNames}
                value={draft.authEnvName}
                onChange={(nextAuthName) => {
                  update({ authEnvName: nextAuthName });
                }}
              />
            </>
          )}
        </form>
      </FieldErrorVisibilityContext.Provider>
      {hasEnvironmentSelects && environmentNames.status === 'failure' && (
        <Alert variant="danger">{environmentNames.message}</Alert>
      )}
      {isOverwrite && (
        <Alert variant="warning">
          Már van {draft.name} nevű MCP szerver: a mentés lecseréli a definícióját, és a rá hivatkozó lépések az új
          definíciót használják.
        </Alert>
      )}
      {request.state.status === 'failure' && <Alert variant="danger">{request.state.message}</Alert>}
    </Modal>
  );
}
