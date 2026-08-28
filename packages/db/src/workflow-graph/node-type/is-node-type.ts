import { isString } from '@easter-workflow-builder/typeguards';
import type { NodeType } from './node-type.ts';

/**
 * A tíz ág kulcsonként. A `Record<NodeType, true>` annotáció miatt a fordító
 * hibát ad, ha a `NodeType` unió bővül, de ez a lista nem: a guard így nem tud
 * csendben lemaradni egy típusról.
 */
const NODE_TYPE_KEYS: Readonly<Record<NodeType, true>> = {
  start: true,
  agent_step: true,
  branch: true,
  fan_out: true,
  join: true,
  loop: true,
  human_approval: true,
  error_handler: true,
  sub_workflow: true,
  script: true,
};

/**
A tíz `NodeType` érték egyike-e a bemenet (SPEC-003 9.4 szekció).
*/
export function isNodeType(value: unknown): value is NodeType {
  return isString(value) && Object.hasOwn(NODE_TYPE_KEYS, value);
}
