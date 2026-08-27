import { describe, expect, it } from 'vitest';
import type { NodeType } from './node-type.ts';
import { isNodeType } from './is-node-type.ts';

// A SPEC-003 4.3 táblázatának mind a tíz értéke, a táblázat sorrendjében. A
// `NodeType[]` annotáció fordítási idejű állítás is: ha az unió bővül vagy
// szűkül, ez a lista nem maradhat érintetlenül.
const allNodeTypes: readonly NodeType[] = [
  'start',
  'agent_step',
  'branch',
  'fan_out',
  'join',
  'loop',
  'human_approval',
  'error_handler',
  'sub_workflow',
  'script',
];

describe('isNodeType', () => {
  it('a tíz ág mindegyikére igazat ad', () => {
    expect(allNodeTypes.every((nodeType) => isNodeType(nodeType))).toBe(true);
    expect(allNodeTypes).toHaveLength(10);
  });

  it('hamisat ad ismeretlen szövegre', () => {
    expect(isNodeType('prompt')).toBe(false);
    expect(isNodeType('')).toBe(false);
    // A `Record` alapú keresés nem eshet át a prototípus láncra.
    expect(isNodeType('toString')).toBe(false);
    expect(isNodeType('constructor')).toBe(false);
  });

  it('hamisat ad nem szöveg bemenetre', () => {
    expect(isNodeType(undefined)).toBe(false);
    expect(isNodeType(7)).toBe(false);
    expect(isNodeType({ type: 'start' })).toBe(false);
    expect(isNodeType(['start'])).toBe(false);
  });
});
