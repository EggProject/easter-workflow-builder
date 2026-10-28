import type { McpServerDefinition, McpServerDefinitionRecord } from '@easter-workflow-builder/protocol';
import { Alert, Button, Empty } from '@easter-workflow-builder/ui';
import { useId, useState, type ReactElement } from 'react';
import type { RequestState } from '../request-state/request-state.ts';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';
import { ThemedSkeleton } from '../themed-skeleton/ThemedSkeleton.tsx';
import { DeleteMcpServerModal } from './DeleteMcpServerModal.tsx';
import { McpServerEditModal } from './McpServerEditModal.tsx';
import { McpServerRow } from './McpServerRow.tsx';
import './mcp-server-config.css';

export interface McpServerSettingsCardProperties {
  readonly serversState: RequestState<readonly McpServerDefinitionRecord[]>;
  /**
   * A szerver gép környezeti változóinak nevei a hozzárendelés választóihoz
   * (O-32).
   */
  readonly environmentNamesState: RequestState<readonly string[]>;
  readonly saveServer: (
    name: string,
    definition: McpServerDefinition,
  ) => Promise<RouteOutcome<McpServerDefinitionRecord>>;
  readonly deleteServer: (name: string) => Promise<RouteOutcome<undefined>>;
}

/**
 * A szerkesztő modális célja: új szerver (`record` nélkül) vagy a tárolt
 * szerver. A burkoló objektum különbözteti meg a "zárva" állapottól.
 */
interface EditTarget {
  readonly record: McpServerDefinitionRecord | undefined;
}

/**
 * A Beállítások "MCP szerverek" kártyája (SPEC-009 3.1 5. pont, 6.2, O-31): a
 * központi MCP szerver lista szerverenként egy sorral, hozzáadás és
 * szerkesztés modálisban, törlés megerősítő modálissal, akkor is, ha egy
 * lépés hivatkozik a szerverre (O-43). A kártya kimondja, hogy a definíció
 * csak neveket tárol (a titok értéke a szerver környezetében marad), és hogy
 * a lépés a hozzárendelést felülírhatja. A betöltés alatt csontváz, a
 * betöltés hibája danger `Alert`, az üres lista `Empty`. Kártya a kártyában
 * nincs.
 */
export function McpServerSettingsCard(properties: Readonly<McpServerSettingsCardProperties>): ReactElement {
  const { serversState, environmentNamesState, saveServer, deleteServer } = properties;
  const headingId = useId();
  const [editTarget, setEditTarget] = useState<EditTarget | undefined>(undefined);
  const [serverNameToDelete, setServerNameToDelete] = useState<string | undefined>(undefined);

  function renderBody(): ReactElement {
    if (serversState.status === 'failure') {
      return <Alert variant="danger">{serversState.message}</Alert>;
    }
    if (serversState.status !== 'success') {
      return (
        <div aria-busy="true">
          <ThemedSkeleton shape="text" lines={2} />
        </div>
      );
    }
    const servers = serversState.value;
    return (
      <>
        {servers.length === 0 ? (
          <Empty
            inline
            message="Még nincs MCP szerver. Vegyél fel egyet, hogy az agent lépések név szerint hivatkozhassanak rá."
          />
        ) : (
          servers.map((server) => (
            <McpServerRow
              key={server.name}
              server={server}
              onEdit={(record) => {
                setEditTarget({ record });
              }}
              onDelete={(record) => {
                setServerNameToDelete(record.name);
              }}
            />
          ))
        )}
        <Button
          type="button"
          size="sm"
          className="mcp-server-card__add"
          onClick={() => {
            setEditTarget({ record: undefined });
          }}
        >
          MCP szerver hozzáadása
        </Button>
        {editTarget !== undefined && (
          <McpServerEditModal
            record={editTarget.record}
            existingNames={servers.map((server) => server.name)}
            environmentNames={environmentNamesState}
            saveServer={saveServer}
            onClose={() => {
              setEditTarget(undefined);
            }}
          />
        )}
      </>
    );
  }

  return (
    <section className="card" aria-labelledby={headingId}>
      <div className="card__header">
        <h3 id={headingId}>MCP szerverek</h3>
      </div>
      <p className="settings-screen__hint">
        A definíció csak neveket tárol: a titkok értéke a szerver gép környezeti változóiban marad. A lépés és az agent
        definíció név szerint hivatkozik a szerverre, és ott felülírhatja, melyik szerver oldali változó kerüljön a
        deklarált változóba.
      </p>
      {renderBody()}
      <DeleteMcpServerModal
        serverName={serverNameToDelete}
        onClose={() => {
          setServerNameToDelete(undefined);
        }}
        deleteServer={deleteServer}
      />
    </section>
  );
}
