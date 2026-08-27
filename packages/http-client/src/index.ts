// Barrel: csak újraexport, a csomag publikus felülete a beépített `fetch` fölötti vékony
// HTTP réteg.

export type { FetchFunction } from './request/fetch-function.ts';
export type { BinaryPayload } from './request/binary-payload.ts';
export { postJson } from './request/post-json.ts';
export type { PostJsonRequest } from './request/post-json.ts';
export { getBinary } from './request/get-binary.ts';
export { describeError } from './error-description/describe-error.ts';
