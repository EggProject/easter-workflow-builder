/* eslint-disable unicorn/no-null -- a teszt fixture-ök a `node-config` séma nullázható mezőit hordozzák (SPEC-005). */
import type { NodeConfig } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { DEFAULT_AGENT_STEP_SETTINGS } from './default-agent-step-settings.ts';
import { findLanguageFieldIssues } from './find-language-field-issues.ts';

// A valódi `workflow-language` csomag fut, mock nélkül (SPEC-010 12.4): a
// mondatok a csomag saját magyar leírásai, a telepített csomagon mérve.
const UNCLOSED_SECTION = 'Le nem zárt szakasz a sablonban (pozíció: 10).';
const UNDECLARED_VARIABLE = 'Nem deklarált változó a kifejezésben (pozíció: 0).';
const BROKEN_TEMPLATE = '{{#titok}}';
const BROKEN_EXPRESSION = 'titokNeve > 1';
const NO_SCHEMA_ERRORS: ReadonlyMap<string, string> = new Map<string, string>();

const CASES: readonly {
  readonly description: string;
  readonly config: NodeConfig;
  readonly expected: readonly { readonly path: readonly string[]; readonly message: string }[];
}[] = [
  {
    description: 'agent_step: a hibás prompt sablon',
    config: {
      ...DEFAULT_AGENT_STEP_SETTINGS,
      promptTemplate: BROKEN_TEMPLATE,
      type: 'agent_step',
      onUnhandledError: null,
    },
    expected: [{ path: ['promptTemplate'], message: UNCLOSED_SECTION }],
  },
  {
    description: 'join ai_synthesis: a hibás settings.promptTemplate',
    config: {
      type: 'join',
      mode: 'ai_synthesis',
      settings: { ...DEFAULT_AGENT_STEP_SETTINGS, promptTemplate: BROKEN_TEMPLATE },
      onUnhandledError: null,
    },
    expected: [{ path: ['settings', 'promptTemplate'], message: UNCLOSED_SECTION }],
  },
  {
    description: 'human_approval: a hibás törzs sablon',
    config: {
      type: 'human_approval',
      title: 'Cím',
      bodyTemplate: BROKEN_TEMPLATE,
      timeoutMs: null,
      onUnhandledError: null,
    },
    expected: [{ path: ['bodyTemplate'], message: UNCLOSED_SECTION }],
  },
  {
    description: 'fan_out: a hibás elemek kifejezés és a hibás ág címke sablon',
    config: {
      type: 'fan_out',
      itemsExpression: BROKEN_EXPRESSION,
      branchLabelTemplate: BROKEN_TEMPLATE,
      onUnhandledError: null,
    },
    expected: [
      { path: ['itemsExpression'], message: UNDECLARED_VARIABLE },
      { path: ['branchLabelTemplate'], message: UNCLOSED_SECTION },
    ],
  },
  {
    description: 'branch: a hibás feltétel kifejezés',
    config: {
      type: 'branch',
      expression: BROKEN_EXPRESSION,
      branches: [],
      defaultBranchKey: null,
      onUnhandledError: null,
    },
    expected: [{ path: ['expression'], message: UNDECLARED_VARIABLE }],
  },
  {
    description: 'loop: a hibás folytatás feltétel',
    config: { type: 'loop', maxIterations: 3, continueExpression: BROKEN_EXPRESSION, onUnhandledError: null },
    expected: [{ path: ['continueExpression'], message: UNDECLARED_VARIABLE }],
  },
];

describe('findLanguageFieldIssues', () => {
  it.each(CASES)('$description a mező útvonalán, a csomag mondatával jelez', ({ config, expected }) => {
    expect(findLanguageFieldIssues(config, NO_SCHEMA_ERRORS)).toEqual(expected);
  });

  it('a hibaüzenet a mező szövegét nem idézi (SPEC-010 9.5)', () => {
    const messages = CASES.flatMap(({ config }) =>
      findLanguageFieldIssues(config, NO_SCHEMA_ERRORS).map((issue) => issue.message),
    );
    for (const message of messages) {
      expect(message).not.toContain('titok');
    }
  });

  it('hibátlan sablon és kifejezés mezőn nincs hiba', () => {
    expect(
      findLanguageFieldIssues(
        {
          type: 'fan_out',
          itemsExpression: 'input.items',
          branchLabelTemplate: '{{item}}',
          onUnhandledError: null,
        },
        NO_SCHEMA_ERRORS,
      ),
    ).toEqual([]);
  });

  it('a séma hibájú mező nem fordul, tehát nincs rá fordítási hiba (SPEC-010 10. "sorrend", AC46)', () => {
    expect(
      findLanguageFieldIssues(
        { type: 'loop', maxIterations: 3, continueExpression: ' ', onUnhandledError: null },
        new Map([['continueExpression', 'A mező nem lehet üres.']]),
      ),
    ).toEqual([]);
  });

  it('a séma hiba csak a saját mezőjét hagyja ki, a másik mező fordul', () => {
    expect(
      findLanguageFieldIssues(
        {
          type: 'fan_out',
          itemsExpression: ' ',
          branchLabelTemplate: BROKEN_TEMPLATE,
          onUnhandledError: null,
        },
        new Map([['itemsExpression', 'A mező nem lehet üres.']]),
      ),
    ).toEqual([{ path: ['branchLabelTemplate'], message: UNCLOSED_SECTION }]);
  });

  it.each([
    { type: 'start', inputFields: [], onUnhandledError: null },
    { type: 'error_handler', maxAttempts: 3, backoffMs: [100], handledErrorKinds: [], onUnhandledError: null },
    { type: 'sub_workflow', targetWorkflowId: 'wf-2', inputMapping: {}, onUnhandledError: null },
    { type: 'script', source: 'return 1;', runtime: 'expression', onUnhandledError: null },
    { type: 'join', mode: 'merge', onUnhandledError: null },
    { type: 'join', mode: 'script', settings: { source: 'return 1;', runtime: 'expression' }, onUnhandledError: null },
    { type: 'join', mode: null, onUnhandledError: null },
  ] satisfies readonly NodeConfig[])(
    'a sablon és kifejezés mező nélküli $type ($mode) config üres listát ad',
    (config) => {
      expect(findLanguageFieldIssues(config, NO_SCHEMA_ERRORS)).toEqual([]);
    },
  );
});
