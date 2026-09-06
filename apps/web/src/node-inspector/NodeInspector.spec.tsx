/* eslint-disable unicorn/no-null -- a teszt fixture-ök a `node-config` séma nullázható mezőit hordozzák (SPEC-005). */
import type { NodeConfig, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeInspector } from './NodeInspector.tsx';

type OnChange = (updatedNode: WorkflowNodeInput) => void;

// A TypeScript excess-property ellenőrzése csak FRISS objektum literálra fut
// egy kontextuális típus helyén; egy közbülső változóba kötött literál már
// szélesség szerinti (width) altípusként megy át a `NodeConfig` felé, tehát
// ez `as` nélkül, type-safe módon előállítható (saját méréssel igazolva).
function buildConfigWithExtraKey(): NodeConfig {
  const raw = { type: 'start' as const, inputFields: [], onUnhandledError: null, extraKey: 'oops' };
  return raw;
}

const AGENT_STEP_SETTINGS = {
  promptTemplate: 'sablon',
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
  agentTools: [],
  sessionMode: 'isolated' as const,
  structuredOutput: null,
};

const NODES_BY_TYPE: readonly { readonly node: WorkflowNodeInput; readonly legend: string }[] = [
  {
    node: {
      id: 'n-start',
      type: 'start',
      label: 'Indítás',
      positionX: 0,
      positionY: 0,
      config: { type: 'start', inputFields: [], onUnhandledError: null },
    },
    legend: 'bemeneti mezők',
  },
  {
    node: {
      id: 'n-agent',
      type: 'agent_step',
      label: 'Agent',
      positionX: 0,
      positionY: 0,
      config: { ...AGENT_STEP_SETTINGS, type: 'agent_step', onUnhandledError: null },
    },
    legend: 'prompt és provider',
  },
  {
    node: {
      id: 'n-branch',
      type: 'branch',
      label: 'Elágazás',
      positionX: 0,
      positionY: 0,
      config: { type: 'branch', expression: 'x', branches: [], defaultBranchKey: null, onUnhandledError: null },
    },
    legend: 'elágazás',
  },
  {
    node: {
      id: 'n-fan-out',
      type: 'fan_out',
      label: 'Szétosztás',
      positionX: 0,
      positionY: 0,
      config: { type: 'fan_out', itemsExpression: 'items', branchLabelTemplate: '{{item}}', onUnhandledError: null },
    },
    legend: 'szétosztás',
  },
  {
    node: {
      id: 'n-join',
      type: 'join',
      label: 'Összefésülés',
      positionX: 0,
      positionY: 0,
      config: { type: 'join', mode: 'merge', settings: {}, onUnhandledError: null },
    },
    legend: 'összefésülés',
  },
  {
    node: {
      id: 'n-loop',
      type: 'loop',
      label: 'Ciklus',
      positionX: 0,
      positionY: 0,
      config: { type: 'loop', maxIterations: 5, continueExpression: 'i < 5', onUnhandledError: null },
    },
    legend: 'ciklus',
  },
  {
    node: {
      id: 'n-approval',
      type: 'human_approval',
      label: 'Jóváhagyás',
      positionX: 0,
      positionY: 0,
      config: { type: 'human_approval', title: 'Cím', bodyTemplate: 'Törzs', timeoutMs: null, onUnhandledError: null },
    },
    legend: 'emberi jóváhagyás',
  },
  {
    node: {
      id: 'n-error-handler',
      type: 'error_handler',
      label: 'Hibakezelő',
      positionX: 0,
      positionY: 0,
      config: {
        type: 'error_handler',
        maxAttempts: 3,
        backoffMs: [100],
        handledErrorKinds: [],
        onUnhandledError: null,
      },
    },
    legend: 'hibakezelő',
  },
  {
    node: {
      id: 'n-sub-workflow',
      type: 'sub_workflow',
      label: 'Al-workflow',
      positionX: 0,
      positionY: 0,
      config: { type: 'sub_workflow', targetWorkflowId: 'wf-2', inputMapping: {}, onUnhandledError: null },
    },
    legend: 'al-workflow',
  },
  {
    node: {
      id: 'n-script',
      type: 'script',
      label: 'Szkript',
      positionX: 0,
      positionY: 0,
      config: { type: 'script', source: 'return 1;', runtime: 'expression', onUnhandledError: null },
    },
    legend: 'szkript',
  },
];

describe('NodeInspector', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it.each(NODES_BY_TYPE)('a(z) "$node.type" típusra a megfelelő mezőcsoportot rendereli', ({ node, legend }) => {
    act(() => {
      root.render(
        <NodeInspector node={node} onChange={vi.fn()} onClose={vi.fn()} inheritedProviderDescription="nincs" />,
      );
    });
    const sectionTitles = [...container.querySelectorAll('.inspector-section__title')].map(
      (element) => element.textContent,
    );
    expect(sectionTitles).toContain(legend);
  });

  it('a fejlécben megjeleníti a katalógus címkét és a node azonosítót', () => {
    const startNode = NODES_BY_TYPE[0]?.node;
    if (startNode === undefined) {
      throw new Error('a teszt nem talált start node fixture-t');
    }
    act(() => {
      root.render(
        <NodeInspector node={startNode} onChange={vi.fn()} onClose={vi.fn()} inheritedProviderDescription="nincs" />,
      );
    });
    expect(container.textContent).toContain('Indítás');
    expect(container.textContent).toContain('n-start');
  });

  it('a bezárás gomb az onClose-t hívja', () => {
    const onClose = vi.fn();
    const startNode = NODES_BY_TYPE[0]?.node;
    if (startNode === undefined) {
      throw new Error('a teszt nem talált start node fixture-t');
    }
    act(() => {
      root.render(
        <NodeInspector node={startNode} onChange={vi.fn()} onClose={onClose} inheritedProviderDescription="nincs" />,
      );
    });
    const closeButton = container.querySelector('button');
    if (closeButton === null) {
      throw new Error('a teszt nem találta a Bezárás gombot');
    }
    act(() => {
      closeButton.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('érvényes configra nem jelenít meg hibalistát', () => {
    const startNode = NODES_BY_TYPE[0]?.node;
    if (startNode === undefined) {
      throw new Error('a teszt nem talált start node fixture-t');
    }
    act(() => {
      root.render(
        <NodeInspector node={startNode} onChange={vi.fn()} onClose={vi.fn()} inheritedProviderDescription="nincs" />,
      );
    });
    expect(container.querySelector('.node-inspector__errors')).toBeNull();
  });

  it('érvénytelen configra mezőnkénti hibalistát jelenít meg, útvonallal', () => {
    const invalidNode: WorkflowNodeInput = {
      id: 'n-loop-invalid',
      type: 'loop',
      label: 'Ciklus',
      positionX: 0,
      positionY: 0,
      config: { type: 'loop', maxIterations: Number('nem szám'), continueExpression: 'i < 5', onUnhandledError: null },
    };
    act(() => {
      root.render(
        <NodeInspector node={invalidNode} onChange={vi.fn()} onClose={vi.fn()} inheritedProviderDescription="nincs" />,
      );
    });
    const errorList = container.querySelector('.node-inspector__errors');
    expect(errorList).not.toBeNull();
    expect(errorList?.textContent).toContain('maxIterations');
  });

  it('gyökér szintű hibára üres útvonal elemet ad, amit a CSS jelöl meg "(gyökér)" felirattal', () => {
    // A `z.strictObject` a felesleges kulcsot a TELJES objektum szintjén jelzi
    // (nem egy adott mezőn), tehát a Zod issue `path`-ja üres tömb.
    //
    // A `NodeInspector` ezt SZÁNDÉKOSAN nem elágazással kezeli: az üres
    // útvonalat a `.node-inspector__error-path:empty::before` CSS szabály
    // jelöli meg "(gyökér)" felirattal. Az ok a `.claude/CLAUDE.md` 5.
    // szekciója: a gyökér szintű hiba a FELÜLETEN elő sem állhat, mert a
    // gráf betöltésekor a `WorkflowGraphDocumentSchema` ugyanezt a
    // `NodeConfigSchema` sémát futtatja, tehát egy felesleges kulcsot
    // hordozó config el sem jut a panelig; egy sosem futó JavaScript ágat
    // pedig a szabálykönyv tilt. Ez a teszt így azt igazolja, hogy a
    // gyökér szintű hiba MEGJELENIK a listában, és hogy az útvonal eleme
    // üres, tehát a CSS szabály tényleg rá illeszkedik.
    //
    // A TypeScript excess-property ellenőrzése csak FRISS objektum literálra fut
    // egy kontextuális típus helyén; egy közbülső változóba kötött literál már
    // szélesség szerinti (width) altípusként megy át a `NodeConfig` felé, tehát
    // ez `as` nélkül, type-safe módon előállítható (saját méréssel igazolva).
    const invalidNode: WorkflowNodeInput = {
      id: 'n-extra-key',
      type: 'start',
      label: 'Indítás',
      positionX: 0,
      positionY: 0,
      config: buildConfigWithExtraKey(),
    };
    act(() => {
      root.render(
        <NodeInspector node={invalidNode} onChange={vi.fn()} onClose={vi.fn()} inheritedProviderDescription="nincs" />,
      );
    });
    const errorList = container.querySelector('.node-inspector__errors');
    expect(errorList).not.toBeNull();
    const paths = [...container.querySelectorAll('.node-inspector__error-path')].map((element) => element.textContent);
    expect(paths).toEqual(['']);
  });

  it('az `agent_step` node szerkesztése a type és az onUnhandledError mezőt megőrzi', () => {
    const onChange = vi.fn<OnChange>();
    const agentNode = NODES_BY_TYPE[1]?.node;
    if (agentNode === undefined) {
      throw new Error('a teszt nem talált agent_step node fixture-t');
    }
    act(() => {
      root.render(
        <NodeInspector node={agentNode} onChange={onChange} onClose={vi.fn()} inheritedProviderDescription="nincs" />,
      );
    });
    const promptTextarea = [...container.querySelectorAll('textarea')].find((textarea) => textarea.value === 'sablon');
    if (promptTextarea === undefined) {
      throw new Error('a teszt nem találta a prompt sablon mezőt');
    }
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    act(() => {
      descriptor?.set?.call(promptTextarea, 'módosított');
      promptTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      promptTextarea.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const lastCall = onChange.mock.calls.at(-1);
    if (lastCall === undefined) {
      throw new Error('a teszt nem talált onChange hívást');
    }
    expect(lastCall[0]).toMatchObject({
      id: 'n-agent',
      config: { type: 'agent_step', onUnhandledError: null, promptTemplate: 'módosított' },
    });
  });
});
