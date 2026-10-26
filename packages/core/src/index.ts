// Barrel: csak nevesített újraexport. A csomag három tárgykörre tagolódik, a `src/` alatti
// tárgykör mappák szerint: `result`, `env-reader`, `http-client`.

// result: a kétállapotú eredménytípus és a rá szűkítő typeguard.
export type { Outcome } from './result/outcome/outcome.ts';
export type { OutcomeWithErrorType } from './result/outcome/outcome-with-error-type.ts';
export { isOkOutcome } from './result/outcome/is-ok-outcome.ts';

// env-reader: a környezeti változó olvasó típusa.
export type { EnvironmentReader } from './env-reader/environment-reader/environment-reader.ts';

// http-client: a befecskendezhető `fetch` típusa és a hibaleírók.
export type { FetchFunction } from './http-client/request/fetch-function.ts';
export { describeError } from './http-client/error-description/describe-error.ts';
export { describeErrorType } from './http-client/error-description/describe-error-type.ts';
