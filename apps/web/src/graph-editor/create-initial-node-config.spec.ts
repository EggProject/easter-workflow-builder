/* eslint-disable unicorn/no-null -- a szintetikus config fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import {
  NodeConfigSaveSchema,
  NodeConfigSchema,
  NodeTypeSchema,
  type NodeConfig,
} from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { DEFAULT_AGENT_STEP_SETTINGS } from '../node-inspector/default-agent-step-settings.ts';
import type { AddableNodeType } from './addable-node-type.ts';
import { createInitialNodeConfig } from './create-initial-node-config.ts';

interface InitialConfigCase {
  readonly type: AddableNodeType;
  readonly expected: NodeConfig;
  /**
   * A mentési séma egyik hibájának útvonala: a `NaN` számot hordozó két
   * típusnál a szám mező (az olvasó séma már ott megáll, M-104), a többinél az
   * üresen hagyott `onUnhandledError` (O-29).
   */
  readonly saveIssuePath: string;
}

/**
 * A SPEC-008 5.8 táblázata soronként: a `NaN` a két kötelező, alapérték nélküli
 * szám mező üres jelölése, a `join` `mode` mezője `null` és nincs `settings`
 * mezője (O-33).
 */
const CASES: readonly InitialConfigCase[] = [
  {
    type: 'agent_step',
    saveIssuePath: 'onUnhandledError',
    expected: { ...DEFAULT_AGENT_STEP_SETTINGS, type: 'agent_step', onUnhandledError: null },
  },
  {
    type: 'branch',
    saveIssuePath: 'onUnhandledError',
    expected: { type: 'branch', expression: '', branches: [], defaultBranchKey: null, onUnhandledError: null },
  },
  {
    type: 'fan_out',
    saveIssuePath: 'onUnhandledError',
    expected: { type: 'fan_out', itemsExpression: '', branchLabelTemplate: '', onUnhandledError: null },
  },
  {
    type: 'join',
    saveIssuePath: 'onUnhandledError',
    expected: { type: 'join', mode: null, onUnhandledError: null },
  },
  {
    type: 'loop',
    saveIssuePath: 'maxIterations',
    expected: { type: 'loop', maxIterations: NaN, continueExpression: '', onUnhandledError: null },
  },
  {
    type: 'human_approval',
    saveIssuePath: 'onUnhandledError',
    expected: { type: 'human_approval', title: '', bodyTemplate: '', timeoutMs: null, onUnhandledError: null },
  },
  {
    type: 'error_handler',
    saveIssuePath: 'maxAttempts',
    expected: {
      type: 'error_handler',
      maxAttempts: NaN,
      backoffMs: [],
      handledErrorKinds: [],
      onUnhandledError: null,
    },
  },
  {
    type: 'sub_workflow',
    saveIssuePath: 'onUnhandledError',
    expected: { type: 'sub_workflow', targetWorkflowId: '', inputMapping: {}, onUnhandledError: null },
  },
  {
    type: 'script',
    saveIssuePath: 'onUnhandledError',
    expected: { type: 'script', source: '', runtime: 'expression', onUnhandledError: null },
  },
];

const NAN_FIELD_TYPES: ReadonlySet<AddableNodeType> = new Set(['loop', 'error_handler']);

describe('createInitialNodeConfig', () => {
  it('a kilenc felvehető típust fedi: mind a tíz NodeType, a start kivételével', () => {
    const expectedTypes = new Set(NodeTypeSchema.options.filter((type) => type !== 'start'));
    expect(new Set(CASES.map((testCase) => testCase.type))).toEqual(expectedTypes);
    expect(CASES).toHaveLength(9);
  });

  it.each(CASES)('$type: a SPEC-008 5.8 táblázata szerinti kezdő config', ({ type, expected }) => {
    expect(createInitialNodeConfig(type)).toEqual(expected);
  });

  it.each(CASES)('$type: a config típusa a kért típus', ({ type }) => {
    expect(createInitialNodeConfig(type).type).toBe(type);
  });

  it.each(CASES)('$type: az olvasó séma elfogadja, kivéve a NaN számot hordozó két típust', ({ type }) => {
    const parsed = NodeConfigSchema.safeParse(createInitialNodeConfig(type));
    expect(parsed.success).toBe(!NAN_FIELD_TYPES.has(type));
  });

  it.each(CASES)('$type: a mentési séma elutasítja, a hiba útvonala $saveIssuePath', ({ type, saveIssuePath }) => {
    const parsed = NodeConfigSaveSchema.safeParse(createInitialNodeConfig(type));
    expect(parsed.success).toBe(false);
    const issuePaths = parsed.success ? [] : parsed.error.issues.map((issue) => issue.path.join('.'));
    expect(issuePaths).toContain(saveIssuePath);
  });

  it('hívásonként új, egymástól független legfelső szintű objektumot ad', () => {
    expect(createInitialNodeConfig('branch')).not.toBe(createInitialNodeConfig('branch'));
  });
});
