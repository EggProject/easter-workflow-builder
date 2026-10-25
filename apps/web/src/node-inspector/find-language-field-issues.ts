import type { NodeConfig } from '@easter-workflow-builder/protocol';
import {
  createCelExpressionEvaluator,
  createMustacheTemplateRenderer,
} from '@easter-workflow-builder/workflow-language';
import type { ZodIssueLike } from './field-errors-from-zod-error.ts';

/**
 * A szerverrel és a motorral azonos csomag két fordítója (SPEC-010 3.1, 10.).
 * Modul szintű példány, mert a `compile` állapotmentes, és a panel minden
 * renderelése fordít.
 */
const TEMPLATE_RENDERER = createMustacheTemplateRenderer();
const EXPRESSION_EVALUATOR = createCelExpressionEvaluator();

/**
 * Egy sablon vagy kifejezés mező: a `config`-on belüli útvonala, a szövege és
 * a nyelve.
 */
interface LanguageField {
  readonly path: readonly string[];
  readonly source: string;
  readonly language: 'template' | 'expression';
}

/**
 * A SPEC-010 9.2 hét vizsgált mezője közül azok, amik a csomópont típusán
 * léteznek. A `start`, az `error_handler`, a `sub_workflow`, a `script` node
 * és a `join` nem `ai_synthesis` módja nem hordoz sablont vagy kifejezést.
 */
function languageFieldsOf(config: NodeConfig): readonly LanguageField[] {
  switch (config.type) {
    case 'agent_step': {
      return [{ path: ['promptTemplate'], source: config.promptTemplate, language: 'template' }];
    }
    case 'join': {
      return config.mode === 'ai_synthesis'
        ? [{ path: ['settings', 'promptTemplate'], source: config.settings.promptTemplate, language: 'template' }]
        : [];
    }
    case 'human_approval': {
      return [{ path: ['bodyTemplate'], source: config.bodyTemplate, language: 'template' }];
    }
    case 'fan_out': {
      return [
        { path: ['itemsExpression'], source: config.itemsExpression, language: 'expression' },
        { path: ['branchLabelTemplate'], source: config.branchLabelTemplate, language: 'template' },
      ];
    }
    case 'branch': {
      return [{ path: ['expression'], source: config.expression, language: 'expression' }];
    }
    case 'loop': {
      return [{ path: ['continueExpression'], source: config.continueExpression, language: 'expression' }];
    }
    case 'start':
    case 'error_handler':
    case 'sub_workflow':
    case 'script': {
      return [];
    }
  }
}

/**
 * A kiválasztott csomópont sablon és kifejezés mezőinek fordítási hibái, a
 * mezőnkénti hibatérkép bemenetének alakjában (SPEC-010 10., AC43): a sablon
 * a `mustache-template`, a kifejezés a `cel-expression` `compile` hívásával
 * fordul. Az üzenet a csomag saját magyar leírása, ami a mező szövegét nem
 * idézi (SPEC-010 9.5).
 *
 * A fordítás csak sémahelyes mezőn fut (SPEC-010 10. "sorrend", AC46): ha a
 * `schemaFieldErrors` térképen a mező útvonalán már áll hiba (például az üres
 * kötelező mező mondata), a mező kimarad, tehát alatta a séma hibája marad.
 */
export function findLanguageFieldIssues(
  config: NodeConfig,
  schemaFieldErrors: ReadonlyMap<string, string>,
): readonly ZodIssueLike[] {
  const issues: ZodIssueLike[] = [];
  for (const { path, source, language } of languageFieldsOf(config)) {
    if (schemaFieldErrors.has(path.join('.'))) {
      continue;
    }
    const compiled = language === 'template' ? TEMPLATE_RENDERER.compile(source) : EXPRESSION_EVALUATOR.compile(source);
    if (compiled.kind === 'error') {
      issues.push({ path, message: compiled.message });
    }
  }
  return issues;
}
