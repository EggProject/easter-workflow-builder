import type { McpServerDefinition, McpServerReference } from '@easter-workflow-builder/protocol';
import { Alert, Checkbox, Empty } from '@easter-workflow-builder/ui';
import { useContext, type ChangeEvent, type ReactElement } from 'react';
import { readEnvironmentBinding } from '../mcp-server-config/read-environment-binding.ts';
import { ServerEnvironmentNameSelect } from '../mcp-server-config/ServerEnvironmentNameSelect.tsx';
import { ThemedSkeleton } from '../themed-skeleton/ThemedSkeleton.tsx';
import { InspectorFieldGroup } from './InspectorFieldGroup.tsx';
import { describeUnknownValue } from './describe-unknown-value.ts';
import { McpServerLibraryContext } from './mcp-server-library-context.ts';
import { readMcpServerReferences } from './read-mcp-server-references.ts';
import './node-inspector.css';

// eslint-disable-next-line unicorn/no-null -- a hivatkozás `authEnvName` mezője `null` a "nincs felülírás" állapotban (SPEC-009 6.2, O-42).
const NO_OVERRIDE: McpServerReference = { envBindings: {}, authEnvName: null };

export interface McpServerReferencesFieldProperties {
  /**
   * A mező jelenlegi tárolt értéke. `unknown`, mert az agent definíció
   * `mcpServerReferences` mezője szűkítetlen; a hiányzó kulcs (`undefined`)
   * üres hivatkozás-halmaz.
   */
  readonly value: unknown;
  readonly onChange: (nextValue: Readonly<Record<string, McpServerReference>>) => void;
}

/**
 * Egy hivatkozás új `envBindings` mezővel: az üres szöveg törli a deklarált
 * névhez tartozó felülírást (a központi alapértelmezés dönt), a többi
 * bejegyzés változatlan marad.
 */
function withBinding(reference: McpServerReference, declaredName: string, serverName: string): McpServerReference {
  const bindings = new Map(Object.entries(reference.envBindings));
  if (serverName === '') {
    bindings.delete(declaredName);
  } else {
    bindings.set(declaredName, serverName);
  }
  return { ...reference, envBindings: Object.fromEntries(bindings) };
}

/**
 * A `sse` és `http` ág `Authorization` felülírása: az üres szöveg `null`,
 * vagyis a központi `authEnvName` dönt.
 */
function withAuthEnvironmentName(reference: McpServerReference, serverName: string): McpServerReference {
  // eslint-disable-next-line unicorn/no-null -- az üres választás a "nincs felülírás" állapot, amit a tárolt alak `null`-lal fejez ki.
  return { ...reference, authEnvName: serverName === '' ? null : serverName };
}

/**
 * A lépés és az agent definíció `mcpServerReferences` mezőjének vezérlője
 * (SPEC-009 6.2, AC16): a központi MCP szerver lista neveiből épülő
 * `Checkbox` lista; a bejelölt szerver alatt a hozzárendelés felülírása. A
 * `stdio` ágon deklarált változónként egy szerver oldali név, a `sse` és
 * `http` ágon az `Authorization` fejlécet adó szerver oldali név; a választék
 * a szerver környezetének nevei (O-32), értéket a felület soha nem lát. A
 * tárolt alak puszta nevek (6.2).
 *
 * Egy tárolt név, ami már nincs a központi listában (a törlés megengedett,
 * O-43), láthatóan "hiányzik" jelzéssel, bejelölve marad: a mentés nem dobja
 * el csendben, a futás indítása hibával áll meg, és a jelölés levételével
 * vagy a szerver újrafelvételével oldható fel.
 */
export function McpServerReferencesField(properties: Readonly<McpServerReferencesFieldProperties>): ReactElement {
  const { value, onChange } = properties;
  const { servers, environmentNames } = useContext(McpServerLibraryContext);
  const references = readMcpServerReferences(value);
  const storedReferences = references ?? new Map<string, McpServerReference>();

  function emit(nextReferences: ReadonlyMap<string, McpServerReference>): void {
    onChange(Object.fromEntries(nextReferences));
  }

  function replaceReference(name: string, reference: McpServerReference): void {
    emit(new Map(storedReferences).set(name, reference));
  }

  function toggleReference(name: string, isChecked: boolean): void {
    const nextReferences = new Map(storedReferences);
    if (isChecked) {
      nextReferences.set(name, NO_OVERRIDE);
    } else {
      nextReferences.delete(name);
    }
    emit(nextReferences);
  }

  function renderOverrides(name: string, definition: McpServerDefinition, reference: McpServerReference): ReactElement {
    switch (definition.type) {
      case 'stdio': {
        return (
          <>
            {definition.envNames.map((declaredName) => {
              const defaultName = readEnvironmentBinding(definition.envBindings, declaredName);
              return (
                <ServerEnvironmentNameSelect
                  key={declaredName}
                  label={`${name}: ${declaredName} szerver oldali változója`}
                  value={readEnvironmentBinding(reference.envBindings, declaredName)}
                  noneLabel={`központi alapértelmezés (${defaultName === '' ? declaredName : defaultName})`}
                  environmentNames={environmentNames}
                  size="sm"
                  onChange={(serverName) => {
                    replaceReference(name, withBinding(reference, declaredName, serverName));
                  }}
                />
              );
            })}
          </>
        );
      }
      case 'sse':
      case 'http': {
        return (
          <ServerEnvironmentNameSelect
            label={`${name}: Authorization fejléc szerver oldali változója`}
            value={reference.authEnvName ?? ''}
            noneLabel={`központi alapértelmezés (${definition.authEnvName ?? 'nincs'})`}
            environmentNames={environmentNames}
            size="sm"
            onChange={(serverName) => {
              replaceReference(name, withAuthEnvironmentName(reference, serverName));
            }}
          />
        );
      }
    }
  }

  function renderList(): ReactElement {
    if (servers.status === 'failure') {
      return <Alert variant="danger">{servers.message}</Alert>;
    }
    if (servers.status !== 'success') {
      return (
        <div aria-busy="true">
          <ThemedSkeleton shape="text" lines={2} />
        </div>
      );
    }
    const libraryNames = new Set(servers.value.map((server) => server.name));
    const missingNames = storedReferences
      .keys()
      .filter((name) => !libraryNames.has(name))
      .toArray();
    const rows = [
      ...servers.value.map((server) => ({ name: server.name, label: server.name, definition: server.definition })),
      ...missingNames.map((name) => ({ name, label: `${name} (hiányzik a központi listából)`, definition: undefined })),
    ];
    if (rows.length === 0) {
      return <Empty inline message="Még nincs MCP szerver. A Beállítások oldalon vehetsz fel újat." />;
    }
    return (
      <>
        <InspectorFieldGroup title="Központi MCP szerverek">
          {rows.map((row) => {
            const reference = storedReferences.get(row.name);
            return (
              <div key={row.name}>
                <Checkbox
                  label={row.label}
                  checked={reference !== undefined}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    toggleReference(row.name, event.target.checked);
                  }}
                />
                {reference !== undefined && row.definition !== undefined && (
                  <div className="node-inspector__mcp-overrides">
                    {renderOverrides(row.name, row.definition, reference)}
                  </div>
                )}
              </div>
            );
          })}
        </InspectorFieldGroup>
        {missingNames.length > 0 && (
          <p className="node-inspector__reason">
            A központi listából hiányzó MCP szerverre a futás indítása hibával áll meg: vedd ki a jelölést, vagy vedd
            fel újra a Beállítások oldalon.
          </p>
        )}
        {environmentNames.status === 'failure' && storedReferences.size > 0 && (
          <Alert variant="danger">{environmentNames.message}</Alert>
        )}
      </>
    );
  }

  return (
    <div className="node-inspector__group">
      <p className="node-inspector__reason">
        A lépés a Beállítások MCP szerver listájából választ; a szerver oldali változó neve itt felülírható.
      </p>
      {references === undefined && (
        <p className="node-inspector__reason">
          A tárolt érték alakja érvénytelen ({describeUnknownValue(value)}), ezért itt üresként jelenik meg. Bármelyik
          módosítás felülírja.
        </p>
      )}
      {renderList()}
    </div>
  );
}
