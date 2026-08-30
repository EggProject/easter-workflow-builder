import { describe, expect, it } from 'vitest';
import { ROUTE_TABLE } from './route-table.ts';
import { isRouteId } from './is-route-id.ts';

describe('isRouteId', () => {
  it('a ROUTE_TABLE mind a 26 kulcsára igazat ad', () => {
    const routeIds = Object.keys(ROUTE_TABLE);
    expect(routeIds).toHaveLength(26);
    expect(routeIds.every((routeId) => isRouteId(routeId))).toBe(true);
  });

  it('hamisat ad ismeretlen szövegre', () => {
    expect(isRouteId('unknownRoute')).toBe(false);
    expect(isRouteId('')).toBe(false);
    // A `Record` alapú keresés nem eshet át a prototípus láncra.
    expect(isRouteId('toString')).toBe(false);
    expect(isRouteId('constructor')).toBe(false);
  });

  it('hamisat ad nem szöveg bemenetre', () => {
    expect(isRouteId(undefined)).toBe(false);
    expect(isRouteId(7)).toBe(false);
    expect(isRouteId({ routeId: 'listWorkflows' })).toBe(false);
    expect(isRouteId(['listWorkflows'])).toBe(false);
  });
});
