import { isFunction } from '../is-function/is-function.ts';
import type { Constructor } from './constructor.ts';
import { isNil } from '../is-nil/is-nil.ts';

/**
 * Type guard that checks if a value is a class constructor.
 * Distinguishes between regular functions and ES6 class constructors.
 *
 * @param value - The value to check
 * @returns `true` if the value is a class constructor, `false` otherwise
 */
export function isConstructor<T>(value?: unknown): value is Constructor<T> {
  if (!isFunction(value)) {
    return false;
  }

  const functionWithPrototype: { prototype?: { constructor: unknown } } = value;
  if (isNil(functionWithPrototype.prototype) || functionWithPrototype.prototype.constructor !== value) {
    return false;
  }

  // Check if it's a class constructor by examining its string representation
  // Class constructors start with "class" when converted to string
  return /^\s*class\s+/.test(Function.prototype.toString.call(value));
}
