// Barrel: csak nevesített újraexport (SPEC-002 6.6). A csomag téma mappánként bővül, ahogy a
// PLAN-010 lépései elkészülnek (mustache-template, cel-expression).

// mustache-template: a Mustache sablon renderelő gyártó függvénye és az alakja (SPEC-010 6.).
export { createMustacheTemplateRenderer } from './mustache-template/create-mustache-template-renderer.ts';
export type { MustacheTemplateRenderer } from './mustache-template/mustache-template-renderer.ts';

// cel-expression: a CEL kifejezés kiértékelő gyártó függvénye, az alakja és a hét változó neve (SPEC-010 7.).
export { createCelExpressionEvaluator } from './cel-expression/create-cel-expression-evaluator.ts';
export type { CelExpressionEvaluator } from './cel-expression/cel-expression-evaluator.ts';
export { RUN_CONTEXT_VARIABLE_NAMES } from './cel-expression/run-context-variable-names.ts';
