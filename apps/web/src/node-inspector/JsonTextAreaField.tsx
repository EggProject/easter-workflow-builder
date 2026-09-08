import { TextAreaField } from '@easter-workflow-builder/ui';
import { useState, type ChangeEvent, type ReactElement } from 'react';

export interface JsonTextAreaFieldProperties {
  readonly label: string;
  readonly value: unknown;
  readonly onChange: (nextValue: unknown) => void;
}

/**
 * Nyers JSON szerkesztő egy `unknown` érték felett - a `sandbox` és a
 * `structuredOutput.schema` mező közös vezérlője, mert mindkettő olyan
 * (részben) ismeretlen alakú objektum, aminek nincs teljes Zod sémája
 * (`SandboxConfig` öt mezője kimondottan `unknown`, `StructuredOutputConfig.
 * schema` teljesen az). Ez NEM gráf szemantikai validáció, csak JSON
 * szintaxis ellenőrzés: a szöveg puffer helyben marad (`useState` lusta
 * kezdőértékkel), és csak ÉRVÉNYES JSON-ra hívja az `onChange`-et, hogy egy
 * félig begépelt, átmenetileg érvénytelen szöveg ne veszítse el a felhasználó
 * gépelését egy kívülről érkező prop frissítéssel.
 */
export function JsonTextAreaField(properties: Readonly<JsonTextAreaFieldProperties>): ReactElement {
  const { label, value, onChange } = properties;
  const [text, setText] = useState(() => JSON.stringify(value, undefined, 2));
  const [parseError, setParseError] = useState<string | undefined>(undefined);

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    const nextText = event.target.value;
    setText(nextText);
    try {
      const parsedValue: unknown = JSON.parse(nextText);
      setParseError(undefined);
      onChange(parsedValue);
    } catch {
      setParseError('Érvénytelen JSON - a változtatás egyelőre nem kerül mentésre.');
    }
  }

  return <TextAreaField label={label} value={text} onChange={handleChange} rows={6} error={parseError} />;
}
