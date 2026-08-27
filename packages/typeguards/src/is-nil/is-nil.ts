/**
 * Type guard that checks if a value is null or undefined (nil).
 *
 * @param value - The value to check
 * @returns `true` if the value is null or undefined, `false` otherwise
 */
export function isNil(value?: unknown): value is null | undefined {
  return value === null || value === undefined;
}
