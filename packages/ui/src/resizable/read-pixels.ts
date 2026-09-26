/**
 * Egy kiszámított CSS hosszúság (`getComputedStyle`, például `min-height`
 * vagy `border-top-width`) pixel értéke. Hosszúságra a kiszámított érték
 * mindig `px` végű; minden más (`auto`, vagy a happy-dom üres értéke) nulla.
 */
export function readPixels(value: string): number {
  return value.endsWith('px') ? Number(value.slice(0, -'px'.length)) : 0;
}
