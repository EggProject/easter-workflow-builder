import { describe, expect, it } from 'vitest';
import { createGraphNode } from './create-graph-node.ts';
import { createInitialNodeConfig } from './create-initial-node-config.ts';
import type { GraphElementIdGenerator } from './graph-element-id-generator.ts';

function sequentialIdGenerator(): GraphElementIdGenerator {
  let counter = 0;
  return () => {
    counter += 1;
    return `id-${String(counter)}`;
  };
}

describe('createGraphNode', () => {
  it('az azonosítót a porton át kapja, a pozíciót a bal felső sarokként írja, a címke üres', () => {
    const node = createGraphNode('script', { x: 12.5, y: -40 }, () => 'generated-id');
    expect(node).toEqual({
      id: 'generated-id',
      type: 'script',
      label: '',
      positionX: 12.5,
      positionY: -40,
      config: createInitialNodeConfig('script'),
    });
  });

  it('a config a kért típus kezdő configja', () => {
    expect(createGraphNode('join', { x: 0, y: 0 }, () => 'a').config).toEqual(createInitialNodeConfig('join'));
  });

  it('hívásonként egy azonosítót fogyaszt, egymás után különbözőt kap', () => {
    const generateId = sequentialIdGenerator();
    const first = createGraphNode('loop', { x: 0, y: 0 }, generateId);
    const second = createGraphNode('loop', { x: 0, y: 0 }, generateId);
    expect([first.id, second.id]).toEqual(['id-1', 'id-2']);
  });
});
