import type { LoopNodeConfig } from '@easter-workflow-builder/protocol';
import { TextField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
import { TextAreaField } from './TextAreaField.tsx';

export interface LoopNodeFieldsProperties {
  readonly config: LoopNodeConfig;
  readonly onChange: (nextConfig: LoopNodeConfig) => void;
}

/**
 * A `loop` node szerkesztett mezői: `maxIterations`, `continueExpression`
 * (SPEC-008 5.1). A `maxIterations` kötelező, szállított alapérték nélkül
 * (`packages/protocol/src/node-config/node-config.ts` doksija), tehát a
 * mező itt sem kap alapértéket. A natív `<input type="number">` érvénytelen
 * szöveges bevitelre a saját `.value`-ját üres sztringre állítja (mért
 * viselkedés), a `Number('')` pedig `0`-t ad, nem `NaN`-t - a mentés előtti
 * `NodeConfigSchema.safeParse` ezért csak akkor jelez hibát, ha a hívó
 * oldalon valamilyen külön korlát (pl. minimum érték) is érvényben van.
 */
export function LoopNodeFields(properties: Readonly<LoopNodeFieldsProperties>): ReactElement {
  const { config, onChange } = properties;

  return (
    <fieldset>
      <legend>ciklus</legend>
      <TextField
        type="number"
        label="Max. iterációk száma"
        value={String(config.maxIterations)}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange({ ...config, maxIterations: Number(event.target.value) });
        }}
      />
      <TextAreaField
        label="Folytatás feltétel (continueExpression)"
        value={config.continueExpression}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange({ ...config, continueExpression: event.target.value });
        }}
      />
    </fieldset>
  );
}
