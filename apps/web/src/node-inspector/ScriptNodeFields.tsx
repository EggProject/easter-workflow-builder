import type { ScriptNodeConfig } from '@easter-workflow-builder/protocol';
import { TextAreaField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
import { useFieldError } from './use-field-error.ts';

export interface ScriptNodeFieldsProperties {
  readonly config: ScriptNodeConfig;
  readonly onChange: (nextConfig: ScriptNodeConfig) => void;
}

/**
 * A `script` node szerkesztett mezői: `source`, `runtime` (SPEC-008 5.1). A
 * `runtime` a séma szerint kizárólag `'expression'` literál lehet
 * (`ScriptConfigSchema`), tehát nem szerkeszthető - a mező csak megnevezi az
 * egyetlen érvényes értéket. A figyelmeztetés a kártyán (`graph-node-card`,
 * T-009-15) már megjelenik; ez a panel változata ugyanazt mondja ki
 * (SPEC-008 5.1 "a szerkesztő a `script` node kártyáján... is megnevezi
 * ezt", PLAN-009 T-009-18 sor).
 *
 * CSOPORTOSÍTÁS: nincs összecsukható panel. A figyelmeztetést semmiképp nem
 * szabad elrejteni, a forrás a node lényege, a `runtime` pedig egyetlen,
 * egysoros, csak olvasható érték.
 */
export function ScriptNodeFields(properties: Readonly<ScriptNodeFieldsProperties>): ReactElement {
  const { config, onChange } = properties;
  const sourceError = useFieldError('source');

  return (
    <>
      <p role="alert">A motor a futtatáskor `unimplemented_node_type` hibával elutasítja ezt a csomópontot.</p>
      <TextAreaField
        label="Forrás (source)"
        value={config.source}
        error={sourceError}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange({ ...config, source: event.target.value });
        }}
      />
      <div className="field">
        <span className="field__label">Futásidő (runtime)</span>
        <p>{config.runtime}</p>
      </div>
    </>
  );
}
