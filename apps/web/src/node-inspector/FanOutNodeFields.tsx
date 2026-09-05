import type { FanOutNodeConfig } from '@easter-workflow-builder/protocol';
import type { ChangeEvent, ReactElement } from 'react';
import { TextAreaField } from './TextAreaField.tsx';

export interface FanOutNodeFieldsProperties {
  readonly config: FanOutNodeConfig;
  readonly onChange: (nextConfig: FanOutNodeConfig) => void;
}

/**
 * A `fan_out` node szerkesztett mezői: `itemsExpression`,
 * `branchLabelTemplate` (SPEC-008 5.1).
 */
export function FanOutNodeFields(properties: Readonly<FanOutNodeFieldsProperties>): ReactElement {
  const { config, onChange } = properties;

  return (
    <fieldset>
      <legend>szétosztás</legend>
      <TextAreaField
        label="Elemek kifejezés (itemsExpression)"
        value={config.itemsExpression}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange({ ...config, itemsExpression: event.target.value });
        }}
      />
      <TextAreaField
        label="Ág címke sablon (branchLabelTemplate)"
        value={config.branchLabelTemplate}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange({ ...config, branchLabelTemplate: event.target.value });
        }}
      />
    </fieldset>
  );
}
