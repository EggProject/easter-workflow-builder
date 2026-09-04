import { Button, Card } from '@easter-workflow-builder/ui';
import type { ReactElement } from 'react';
import type { ClientRouteId } from '../client-route/client-route-table.ts';

export interface NotFoundRouteProperties {
  readonly navigate: (routeId: ClientRouteId) => void;
}

/**
 * Az ismeretlen útvonal képernyője (SPEC-007 10.3): egy `Card` komponensben
 * megnevezi a hibát, és egy gombbal visszavisz a workflow listára. A
 * böngésző címsora NEM íródik át: ez a komponens sosem hív `pushState`-et
 * saját magától, kizárólag a "vissza" gomb kattintása navigál.
 */
export function NotFoundRoute(properties: Readonly<NotFoundRouteProperties>): ReactElement {
  const { navigate } = properties;

  return (
    <div>
      <Card title="Az oldal nem található">Ez az útvonal nem létezik.</Card>
      <Button
        type="button"
        onClick={() => {
          navigate('workflowList');
        }}
      >
        Vissza a workflow listára
      </Button>
    </div>
  );
}
