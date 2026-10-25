import { describe, expect, it } from 'vitest';
import { createCelEnvironment } from './create-cel-environment.ts';
import { rejectOptionalNamespace } from './reject-optional-namespace.ts';

const environment = createCelEnvironment();

function verdictOf(expression: string): ReturnType<typeof rejectOptionalNamespace> {
  return rejectOptionalNamespace(environment.parse(expression).ast);
}

const SENTENCE = 'az optional névtér nem használható, mert az opcionális típusok ki vannak kapcsolva';

describe('rejectOptionalNamespace (SPEC-010 7.2, O-23)', () => {
  it.each([
    ['optional.of(1)', 0],
    ['optional.none()', 0],
    ['optional', 0],
    ['input.a + optional.of(1).value()', 10],
    ['[1].map(x, optional.of(x))', 11],
    ['has(optional.x)', 4],
    ['cel.bind(v, optional.none(), v)', 12],
    ['[1].map(x, x).map(optional, optional + 1).filter(y, optional.of(y))', 52],
  ])('REGRESSZIÓ: a(z) %s kifejezést elutasítja, a pozícióval', (expression, position) => {
    expect(verdictOf(expression)).toStrictEqual({
      kind: 'error',
      message: `${SENTENCE} (pozíció: ${String(position)})`,
    });
  });

  it.each([
    'input.optional',
    '"optional"',
    "input['optional']",
    '[1].map(optional, optional + 1)',
    '[1].exists(optional, optional > 0)',
    'cel.bind(optional, 1, optional + 1)',
    'input.x.startsWith("a")',
    '{"a": [1, 2]}',
    '-input.n',
  ])('a(z) %s kifejezést átengedi', (expression) => {
    expect(verdictOf(expression)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('a nem AST alakú bemenetet és a rendhagyó metódushívást a gyerek csomópontok szerint vizsgálja', () => {
    const id = { op: 'id', args: 'optional', start: 3 };
    expect(rejectOptionalNamespace(undefined)).toStrictEqual({ kind: 'ok', value: undefined });
    expect(rejectOptionalNamespace({ op: 'rcall', args: 'nem lista', start: 0 })).toStrictEqual({
      kind: 'ok',
      value: undefined,
    });
    expect(rejectOptionalNamespace({ op: 'rcall', args: [1, id, []], start: 0 })).toStrictEqual({
      kind: 'error',
      message: `${SENTENCE} (pozíció: 3)`,
    });
    expect(rejectOptionalNamespace({ op: 'rcall', args: ['map', id, 'nem lista'], start: 0 })).toStrictEqual({
      kind: 'error',
      message: `${SENTENCE} (pozíció: 3)`,
    });
    expect(
      rejectOptionalNamespace({
        op: 'rcall',
        args: ['map', { op: 'id', args: 'xs', start: 0 }, [{ op: 'id', args: 1, start: 1 }, id]],
        start: 0,
      }),
    ).toStrictEqual({ kind: 'error', message: `${SENTENCE} (pozíció: 3)` });
  });
});
