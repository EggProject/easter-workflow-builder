import { describe, expect, expectTypeOf, it } from 'vitest';
import { isCelAstNode, type CelAstNode } from './is-cel-ast-node.ts';

describe('isCelAstNode', () => {
  it('a csomópont alakra igaz, és CelAstNode típusra szűkít', () => {
    const value: unknown = { op: 'id', args: 'input', start: 0, end: 5 };
    expect(isCelAstNode(value)).toBe(true);
    if (isCelAstNode(value)) {
      expectTypeOf(value).toEqualTypeOf<CelAstNode>();
    }
  });

  it.each([
    ['nem objektum', 'id'],
    ['op nélkül', { args: 'x', start: 0 }],
    ['nem szöveg op', { op: 1, args: 'x', start: 0 }],
    ['args nélkül', { op: 'id', start: 0 }],
    ['nem egész start', { op: 'id', args: 'x', start: '0' }],
  ])('%s értékre hamis', (_name, value) => {
    expect(isCelAstNode(value)).toBe(false);
  });
});
