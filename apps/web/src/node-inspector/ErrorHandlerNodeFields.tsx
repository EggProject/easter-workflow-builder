import type { ErrorHandlerNodeConfig } from '@easter-workflow-builder/protocol';
import { TextField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
import { LineListTextAreaField } from './LineListTextAreaField.tsx';
import { fromNumberListFieldValue, toNumberListFieldValue } from './number-list-field-value.ts';
import { fromStringListFieldValue, toStringListFieldValue } from './string-list-field-value.ts';
import { useFieldError } from './use-field-error.ts';

export interface ErrorHandlerNodeFieldsProperties {
  readonly config: ErrorHandlerNodeConfig;
  readonly onChange: (nextConfig: ErrorHandlerNodeConfig) => void;
}

/**
 * A `error_handler` node szerkesztett mezői: `maxAttempts`, `backoffMs`,
 * `handledErrorKinds` (SPEC-008 5.1). A `maxAttempts` kötelező, szállított
 * alapérték nélkül, ugyanúgy, mint a `loop` `maxIterations` mezője.
 *
 * A `maxAttempts` a mező `valueAsNumber` értékét kapja, ami üres mezőre `NaN`
 * (HTML Living Standard, `valueAsNumber`): a kiürített mező így üres marad (a
 * `String(NaN)` értéket a szám mező üresre tisztítja, mint a felvett node
 * kezdő `NaN` értékénél), és a mentés a mező alatt jelez. A korábbi
 * `Number(value)` az üres szövegből `0`-t adott, ami a mezőben `0`-ként jelent
 * meg.
 *
 * CSOPORTOSÍTÁS: nincs összecsukható panel. A három mező EGYÜTT maga az
 * újrapróbálkozási szabály, vagyis a node teljes tartalma - itt nincs
 * "haladó" réteg, amit el lehetne rejteni.
 */
export function ErrorHandlerNodeFields(properties: Readonly<ErrorHandlerNodeFieldsProperties>): ReactElement {
  const { config, onChange } = properties;
  const maxAttemptsError = useFieldError('maxAttempts');
  const backoffMsError = useFieldError('backoffMs');
  const handledErrorKindsError = useFieldError('handledErrorKinds');

  return (
    <>
      <TextField
        size="sm"
        type="number"
        label="Max. próbálkozások száma"
        value={String(config.maxAttempts)}
        error={maxAttemptsError}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange({ ...config, maxAttempts: event.target.valueAsNumber });
        }}
      />
      <LineListTextAreaField
        label="Várakozás próbálkozásonként, ms (soronként egy szám)"
        value={config.backoffMs}
        toText={toNumberListFieldValue}
        fromText={fromNumberListFieldValue}
        error={backoffMsError}
        onChange={(backoffMs) => {
          onChange({ ...config, backoffMs });
        }}
      />
      <LineListTextAreaField
        label="Kezelt hibafajták (soronként egy)"
        value={config.handledErrorKinds}
        toText={toStringListFieldValue}
        fromText={fromStringListFieldValue}
        error={handledErrorKindsError}
        onChange={(handledErrorKinds) => {
          onChange({ ...config, handledErrorKinds });
        }}
      />
    </>
  );
}
