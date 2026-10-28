import { describe, expect, it } from 'vitest';
import {
  DOC_7MINAI_MINIMAX_M31_FLASH,
  DOC_CLAUDE_CODE_TOOLS_ALT_PROVIDERS,
  DOC_CLOUDFLARE_MINIMAX_M31_FLASH,
  DOC_DIGITALAPPLIED_MINIMAX_FLASH_CLAUDE_CODE,
  DOC_ENV_VARS,
  DOC_FOUNDERMAG_MINIMAX_M31_FLASH,
  DOC_MINIMAX_ANTHROPIC_API,
  DOC_MINIMAX_CHAT_OPENAI,
  DOC_MINIMAX_CLAUDE_CODE_M_PLAN,
  DOC_MINIMAX_CLAUDE_CODE_TOKEN_PLAN,
  DOC_MINIMAX_OPENAI_API,
  DOC_MINIMAX_TEXT_GENERATION,
  DOC_TYPINGMIND_MINIMAX_M31_FLASH,
  DOC_WOKEY_MINIMAX_M31_FLASH,
  RESEARCH_GATEWAY,
  RESEARCH_MINIMAX_FLASH,
  type EvidenceReference,
  type Fact,
} from '@easter-workflow-builder/provider-capability';
import { minimaxProvider } from './descriptor.ts';

/**
 * A SPEC-013 3.2 táblázata mezőnként, a valódi leírón (PLAN-014 T-014-3, AC2, AC3), a Flash-re
 * megismételt mérések szerint frissítve (docs/research/2026-10-28-flash-meresek.md 4. szekció).
 */

function sourceOf(reference: EvidenceReference): string {
  switch (reference.kind) {
    case 'doc': {
      return reference.url;
    }
    case 'research': {
      return reference.section;
    }
    case 'measurement': {
      return reference.id;
    }
  }
}

function blockedByOf(fact: Fact<unknown>): readonly string[] | undefined {
  return fact.state === 'unknown' ? fact.blockedBy : undefined;
}

const model = minimaxProvider.models[0];

describe('a minimax leíró a MiniMax-M3.1-Flash modellt írja le (SPEC-013 3.1)', () => {
  it('pontosan egy modell, a Flash azonosítóval és családdal', () => {
    expect(minimaxProvider.models).toHaveLength(1);
    expect(model?.id).toBe('MiniMax-M3.1-Flash');
    expect(model?.family).toBe('M3.1-Flash');
    expect(minimaxProvider.measuredAt).toBe('2026-10-28');
  });
});

const strategy = minimaxProvider.structuredOutput.strategies[0];

describe('a known mezők a Flash forrásaira és a Flash mérésekre épülnek (SPEC-013 3.2)', () => {
  it.each([
    [
      'clientModelIdentifier',
      model?.clientModelIdentifier,
      'MiniMax-M3.1-Flash[1m]',
      [
        DOC_MINIMAX_CLAUDE_CODE_M_PLAN,
        DOC_MINIMAX_CLAUDE_CODE_TOKEN_PLAN,
        DOC_CLAUDE_CODE_TOOLS_ALT_PROVIDERS,
        DOC_DIGITALAPPLIED_MINIMAX_FLASH_CLAUDE_CODE,
        RESEARCH_MINIMAX_FLASH,
        'M-11-flash',
      ],
    ],
    [
      'contextWindow',
      model?.contextWindow,
      1_000_000,
      [
        DOC_MINIMAX_ANTHROPIC_API,
        DOC_MINIMAX_TEXT_GENERATION,
        DOC_CLOUDFLARE_MINIMAX_M31_FLASH,
        DOC_TYPINGMIND_MINIMAX_M31_FLASH,
      ],
    ],
    [
      'maxOutputTokensRecommended',
      model?.maxOutputTokensRecommended,
      131_072,
      [DOC_MINIMAX_CHAT_OPENAI, DOC_7MINAI_MINIMAX_M31_FLASH, DOC_WOKEY_MINIMAX_M31_FLASH],
    ],
    [
      'maxOutputTokensHard',
      model?.maxOutputTokensHard,
      524_288,
      [DOC_MINIMAX_CHAT_OPENAI, DOC_WOKEY_MINIMAX_M31_FLASH, DOC_TYPINGMIND_MINIMAX_M31_FLASH],
    ],
    [
      'thinking M3.1-Flash',
      minimaxProvider.thinking.byModelFamily['M3.1-Flash'],
      ['adaptive'],
      [
        DOC_MINIMAX_ANTHROPIC_API,
        DOC_MINIMAX_OPENAI_API,
        DOC_MINIMAX_CLAUDE_CODE_M_PLAN,
        DOC_WOKEY_MINIMAX_M31_FLASH,
        DOC_7MINAI_MINIMAX_M31_FLASH,
      ],
    ],
    [
      'effort.accepted',
      minimaxProvider.effort.accepted,
      true,
      [
        DOC_MINIMAX_ANTHROPIC_API,
        DOC_MINIMAX_TEXT_GENERATION,
        DOC_CLOUDFLARE_MINIMAX_M31_FLASH,
        DOC_WOKEY_MINIMAX_M31_FLASH,
      ],
    ],
    [
      'effort.wireField',
      minimaxProvider.effort.wireField,
      'output_config.effort',
      [
        DOC_MINIMAX_ANTHROPIC_API,
        DOC_MINIMAX_TEXT_GENERATION,
        DOC_7MINAI_MINIMAX_M31_FLASH,
        DOC_FOUNDERMAG_MINIMAX_M31_FLASH,
      ],
    ],
    [
      'streaming.fineGrainedToolStreaming',
      minimaxProvider.streaming.fineGrainedToolStreaming,
      false,
      [RESEARCH_GATEWAY],
    ],
    [
      'concurrency.subagentCapEnvVar',
      minimaxProvider.concurrency.subagentCapEnvVar,
      'CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS',
      [DOC_ENV_VARS],
    ],
    ['imageInput', model?.imageInput, true, ['M-23-flash']],
    ['listedByModelsEndpoint', model?.listedByModelsEndpoint, true, ['M-35-flash']],
    ['thinking.wireShape', minimaxProvider.thinking.wireShape, '{"type":"adaptive"}', ['M-01-flash', 'M-05-flash']],
    ['thinking.sendsBudgetTokens', minimaxProvider.thinking.sendsBudgetTokens, false, ['M-05-flash', 'M-06-flash']],
    [
      'thinking.streamEventTypes',
      minimaxProvider.thinking.streamEventTypes,
      ['content_block_start', 'thinking_delta', 'signature_delta', 'content_block_stop'],
      ['M-01-flash', 'M-03-flash'],
    ],
    ['structuredOutput usable', strategy?.usable, true, ['M-03-flash']],
    // eslint-disable-next-line unicorn/no-null -- a "nincs blokkoló" érték a leíróban null (structured-output-strategy.ts)
    ['structuredOutput blockingWireDetail', strategy?.blockingWireDetail, null, ['M-03-flash']],
    ['structuredOutput observedRoundTrips', strategy?.observedRoundTrips, [3], ['M-03-flash']],
    [
      'structuredOutput.outputConfigAlwaysSent',
      minimaxProvider.structuredOutput.outputConfigAlwaysSent,
      true,
      ['M-01-flash', 'M-26-flash'],
    ],
    [
      'structuredOutput.outputConfigWireField',
      minimaxProvider.structuredOutput.outputConfigWireField,
      'output_config.effort',
      ['M-01-flash', 'M-26-flash'],
    ],
    [
      'toolChoice.rejectionBehaviour',
      minimaxProvider.toolChoice.rejectionBehaviour,
      'silently_dropped',
      ['M-34-flash'],
    ],
    [
      'toolChoice.sdkSendsForcedChoice',
      minimaxProvider.toolChoice.sdkSendsForcedChoice,
      false,
      ['M-03-flash', 'M-17-flash'],
    ],
    ['streaming.sse', minimaxProvider.streaming.sse, true, ['M-05-flash', 'M-09-flash']],
    ['streaming.toolInputDelta', minimaxProvider.streaming.toolInputDelta, 'input_json_delta', ['M-09-flash']],
    ['streaming.sdkReassemblesToolInput', minimaxProvider.streaming.sdkReassemblesToolInput, true, ['M-09-flash']],
    ['modelsEndpoint.directHttpReachable', minimaxProvider.modelsEndpoint.directHttpReachable, true, ['M-35-flash']],
    ['modelsEndpoint.calledBySdk', minimaxProvider.modelsEndpoint.calledBySdk, false, ['M-12-flash', 'M-36-flash']],
    ['modelsEndpoint.listedModelCount', minimaxProvider.modelsEndpoint.listedModelCount, 9, ['M-35-flash']],
    [
      'anthropicBetaHeaders',
      minimaxProvider.anthropicBetaHeaders,
      [
        'claude-code-20250219',
        'context-1m-2025-08-07',
        'interleaved-thinking-2025-05-14',
        'thinking-token-count-2026-05-13',
        'context-management-2025-06-27',
        'prompt-caching-scope-2026-01-05',
        'mid-conversation-system-2026-04-07',
        'effort-2025-11-24',
      ],
      ['M-01-flash', 'M-11-flash'],
    ],
  ] as const)('%s', (_name, fact, value, sources) => {
    expect(fact?.state).toBe('known');
    if (fact?.state !== 'known') {
      return;
    }
    expect(fact.value).toStrictEqual(value);
    const evidenceSources = fact.evidence.map((reference) => sourceOf(reference));
    expect(evidenceSources).toStrictEqual(sources);
  });

  it('a web_search szerver oldali tool elérhető, a kliens oldali neve WebSearch (M-17-flash)', () => {
    const tools = minimaxProvider.serverTools;
    expect(tools.state).toBe('known');
    if (tools.state !== 'known') {
      return;
    }
    expect(tools.evidence.map((reference) => sourceOf(reference))).toStrictEqual(['M-17-flash']);
    expect(tools.value).toHaveLength(1);
    const [webSearch] = tools.value;
    expect([webSearch?.wireType, webSearch?.name]).toStrictEqual(['web_search_20250305', 'web_search']);
    expect(webSearch?.available).toStrictEqual({
      state: 'known',
      value: true,
      evidence: [{ kind: 'measurement', id: 'M-17-flash' }],
    });
    expect(webSearch?.clientToolName).toStrictEqual({
      state: 'known',
      value: 'WebSearch',
      evidence: [{ kind: 'measurement', id: 'M-17-flash' }],
    });
  });

  it('a rate limit sor a Flash-re vonatkozik', () => {
    expect(minimaxProvider.rateLimits.buckets[0]?.appliesTo).toStrictEqual(['MiniMax-M3.1-Flash']);
  });
});

// A Flash-re lefuttatott, de a kérdést el nem döntő esetek mezői saját indoklást kapnak (thinking signature, tool_choice).
describe('a Flash-re nem mért vagy a méréssel el nem döntött mezők unknown állapotúak, a blokkoló méréssel (SPEC-013 3.2)', () => {
  const caching = minimaxProvider.promptCaching;
  const cachingMeasurements = ['M-08', 'M-15', 'M-24', 'M-33'];

  it.each([
    ['effectiveContextWindowOnWire', model?.effectiveContextWindowOnWire, ['M-20']],
    ['maxOutputTokensWireCeiling', model?.maxOutputTokensWireCeiling, ['M-22']],
    ['videoInput', model?.videoInput, ['M-16', 'M-23']],
    ['thinking.interleavedSignatureRequired', minimaxProvider.thinking.interleavedSignatureRequired, ['M-05']],
    ['structuredOutput.defaultStrategy', minimaxProvider.structuredOutput.defaultStrategy, ['M-19']],
    ['toolChoice.accepted', minimaxProvider.toolChoice.accepted, ['M-34']],
    ['promptCaching.mode', caching.mode, ['M-15', 'M-20', 'M-24', 'M-33']],
    ['promptCaching.explicitBreakpointLimit', caching.explicitBreakpointLimit, cachingMeasurements],
    ['promptCaching.ttlSeconds', caching.ttlSeconds, cachingMeasurements],
    ['promptCaching.minimumInputTokens', caching.minimumInputTokens, cachingMeasurements],
    ['promptCaching.usageFields', caching.usageFields, cachingMeasurements],
    ['promptCaching.disableEnvVar', caching.disableEnvVar, cachingMeasurements],
    ['promptCaching.callerBreakpointSurvivesDisable', caching.callerBreakpointSurvivesDisable, cachingMeasurements],
    ['streaming.streamDisableable', minimaxProvider.streaming.streamDisableable, ['M-24']],
    ['rateLimits RPM', minimaxProvider.rateLimits.buckets[0]?.requestsPerMinute, []],
    ['rateLimits TPM', minimaxProvider.rateLimits.buckets[0]?.tokensPerMinute, []],
    ['rateLimits.retryAfterHeader', minimaxProvider.rateLimits.retryAfterHeader, ['M-18', 'M-36']],
    ['rateLimits.rateLimitHeaders', minimaxProvider.rateLimits.rateLimitHeaders, ['M-18', 'M-36']],
    ['concurrency.measuredSubagentCap', minimaxProvider.concurrency.measuredSubagentCap, ['M-31']],
    ['concurrency.observedMaxConcurrentRequests', minimaxProvider.concurrency.observedMaxConcurrentRequests, ['M-31']],
    ['concurrency.measuredMaxConcurrentSteps', minimaxProvider.concurrency.measuredMaxConcurrentSteps, ['M-39']],
  ] as const)('%s', (_name, fact, blockedBy) => {
    expect(fact?.state).toBe('unknown');
    expect(fact === undefined ? undefined : blockedByOf(fact)).toStrictEqual(blockedBy);
  });
});
