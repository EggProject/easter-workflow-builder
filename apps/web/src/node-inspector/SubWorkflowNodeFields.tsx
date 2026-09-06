import type { SubWorkflowNodeConfig } from '@easter-workflow-builder/protocol';
import { TextField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
import { InspectorSection } from './InspectorSection.tsx';
import { TextAreaField } from './TextAreaField.tsx';
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
 */
export function SubWorkflowNodeFields(properties: Readonly<SubWorkflowNodeFieldsProperties>): ReactElement {
  const { config, onChange } = properties;
  const targetWorkflowIdError = useFieldError('targetWorkflowId');
  const inputMappingError = useFieldError('inputMapping');

  return (
    <InspectorSection title="al-workflow">
      <TextField
        label="Célzott workflow azonosítója"
        value={config.targetWorkflowId}
        error={targetWorkflowIdError}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange({ ...config, targetWorkflowId: event.target.value });
        }}
      />
      <TextAreaField
        label="Bemenet leképezés (soronként kulcs=érték)"
        value={toStringRecordFieldValue(config.inputMapping)}
        error={inputMappingError}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange({ ...config, inputMapping: fromStringRecordFieldValue(event.target.value) });
        }}
      />
    </InspectorSection>
  );
}
