// Barrel: csak nevesített újraexport. A csomag egyetlen témája ma a
// `query-runner`: a motorba befecskendezett futtató port típusai és a valódi
// Agent SDK `query()` függvényét paraméterként fogadó adapter (SPEC-004 3.3).

// A port szerződése, amit a motor (L5) importál.
export type { AgentQueryRequest } from './query-runner/agent-query-request.ts';
export type { AgentQuery } from './query-runner/agent-query.ts';
export type { AgentQueryRunner } from './query-runner/agent-query-runner.ts';

// Az adapter és a befecskendezett SDK függvény alakja, amit az összeállítás
// (`apps/server`, L6) használ.
export type { SdkQueryHandle } from './query-runner/sdk-query-handle.ts';
export type { SdkQueryFunction } from './query-runner/sdk-query-function.ts';
export { createAgentQueryRunner } from './query-runner/create-agent-query-runner.ts';
