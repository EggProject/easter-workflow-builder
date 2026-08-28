// Barrel: csak nevesített újraexport. A csomag három témája: a `query-runner`
// (a motorba befecskendezett futtató port típusai és a valódi Agent SDK
// `query()` függvényét paraméterként fogadó adapter), az `sdk-message-shape`
// (a `messages: AsyncIterable<unknown>` folyamból a motor által ténylegesen
// kiolvasott mezők typeguardjai), SPEC-004 3.3, és az `sdk-version` (a
// telepített SDK verzió egyetlen, gépileg őrzött forrása).

// A port szerződése, amit a motor (L5) importál.
export type { AgentQueryRequest } from './query-runner/agent-query-request.ts';
export type { AgentQuery } from './query-runner/agent-query.ts';
export type { AgentQueryRunner } from './query-runner/agent-query-runner.ts';

// Az adapter és a befecskendezett SDK függvény alakja, amit az összeállítás
// (`apps/server`, L6) használ.
export type { SdkQueryHandle } from './query-runner/sdk-query-handle.ts';
export type { SdkQueryFunction } from './query-runner/sdk-query-function.ts';
export { createAgentQueryRunner } from './query-runner/create-agent-query-runner.ts';

// A `system` `init` üzenet alakja, amiből a motor a `session_id`-t olvassa.
export type { SdkSystemInitMessage } from './sdk-message-shape/sdk-system-init-message.ts';
export { isSdkSystemInitMessage } from './sdk-message-shape/is-sdk-system-init-message.ts';

// A `result` üzenet `subtype` értékkészlete és alakja, plusz a strukturált
// kimenet jelenlétét eldöntő segédfüggvény.
export type { SdkResultSubtype } from './sdk-message-shape/sdk-result-subtype.ts';
export { isSdkResultSubtype } from './sdk-message-shape/is-sdk-result-subtype.ts';
export type { SdkResultMessage } from './sdk-message-shape/sdk-result-message.ts';
export { isSdkResultMessage } from './sdk-message-shape/is-sdk-result-message.ts';
export { hasStructuredOutput } from './sdk-message-shape/has-structured-output.ts';

// A telepített Agent SDK verzió, amit az összeállítás a motornak átad
// (SPEC-004 11.3 táblázat 17. sora, SPEC-003 5.1 `sdkVersionPin`).
export { INSTALLED_AGENT_SDK_VERSION } from './sdk-version/installed-agent-sdk-version.ts';
