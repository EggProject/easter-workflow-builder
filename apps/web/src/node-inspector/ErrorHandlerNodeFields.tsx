import type { ErrorHandlerNodeConfig } from '@easter-workflow-builder/protocol';
import { TextAreaField, TextField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
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
          onChange({ ...config, maxAttempts: Number(event.target.value) });
        }}
      />
      <TextAreaField
        size="sm"
        label="Várakozás próbálkozásonként, ms (soronként egy szám)"
        value={toNumberListFieldValue(config.backoffMs)}
        error={backoffMsError}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange({ ...config, backoffMs: fromNumberListFieldValue(event.target.value) });
        }}
      />
      <TextAreaField
        size="sm"
        label="Kezelt hibafajták (soronként egy)"
        value={toStringListFieldValue(config.handledErrorKinds)}
        error={handledErrorKindsError}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange({ ...config, handledErrorKinds: fromStringListFieldValue(event.target.value) });
        }}
      />
    </>
  );
}
