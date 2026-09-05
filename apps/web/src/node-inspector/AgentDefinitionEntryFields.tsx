import { Checkbox, SelectField, TextField } from '@easter-workflow-builder/ui';
import { isBoolean, isNumber, isRecord, isString, isStringArray } from '@easter-workflow-builder/typeguards';
import type { ChangeEvent, ReactElement } from 'react';
import { TextAreaField } from './TextAreaField.tsx';
import {
  UNCONFIRMED_AGENT_DEFINITION_FIELD_KEYS,
  UNCONFIRMED_AGENT_DEFINITION_FIELD_REASON,
  AGENT_DEFINITION_FIELD_TABLE,
  type AgentDefinitionFieldDescriptor,
} from './agent-definition-field-table.ts';
import { describeUnknownValue } from './describe-unknown-value.ts';
import { fromNumberFieldValue, toNumberFieldValue } from './nullable-number-field-value.ts';
import { fromStringListFieldValue, toStringListFieldValue } from './string-list-field-value.ts';
import './node-inspector.css';

const FIELD_GROUPS = [...new Set(AGENT_DEFINITION_FIELD_TABLE.map((field) => field.group))];

export interface AgentDefinitionEntryFieldsProperties {
  /**
   * Az `agents` rekord egyetlen bejegyzésének nyers, `unknown` értéke - a
   * `db` és a `protocol` oldalon is szándékosan nem szűkített alak
   * (`.claude/CLAUDE.md` 5. szekció "A `protocol` a `db` domain uniót is
   * duplikálhatja..."). A komponens ebből a tizenhárom mérten fedett mezőt
   * olvassa ki, típusőr mögött, `as`/`any` nélkül.
   */
  readonly value: unknown;
  /**
   * A mentés RÁOLVASZT, nem cserél (AC60): minden mezőváltozás a TELJES,
   * jelenlegi rekordot adja tovább, a szerkesztett kulcs felülírásával -
   * egy ismeretlen kulcs (pl. a mérés után megjelenő SDK mező) így mindig
   * túléli a szerkesztést.
   */
  readonly onChange: (nextValue: Readonly<Record<string, unknown>>) => void;
}

function renderFieldControl(
  field: AgentDefinitionFieldDescriptor,
  record: Readonly<Record<string, unknown>>,
  setField: (key: string, fieldValue: unknown) => void,
): ReactElement {
  const rawValue = record[field.key];
  const { control } = field;
  switch (control.kind) {
    case 'text': {
      return (
        <TextField
          label={field.label}
          value={isString(rawValue) ? rawValue : ''}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setField(field.key, event.target.value);
          }}
        />
      );
    }
    case 'textarea': {
      return (
        <TextAreaField
          label={field.label}
          value={isString(rawValue) ? rawValue : ''}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            setField(field.key, event.target.value);
          }}
        />
      );
    }
    case 'number': {
      return (
        <TextField
          type="number"
          label={field.label}
          // eslint-disable-next-line unicorn/no-null -- a `nullable-number-field-value` a hiányzó számot `null`-ként kezeli, itt "nincs beállítva" jelentéssel.
          value={toNumberFieldValue(isNumber(rawValue) ? rawValue : null)}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setField(field.key, fromNumberFieldValue(event.target.value));
          }}
        />
      );
    }
    case 'boolean': {
      return (
        <Checkbox
          label={field.label}
          checked={isBoolean(rawValue) ? rawValue : false}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setField(field.key, event.target.checked);
          }}
        />
      );
    }
    case 'string-list': {
      return (
        <TextAreaField
          label={field.label}
          value={toStringListFieldValue(isStringArray(rawValue) ? rawValue : [])}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            setField(field.key, fromStringListFieldValue(event.target.value));
          }}
        />
      );
    }
    case 'select': {
      return (
        <SelectField
          aria-label={field.label}
          options={control.options.map((option) => ({ value: option, label: option }))}
          placeholder="nincs megadva"
          value={isString(rawValue) ? rawValue : ''}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            setField(field.key, event.target.value);
          }}
        />
      );
    }
    case 'readonly': {
      return (
        <div className="field">
          <span className="field__label">{field.label}</span>
          <p>{describeUnknownValue(rawValue)}</p>
          <p className="node-inspector__reason">{control.reason}</p>
        </div>
      );
    }
  }
}

/**
 * Egy `agents` bejegyzés (`AgentDefinition`-szerű `unknown` érték)
 * szerkesztő űrlapja, a `agent-definition-field-table.ts` `as const
 * satisfies` tábláját dolgozva fel (SPEC-008 5.2, AC60). A `agents` mezőnek
 * itt **nincs Zod sémája** (szándékosan `Record<string, unknown>` marad),
 * tehát ezen a szinten nincs mezőnkénti Zod hibaüzenet sem - a felület
 * típusőrökkel olvassa ki a mért mezőket, hibás alak esetén az "üres"
 * alapértékre esik vissza, sosem omlik össze.
 */
export function AgentDefinitionEntryFields(properties: Readonly<AgentDefinitionEntryFieldsProperties>): ReactElement {
  const { value, onChange } = properties;

  if (!isRecord(value)) {
    return <p role="alert">Ez a bejegyzés nem objektum alakú, itt nem szerkeszthető.</p>;
  }
  const record = value;

  function setField(key: string, fieldValue: unknown): void {
    onChange({ ...record, [key]: fieldValue });
  }

  return (
    <div className="agent-definition-entry-fields">
      {FIELD_GROUPS.map((group) => (
        <fieldset key={group}>
          <legend>{group}</legend>
          {AGENT_DEFINITION_FIELD_TABLE.filter((field) => field.group === group).map((field) => (
            <div key={field.key}>{renderFieldControl(field, record, setField)}</div>
          ))}
        </fieldset>
      ))}
      <fieldset>
        <legend>nem megerősített mezők</legend>
        <p className="node-inspector__reason">{UNCONFIRMED_AGENT_DEFINITION_FIELD_REASON}</p>
        {UNCONFIRMED_AGENT_DEFINITION_FIELD_KEYS.map((key) => (
          <p key={key}>
            <b>{key}</b>: {describeUnknownValue(record[key])}
          </p>
        ))}
      </fieldset>
    </div>
  );
}
