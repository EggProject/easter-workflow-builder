/* eslint-disable unicorn/no-null -- az `AgentStepConfig` elhagyható mezői a tárolt JSON-ban `null` értékkel jelzik a hiányt (SPEC-003 4.4) */
import { describe, expect, it } from 'vitest';
import type { AgentStepConfig } from '@easter-workflow-builder/db';
import { validateAgentStepCapabilities } from '@easter-workflow-builder/engine';
import { providerRegistry } from '@easter-workflow-builder/provider-registry';

/**
 * A motor viselkedése a valódi `minimax` leíróval, a `MiniMax-M3.1-Flash` cserére (SPEC-013 3.3,
 * 3.4, AC4, AC5; PLAN-014 T-014-4). A motor csomag a `provider-registry` csomagtól nem függ, a
 * leíró és a motor egyszerre csak az `apps/server` csomagban látszik.
 *
 * **Ennek a mappának szándékosan nincs futásidejű forrásfájlja** (`.claude/CLAUDE.md` 5.
 * szekció, megvalósítás nélküli regressziós teszt): a motor kódja a cseréhez nem változik, ez a
 * teszt azt őrzi, hogy a leíró új tényei a meglévő úton a várt döntést adják.
 */

function agentStepConfig(overrides: Partial<AgentStepConfig> = {}): AgentStepConfig {
  return {
    promptTemplate: 'prompt',
    providerId: 'minimax',
    modelId: null,
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
    ...overrides,
  };
}

describe('a motor a MiniMax-M3.1-Flash leíróval', () => {
  it('a disabled thinking a futás indításakor thinking_mode_unsupported hibát ad (AC4)', () => {
    const outcome = validateAgentStepCapabilities(agentStepConfig({ thinking: 'disabled' }), providerRegistry.minimax);

    expect(outcome.status).toBe('failed');
    expect(outcome.status === 'failed' ? outcome.errorKind : undefined).toBe('thinking_mode_unsupported');
  });

  it('modell nélkül a Flash-t választja, a kimenő azonosító a suffixes alak, delta nélkül (AC5, 3.4)', () => {
    const outcome = validateAgentStepCapabilities(agentStepConfig(), providerRegistry.minimax);

    expect(outcome.status).toBe('ok');
    const decisions = outcome.status === 'ok' ? outcome.decisions : undefined;
    expect(decisions?.model).toStrictEqual({
      outgoingModel: 'MiniMax-M3.1-Flash[1m]',
      modelIdentifierUnproven: false,
    });
    expect(decisions?.includePartialMessages).toBe(false);
    expect(decisions?.disallowedServerTools).toStrictEqual({
      disallowedTools: [],
      serverToolAvailabilityUnproven: true,
    });
  });

  it('az adaptive thinking és a low effort kimegy', () => {
    const outcome = validateAgentStepCapabilities(
      agentStepConfig({ thinking: 'adaptive', effort: 'low' }),
      providerRegistry.minimax,
    );

    expect(outcome.status === 'ok' ? [outcome.decisions.thinking, outcome.decisions.effort] : undefined).toStrictEqual([
      'adaptive',
      'low',
    ]);
  });
});
