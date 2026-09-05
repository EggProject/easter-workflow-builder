import type { StartInputField, StartNodeConfig } from '@easter-workflow-builder/protocol';
import { Button, Checkbox, TextField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';

export interface StartNodeFieldsProperties {
  readonly config: StartNodeConfig;
  readonly onChange: (nextConfig: StartNodeConfig) => void;
}

const EMPTY_INPUT_FIELD: StartInputField = { name: '', label: '', valueKind: 'string', required: false };

/**
 * A `start` node szerkesztett mezője: a bemeneti mezők listája (SPEC-008
 * 5.1, `name`/`label`/`valueKind`/`required`). Felvehető, szerkeszthető és
 * törölhető sor.
 */
export function StartNodeFields(properties: Readonly<StartNodeFieldsProperties>): ReactElement {
  const { config, onChange } = properties;

  function setInputFields(nextInputFields: readonly StartInputField[]): void {
    onChange({ ...config, inputFields: nextInputFields });
  }

  function updateField(index: number, patch: Partial<StartInputField>): void {
    setInputFields(
      config.inputFields.map((field, fieldIndex) => (fieldIndex === index ? { ...field, ...patch } : field)),
    );
  }

  return (
    <fieldset>
      <legend>bemeneti mezők</legend>
      {config.inputFields.map((field, index) => (
        <div key={index} className="node-inspector__list-row">
          <TextField
            label="Név"
            value={field.name}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              updateField(index, { name: event.target.value });
            }}
          />
          <TextField
            label="Címke"
            value={field.label}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              updateField(index, { label: event.target.value });
            }}
          />
          <TextField
            label="Érték típusa"
            value={field.valueKind}
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
        onClick={() => {
          setInputFields([...config.inputFields, EMPTY_INPUT_FIELD]);
        }}
      >
        Bemeneti mező hozzáadása
      </Button>
    </fieldset>
  );
}
