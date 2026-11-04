import { TextAreaField } from '@easter-workflow-builder/ui';
import { useState, type ChangeEvent, type ReactElement } from 'react';
import { fromStringListFieldValue, toStringListFieldValue } from './string-list-field-value.ts';

export interface StartInputOptionsFieldProperties {
  readonly options: readonly string[];
  readonly error: string | undefined;
  readonly onChange: (nextOptions: readonly string[]) => void;
}

/**
 * A `choice` bemeneti mező opciói, soronként egy (SPEC-016 5.3). A mező a
 * begépelt NYERS szöveget tartja helyben, és csak a config felé bontja
 * (`options` tömb): a bontás eldobja az üres sort és a sor végi szóközt, tehát
 * ha a mező közvetlenül a bontott tömbből épülne vissza, az `Enter` és a
 * szóköz a leütés pillanatában eltűnne, és több opció csak beillesztéssel
 * volna megadható.
 *
 * A helyi szöveg a kívülről jövő változást követi (visszavonás, újra, másik
 * csomópont vagy sor): ha a szöveg bontása már nem a kapott `options`, a mező
 * a kapott listából épül újra, egyébként a helyi nyers szöveg marad.
 */
export function StartInputOptionsField(properties: Readonly<StartInputOptionsFieldProperties>): ReactElement {
  const { options, error, onChange } = properties;
  const [draft, setDraft] = useState(() => toStringListFieldValue(options));

  const isDraftCurrent = toStringListFieldValue(fromStringListFieldValue(draft)) === toStringListFieldValue(options);

  return (
    <TextAreaField
      size="sm"
      label="Opciók (soronként egy)"
      value={isDraftCurrent ? draft : toStringListFieldValue(options)}
      error={error}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
        setDraft(event.target.value);
        onChange(fromStringListFieldValue(event.target.value));
      }}
    />
  );
}
