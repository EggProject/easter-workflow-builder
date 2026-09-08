import type { FanOutNodeConfig } from '@easter-workflow-builder/protocol';
import { TextAreaField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
import { useFieldError } from './use-field-error.ts';

export interface FanOutNodeFieldsProperties {
  readonly config: FanOutNodeConfig;
  readonly onChange: (nextConfig: FanOutNodeConfig) => void;
}

/**
 * A `fan_out` node szerkesztett mezői: `itemsExpression`,
 * `branchLabelTemplate` (SPEC-008 5.1).
 *
 * CSOPORTOSÍTÁS: nincs összecsukható panel. A node mindössze két mezőt
 * hordoz, és mindkettő a szétosztás lényege.
 */
export function FanOutNodeFields(properties: Readonly<FanOutNodeFieldsProperties>): ReactElement {
  const { config, onChange } = properties;
  const itemsExpressionError = useFieldError('itemsExpression');
  const branchLabelTemplateError = useFieldError('branchLabelTemplate');

  return (
    <>
      <TextAreaField
        label="Elemek kifejezés (itemsExpression)"
        value={config.itemsExpression}
        error={itemsExpressionError}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange({ ...config, itemsExpression: event.target.value });
        }}
      />
      <TextAreaField
        label="Ág címke sablon (branchLabelTemplate)"
        value={config.branchLabelTemplate}
        error={branchLabelTemplateError}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange({ ...config, branchLabelTemplate: event.target.value });
        }}
      />
    </>
  );
}
