import type { CelExpressionEvaluator } from './cel-expression-evaluator.ts';
import { createCelEnvironment } from './create-cel-environment.ts';
import { describeCelError } from './describe-cel-error.ts';
import { normalizeCelResult } from './normalize-cel-result.ts';
import { toCelContext } from './to-cel-context.ts';

/**
 * A CEL kifejezés kiértékelő gyártó függvénye (SPEC-010 7.). Egyetlen, a 7.1
 * szerinti környezetet épít. A `compile` a 7.2 szerint előbb `parse`, majd
 * `check`: a szintaktikai hibát és a szerkezeti korlát túllépését a `parse`
 * kivétele, a nem deklarált változót az `env.check` `valid: false` eredménye
 * adja (research 2. szekció (2)). Az `evaluate` a 7.3 szerint leképezett
 * kontextuson értékel ki, és az eredményt a 7.4 szerint normalizálja. Kivétel
 * egyik műveletből sem hagyja el a függvényt: a túl mély vagy körkörös adat
 * normalizálásának veremtúlcsordulása is a közös hibaleírást kapja.
 */
export function createCelExpressionEvaluator(): CelExpressionEvaluator {
  const environment = createCelEnvironment();
  return {
    compile(expression) {
      try {
        environment.parse(expression);
      } catch (error) {
        return { kind: 'error', message: describeCelError(error) };
      }
      const checked = environment.check(expression);
      return checked.valid
        ? { kind: 'ok', value: undefined }
        : { kind: 'error', message: describeCelError(checked.error) };
    },
    evaluate(expression, context) {
      try {
        const result: unknown = environment.evaluate(expression, toCelContext(context));
        return normalizeCelResult(result);
      } catch (error) {
        return { kind: 'error', message: describeCelError(error) };
      }
    },
  };
}
