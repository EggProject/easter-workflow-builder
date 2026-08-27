// Barrel: csak újraexport, a csomag publikus felülete a MiniMax HTTP kliens.

export type { MiniMaxConfig } from './minimax-config/minimax-config.ts';
export { resolveMiniMaxConfig } from './minimax-config/resolve-minimax-config.ts';
export {
  ENV_MINIMAX_API_KEY,
  ENV_MINIMAX_BASE_URL,
  ENV_MINIMAX_TIMEOUT_MS,
} from './minimax-config/environment-variable-name.ts';

export { callMiniMax } from './call-minimax/call-minimax.ts';
export { PATH_SEARCH, PATH_VLM } from './call-minimax/endpoint-path.ts';

export { isSearchResponse } from './search/is-search-response.ts';
export { formatSearchResponse } from './search/format-search-response.ts';

export { isVlmResponse } from './vlm/is-vlm-response.ts';

// A `resolveMiniMaxConfig` és a `callMiniMax` szignatúrájában megjelenő idegen típusok, a
// SPEC-002 6.6 pont 7. szabálya szerint.
export type { EnvironmentReader } from '@easter-workflow-builder/env-reader';
export type { FetchFunction } from '@easter-workflow-builder/http-client';
