import type { WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import type { AddableNodeType } from './addable-node-type.ts';
import { createInitialNodeConfig } from './create-initial-node-config.ts';
import type { GraphElementIdGenerator } from './graph-element-id-generator.ts';

/**
 * Az új csomópont (SPEC-008 5.8): a felvétel mindkét útja ezt hívja, a kettő
 * csak a pozíció számításában különbözik. Az azonosító a befecskendezett
 * porton át jön, a `label` üres, a `config` a típus szerinti kezdő alak. A
 * `position` a kártya bal felső sarka (a `nodeOrigin` alapértéke szerint).
 */
export function createGraphNode(
  type: AddableNodeType,
  position: Readonly<{ x: number; y: number }>,
  generateId: GraphElementIdGenerator,
): WorkflowNodeInput {
  return {
    id: generateId(),
    type,
    label: '',
    positionX: position.x,
    positionY: position.y,
    config: createInitialNodeConfig(type),
  };
}
