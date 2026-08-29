import type { TemplateRendererPort } from '@easter-workflow-builder/engine';

const REJECTION_MESSAGE =
  'A szerver nem ismer sablon nyelvet, a promptTemplate/bodyTemplate/branchLabelTemplate renderelése nem elérhető (expression_evaluator_unavailable).';

/**
 * A sablon renderelő port kimondottan elutasító implementációja, ugyanazon
 * okból és ugyanazzal a hibaosztállyal, mint a
 * `create-rejecting-expression-evaluator.ts` (SPEC-004 15. szekció O-1: a
 * két port közös nyitott kérdés, közös hibaosztály).
 */
export function createRejectingTemplateRenderer(): TemplateRendererPort {
  return {
    render: () => ({ kind: 'error', message: REJECTION_MESSAGE }),
    compile: () => ({ kind: 'error', message: REJECTION_MESSAGE }),
  };
}
