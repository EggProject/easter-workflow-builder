import type { StartInputField } from '@easter-workflow-builder/protocol';
import { Checkbox, SelectField, TextAreaField, TextField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
import type { StartRunFieldValue } from './start-run-values.ts';

export interface StartRunFieldProperties {
  readonly field: StartInputField;
  readonly value: StartRunFieldValue;
  readonly error: string | undefined;
  readonly onChange: (nextValue: StartRunFieldValue) => void;
}

/**
 * A választó ürítő opciója a nem kötelező `choice` mezőn: kiválasztva a mező
 * üres, tehát a kulcsa kimarad a bemenetből.
 */
const NO_CHOICE_OPTION = { value: '', label: 'nincs kiválasztva' } as const;

/**
 * Egy bemeneti mező beviteli eleme az `valueKind` szerint (SPEC-016 5.1
 * táblázata): `text` `TextField`, `number` `type="number"` `TextField` (az
 * érték a `valueAsNumber`, üresen `NaN`; a mező a felhasználó nyers szövegét
 * mutatja vissza, különben a gépelés köztes alakja, `1.0`, a számból képzett
 * szöveggel felülíródna, és `1.05` helyett `15` menne el), `boolean` `Checkbox`, `choice`
 * `SelectField` az `options` elemeivel, `list` soronkénti és `json`
 * `TextAreaField`. A hibaüzenet a mező alatt áll (`error`). A `Checkbox`
 * nem kap hibát és `required` jelzést, mert a jelölőnégyzetnek nincs üres
 * állapota: a `boolean` mező mindig ad értéket.
 */
export function StartRunField(properties: Readonly<StartRunFieldProperties>): ReactElement {
  const { field, value, error, onChange } = properties;

  switch (field.valueKind) {
    case 'text': {
      return (
        <TextField
          label={field.label}
          value={value.text}
          required={field.required}
          error={error}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onChange({ ...value, text: event.target.value });
          }}
        />
      );
    }
    case 'number': {
      return (
        <TextField
          type="number"
          step="any"
          label={field.label}
          value={value.text}
          required={field.required}
          error={error}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onChange({ ...value, text: event.target.value, number: event.target.valueAsNumber });
          }}
        />
      );
    }
    case 'boolean': {
      return (
        <Checkbox
          label={field.label}
          checked={value.checked}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onChange({ ...value, checked: event.target.checked });
          }}
        />
      );
    }
    case 'choice': {
      return (
        <SelectField
          label={field.label}
          placeholder="válassz egy opciót"
          options={[
            ...(field.required ? [] : [NO_CHOICE_OPTION]),
            ...field.options.map((option) => ({ value: option, label: option })),
          ]}
          value={value.text}
          error={error}
          onChange={(text) => {
            onChange({ ...value, text });
          }}
        />
      );
    }
    case 'list': {
      return (
        <TextAreaField
          label={`${field.label} (soronként egy)`}
          value={value.text}
          required={field.required}
          error={error}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            onChange({ ...value, text: event.target.value });
          }}
        />
      );
    }
    case 'json': {
      return (
        <TextAreaField
          label={field.label}
          value={value.text}
          required={field.required}
          error={error}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            onChange({ ...value, text: event.target.value });
          }}
        />
      );
    }
  }
}
