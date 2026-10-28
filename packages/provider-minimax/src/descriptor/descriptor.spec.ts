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
 * A SPEC-013 3.2 táblázata mezőnként, a valódi leírón (PLAN-014 T-014-3, AC2, AC3).
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
    expect(minimaxProvider.measuredAt).toBe('2026-10-27');
  });
});

describe('a known mezők a Flash forrásaira épülnek (SPEC-013 3.2)', () => {
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
  ] as const)('%s', (_name, fact, value, sources) => {
    expect(fact?.state).toBe('known');
    if (fact?.state !== 'known') {
      return;
    }
    expect(fact.value).toStrictEqual(value);
    const evidenceSources = fact.evidence.map((reference) => sourceOf(reference));
    expect(evidenceSources).toStrictEqual(sources);
  });

  it('a rate limit sor a Flash-re vonatkozik', () => {
    expect(minimaxProvider.rateLimits.buckets[0]?.appliesTo).toStrictEqual(['MiniMax-M3.1-Flash']);
  });
});

describe('az előző modellre mért mezők unknown állapotúak, a megismétlendő méréssel (SPEC-013 3.2)', () => {
  const strategy = minimaxProvider.structuredOutput.strategies[0];
  const caching = minimaxProvider.promptCaching;
  const cachingMeasurements = ['M-08', 'M-15', 'M-24', 'M-33'];

  it.each([
    ['effectiveContextWindowOnWire', model?.effectiveContextWindowOnWire, ['M-20']],
    ['maxOutputTokensWireCeiling', model?.maxOutputTokensWireCeiling, ['M-22']],
    ['imageInput', model?.imageInput, ['M-23', 'M-16']],
    ['videoInput', model?.videoInput, ['M-16', 'M-23']],
    ['listedByModelsEndpoint', model?.listedByModelsEndpoint, ['M-35']],
    ['thinking.wireShape', minimaxProvider.thinking.wireShape, ['M-01', 'M-05']],
    ['thinking.sendsBudgetTokens', minimaxProvider.thinking.sendsBudgetTokens, ['M-05', 'M-06']],
    ['thinking.streamEventTypes', minimaxProvider.thinking.streamEventTypes, ['M-05']],
    ['thinking.interleavedSignatureRequired', minimaxProvider.thinking.interleavedSignatureRequired, ['M-05']],
    ['structuredOutput usable', strategy?.usable, ['M-02', 'M-03']],
    ['structuredOutput blockingWireDetail', strategy?.blockingWireDetail, ['M-03']],
    ['structuredOutput observedRoundTrips', strategy?.observedRoundTrips, ['M-03']],
    ['structuredOutput.defaultStrategy', minimaxProvider.structuredOutput.defaultStrategy, ['M-02', 'M-03', 'M-19']],
    [
      'structuredOutput.outputConfigAlwaysSent',
      minimaxProvider.structuredOutput.outputConfigAlwaysSent,
      ['M-01', 'M-04', 'M-26'],
    ],
    [
      'structuredOutput.outputConfigWireField',
      minimaxProvider.structuredOutput.outputConfigWireField,
      ['M-01', 'M-04'],
    ],
    ['toolChoice.accepted', minimaxProvider.toolChoice.accepted, ['M-03', 'M-34']],
    ['toolChoice.rejectionBehaviour', minimaxProvider.toolChoice.rejectionBehaviour, ['M-34']],
    ['toolChoice.sdkSendsForcedChoice', minimaxProvider.toolChoice.sdkSendsForcedChoice, ['M-03', 'M-17']],
    ['promptCaching.mode', caching.mode, ['M-15', 'M-20', 'M-24', 'M-33']],
    ['promptCaching.explicitBreakpointLimit', caching.explicitBreakpointLimit, cachingMeasurements],
    ['promptCaching.ttlSeconds', caching.ttlSeconds, cachingMeasurements],
    ['promptCaching.minimumInputTokens', caching.minimumInputTokens, cachingMeasurements],
    ['promptCaching.usageFields', caching.usageFields, cachingMeasurements],
    ['promptCaching.disableEnvVar', caching.disableEnvVar, cachingMeasurements],
    ['promptCaching.callerBreakpointSurvivesDisable', caching.callerBreakpointSurvivesDisable, cachingMeasurements],
    ['streaming.sse', minimaxProvider.streaming.sse, ['M-05', 'M-09']],
    ['streaming.toolInputDelta', minimaxProvider.streaming.toolInputDelta, ['M-09']],
    ['streaming.sdkReassemblesToolInput', minimaxProvider.streaming.sdkReassemblesToolInput, ['M-09']],
    ['streaming.streamDisableable', minimaxProvider.streaming.streamDisableable, ['M-24']],
    ['serverTools', minimaxProvider.serverTools, ['M-17', 'M-25']],
    ['modelsEndpoint.directHttpReachable', minimaxProvider.modelsEndpoint.directHttpReachable, ['M-35']],
    ['modelsEndpoint.calledBySdk', minimaxProvider.modelsEndpoint.calledBySdk, ['M-12', 'M-36']],
    ['modelsEndpoint.listedModelCount', minimaxProvider.modelsEndpoint.listedModelCount, ['M-35']],
    ['rateLimits RPM', minimaxProvider.rateLimits.buckets[0]?.requestsPerMinute, []],
    ['rateLimits TPM', minimaxProvider.rateLimits.buckets[0]?.tokensPerMinute, []],
    ['rateLimits.retryAfterHeader', minimaxProvider.rateLimits.retryAfterHeader, ['M-18', 'M-36']],
    ['rateLimits.rateLimitHeaders', minimaxProvider.rateLimits.rateLimitHeaders, ['M-18', 'M-36']],
    ['concurrency.measuredSubagentCap', minimaxProvider.concurrency.measuredSubagentCap, ['M-31']],
    ['concurrency.observedMaxConcurrentRequests', minimaxProvider.concurrency.observedMaxConcurrentRequests, ['M-31']],
    ['concurrency.measuredMaxConcurrentSteps', minimaxProvider.concurrency.measuredMaxConcurrentSteps, ['M-39']],
    ['anthropicBetaHeaders', minimaxProvider.anthropicBetaHeaders, ['M-01', 'M-11', 'M-14', 'M-32']],
  ] as const)('%s', (_name, fact, blockedBy) => {
    expect(fact?.state).toBe('unknown');
    expect(fact === undefined ? undefined : blockedByOf(fact)).toStrictEqual(blockedBy);
  });
});
