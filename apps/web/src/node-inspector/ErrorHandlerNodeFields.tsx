import type { ErrorHandlerNodeConfig } from '@easter-workflow-builder/protocol';
import { TextField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
import { TextAreaField } from './TextAreaField.tsx';
import { fromNumberListFieldValue, toNumberListFieldValue } from './number-list-field-value.ts';
import { fromStringListFieldValue, toStringListFieldValue } from './string-list-field-value.ts';

export interface ErrorHandlerNodeFieldsProperties {
  readonly config: ErrorHandlerNodeConfig;
  readonly onChange: (nextConfig: ErrorHandlerNodeConfig) => void;
}

/**
 * A `error_handler` node szerkesztett mezői: `maxAttempts`, `backoffMs`,
 * `handledErrorKinds` (SPEC-008 5.1). A `maxAttempts` kötelező, szállított
 * alapérték nélkül, ugyanúgy, mint a `loop` `maxIterations` mezője.
 */
export function ErrorHandlerNodeFields(properties: Readonly<ErrorHandlerNodeFieldsProperties>): ReactElement {
  const { config, onChange } = properties;

  return (
    <fieldset>
      <legend>hibakezelő</legend>
      <TextField
        type="number"
        label="Max. próbálkozások száma"
        value={String(config.maxAttempts)}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange({ ...config, maxAttempts: Number(event.target.value) });
        }}
      />
      <TextAreaField
        label="Várakozás próbálkozásonként, ms (soronként egy szám)"
        value={toNumberListFieldValue(config.backoffMs)}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange({ ...config, backoffMs: fromNumberListFieldValue(event.target.value) });
        }}
      />
      <TextAreaField
        label="Kezelt hibafajták (soronként egy)"
        value={toStringListFieldValue(config.handledErrorKinds)}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange({ ...config, handledErrorKinds: fromStringListFieldValue(event.target.value) });
        }}
      />
    </fieldset>
  );
}
