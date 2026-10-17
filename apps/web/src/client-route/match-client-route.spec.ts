import { describe, expect, it } from 'vitest';
import { CLIENT_ROUTE_TABLE } from './client-route-table.ts';
import { matchClientRoute } from './match-client-route.ts';

describe('CLIENT_ROUTE_TABLE', () => {
  it('pontosan öt bejegyzést tartalmaz', () => {
    expect(Object.keys(CLIENT_ROUTE_TABLE)).toHaveLength(5);
  });

  it('az ötödik bejegyzés a Beállítások képernyő, paraméteres szegmens nélkül (SPEC-008 5.11)', () => {
    expect(CLIENT_ROUTE_TABLE.settings).toEqual({ template: '/settings', label: 'Beállítások' });
  });
});

describe('matchClientRoute', () => {
  it('a gyökér útvonalat a workflowList azonosítóra illeszti', () => {
    expect(matchClientRoute('/')).toBe('workflowList');
  });

  it('a /runs útvonalat a runHistory azonosítóra illeszti', () => {
    expect(matchClientRoute('/runs')).toBe('runHistory');
  });

  it('a /editor útvonalat a graphEditor azonosítóra illeszti', () => {
    expect(matchClientRoute('/editor')).toBe('graphEditor');
  });

  it('a /run útvonalat a runView azonosítóra illeszti', () => {
    expect(matchClientRoute('/run')).toBe('runView');
  });

  it('a /settings útvonalat a settings azonosítóra illeszti', () => {
    expect(matchClientRoute('/settings')).toBe('settings');
  });

  it('ismeretlen útvonalra undefined-et ad', () => {
    expect(matchClientRoute('/nincs-ilyen')).toBeUndefined();
  });
});
