/**
 * Type guard that checks if a value is an integer number.
 * An integer is a whole number without a fractional part.
 *
 * @param n - The value to check
 * @returns `true` if the value is an integer, `false` otherwise
 */
export function isInt(n?: unknown): n is number {
  // Nem Number.isSafeInteger(): az szűkítené a viselkedést a +/-2^53-1
  // tartományra, ami eltérne a dokumentált szerződéstől ("egész szám
  // törtrész nélkül" - lásd fent), és az is-int.spec.ts kifejezetten elvárja,
  // hogy a Number.MAX_SAFE_INTEGER/MIN_SAFE_INTEGER is igazat adjon.
  // eslint-disable-next-line unicorn/prefer-number-is-safe-integer
  return Number(n) === n && Number.isFinite(n) && n % 1 === 0;
}
