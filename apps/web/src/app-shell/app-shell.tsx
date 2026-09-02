import type { FetchFunction } from '@easter-workflow-builder/core';
import { AppShellFrame, ThemeModeToggle } from '@easter-workflow-builder/ui';
import { useEffect, useState, type ReactElement } from 'react';
import { browserHistoryLocationPort } from '../history-navigation/browser-history-location-port.ts';
import { useClientRoute } from '../history-navigation/use-client-route.ts';
import { NotFoundRoute } from '../not-found-route/not-found-route.tsx';
import { RunHistoryScreen } from '../run-history/run-history-screen.tsx';
import { browserEventSourceFactory } from '../stream-client/browser-event-source-factory.ts';
import { browserStreamIdGenerator } from '../stream-client/browser-stream-id-generator.ts';
import { useStreamConnection, type StreamConnectionPhase } from '../stream-client/use-stream-connection.ts';
import { WorkflowListScreen } from '../workflow-list/workflow-list-screen.tsx';

export interface AppShellProperties {
  readonly apiOrigin: string;
  readonly listLimit: number;
  readonly streamReplayLimit: number;
  readonly fetchFunction: FetchFunction;
}

/**
 * A stream kapcsolat státusz szövege a topnav `.app-tn__actions` sávjában
 * (SPEC-007 11. szekció 14 ... 16. async pont). A `live` fázisnak nincs
 * önálló szövege (a `useStreamConnection` dokumentációja szerint), ezért a
 * leképezés csak három fázist fed; a negyedik a hívó oldalon `undefined`-et
 * ad, jelzés nélkül.
 */
const STREAM_STATUS_LABEL: Readonly<Partial<Record<StreamConnectionPhase, string>>> = {
  connecting: 'kapcsolódás',
  replaying: 'előzmények betöltése',
  reconnecting: 'újracsatlakozás',
};

/**
 * Az alkalmazás gyökér összeállítása (SPEC-007 5.1 mermaid: `AppShell,
 * osztaly app-tn`): a topnav bar ÉS a útválasztott tartalom együtt, nem
 * csak egy csupasz topnav. Az egyetlen, app élettartamú
 * `useStreamConnection` itt épül, és a `run-history` képernyőnek adja
 * tovább, ami az egyetlen SSE fogyasztó (SPEC-007 10.2).
 */
export function AppShell(properties: Readonly<AppShellProperties>): ReactElement {
  const { apiOrigin, listLimit, streamReplayLimit, fetchFunction } = properties;

  const { routeId, search, navigate } = useClientRoute(browserHistoryLocationPort);
  const streamConnection = useStreamConnection({
    apiOrigin,
    eventSourceFactory: browserEventSourceFactory,
    streamIdGenerator: browserStreamIdGenerator,
  });

  const [isNavigationMenuOpen, setIsNavigationMenuOpen] = useState(false);
  useEffect(() => {
    setIsNavigationMenuOpen(false);
  }, [routeId]);

  const streamStatusLabel = STREAM_STATUS_LABEL[streamConnection.phase];

  const content = renderRouteContent(routeId, {
    apiOrigin,
    listLimit,
    streamReplayLimit,
    fetchFunction,
    search,
    navigate,
    streamId: streamConnection.streamId,
    lastFrame: streamConnection.lastFrame,
  });

  return (
    <AppShellFrame
      isNavigationMenuOpen={isNavigationMenuOpen}
      pageTitle={routeId === 'runHistory' ? 'Futás előzmények' : 'Workflow-k'}
      brand={
        <>
          <button
            type="button"
            className="app-tn__nav-toggle"
            aria-label="Navigáció megnyitása"
            aria-expanded={isNavigationMenuOpen}
            onClick={() => {
              setIsNavigationMenuOpen((previous) => !previous);
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <b>easter-workflow-builder</b>
        </>
      }
      navigation={
        <>
          <a
            href="/"
            className={routeId === 'workflowList' ? 'is-on' : undefined}
            onClick={(event) => {
              event.preventDefault();
              navigate('workflowList');
            }}
          >
            Workflow-k
          </a>
          <a
            href="/runs"
            className={routeId === 'runHistory' ? 'is-on' : undefined}
            onClick={(event) => {
              event.preventDefault();
              navigate('runHistory');
            }}
          >
            Futás előzmények
          </a>
        </>
      }
      actions={
        <>
          {streamStatusLabel === undefined ? undefined : <span>{streamStatusLabel}</span>}
          <ThemeModeToggle />
        </>
      }
    >
      {content}
    </AppShellFrame>
  );
}

interface RouteContentDependencies {
  readonly apiOrigin: string;
  readonly listLimit: number;
  readonly streamReplayLimit: number;
  readonly fetchFunction: FetchFunction;
  readonly search: string;
  readonly navigate: ReturnType<typeof useClientRoute>['navigate'];
  readonly streamId: string;
  readonly lastFrame: ReturnType<typeof useStreamConnection>['lastFrame'];
}

function renderRouteContent(
  routeId: ReturnType<typeof useClientRoute>['routeId'],
  dependencies: Readonly<RouteContentDependencies>,
): ReactElement {
  const { apiOrigin, listLimit, streamReplayLimit, fetchFunction, search, navigate, streamId, lastFrame } =
    dependencies;

  switch (routeId) {
    case 'workflowList': {
      return (
        <WorkflowListScreen
          apiOrigin={apiOrigin}
          listLimit={listLimit}
          fetchFunction={fetchFunction}
          navigate={navigate}
        />
      );
    }
    case 'runHistory': {
      return (
        <RunHistoryScreen
          apiOrigin={apiOrigin}
          listLimit={listLimit}
          streamReplayLimit={streamReplayLimit}
          fetchFunction={fetchFunction}
          search={search}
          streamId={streamId}
          lastFrame={lastFrame}
        />
      );
    }
    case undefined: {
      return <NotFoundRoute navigate={navigate} />;
    }
  }
}
