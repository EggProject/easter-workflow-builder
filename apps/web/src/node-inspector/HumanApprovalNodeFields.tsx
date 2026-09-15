import type { HumanApprovalNodeConfig } from '@easter-workflow-builder/protocol';
import { TextAreaField, TextField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
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
 *
 * CSOPORTOSÍTÁS: nincs összecsukható panel. A cím és a törzs sablon az,
 * amit a jóváhagyó ténylegesen látni fog, tehát elöl a helye; a `timeoutMs`
 * valóban ritkán állított korlát, de EGYETLEN mező, aminek a panelbe
 * zárása több chrome-ot adna, mint amennyi helyet megspórol.
 */
export function HumanApprovalNodeFields(properties: Readonly<HumanApprovalNodeFieldsProperties>): ReactElement {
  const { config, onChange } = properties;
  const titleError = useFieldError('title');
  const bodyTemplateError = useFieldError('bodyTemplate');
  const timeoutMsError = useFieldError('timeoutMs');

  return (
    <>
      <TextField
        size="sm"
        label="Cím"
        value={config.title}
        error={titleError}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange({ ...config, title: event.target.value });
        }}
      />
      <TextAreaField
        size="sm"
        label="Törzs sablon (bodyTemplate)"
        value={config.bodyTemplate}
        error={bodyTemplateError}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange({ ...config, bodyTemplate: event.target.value });
        }}
      />
      <TextField
        size="sm"
        type="number"
        label="Időkorlát ms-ben (üres = korlátlan)"
        value={toNumberFieldValue(config.timeoutMs)}
        error={timeoutMsError}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange({ ...config, timeoutMs: fromNumberFieldValue(event.target.value) });
        }}
      />
    </>
  );
}
