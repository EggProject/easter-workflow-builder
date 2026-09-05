import type { HumanApprovalNodeConfig } from '@easter-workflow-builder/protocol';
import { TextField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
import { TextAreaField } from './TextAreaField.tsx';
import { fromNumberFieldValue, toNumberFieldValue } from './nullable-number-field-value.ts';

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

  return (
    <fieldset>
      <legend>emberi jóváhagyás</legend>
      <TextField
        label="Cím"
        value={config.title}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange({ ...config, title: event.target.value });
        }}
      />
      <TextAreaField
        label="Törzs sablon (bodyTemplate)"
        value={config.bodyTemplate}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange({ ...config, bodyTemplate: event.target.value });
        }}
      />
      <TextField
        type="number"
        label="Időkorlát ms-ben (üres = korlátlan)"
        value={toNumberFieldValue(config.timeoutMs)}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange({ ...config, timeoutMs: fromNumberFieldValue(event.target.value) });
        }}
      />
    </fieldset>
  );
}
