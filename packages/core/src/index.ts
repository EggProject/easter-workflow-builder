// Barrel: csak nevesített újraexport. A csomag négy tárgykörre tagolódik, a `src/` alatti
// tárgykör mappák szerint: `result`, `env-reader`, `http-client`, `image-source`.

// result: a kétállapotú eredménytípus és a rá szűkítő typeguard.
export type { Outcome } from './result/outcome/outcome.ts';
export { isOkOutcome } from './result/outcome/is-ok-outcome.ts';

// env-reader: típusos környezeti változó olvasás.
export type { EnvironmentReader } from './env-reader/environment-reader/environment-reader.ts';
export { readBaseUrl } from './env-reader/environment-reader/read-base-url.ts';
export { readTimeoutMs } from './env-reader/environment-reader/read-timeout-ms.ts';

// http-client: vékony réteg a beépített `fetch` fölött.
export type { FetchFunction } from './http-client/request/fetch-function.ts';
export type { BinaryPayload } from './http-client/request/binary-payload.ts';
export { postJson } from './http-client/request/post-json.ts';
export type { PostJsonRequest } from './http-client/request/post-json.ts';
export { getBinary } from './http-client/request/get-binary.ts';
export { describeError } from './http-client/error-description/describe-error.ts';

// image-source: kép feloldása base64 data URL alakra.
export type { ImageMediaType } from './image-source/media-type/image-media-type.ts';
export { mediaTypeFromContentType } from './image-source/media-type/media-type-from-content-type.ts';
export { mediaTypeFromExtension } from './image-source/media-type/media-type-from-extension.ts';
export type { ReadFileFunction } from './image-source/data-url/read-file-function.ts';
export { resolveImageDataUrl } from './image-source/data-url/resolve-image-data-url.ts';
