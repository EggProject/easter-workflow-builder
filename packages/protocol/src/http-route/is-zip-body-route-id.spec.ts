import { describe, expect, expectTypeOf, it } from 'vitest';
import { isZipBodyRouteId, type ZipBodyRouteId } from './is-zip-body-route-id.ts';

describe('isZipBodyRouteId', () => {
  it('a skill feltöltés nyers ZIP törzsű végpont', () => {
    expect(isZipBodyRouteId('uploadSkill')).toBe(true);
  });

  it.each(['listSkills', 'deleteSkill', 'replaceWorkflowGraph'] as const)(
    'a(z) %s JSON vagy törzs nélküli végpont',
    (routeId) => {
      expect(isZipBodyRouteId(routeId)).toBe(false);
    },
  );

  it('típusszinten pontosan a skill feltöltés a ZIP törzsű végpont', () => {
    expectTypeOf<ZipBodyRouteId>().toEqualTypeOf<'uploadSkill'>();
  });
});
