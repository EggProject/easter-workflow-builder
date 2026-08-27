// Barrel: csak újraexport, a csomag publikus felülete a kép forrásának feloldása base64 data
// URL alakra.

export type { ImageMediaType } from './media-type/image-media-type.ts';
export { mediaTypeFromContentType } from './media-type/media-type-from-content-type.ts';
export { mediaTypeFromExtension } from './media-type/media-type-from-extension.ts';
export type { ReadFileFunction } from './data-url/read-file-function.ts';
export { resolveImageDataUrl } from './data-url/resolve-image-data-url.ts';

// A `resolveImageDataUrl` paraméterei között megjelenő idegen típus, a SPEC-002 6.6 pont 7.
// szabálya szerint.
export type { FetchFunction } from '@easter-workflow-builder/http-client';
