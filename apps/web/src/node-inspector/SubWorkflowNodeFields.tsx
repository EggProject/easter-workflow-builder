import type { SubWorkflowNodeConfig } from '@easter-workflow-builder/protocol';
import { TextField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
import { TextAreaField } from './TextAreaField.tsx';
import { fromStringRecordFieldValue, toStringRecordFieldValue } from './string-record-field-value.ts';

export interface SubWorkflowNodeFieldsProperties {
  readonly config: SubWorkflowNodeConfig;
  readonly onChange: (nextConfig: SubWorkflowNodeConfig) => void;
}

/**
 * A `sub_workflow` node szerkesztett mezői: `targetWorkflowId`,
 * `inputMapping` (SPEC-008 5.1). Az `inputMapping` egy `Record<string,
 * string>`, a szerkesztője a `string-record-field-value.ts`
 * `kulcs=érték` soronkénti alakon megy.
 */
export function SubWorkflowNodeFields(properties: Readonly<SubWorkflowNodeFieldsProperties>): ReactElement {
  const { config, onChange } = properties;

  return (
    <fieldset>
      <legend>al-workflow</legend>
      <TextField
        label="Célzott workflow azonosítója"
        value={config.targetWorkflowId}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange({ ...config, targetWorkflowId: event.target.value });
        }}
      />
      <TextAreaField
        label="Bemenet leképezés (soronként kulcs=érték)"
        value={toStringRecordFieldValue(config.inputMapping)}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange({ ...config, inputMapping: fromStringRecordFieldValue(event.target.value) });
        }}
      />
    </fieldset>
  );
}
