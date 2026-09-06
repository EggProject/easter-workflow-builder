import type { HumanApprovalNodeConfig } from '@easter-workflow-builder/protocol';
import { TextField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
import { InspectorSection } from './InspectorSection.tsx';
import { TextAreaField } from './TextAreaField.tsx';
import { fromNumberFieldValue, toNumberFieldValue } from './nullable-number-field-value.ts';
import { useFieldError } from './use-field-error.ts';

export interface HumanApprovalNodeFieldsProperties {
  readonly config: HumanApprovalNodeConfig;
  readonly onChange: (nextConfig: HumanApprovalNodeConfig) => void;
}

/**
 * A `human_approval` node szerkesztett mezői: `title`, `bodyTemplate`,
 * `timeoutMs` (SPEC-008 5.1). A `timeoutMs` `null` értéke korlátlan
 * várakozást jelent (`packages/protocol/src/node-config/node-config.ts`
 * doksija).
 */
export function HumanApprovalNodeFields(properties: Readonly<HumanApprovalNodeFieldsProperties>): ReactElement {
  const { config, onChange } = properties;
  const titleError = useFieldError('title');
  const bodyTemplateError = useFieldError('bodyTemplate');
  const timeoutMsError = useFieldError('timeoutMs');

  return (
    <InspectorSection title="emberi jóváhagyás">
      <TextField
        label="Cím"
        value={config.title}
        error={titleError}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange({ ...config, title: event.target.value });
        }}
      />
      <TextAreaField
        label="Törzs sablon (bodyTemplate)"
        value={config.bodyTemplate}
        error={bodyTemplateError}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange({ ...config, bodyTemplate: event.target.value });
        }}
      />
      <TextField
        type="number"
        label="Időkorlát ms-ben (üres = korlátlan)"
        value={toNumberFieldValue(config.timeoutMs)}
        error={timeoutMsError}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange({ ...config, timeoutMs: fromNumberFieldValue(event.target.value) });
        }}
      />
    </InspectorSection>
  );
}
