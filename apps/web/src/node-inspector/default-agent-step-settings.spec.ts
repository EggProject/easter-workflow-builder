/* eslint-disable unicorn/no-null -- az `AgentStepConfig` nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import { AgentStepConfigSchema } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { DEFAULT_AGENT_STEP_SETTINGS } from './default-agent-step-settings.ts';

describe('DEFAULT_AGENT_STEP_SETTINGS', () => {
  it('átmegy az olvasó AgentStepConfig sémán', () => {
    expect(AgentStepConfigSchema.safeParse(DEFAULT_AGENT_STEP_SETTINGS).success).toBe(true);
  });

  it('a SPEC-008 5.8 szerinti üres alak: üres sablon, null nullázható mezők, üres listák és rekordok, izolált munkamenet', () => {
    expect(DEFAULT_AGENT_STEP_SETTINGS).toEqual({
      promptTemplate: '',
      providerId: null,
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
      enabledEngineHooks: [],
      cwd: null,
      additionalDirectories: [],
      sandbox: null,
      sessionMode: 'isolated',
      structuredOutput: null,
    });
  });
});
