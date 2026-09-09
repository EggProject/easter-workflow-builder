import type { FetchFunction } from '@easter-workflow-builder/core';
import {
  AppShellFrame,
  Breadcrumb,
  logoMarkUrl,
  ThemeModeToggle,
  type BreadcrumbAncestor,
} from '@easter-workflow-builder/ui';
import { useEffect, useState, type MouseEvent, type ReactElement } from 'react';
import { CLIENT_ROUTE_TABLE, type ClientRouteId } from '../client-route/client-route-table.ts';
import { GraphEditorScreen } from '../graph-editor/GraphEditorScreen.tsx';
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
  readonly streamOrigin: string;
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
 * Az ismeretlen (`undefined`) útvonal morzsamenü végpontjának neve
 * (2026-09-06). Nem a `CLIENT_ROUTE_TABLE` tagja, mert nincs hozzá valódi
 * útvonal sablon - ez a `NotFoundRoute` képernyő egyetlen, nem duplikált
 * felirata.
 */
const NOT_FOUND_BREADCRUMB_LABEL = 'Ismeretlen oldal';

/**
 * A morzsamenü elemei útvonalanként (2026-09-06, a nagy oldalcím
 * felváltása). A `workflowList` az alkalmazás gyökere: ott a "Workflow-k"
 * maga az aktuális, ős nélküli elem (WAI-ARIA APG Breadcrumb Pattern - az
 * aktuális elemnek nincs elődje a lista élén). Minden más útvonalon a
 * "Workflow-k" az első, kattintható ős, mert minden képernyő innen érhető
 * el. Az útvonal nevek a `CLIENT_ROUTE_TABLE` `label` mezőjéből jönnek, nem
 * duplikálva itt (`.claude/CLAUDE.md` 5. szekció).
 */
function buildBreadcrumbAncestors(
  routeId: ClientRouteId | undefined,
  navigate: (routeId: ClientRouteId) => void,
): readonly BreadcrumbAncestor[] {
  if (routeId === 'workflowList') {
    return [];
  }
  return [
    {
      label: CLIENT_ROUTE_TABLE.workflowList.label,
      href: CLIENT_ROUTE_TABLE.workflowList.template,
      onClick: (event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        navigate('workflowList');
      },
    },
  ];
}

function resolveBreadcrumbCurrent(routeId: ClientRouteId | undefined): string {
  return routeId === undefined ? NOT_FOUND_BREADCRUMB_LABEL : CLIENT_ROUTE_TABLE[routeId].label;
}

/**
 * Az alkalmazás gyökér összeállítása (SPEC-007 5.1 mermaid: `AppShell,
 * osztaly app-tn`): a topnav bar ÉS a útválasztott tartalom együtt, nem
 * csak egy csupasz topnav. Az egyetlen, app élettartamú
 * `useStreamConnection` itt épül, és a `run-history` képernyőnek adja
 * tovább, ami az egyetlen SSE fogyasztó (SPEC-007 10.2).
 */
export function AppShell(properties: Readonly<AppShellProperties>): ReactElement {
  const { apiOrigin, streamOrigin, listLimit, streamReplayLimit, fetchFunction } = properties;

  const { routeId, search, navigate } = useClientRoute(browserHistoryLocationPort);
  const streamConnection = useStreamConnection({
    streamOrigin,
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
    serverRestartCount: streamConnection.serverRestartCount,
  });

  return (
    <AppShellFrame
      isNavigationMenuOpen={isNavigationMenuOpen}
      breadcrumb={
        <Breadcrumb
          ancestors={buildBreadcrumbAncestors(routeId, navigate)}
          current={resolveBreadcrumbCurrent(routeId)}
        />
      }
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
          {/* A design system saját topnav minta követése (eggproject-design-app-common/
              skeletons/shell-topnav.html): a márkajel `<img>` a szöveges márkanév ELŐTT,
              a `.app-tn__brand img` szabály (topnav-shell.css) adja a 24x24px méretet. */}
          <img src={logoMarkUrl} alt="" />
          <b>easter-workflow-builder</b>
        </>
      }
      navigation={
        <>
          <a
            href={CLIENT_ROUTE_TABLE.workflowList.template}
            className={routeId === 'workflowList' ? 'is-on' : undefined}
            onClick={(event) => {
              event.preventDefault();
              navigate('workflowList');
            }}
          >
            {CLIENT_ROUTE_TABLE.workflowList.label}
          </a>
          <a
            href={CLIENT_ROUTE_TABLE.runHistory.template}
            className={routeId === 'runHistory' ? 'is-on' : undefined}
            onClick={(event) => {
              event.preventDefault();
              navigate('runHistory');
            }}
          >
            {CLIENT_ROUTE_TABLE.runHistory.label}
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
  readonly serverRestartCount: number;
}

function renderRouteContent(
  routeId: ReturnType<typeof useClientRoute>['routeId'],
  dependencies: Readonly<RouteContentDependencies>,
): ReactElement {
  const {
    apiOrigin,
    listLimit,
    streamReplayLimit,
    fetchFunction,
    search,
    navigate,
    streamId,
    lastFrame,
    serverRestartCount,
  } = dependencies;

  switch (routeId) {
    case 'workflowList': {
      return (
        <WorkflowListScreen
          apiOrigin={apiOrigin}
          listLimit={listLimit}
          fetchFunction={fetchFunction}
          navigate={navigate}
          serverRestartCount={serverRestartCount}
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
          serverRestartCount={serverRestartCount}
        />
      );
    }
    case 'graphEditor': {
      return <GraphEditorScreen apiOrigin={apiOrigin} fetchFunction={fetchFunction} search={search} />;
    }
    case 'runView': {
      // A tényleges futás nézet a T-009-20 ... T-009-27 lépések tárgya
      // (SPEC-008 F4 ... F6 fázis), ugyanazon okból helyőrző.
      return <p>Futás nézet (folyamatban).</p>;
    }
    case undefined: {
      return <NotFoundRoute navigate={navigate} />;
    }
  }
}
