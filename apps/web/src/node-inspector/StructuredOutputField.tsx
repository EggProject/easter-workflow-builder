import { StructuredOutputStrategyIdSchema, type StructuredOutputConfig } from '@easter-workflow-builder/protocol';
import { Checkbox, SelectField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
import { JsonTextAreaField } from './JsonTextAreaField.tsx';

const DEFAULT_STRUCTURED_OUTPUT_CONFIG: StructuredOutputConfig = {
  strategy: 'emit_output_tool',
  schema: {},
};

export interface StructuredOutputFieldProperties {
  readonly value: StructuredOutputConfig | null;
  readonly onChange: (nextValue: StructuredOutputConfig | null) => void;
}

/**
 * A `structuredOutput` mező vezérlője (SPEC-008 5.2 "eszközök és környezet"
 * csoport). A `strategy` zárt lista (`StructuredOutputStrategyIdSchema`), a
 * `schema` viszont `z.unknown()` (SPEC-003 4.6) - nincs sémája, aminek a
 * felülete szerkeszthetne, ezért nyers JSON szerkesztőn megy.
 */
export function StructuredOutputField(properties: Readonly<StructuredOutputFieldProperties>): ReactElement {
  const { value, onChange } = properties;
  const isEnabled = value !== null;

  return (
    <div className="node-inspector__group">
      <Checkbox
        label="Strukturált kimenet felülírás megadva"
        checked={isEnabled}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          // eslint-disable-next-line unicorn/no-null -- a `StructuredOutputConfig | null` mező `null` értéke jelenti a "nincs felülírás" állapotot (SPEC-005 protokoll alak).
          onChange(event.target.checked ? DEFAULT_STRUCTURED_OUTPUT_CONFIG : null);
        }}
      />
      {isEnabled && (
        <>
          <SelectField
            size="sm"
            label="Strukturált kimenet stratégiája"
            options={StructuredOutputStrategyIdSchema.options.map((option) => ({ value: option, label: option }))}
            value={value.strategy}
            onChange={(nextStrategy) => {
              onChange({ ...value, strategy: nextStrategy });
            }}
          />
          <JsonTextAreaField
            label="Kimenet séma (nyers JSON)"
            value={value.schema}
            onChange={(nextSchema) => {
              onChange({ ...value, schema: nextSchema });
            }}
          />
        </>
      )}
    </div>
  );
}
