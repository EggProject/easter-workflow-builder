import type { SubWorkflowNodeConfig } from '@easter-workflow-builder/protocol';
import { TextAreaField, TextField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
import { fromStringRecordFieldValue, toStringRecordFieldValue } from './string-record-field-value.ts';
import { useFieldError } from './use-field-error.ts';

export interface SubWorkflowNodeFieldsProperties {
  readonly config: SubWorkflowNodeConfig;
  readonly onChange: (nextConfig: SubWorkflowNodeConfig) => void;
}

/**
 * A `sub_workflow` node szerkesztett mezői: `targetWorkflowId`,
 * `inputMapping` (SPEC-008 5.1). Az `inputMapping` egy `Record<string,
 * string>`, a szerkesztője a `string-record-field-value.ts`
 * `kulcs=érték` soronkénti alakon megy.
 *
 * CSOPORTOSÍTÁS: nincs összecsukható panel. Két mező, és mindkettő
 * kötelezően kitöltendő ahhoz, hogy a hívás egyáltalán működjön.
 */
export function SubWorkflowNodeFields(properties: Readonly<SubWorkflowNodeFieldsProperties>): ReactElement {
  const { config, onChange } = properties;
  const targetWorkflowIdError = useFieldError('targetWorkflowId');
  const inputMappingError = useFieldError('inputMapping');

  return (
    <>
      <TextField
        size="sm"
        label="Célzott workflow azonosítója"
        value={config.targetWorkflowId}
        error={targetWorkflowIdError}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange({ ...config, targetWorkflowId: event.target.value });
        }}
      />
      <TextAreaField
        size="sm"
        label="Bemenet leképezés (soronként kulcs=érték)"
        value={toStringRecordFieldValue(config.inputMapping)}
        error={inputMappingError}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange({ ...config, inputMapping: fromStringRecordFieldValue(event.target.value) });
        }}
      />
    </>
  );
}
