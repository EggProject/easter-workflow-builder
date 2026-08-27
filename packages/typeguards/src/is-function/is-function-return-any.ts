/**
 * Type guard that checks if a value is a function with an `any` return type.
 * This is similar to `isFunction` but explicitly types the return value as `any`.
 *
 * @param obj - The value to check
 * @returns `true` if the value is a function, `false` otherwise
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isFunctionReturnAny(object: unknown): object is (...arguments_: any) => any {
  return typeof object === 'function';
}
