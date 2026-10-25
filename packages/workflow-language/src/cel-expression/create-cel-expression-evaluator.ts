import type { CelExpressionEvaluator } from './cel-expression-evaluator.ts';
import { createCelEnvironment } from './create-cel-environment.ts';
import { describeCelError } from './describe-cel-error.ts';
import { normalizeCelResult } from './normalize-cel-result.ts';
import { rejectOptionalNamespace } from './reject-optional-namespace.ts';
import { toCelContext } from './to-cel-context.ts';

/**
 * A CEL kifejezés kiértékelő gyártó függvénye (SPEC-010 7.). Egyetlen, a 7.1
 * szerinti környezetet épít. A `compile` a 7.2 szerint előbb `parse`, majd
 * `check`, végül a saját `optional` ellenőrzés: a szintaktikai hibát és a
 * szerkezeti korlát túllépését a `parse` kivétele, a nem deklarált változót az
 * `env.check` `valid: false` eredménye adja (research 2. szekció (2)); az
 * `optional` névtér azonosítóját a `check` átengedi (deklarált konstans, ami a
 * kikapcsolt opcionális típusok mellett értéket nem kap), ezért azt a
 * `rejectOptionalNamespace` utasítja el (O-23). Az `evaluate` a 7.3 szerint leképezett
 * kontextuson értékel ki, és az eredményt a 7.4 szerint normalizálja. Kivétel
 * egyik műveletből sem hagyja el a függvényt: a túl mély vagy körkörös adat
 * normalizálásának veremtúlcsordulása is a közös hibaleírást kapja.
 */
export function createCelExpressionEvaluator(): CelExpressionEvaluator {
  const environment = createCelEnvironment();
  return {
    compile(expression) {
      let ast: unknown;
      try {
        ast = environment.parse(expression).ast;
      } catch (error) {
        return describeCelError(error);
      }
      const checked = environment.check(expression);
      return checked.valid ? rejectOptionalNamespace(ast) : describeCelError(checked.error);
    },
    evaluate(expression, context) {
      try {
        const result: unknown = environment.evaluate(expression, toCelContext(context));
        return normalizeCelResult(result);
      } catch (error) {
        return describeCelError(error);
      }
    },
  };
}
