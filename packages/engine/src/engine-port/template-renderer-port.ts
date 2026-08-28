import type { Outcome } from '@easter-workflow-builder/core';

/**
 * A sablon renderelő port (SPEC-004 3.2 táblázat, `templateRenderer` sor). A
 * `promptTemplate`, a `bodyTemplate` és a `branchLabelTemplate` renderelését
 * ezen a porton át végzi a motor. A sablon nyelv megválasztása nem ennek a
 * specnek a tárgya (SPEC-004 1. szekció "Amit NEM dönt el", 15. szekció O-1
 * nyitott kérdés).
 */
export interface TemplateRendererPort {
  render(template: string, context: unknown): Outcome<string>;
  compile(template: string): Outcome<void>;
}
