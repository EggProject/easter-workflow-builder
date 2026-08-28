import { describe, expect, it } from 'vitest';
import type { BranchContext, BranchScope } from '../branch-scope/branch-scope.ts';
import type { ExecutedStepInstance } from './executed-step-instance.ts';
import { findVisibleStepInstance } from './find-visible-step-instance.ts';

function fanOut(stepRunId: string, itemIndex: number): BranchScope {
  return { kind: 'fan_out', stepRunId, itemIndex };
}

function loop(stepRunId: string, iteration: number): BranchScope {
  return { kind: 'loop', stepRunId, iteration };
}

function instance(nodeId: string, branchContext: BranchContext, output: unknown): ExecutedStepInstance {
  return { nodeId, branchContext, output };
}

const ROOT: BranchContext = [];

describe('findVisibleStepInstance', () => {
  it('a gyökér kontextusban futott példányt megtalálja', () => {
    const instances = [instance('a', ROOT, 'a kimenete')];

    expect(findVisibleStepInstance(instances, 'a', ROOT)?.output).toBe('a kimenete');
  });

  it('más node példányát nem adja vissza', () => {
    const instances = [instance('a', ROOT, 'a kimenete')];

    expect(findVisibleStepInstance(instances, 'b', ROOT)).toBeUndefined();
  });

  it('a külső kontextusban futott példány látszik a belsőből', () => {
    const instances = [instance('f', ROOT, ['x', 'y'])];

    expect(findVisibleStepInstance(instances, 'f', [fanOut('sr-f', 1)])?.output).toStrictEqual(['x', 'y']);
  });

  it('a mélyebb kontextusban futott példány nem látszik a külsőből', () => {
    const instances = [instance('a', [fanOut('sr-f', 0)], 'belső kimenet')];

    expect(findVisibleStepInstance(instances, 'a', ROOT)).toBeUndefined();
  });

  it('a fan-out testvér ág példánya nem látszik, mert más az itemIndex', () => {
    const instances = [instance('a', [fanOut('sr-f', 0)], 'nulladik elem')];

    expect(findVisibleStepInstance(instances, 'a', [fanOut('sr-f', 1)])).toBeUndefined();
  });

  it('azonos itemIndex mellett is elválaszt a hatókört nyitó lépés futásának azonosítója', () => {
    const instances = [instance('a', [fanOut('sr-f1', 2)], 'az első fan_out ága')];

    expect(findVisibleStepInstance(instances, 'a', [fanOut('sr-f2', 2)])).toBeUndefined();
  });

  it('a másik iterációban futott példány nem látszik', () => {
    const instances = [instance('torzs', [loop('sr-l0', 0)], 'nulladik iteráció')];

    expect(findVisibleStepInstance(instances, 'torzs', [loop('sr-l1', 1)])).toBeUndefined();
  });

  it('az azonos verem pozíción álló, eltérő fajtájú keret nem előtag', () => {
    const instances = [instance('a', [loop('sr', 0)], 'ciklusból')];

    expect(findVisibleStepInstance(instances, 'a', [fanOut('sr', 0)])).toBeUndefined();
  });

  it('több iteráció közül a jelenlegihez tartozót adja', () => {
    const instances = [
      instance('torzs', [loop('sr-l0', 0)], 'nulladik'),
      instance('torzs', [loop('sr-l1', 1)], 'első'),
    ];

    expect(findVisibleStepInstance(instances, 'torzs', [loop('sr-l1', 1)])?.output).toBe('első');
  });

  it('azonos ág kontextusú újrapróbálkozásoknál a legutóbbi lefutás nyer', () => {
    const instances = [
      instance('a', ROOT, 'első kísérlet'),
      instance('a', ROOT, 'második kísérlet'),
      instance('a', ROOT, 'harmadik kísérlet'),
    ];

    expect(findVisibleStepInstance(instances, 'a', ROOT)?.output).toBe('harmadik kísérlet');
  });

  it('a leghosszabb előtaggal rendelkező példány nyer, a lista sorrendjétől függetlenül', () => {
    const current: BranchContext = [fanOut('sr-f', 0)];
    const mely = [instance('a', [fanOut('sr-f', 0)], 'a fan-out ágból'), instance('a', ROOT, 'a gyökérből')];
    const sekely = [instance('a', ROOT, 'a gyökérből'), instance('a', [fanOut('sr-f', 0)], 'a fan-out ágból')];

    expect(findVisibleStepInstance(mely, 'a', current)?.output).toBe('a fan-out ágból');
    expect(findVisibleStepInstance(sekely, 'a', current)?.output).toBe('a fan-out ágból');
  });
});
