import { Accordion, AccordionItem, Checkbox, SelectField, TextAreaField, TextField } from '@easter-workflow-builder/ui';
import { isBoolean, isNumber, isRecord, isString, isStringArray } from '@easter-workflow-builder/typeguards';
import type { ChangeEvent, ReactElement } from 'react';
import {
  UNCONFIRMED_AGENT_DEFINITION_FIELD_KEYS,
  UNCONFIRMED_AGENT_DEFINITION_FIELD_REASON,
  AGENT_DEFINITION_FIELD_TABLE,
  type AgentDefinitionFieldDescriptor,
  type AgentDefinitionFieldGroup,
} from './agent-definition-field-table.ts';
import { describeUnknownValue } from './describe-unknown-value.ts';
import { fromNumberFieldValue, toNumberFieldValue } from './nullable-number-field-value.ts';
import { fromStringListFieldValue, toStringListFieldValue } from './string-list-field-value.ts';
import './node-inspector.css';

/**
 * A tábla öt csoportja két szintre oszlik. ELÖL, panel nélkül a `kötelező`
 * csoport áll (a leírás és a prompt: e kettő nélkül az agent bejegyzésnek
 * nincs értelme, és mérten ez az a két mező, amit minden bejegyzésen ki
 * kell tölteni). A többi négy csoport összecsukható panelbe kerül, mert
 * mind opcionális felülírás vagy csak olvasható érték - a `modell és
 * korlátok`, illetve az `eszközök`+`környezet` páros egy-egy panelt kap
 * (utóbbi kettő ugyanannak a futtatási környezetnek a két oldala), a
 * `SPEC-009 hatókör` pedig a nem megerősített mezőkkel együtt egyetlen,
 * csak olvasható panelbe.
 */
const ACCORDION_PANELS: readonly { readonly title: string; readonly groups: readonly AgentDefinitionFieldGroup[] }[] = [
  { title: 'Modell és korlátok', groups: ['modell és korlátok'] },
  { title: 'Eszközök és környezet', groups: ['eszközök', 'környezet'] },
  { title: 'Skillek és MCP szerverek (csak olvasható)', groups: ['SPEC-009 hatókör'] },
];

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
          size="sm"
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
          size="sm"
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
          size="sm"
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
          size="sm"
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
          size="sm"
          label={field.label}
          options={[
            { value: '', label: 'nincs megadva' },
            ...control.options.map((option) => ({ value: option, label: option })),
          ]}
          placeholder="nincs megadva"
          value={isString(rawValue) ? rawValue : ''}
          onChange={(nextValue) => {
            setField(field.key, nextValue);
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
 *
 * CSOPORTOSÍTÁS: lásd az `ACCORDION_PANELS` konstans fölötti indoklást.
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
    <div className="node-inspector__group agent-definition-entry-fields">
      {AGENT_DEFINITION_FIELD_TABLE.filter((field) => field.group === 'kötelező').map((field) => (
        <div key={field.key}>{renderFieldControl(field, record, setField)}</div>
      ))}
      <Accordion>
        {ACCORDION_PANELS.map((panel) => (
          <AccordionItem key={panel.title} title={panel.title}>
            <div className="node-inspector__group">
              {AGENT_DEFINITION_FIELD_TABLE.filter((field) => panel.groups.includes(field.group)).map((field) => (
                <div key={field.key}>{renderFieldControl(field, record, setField)}</div>
              ))}
              {panel.groups.includes('SPEC-009 hatókör') && (
                <>
                  <p className="node-inspector__reason">{UNCONFIRMED_AGENT_DEFINITION_FIELD_REASON}</p>
                  {UNCONFIRMED_AGENT_DEFINITION_FIELD_KEYS.map((key) => (
                    <p key={key}>
                      <b>{key}</b>: {describeUnknownValue(record[key])}
                    </p>
                  ))}
                </>
              )}
            </div>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
