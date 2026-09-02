import { describe, expect, it } from 'vitest';
import { CLIENT_ROUTE_TABLE } from './client-route-table.ts';
import { matchClientRoute } from './match-client-route.ts';

describe('CLIENT_ROUTE_TABLE', () => {
  it('pontosan két bejegyzést tartalmaz', () => {
    expect(Object.keys(CLIENT_ROUTE_TABLE)).toHaveLength(2);
  });
});

describe('matchClientRoute', () => {
  it('a gyökér útvonalat a workflowList azonosítóra illeszti', () => {
    expect(matchClientRoute('/')).toBe('workflowList');
  });

  it('a /runs útvonalat a runHistory azonosítóra illeszti', () => {
    expect(matchClientRoute('/runs')).toBe('runHistory');
  });

  it('ismeretlen útvonalra undefined-et ad', () => {
    expect(matchClientRoute('/nincs-ilyen')).toBeUndefined();
  });
});
