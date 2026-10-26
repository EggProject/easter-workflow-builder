import { Environment } from '@marcbachmann/cel-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCelEnvironment } from './create-cel-environment.ts';

// A teszt a valódi `@marcbachmann/cel-js@8.0.0` könyvtáron fut, mock nélkül. Az
// összevetés alapja egy opció nélkül épített, semmit nem regisztráló környezet:
// ami attól eltér, azt a mi gyártó függvényünk adta hozzá (SPEC-010 16. szekció 17.).

describe('createCelEnvironment (SPEC-010 7.1)', () => {
  const environment = createCelEnvironment();
  const baseline = new Environment();

  it('a beépítetteken felül pontosan a hét RunContext nevet deklarálja, mind dyn típussal', () => {
    const baselineNames = new Set(baseline.getDefinitions().variables.map((variable) => variable.name));
    const added = environment.getDefinitions().variables.filter((variable) => !baselineNames.has(variable.name));
    expect(added.map((variable) => [variable.name, variable.type])).toStrictEqual([
      ['input', 'dyn'],
      ['steps', 'dyn'],
      ['item', 'dyn'],
      ['itemIndex', 'dyn'],
      ['iteration', 'dyn'],
      ['joinInputs', 'dyn'],
      ['error', 'dyn'],
    ]);
  });

  it('a beépített változók és típusok változatlanok', () => {
    const baselineVariables = baseline.getDefinitions().variables;
    expect(environment.getDefinitions().variables.slice(0, baselineVariables.length)).toStrictEqual(baselineVariables);
  });

  it('saját függvényt és operátort nem regisztrál', () => {
    expect(environment.getDefinitions().functions).toStrictEqual(baseline.getDefinitions().functions);
  });

  describe('a regisztráló hívások (SPEC-010 16. szekció 17.)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    // A definíciós lista egy saját típus regisztrációját nem mutatja, ezért a hívásokat a
    // prototípuson figyeljük: a gyártó függvény csak a hét változót regisztrálhatja.
    it('saját típust, függvényt, operátort és konstanst nem regisztrál, csak a hét változót', () => {
      const registerType = vi.spyOn(Environment.prototype, 'registerType');
      const registerFunction = vi.spyOn(Environment.prototype, 'registerFunction');
      const registerOperator = vi.spyOn(Environment.prototype, 'registerOperator');
      const registerConstant = vi.spyOn(Environment.prototype, 'registerConstant');
      const registerVariable = vi.spyOn(Environment.prototype, 'registerVariable');
      createCelEnvironment();
      expect(registerType).not.toHaveBeenCalled();
      expect(registerFunction).not.toHaveBeenCalled();
      expect(registerOperator).not.toHaveBeenCalled();
      expect(registerConstant).not.toHaveBeenCalled();
      expect(registerVariable).toHaveBeenCalledTimes(7);
    });
  });

  it('minden opció, a limits is, a csomag alapértékén marad', () => {
    expect(environment.opts).toStrictEqual(baseline.opts);
    expect(environment.opts.unlistedVariablesAreDyn).toBe(false);
  });
});
