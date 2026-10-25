import { Environment } from '@marcbachmann/cel-js';
import { RUN_CONTEXT_VARIABLE_NAMES } from './run-context-variable-names.ts';

/**
 * A SPEC-010 7.1 szerinti CEL környezet: opció nélkül épül, tehát a
 * `unlistedVariablesAreDyn`, a `homogeneousAggregateLiterals`, az
 * `enableOptionalTypes` és a `limits` a csomag dokumentált alapértékén marad
 * (M-125, M-126). Pontosan a hét `RunContext` név deklarált, mind `dyn`
 * típussal, mert a futás adatának szerkezete futásidőben ismeretlen (M-105).
 * Saját függvény, operátor és típus nincs regisztrálva.
 */
export function createCelEnvironment(): Environment {
  const environment = new Environment();
  for (const name of RUN_CONTEXT_VARIABLE_NAMES) {
    environment.registerVariable(name, 'dyn');
  }
  return environment;
}
