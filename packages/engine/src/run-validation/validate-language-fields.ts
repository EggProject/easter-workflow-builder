import type { Outcome } from '@easter-workflow-builder/core';
import type { ExpressionEvaluatorPort } from '../engine-port/expression-evaluator-port.ts';
import type { TemplateRendererPort } from '../engine-port/template-renderer-port.ts';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ExecutableNodeConfig } from './executable-node-config.ts';

/**
 * A két port, amiből az ellenőrzés kizárólag a `compile` metódust hívja.
 */
interface LanguageCompilePorts {
  readonly templateRenderer: Pick<TemplateRendererPort, 'compile'>;
  readonly expressionEvaluator: Pick<ExpressionEvaluatorPort, 'compile'>;
}

/**
 * Egy sablon vagy kifejezés mező: a `config`-on belüli, ponttal összefűzött
 * útvonala, a szövege és a hibaosztály, amivel a fordíthatatlansága bukik.
 */
interface LanguageField {
  readonly field: string;
  readonly source: string;
  readonly errorKind: 'template_render_failed' | 'expression_evaluation_failed';
}

/**
 * A SPEC-010 9.2 hét vizsgált mezője, a node típusa szerint. A `join`
 * `merge` módjának, a `start`, az `error_handler` és a `sub_workflow` node-nak
 * nincs sablon vagy kifejezés mezője.
 */
function languageFieldsOf(config: ExecutableNodeConfig): readonly LanguageField[] {
  switch (config.type) {
    case 'agent_step': {
      return [{ field: 'promptTemplate', source: config.promptTemplate, errorKind: 'template_render_failed' }];
    }
    case 'join': {
      return config.mode === 'ai_synthesis'
        ? [
            {
              field: 'settings.promptTemplate',
              source: config.settings.promptTemplate,
              errorKind: 'template_render_failed',
            },
          ]
        : [];
    }
    case 'human_approval': {
      return [{ field: 'bodyTemplate', source: config.bodyTemplate, errorKind: 'template_render_failed' }];
    }
    case 'fan_out': {
      return [
        { field: 'itemsExpression', source: config.itemsExpression, errorKind: 'expression_evaluation_failed' },
        { field: 'branchLabelTemplate', source: config.branchLabelTemplate, errorKind: 'template_render_failed' },
      ];
    }
    case 'branch': {
      return [{ field: 'expression', source: config.expression, errorKind: 'expression_evaluation_failed' }];
    }
    case 'loop': {
      return [
        { field: 'continueExpression', source: config.continueExpression, errorKind: 'expression_evaluation_failed' },
      ];
    }
    case 'start':
    case 'error_handler':
    case 'sub_workflow': {
      return [];
    }
  }
}

/**
 * A futás indítási ellenőrzése a sablon és a kifejezés mezőkre (SPEC-010
 * 9.2): minden sablon mező lefordítható a `templateRenderer.compile`, minden
 * kifejezés mező az `expressionEvaluator.compile` hívással, különben
 * `template_render_failed`, illetve `expression_evaluation_failed` hiba.
 *
 * A SPEC-004 4.8 3. lépésében fut, a `validateRun` után, tehát egyetlen
 * adatbázis sort sem ír. Az első hibánál megáll, ugyanazzal az indokkal, mint
 * a `validateRun`. Az üzenet megnevezi a csomópontot és a mezőt, és a port
 * hibaleírását adja tovább; a mező szövegét nem idézi (SPEC-010 9.5).
 */
export function validateLanguageFields(
  configsById: ReadonlyMap<string, ExecutableNodeConfig>,
  ports: LanguageCompilePorts,
): Outcome<void> {
  for (const [nodeId, config] of configsById) {
    for (const { field, source, errorKind } of languageFieldsOf(config)) {
      const compiled =
        errorKind === 'template_render_failed'
          ? ports.templateRenderer.compile(source)
          : ports.expressionEvaluator.compile(source);
      if (compiled.kind === 'error') {
        return {
          kind: 'error',
          message: formatEngineErrorMessage(
            errorKind,
            `A(z) ${nodeId} csomópont ${field} mezője nem fordítható le: ${compiled.message}`,
          ),
        };
      }
    }
  }
  return { kind: 'ok', value: undefined };
}
