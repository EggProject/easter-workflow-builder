import { SelectField } from '@easter-workflow-builder/ui';
import type { ReactElement } from 'react';
import type { RequestState } from '../request-state/request-state.ts';

export interface ServerEnvironmentNameSelectProperties {
  readonly label: string;
  /**
   * A kiválasztott szerver oldali név; az üres szöveg a `noneLabel` opció.
   */
  readonly value: string;
  /**
   * Az üres értékű opció felirata ("azonos név", "központi alapértelmezés",
   * "nincs").
   */
  readonly noneLabel: string;
  readonly environmentNames: RequestState<readonly string[]>;
  readonly size: 'sm' | 'md';
  readonly onChange: (value: string) => void;
}

/**
 * A szerver oldali környezeti változó NEVÉNEK választója (SPEC-009 6.2, O-32
 * (a)): a `GET /api/server-environment-names` listájából választ, begépelni
 * nem kell, értéket a felület soha nem lát. Egy tárolt név, ami már nincs a
 * listában (a változót eltávolították a szerver környezetéből), megmarad
 * opcióként, "nincs a szerver környezetében" jelzéssel: a mentés nem dobja
 * el csendben, a futás indítása `missing_mcp_server_env` hibával áll meg. A
 * betöltés alatt a választó letiltva áll; a betöltés hibáját a hívó jelzi.
 */
export function ServerEnvironmentNameSelect(properties: Readonly<ServerEnvironmentNameSelectProperties>): ReactElement {
  const { label, value, noneLabel, environmentNames, size, onChange } = properties;
  const knownNames = environmentNames.status === 'success' ? environmentNames.value : [];
  const isStoredNameUnlisted = value !== '' && !knownNames.includes(value);
  const storedNameLabel = environmentNames.status === 'success' ? `${value} (nincs a szerver környezetében)` : value;
  const options = [
    { value: '', label: noneLabel },
    ...(isStoredNameUnlisted ? [{ value, label: storedNameLabel }] : []),
    ...knownNames.map((name) => ({ value: name, label: name })),
  ];

  return (
    <SelectField
      size={size}
      label={label}
      options={options}
      value={value}
      loading={environmentNames.status === 'idle' || environmentNames.status === 'pending'}
      loadingLabel="Betöltés…"
      onChange={onChange}
    />
  );
}
