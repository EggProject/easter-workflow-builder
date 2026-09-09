/* eslint-disable unicorn/no-null -- a teszt fixture-ök a `node-config` séma nullázható mezőit hordozzák (SPEC-005). */
import type { WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeInspector } from './NodeInspector.tsx';

type OnChange = (updatedNode: WorkflowNodeInput) => void;

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
    legend: 'Bemeneti mező hozzáadása',
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
    legend: 'Prompt sablon',
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
    legend: 'Feltétel kifejezés',
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
    legend: 'Elemek kifejezés (itemsExpression)',
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
    legend: 'Összefésülés módja',
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
    legend: 'Max. iterációk száma',
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
    legend: 'Törzs sablon (bodyTemplate)',
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
    legend: 'Max. próbálkozások száma',
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
    legend: 'Célzott workflow azonosítója',
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
    legend: 'Forrás (source)',
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

  it.each(NODES_BY_TYPE)('a(z) "$node.type" típusra a megfelelő mezőket rendereli', ({ node, legend }) => {
    act(() => {
      root.render(
        <NodeInspector
          node={node}
          onChange={vi.fn()}
          onClose={vi.fn()}
          inheritedProviderDescription="nincs"
          isSaveAttempted={false}
        />,
      );
    });
    // A típus azonosítója a típusra jellemző, ELÖL álló mező (vagy gomb)
    // felirata: a kártya alakú szakaszcímek megszűntek, a mezők pedig
    // panel nélkül, közvetlenül a panel törzsében állnak.
    expect(container.textContent).toContain(legend);
  });

  it('EGYETLEN csomópont típuson sincs kártya alakú szakasz doboz a panelen', () => {
    for (const { node } of NODES_BY_TYPE) {
      act(() => {
        root.render(
          <NodeInspector
            node={node}
            onChange={vi.fn()}
            onClose={vi.fn()}
            inheritedProviderDescription="nincs"
            isSaveAttempted={false}
          />,
        );
      });
      expect(container.querySelector('.inspector-section')).toBeNull();
      expect(container.querySelector('.card')).toBeNull();
    }
  });

  it('a fejlécben megjeleníti a katalógus címkét és a node azonosítót', () => {
    const startNode = NODES_BY_TYPE[0]?.node;
    if (startNode === undefined) {
      throw new Error('a teszt nem talált start node fixture-t');
    }
    act(() => {
      root.render(
        <NodeInspector
          node={startNode}
          onChange={vi.fn()}
          onClose={vi.fn()}
          inheritedProviderDescription="nincs"
          isSaveAttempted={false}
        />,
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
        <NodeInspector
          node={startNode}
          onChange={vi.fn()}
          onClose={onClose}
          inheritedProviderDescription="nincs"
          isSaveAttempted={false}
        />,
      );
    });
    const closeButton = container.querySelector('button[aria-label="Bezárás"]');
    if (closeButton === null) {
      throw new Error('a teszt nem találta a Bezárás gombot');
    }
    act(() => {
      closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a bezárás a design system panel bezáró vezérlője, aria-label névvel (nincs látható szövege)', () => {
    const startNode = NODES_BY_TYPE[0]?.node;
    if (startNode === undefined) {
      throw new Error('a teszt nem talált start node fixture-t');
    }
    act(() => {
      root.render(
        <NodeInspector
          node={startNode}
          onChange={vi.fn()}
          onClose={vi.fn()}
          inheritedProviderDescription="nincs"
          isSaveAttempted={false}
        />,
      );
    });
    const closeButton = container.querySelector<HTMLButtonElement>('button[aria-label="Bezárás"]');
    expect(closeButton?.className).toBe('node-inspector__close');
    expect(closeButton?.textContent).toBe('');
    expect(closeButton?.querySelector('svg')).not.toBeNull();
  });

  it('a bezárás gomb egyáltalán nem `.btn` variáns - a bezárás nem elsődleges művelet', () => {
    const startNode = NODES_BY_TYPE[0]?.node;
    if (startNode === undefined) {
      throw new Error('a teszt nem talált start node fixture-t');
    }
    act(() => {
      root.render(
        <NodeInspector
          node={startNode}
          onChange={vi.fn()}
          onClose={vi.fn()}
          inheritedProviderDescription="nincs"
          isSaveAttempted={false}
        />,
      );
    });
    // A design system `.btn--ghost` variánsának szövegszíne az arany
    // `--ep-accent-fg`, tehát a ghost sem semleges: a panel bezárására a
    // design system saját, `--ep-fg-muted` színű vezérlője jár (Drawer,
    // Modal). Ez a teszt csak a jelölést állítja; a TÉNYLEGES, számított
    // színt az `apps/web/e2e/form-control-typography.spec.ts` méri valódi
    // böngészőben, mert a jelölés önmagában nem bizonyít színt.
    const closeButton = container.querySelector<HTMLButtonElement>('button[aria-label="Bezárás"]');
    expect(closeButton?.className).not.toContain('btn');
  });

  it('a panel MINDEN gombja sm méretű', () => {
    const agentNode = NODES_BY_TYPE[1]?.node;
    if (agentNode === undefined) {
      throw new Error('a teszt nem talált agent_step node fixture-t');
    }
    act(() => {
      root.render(
        <NodeInspector
          node={agentNode}
          onChange={vi.fn()}
          onClose={vi.fn()}
          inheritedProviderDescription="nincs"
          isSaveAttempted={false}
        />,
      );
    });
    // Az `accordion__header` NEM `.btn`, hanem a design system saját panel
    // fejléce, ezért a méret szabály a `.btn` osztályt viselő gombokra szól.
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('button.btn')];
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.className).toContain('btn--sm');
    }
  });

  it('a panel TETEJÉN nincs hibaösszesítő, érvénytelen config esetén sem', () => {
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
        <NodeInspector
          node={invalidNode}
          onChange={vi.fn()}
          onClose={vi.fn()}
          inheritedProviderDescription="nincs"
          isSaveAttempted={false}
        />,
      );
    });
    expect(container.querySelector('.node-inspector__errors')).toBeNull();
    expect(container.textContent).not.toContain('Érvénytelen mezők');
  });

  it('ÉRINTETLEN, érvénytelen mezőn nincs hibaüzenet', () => {
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
        <NodeInspector
          node={invalidNode}
          onChange={vi.fn()}
          onClose={vi.fn()}
          inheritedProviderDescription="nincs"
          isSaveAttempted={false}
        />,
      );
    });
    expect(container.querySelector('.field__error')).toBeNull();
    expect(container.querySelector('[aria-invalid="true"]')).toBeNull();
  });

  it('ÉRINTETT, érvénytelen mezőn a hibaüzenet a mező ALATT jelenik meg, aria kötéssel', () => {
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
        <NodeInspector
          node={invalidNode}
          onChange={vi.fn()}
          onClose={vi.fn()}
          inheritedProviderDescription="nincs"
          isSaveAttempted={false}
        />,
      );
    });
    const numberInput = container.querySelector<HTMLInputElement>('input[type="number"]');
    if (numberInput === null) {
      throw new Error('a teszt nem találta a max. iterációk mezőt');
    }
    act(() => {
      numberInput.focus();
      numberInput.blur();
    });
    expect(numberInput.getAttribute('aria-invalid')).toBe('true');
    const errorElement = container.querySelector('.field__error');
    expect(errorElement).not.toBeNull();
    expect(errorElement?.id).toBe(numberInput.getAttribute('aria-describedby'));
    // A hibaüzenet a mező UTÁN áll a DOM-ban, tehát alatta jelenik meg.
    expect(numberInput.compareDocumentPosition(errorElement ?? numberInput)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(errorElement?.getAttribute('role')).toBe('alert');
  });

  it('sikertelen mentési kísérlet után az ÉRINTETLEN, érvénytelen mező is kiírja a hibáját', () => {
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
        <NodeInspector
          node={invalidNode}
          onChange={vi.fn()}
          onClose={vi.fn()}
          inheritedProviderDescription="nincs"
          isSaveAttempted
        />,
      );
    });
    expect(container.querySelector('.field__error')).not.toBeNull();
    expect(container.querySelector('[aria-invalid="true"]')).not.toBeNull();
  });

  it('az `agent_step` node szerkesztése a type és az onUnhandledError mezőt megőrzi', () => {
    const onChange = vi.fn<OnChange>();
    const agentNode = NODES_BY_TYPE[1]?.node;
    if (agentNode === undefined) {
      throw new Error('a teszt nem talált agent_step node fixture-t');
    }
    act(() => {
      root.render(
        <NodeInspector
          node={agentNode}
          onChange={onChange}
          onClose={vi.fn()}
          inheritedProviderDescription="nincs"
          isSaveAttempted={false}
        />,
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
