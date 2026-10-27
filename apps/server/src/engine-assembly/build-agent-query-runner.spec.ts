/* eslint-disable unicorn/no-null -- az `AgentStepConfig` elhagyható mezői a tárolt JSON-ban `null` értékkel jelzik a hiányt (SPEC-003 4.4) */
import type { Options } from '@anthropic-ai/claude-agent-sdk';
import type { AgentStepConfig } from '@easter-workflow-builder/db';
import { buildAgentStepOptions } from '@easter-workflow-builder/engine';
import { describe, expect, it } from 'vitest';
import { buildAgentQueryRunner } from './build-agent-query-runner.ts';

describe('buildAgentQueryRunner', () => {
  it('AgentQueryRunner alakú objektumot ad, valós SDK hívás nélkül (a query csak run()-on hívódna)', () => {
    const runner = buildAgentQueryRunner();
    expect(typeof runner.run).toBe('function');
  });
});

/**
 * A motor kimenő `thinking` mezője a pinelt SDK `Options['thinking']` típusának (`ThinkingConfig`)
 * felel meg (SPEC-013 5.3, AC13). A motor az SDK-tól nem függ, a két típus csak itt látszik együtt;
 * a hozzárendelés a `typecheck` kapun bukik, ha a motor újra szöveget adna (a korábbi hiba: a
 * `'adaptive'` szöveg `.type` mezője `undefined`, az SDK egyik ágba sem lépett).
 */
describe('a motor thinking mezője az SDK ThinkingConfig alakja', () => {
  const config: AgentStepConfig = {
    promptTemplate: 'prompt',
    providerId: null,
    modelId: 'modell',
    effort: null,
    thinking: null,
    allowedTools: [],
    disallowedTools: [],
    permissionMode: null,
    maxTurns: null,
    maxBudgetUsd: null,
    systemPrompt: null,
    agents: {},
    skills: null,
    mcpServers: {},
    cwd: null,
    additionalDirectories: [],
    sandbox: null,
    sessionMode: 'isolated',
    structuredOutput: null,
  };

  it.each(['adaptive', 'disabled'] as const)('a(z) %s mód SDK objektumként megy ki', (mode) => {
    const options = buildAgentStepOptions({
      config,
      decisions: {
        model: { outgoingModel: 'modell', modelIdentifierUnproven: false },
        structuredOutput: undefined,
        thinking: mode,
        effort: undefined,
        disallowedServerTools: { disallowedTools: [], serverToolAvailabilityUnproven: false },
        includePartialMessages: false,
      },
      environmentBlock: {},
      sessionBinding: { mode: 'isolated' },
    });

    const sdkThinking: Options['thinking'] = options.thinking;
    expect(sdkThinking).toStrictEqual({ type: mode });
  });
});
