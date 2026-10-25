import type { Outcome } from '@easter-workflow-builder/core';

/**
 * A sablon renderelő port (SPEC-004 3.2 táblázat, `templateRenderer` sor). A
 * `promptTemplate`, a `bodyTemplate` és a `branchLabelTemplate` renderelését
 * ezen a porton át végzi a motor. A sablon nyelv a Mustache (SPEC-004 O-1
 * lezárva, user döntés 2026-09-23); a szállított implementációt a SPEC-010
 * írja le, a motor a nyelvet nem ismeri. A `compile` a futás indításakor fut
 * minden sablon mezőre, és a hibája `template_render_failed` osztállyal
 * utasítja el az indítást (SPEC-010 9.2,
 * `run-validation/validate-language-fields.ts`).
 */
export interface TemplateRendererPort {
  render(template: string, context: unknown): Outcome<string>;
  compile(template: string): Outcome<void>;
}
