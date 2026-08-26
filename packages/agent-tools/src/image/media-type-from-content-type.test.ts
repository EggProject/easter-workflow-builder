import { describe, expect, it } from 'vitest';
import { mediaTypeFromContentType } from './media-type-from-content-type.ts';

describe('mediaTypeFromContentType', () => {
  it('felismeri a támogatott típusokat', () => {
    expect(mediaTypeFromContentType('image/png')).toBe('image/png');
    expect(mediaTypeFromContentType('IMAGE/WEBP')).toBe('image/webp');
    expect(mediaTypeFromContentType('image/jpeg; charset=binary')).toBe('image/jpeg');
    expect(mediaTypeFromContentType('image/jpg')).toBe('image/jpeg');
  });

  it('ismeretlen vagy hiányzó típusra nem tippel', () => {
    expect(mediaTypeFromContentType('text/html')).toBeUndefined();
    expect(mediaTypeFromContentType('')).toBeUndefined();
  });
});
