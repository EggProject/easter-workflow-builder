/* eslint-disable unicorn/no-null -- a node config nullázható mezői a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 4.3) */
import { describe, expect, it } from 'vitest';
import type { AgentStepConfig } from '../agent-step-config/agent-step-config.ts';
import { findBlankRequiredTextField } from './find-blank-required-text-field.ts';

const agentStepConfig: AgentStepConfig = {
  promptTemplate: 'Foglald össze: {{input}}',
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
};

describe('findBlankRequiredTextField', () => {
  it('kitöltött kötelező mezőkre nincs találat', () => {
    expect(
      findBlankRequiredTextField({
        type: 'branch',
        expression: 'x > 0',
        branches: [{ key: 'pos', label: 'Pozitív' }],
        defaultBranchKey: null,
        onUnhandledError: null,
      }),
    ).toBeUndefined();
  });

  it('a típus táblájának első üres mezőjét adja, a lista elem indexével', () => {
    expect(
      findBlankRequiredTextField({
        type: 'branch',
        expression: 'x > 0',
        branches: [
          { key: 'pos', label: 'Pozitív' },
          { key: 'neg', label: ' ' },
        ],
        defaultBranchKey: null,
        onUnhandledError: null,
      }),
    ).toBe('branches.1.label');
  });

  it('a join a mód saját tábláját használja: script módban a settings.source kötelező', () => {
    expect(
      findBlankRequiredTextField({
        type: 'join',
        mode: 'script',
        settings: { source: '', runtime: 'expression' },
        onUnhandledError: null,
      }),
    ).toBe('settings.source');
  });

  it('a join ai_synthesis módjában a settings.promptTemplate kötelező', () => {
    expect(
      findBlankRequiredTextField({
        type: 'join',
        mode: 'ai_synthesis',
        settings: { ...agentStepConfig, promptTemplate: '' },
        onUnhandledError: null,
      }),
    ).toBe('settings.promptTemplate');
  });

  it('a join merge módjának nyitott settings rekordjában nincs kötelező mező', () => {
    expect(
      findBlankRequiredTextField({
        type: 'join',
        mode: 'merge',
        settings: { source: '', promptTemplate: '' },
        onUnhandledError: null,
      }),
    ).toBeUndefined();
  });

  it('a választatlan join (mode: null) átmegy: kötelező szöveg mezője nincs (SPEC-008 O-33)', () => {
    expect(findBlankRequiredTextField({ type: 'join', mode: null, onUnhandledError: null })).toBeUndefined();
  });

  it('a nullázható szöveg mező üres értéke nem kötelező mező (agent_step cwd)', () => {
    expect(
      findBlankRequiredTextField({ ...agentStepConfig, cwd: '', type: 'agent_step', onUnhandledError: null }),
    ).toBeUndefined();
  });

  it('az error_handler típusnak nincs kötelező szöveg mezője', () => {
    expect(
      findBlankRequiredTextField({
        type: 'error_handler',
        maxAttempts: 3,
        backoffMs: [1000],
        handledErrorKinds: [''],
        onUnhandledError: null,
      }),
    ).toBeUndefined();
  });
});
