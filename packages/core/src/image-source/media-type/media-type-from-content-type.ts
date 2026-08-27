import type { ImageMediaType } from './image-media-type.ts';

/**
 * Képformátum meghatározása a szerver által küldött `content-type` fejlécből.
 * Ismeretlen vagy hiányzó fejlécre `undefined`.
 */
export function mediaTypeFromContentType(contentType: string): ImageMediaType | undefined {
  const lowerCaseContentType = contentType.toLowerCase();
  if (lowerCaseContentType.includes('image/png')) {
    return 'image/png';
  }
  if (lowerCaseContentType.includes('image/webp')) {
    return 'image/webp';
  }
  if (lowerCaseContentType.includes('image/jpeg') || lowerCaseContentType.includes('image/jpg')) {
    return 'image/jpeg';
  }
  return undefined;
}
