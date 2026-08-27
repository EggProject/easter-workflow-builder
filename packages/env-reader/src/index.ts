// Barrel: csak újraexport, a csomag publikus felülete a típusos környezeti változó olvasás.

export type { EnvironmentReader } from './environment-reader/environment-reader.ts';
export { readBaseUrl } from './environment-reader/read-base-url.ts';
export { readTimeoutMs } from './environment-reader/read-timeout-ms.ts';
