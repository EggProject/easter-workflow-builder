import type { StartInputField, StartNodeConfig } from '@easter-workflow-builder/protocol';
import { Button, Checkbox, TextField } from '@easter-workflow-builder/ui';
import { useContext, type ChangeEvent, type ReactElement } from 'react';
import { FieldErrorsContext } from './field-errors-context.ts';

export interface StartNodeFieldsProperties {
  readonly config: StartNodeConfig;
  readonly onChange: (nextConfig: StartNodeConfig) => void;
}

const EMPTY_INPUT_FIELD: StartInputField = { name: '', label: '', valueKind: 'string', required: false };

/**
 * A `start` node szerkesztett mezője: a bemeneti mezők listája (SPEC-008
 * 5.1, `name`/`label`/`valueKind`/`required`). Felvehető, szerkeszthető és
 * törölhető sor.
 *
 * CSOPORTOSÍTÁS: nincs összecsukható panel. A node egyetlen fogalmat
 * hordoz, a bemeneti mezők listáját, ami egyben a leggyakrabban szerkesztett
 * tartalom is - egy panel mögé rejteni pontosan a fontosat rejtené el.
 */
export function StartNodeFields(properties: Readonly<StartNodeFieldsProperties>): ReactElement {
  const { config, onChange } = properties;
  const fieldErrors = useContext(FieldErrorsContext);

  function setInputFields(nextInputFields: readonly StartInputField[]): void {
    onChange({ ...config, inputFields: nextInputFields });
  }

  function updateField(index: number, patch: Partial<StartInputField>): void {
    setInputFields(
      config.inputFields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field)),
    );
  }

  return (
    <>
      {config.inputFields.map((field, index) => (
        <div key={index} className="node-inspector__list-row">
          <TextField
            label="Név"
            value={field.name}
            error={fieldErrors.get(`inputFields.${String(index)}.name`)}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              updateField(index, { name: event.target.value });
            }}
          />
          <TextField
            label="Címke"
            value={field.label}
            error={fieldErrors.get(`inputFields.${String(index)}.label`)}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              updateField(index, { label: event.target.value });
            }}
          />
          <TextField
            label="Érték típusa"
            value={field.valueKind}
            error={fieldErrors.get(`inputFields.${String(index)}.valueKind`)}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              updateField(index, { valueKind: event.target.value });
            }}
          />
          <Checkbox
            label="Kötelező"
            checked={field.required}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              updateField(index, { required: event.target.checked });
            }}
          />
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => {
              setInputFields(config.inputFields.filter((_field, fieldIndex) => fieldIndex !== index));
            }}
          >
            Törlés
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        onClick={() => {
          setInputFields([...config.inputFields, EMPTY_INPUT_FIELD]);
        }}
      >
        Bemeneti mező hozzáadása
      </Button>
    </>
  );
}
