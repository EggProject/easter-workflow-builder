/**
 * A MiniMax képértelmező által dokumentáltan támogatott képformátumok. Más
 * formátumot nem próbálunk meg becsempészni: a referencia implementáció
 * ismeretlen kiterjesztés esetén JPEG-nek hazudta a tartalmat, ami néma hibához
 * vezet.
 */
export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp';
