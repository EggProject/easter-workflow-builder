import { TextAreaField } from '@easter-workflow-builder/ui';
import { useState, type ChangeEvent, type ReactElement } from 'react';

export interface LineListTextAreaFieldProperties<T> {
  readonly label: string;
  readonly value: T;
  readonly error?: string | undefined;
  /**
   * A config érték soronkénti szöveg alakja (például `toStringListFieldValue`).
   */
  readonly toText: (value: T) => string;
  /**
   * A szöveg bontása config értékké (például `fromStringListFieldValue`).
   */
  readonly fromText: (text: string) => T;
  readonly onChange: (nextValue: T) => void;
}

/**
 * Soronkénti listát hordozó `<textarea>` (opciók, eszköz lista, hibafajták,
 * várakozások, `kulcs=érték` leképezés). A mező a begépelt NYERS szöveget
 * tartja helyben, és csak a config felé bontja: a bontás eldobja az üres
 * sort, a sor végi szóközt és a még befejezetlen sort, tehát ha a mező
 * közvetlenül a config értékből épülne vissza, az `Enter` és a szóköz a
 * leütés pillanatában eltűnne, és több elem csak beillesztéssel volna
 * megadható (SPEC-016 H2 javításának mintája).
 *
 * A helyi szöveg a kívülről jövő változást követi (visszavonás, újra, másik
 * csomópont vagy sor): ha a szöveg bontása már nem a kapott `value`, a mező a
 * kapott értékből épül újra, egyébként a helyi nyers szöveg marad. Az
 * összehasonlítás a két érték szöveg alakján megy, így tetszőleges `T`-re
 * (tömb, rekord) érvényes.
 */
export function LineListTextAreaField<T>(properties: Readonly<LineListTextAreaFieldProperties<T>>): ReactElement {
  const { label, value, error, toText, fromText, onChange } = properties;
  const [draft, setDraft] = useState(() => toText(value));

  const valueText = toText(value);
  const isDraftCurrent = toText(fromText(draft)) === valueText;

  return (
    <TextAreaField
      size="sm"
      label={label}
      value={isDraftCurrent ? draft : valueText}
      error={error}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
        setDraft(event.target.value);
        onChange(fromText(event.target.value));
      }}
    />
  );
}
