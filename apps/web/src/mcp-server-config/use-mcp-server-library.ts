import type { FetchFunction } from '@easter-workflow-builder/core';
import {
  McpServerDefinitionRecordSchema,
  type McpServerDefinition,
  type McpServerDefinitionRecord,
} from '@easter-workflow-builder/protocol';
import { useCallback, useEffect, useState } from 'react';
import type { RequestState } from '../request-state/request-state.ts';
import { useRequestState } from '../request-state/use-request-state.ts';
import { arraySchema } from '../rest-client/array-schema.ts';
import { emptyResponseSchema } from '../rest-client/empty-response-schema.ts';
import { requestRoute } from '../rest-client/request-route.ts';
import { requestRouteWithoutBody } from '../rest-client/request-route-without-body.ts';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';
import { mergeMcpServer } from './merge-mcp-server.ts';

export interface UseMcpServerLibraryResult {
  /**
   * A betöltés állapota; a betöltés után mindig a legutóbb ismert lista
   * (`success`), tehát egy későbbi mentés vagy törlés hibája nem dobja el a
   * megjelenített szervereket.
   */
  readonly state: RequestState<readonly McpServerDefinitionRecord[]>;
  /**
   * A mentés utáni háttér újratöltés állapota: `failure`, ha a szerver
   * sorrendjét hozó `GET` elbukott (a lista ilyenkor a `PUT` válaszával
   * bővített, utolsó ismert állapot). Külön állapot, hogy az újratöltés ne
   * váltsa csontvázra a listát.
   */
  readonly reloadState: RequestState<readonly McpServerDefinitionRecord[]>;
  /**
   * `PUT /api/mcp-servers/{name}` (létrehozás vagy teljes csere, SPEC-009
   * 6.2): siker után a `PUT` válasza azonnal a listába kerül (név szerint
   * rendezve, azonos név cseréjével), utána a lista újratöltődik a szerver
   * sorrendjéért. Az azonnali beillesztés nélkül egy elbukó újratöltés után az
   * új szerver nem látszana, és az azonos nevű következő hozzáadás a
   * felülírás figyelmeztetése nélkül menne ki.
   */
  readonly saveServer: (
    name: string,
    definition: McpServerDefinition,
  ) => Promise<RouteOutcome<McpServerDefinitionRecord>>;
  /**
   * `DELETE /api/mcp-servers/{name}` (204): a szerver kikerül a listából,
   * akkor is, ha lépés hivatkozik rá (O-43).
   */
  readonly deleteServer: (name: string) => Promise<RouteOutcome<undefined>>;
}

/**
 * A központi MCP szerver lista közös állapota (SPEC-009 3.1 5. pont, 6.2): egy
 * betöltés (`GET /api/mcp-servers`, név szerint rendezve), mentés (új és
 * felülíró egyaránt) és törlés. A Beállítások képernyő és a gráf szerkesztő
 * is ezt használja.
 */
export function useMcpServerLibrary(apiOrigin: string, fetchFunction: FetchFunction): UseMcpServerLibraryResult {
  const loadRequest = useRequestState<readonly McpServerDefinitionRecord[]>();
  const reloadRequest = useRequestState<readonly McpServerDefinitionRecord[]>();
  const [servers, setServers] = useState<readonly McpServerDefinitionRecord[]>([]);
  const { run } = loadRequest;
  const { run: runReload } = reloadRequest;

  const fetchServers = useCallback(async (): Promise<RouteOutcome<readonly McpServerDefinitionRecord[]>> => {
    const outcome = await requestRouteWithoutBody({
      routeId: 'listMcpServerDefinitions',
      responseSchema: arraySchema(McpServerDefinitionRecordSchema),
      fetchFunction,
      apiOrigin,
    });
    if (outcome.kind === 'ok') {
      setServers(outcome.value);
    }
    return outcome;
  }, [apiOrigin, fetchFunction]);

  useEffect(() => {
    void run(fetchServers);
  }, [run, fetchServers]);

  const saveServer = useCallback(
    async (name: string, definition: McpServerDefinition): Promise<RouteOutcome<McpServerDefinitionRecord>> => {
      const outcome = await requestRoute({
        routeId: 'saveMcpServerDefinition',
        parameters: { name },
        body: definition,
        responseSchema: McpServerDefinitionRecordSchema,
        fetchFunction,
        apiOrigin,
      });
      if (outcome.kind === 'ok') {
        const saved = outcome.value;
        setServers((previous) => mergeMcpServer(previous, saved));
        await runReload(fetchServers);
      }
      return outcome;
    },
    [apiOrigin, fetchFunction, fetchServers, runReload],
  );

  const deleteServer = useCallback(
    async (name: string): Promise<RouteOutcome<undefined>> => {
      const outcome = await requestRouteWithoutBody({
        routeId: 'deleteMcpServerDefinition',
        parameters: { name },
        responseSchema: emptyResponseSchema,
        fetchFunction,
        apiOrigin,
      });
      if (outcome.kind === 'ok') {
        setServers((previous) => previous.filter((server) => server.name !== name));
      }
      return outcome;
    },
    [apiOrigin, fetchFunction],
  );

  const state: RequestState<readonly McpServerDefinitionRecord[]> =
    loadRequest.state.status === 'success' ? { status: 'success', value: servers } : loadRequest.state;

  return { state, reloadState: reloadRequest.state, saveServer, deleteServer };
}
