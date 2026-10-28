import { describe, expect, it } from 'vitest';
import { API_BASE_PATH } from './api-base-path.ts';
import { ROUTE_TABLE } from './route-table.ts';

describe('ROUTE_TABLE', () => {
  it('a SPEC-005 4.2 táblázatának 26 és a SPEC-009 5.1 három skill végpontját tartalmazza (11. kritérium, AC10)', () => {
    expect(Object.keys(ROUTE_TABLE)).toHaveLength(29);
  });

  it('a skill könyvtár három útvonala a SPEC-009 5.1 szerint áll, a feltöltés nyers ZIP törzzsel (O-36)', () => {
    expect(ROUTE_TABLE.listSkills).toStrictEqual({ method: 'GET', template: `${API_BASE_PATH}/skills` });
    expect(ROUTE_TABLE.uploadSkill).toStrictEqual({
      method: 'PUT',
      template: `${API_BASE_PATH}/skills/:name`,
      requestBody: 'application/zip',
    });
    expect(ROUTE_TABLE.deleteSkill).toStrictEqual({ method: 'DELETE', template: `${API_BASE_PATH}/skills/:name` });
  });

  it('minden útvonal sablon az API_BASE_PATH alatt áll', () => {
    for (const route of Object.values(ROUTE_TABLE)) {
      expect(route.template.startsWith(`${API_BASE_PATH}/`)).toBe(true);
    }
  });

  it('a metódus a dokumentált öt HTTP ige egyike', () => {
    const allowedMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
    for (const route of Object.values(ROUTE_TABLE)) {
      expect(allowedMethods.has(route.method)).toBe(true);
    }
  });

  it('minden (metódus, sablon) páros egyedi', () => {
    const pairs = Object.values(ROUTE_TABLE).map((route) => `${route.method} ${route.template}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });
});
