import type { ImageMediaType } from './image-media-type.ts';

/**
 * Képformátum meghatározása fájlnév kiterjesztésből. Ismeretlen kiterjesztésre
 * `undefined`, hogy a hívó értelmes hibát adhasson vissza az agentnek.
 */
export function mediaTypeFromExtension(filePath: string): ImageMediaType | undefined {
  const lowerCasePath = filePath.toLowerCase();
  if (lowerCasePath.endsWith('.png')) {
    return 'image/png';
  }
  if (lowerCasePath.endsWith('.webp')) {
    return 'image/webp';
  }
  if (lowerCasePath.endsWith('.jpg') || lowerCasePath.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  return undefined;
}
