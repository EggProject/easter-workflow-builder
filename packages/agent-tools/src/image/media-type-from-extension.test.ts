import { describe, expect, it } from 'vitest';
import { mediaTypeFromExtension } from './media-type-from-extension.ts';

describe('mediaTypeFromExtension', () => {
  it('felismeri a támogatott kiterjesztéseket, kis és nagybetűvel is', () => {
    expect(mediaTypeFromExtension('/adat/a.png')).toBe('image/png');
    expect(mediaTypeFromExtension('/adat/a.WEBP')).toBe('image/webp');
    expect(mediaTypeFromExtension('/adat/a.jpg')).toBe('image/jpeg');
    expect(mediaTypeFromExtension('/adat/a.jpeg')).toBe('image/jpeg');
  });

  it('ismeretlen kiterjesztésre nem tippel', () => {
    expect(mediaTypeFromExtension('/adat/a.gif')).toBeUndefined();
  });
});
