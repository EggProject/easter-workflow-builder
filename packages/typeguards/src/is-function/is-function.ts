/**
 * Type guard that checks if a value is a function.
 * This includes regular functions, arrow functions, async functions, and class constructors.
 *
 * @param obj - The value to check
 * @returns `true` if the value is a function, `false` otherwise
 */
export function isFunction<T>(object: T): object is Extract<T, (...arguments_: never[]) => unknown> {
  return typeof object === 'function';
}
