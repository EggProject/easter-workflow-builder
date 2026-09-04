// A csomag publikus felülete: kizárólag nevesített újraexport, `export *`
// nélkül (SPEC-002 6.6). A barrel a coverage kizárási listáján van, ezért
// futásidejű elágazást nem tartalmazhat.

// app-mount: a valódi böngésző belépési pont.
export { mountApp } from './app-mount/mount-app.tsx';

// app-shell: a topnav összeállítása, a lenyíló menü és a stream státusz.
export { AppShell, type AppShellProperties } from './app-shell/app-shell.tsx';

// client-route: a kliens oldali útvonaltábla és a pathname illesztő.
export { CLIENT_ROUTE_TABLE, type ClientRouteId } from './client-route/client-route-table.ts';
export { matchClientRoute } from './client-route/match-client-route.ts';

// frontend-config: a kötelező, alapérték nélküli felületi konfiguráció.
export type { FrontendConfig } from './frontend-config/frontend-config.ts';
export { readFrontendConfig } from './frontend-config/read-frontend-config.ts';

// history-navigation: a history/location befecskendezett portja és a hook.
export type { HistoryLocationPort } from './history-navigation/history-location-port.ts';
export { browserHistoryLocationPort } from './history-navigation/browser-history-location-port.ts';
export { useClientRoute, type UseClientRouteResult } from './history-navigation/use-client-route.ts';

// not-found-route: az ismeretlen útvonal képernyője.
export { NotFoundRoute, type NotFoundRouteProperties } from './not-found-route/not-found-route.tsx';

// protocol-error-message: a ProtocolErrorCode kimerítő magyar leképezése.
export { protocolErrorMessage } from './protocol-error-message/protocol-error-message.ts';

// request-state: négyállapotú async állapot típus és a hozzá tartozó hook.
export type { RequestState } from './request-state/request-state.ts';
export { useRequestState, type UseRequestStateResult } from './request-state/use-request-state.ts';

// rest-client: REST hívás a packages/protocol ROUTE_TABLE fölött.
export type { SafeParsableSchema, SafeParseOutcome } from './rest-client/safe-parsable-schema.ts';
export { arraySchema } from './rest-client/array-schema.ts';
export { browserFetchFunction } from './rest-client/browser-fetch-function.ts';
export { requestRoute, type RequestRouteInput } from './rest-client/request-route.ts';
export {
  requestRouteWithoutBody,
  type RequestRouteWithoutBodyInput,
} from './rest-client/request-route-without-body.ts';

// run-history: a futás előzmények képernyő és a státusz-jelvény leképezés.
export { describeRunStatusBadge, type RunStatusBadgeDescriptor } from './run-history/run-status-badge.ts';
export { RunHistoryScreen, type RunHistoryScreenProperties } from './run-history/run-history-screen.tsx';

// stream-client: EventSource port, streamId generátor és a kapcsolat hook.
export type { EventSourceFactory, EventSourceLike } from './stream-client/event-source-like.ts';
export { browserEventSourceFactory } from './stream-client/browser-event-source-factory.ts';
export type { StreamIdGenerator } from './stream-client/stream-id-generator.ts';
export { browserStreamIdGenerator } from './stream-client/browser-stream-id-generator.ts';
export {
  useStreamConnection,
  type StreamConnectionPhase,
  type StreamConnectionState,
  type UseStreamConnectionInput,
} from './stream-client/use-stream-connection.ts';

// workflow-list: a workflow lista képernyő, a három soronkénti modálissal.
export { WorkflowListScreen, type WorkflowListScreenProperties } from './workflow-list/workflow-list-screen.tsx';
