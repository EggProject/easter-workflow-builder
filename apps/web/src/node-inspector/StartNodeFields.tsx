import type { StartInputField, StartInputValueKind, StartNodeConfig } from '@easter-workflow-builder/protocol';
import { Button, Checkbox, SelectField, TextField } from '@easter-workflow-builder/ui';
import { useContext, type ChangeEvent, type ReactElement } from 'react';
import { StartInputOptionsField } from './StartInputOptionsField.tsx';
import { FieldErrorsContext } from './field-errors-context.ts';

export interface StartNodeFieldsProperties {
  readonly config: StartNodeConfig;
  readonly onChange: (nextConfig: StartNodeConfig) => void;
}

// Az új mező alapértéke a `text` (SPEC-016 5.1, O-3).
const EMPTY_INPUT_FIELD: StartInputField = { name: '', label: '', valueKind: 'text', required: false };

/**
 * A hat érték felirata az 5.1 táblázat szerint. A `satisfies` őrzi, hogy minden
 * felsorolt érték valóban `StartInputValueKind` legyen.
 */
const VALUE_KIND_OPTIONS = [
  { value: 'text', label: 'Szöveg' },
  { value: 'number', label: 'Szám' },
  { value: 'boolean', label: 'Igen/nem' },
  { value: 'choice', label: 'Választólista' },
  { value: 'list', label: 'Lista' },
  { value: 'json', label: 'JSON adat' },
] as const satisfies readonly { readonly value: StartInputValueKind; readonly label: string }[];

/**
 * Típusváltás: a `choice` ág üres opciólistával indul (amit a mentési séma a
 * mező alatt jelez), a többi ágon az `options` mező nem létezik (SPEC-016 5.3).
 */
function withValueKind(field: StartInputField, valueKind: StartInputValueKind): StartInputField {
  const { name, label, required } = field;
  return valueKind === 'choice'
    ? { name, label, required, valueKind, options: [] }
    : { name, label, required, valueKind };
}

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

  function updateField(index: number, update: (field: StartInputField) => StartInputField): void {
    setInputFields(config.inputFields.map((field, fieldIndex) => (fieldIndex === index ? update(field) : field)));
  }

  return (
    <>
      {config.inputFields.map((field, index) => (
        <div key={index} className="node-inspector__list-row">
          <TextField
            size="sm"
            label="Név"
            value={field.name}
            error={fieldErrors.get(`inputFields.${String(index)}.name`)}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              updateField(index, (current) => ({ ...current, name: event.target.value }));
            }}
          />
          <TextField
            size="sm"
            label="Címke"
            value={field.label}
            error={fieldErrors.get(`inputFields.${String(index)}.label`)}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              updateField(index, (current) => ({ ...current, label: event.target.value }));
            }}
          />
          <SelectField
            size="sm"
            label="Érték típusa"
            options={VALUE_KIND_OPTIONS}
            value={field.valueKind}
            onChange={(valueKind) => {
              updateField(index, (current) => withValueKind(current, valueKind));
            }}
          />
          {field.valueKind === 'choice' && (
            <StartInputOptionsField
              options={field.options}
              error={fieldErrors.get(`inputFields.${String(index)}.options`)}
              onChange={(options) => {
                updateField(index, (current) => ({ ...current, options }));
              }}
            />
          )}
          <Checkbox
            label="Kötelező"
            checked={field.required}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              updateField(index, (current) => ({ ...current, required: event.target.checked }));
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
