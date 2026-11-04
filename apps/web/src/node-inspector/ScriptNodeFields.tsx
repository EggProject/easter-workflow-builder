import type { ScriptNodeConfig } from '@easter-workflow-builder/protocol';
import type { ReactElement } from 'react';
import { ScriptConfigFields } from './ScriptConfigFields.tsx';

export interface ScriptNodeFieldsProperties {
  readonly config: ScriptNodeConfig;
  readonly onChange: (nextConfig: ScriptNodeConfig) => void;
}

/**
 * A `script` node szerkesztett mezői (SPEC-008 5.1, SPEC-014 5.9): a közös
 * `ScriptConfigFields` szerkesztő a node `runtime` ágának megfelelő mezőivel.
 * A `runtime` váltása új alakú beállítást ad, ezért a `type` és az
 * `onUnhandledError` mezőt innen kell visszaírni.
 *
 * CSOPORTOSÍTÁS: nincs összecsukható panel, lásd a `ScriptConfigFields` doksiját.
 */
export function ScriptNodeFields(properties: Readonly<ScriptNodeFieldsProperties>): ReactElement {
  const { config, onChange } = properties;
  const { type, onUnhandledError } = config;

  return (
    <ScriptConfigFields
      fieldPathPrefix=""
      config={config}
      onChange={(nextScriptConfig) => {
        onChange({ type, onUnhandledError, ...nextScriptConfig });
      }}
    />
  );
}
