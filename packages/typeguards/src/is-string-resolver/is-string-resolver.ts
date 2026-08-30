import { isFunction } from '../is-function/is-function.ts';
import { isConstructor } from '../is-constructor/is-constructor.ts';
import { isString } from '../is-string/is-string.ts';
import type { StringResolver } from './string-resolver.ts';

/**
 * Type guard that checks if a value is a StringResolver.
 * A StringResolver is either a string or a function (but not a constructor) that returns a string.
 *
 * @param value - The value to check
 * @returns `true` if the value is a string or a function (excluding constructors), `false` otherwise
 */
export function isStringResolver<T>(value?: unknown): value is StringResolver<T> {
  return isString(value) || (isFunction(value) && !isConstructor(value));
}
