/* eslint-disable unicorn/no-null -- a teszt fixture-ök a `node-config` séma nullázható mezőit hordozzák (SPEC-005). */
import type { WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AGENT_STEP_SETTINGS } from './default-agent-step-settings.ts';
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
      config: { type: 'branch', expression: 'input.x', branches: [], defaultBranchKey: null, onUnhandledError: null },
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
      config: {
        type: 'fan_out',
        itemsExpression: 'input.items',
        branchLabelTemplate: '{{item}}',
        onUnhandledError: null,
      },
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
      config: { type: 'loop', maxIterations: 5, continueExpression: 'iteration < 5', onUnhandledError: null },
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
          onDelete={vi.fn()}
          onFieldBlur={vi.fn()}
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

  it.each(NODES_BY_TYPE)(
    'a(z) "$node.type" típusnál a törzs első mezője a "Kezeletlen hiba szabálya" választó helyőrzővel, a választás a config.onUnhandledError mezőbe íródik (SPEC-008 5.2, O-29)',
    ({ node }) => {
      const onChange = vi.fn<OnChange>();
      act(() => {
        root.render(
          <NodeInspector
            node={node}
            onChange={onChange}
            onClose={vi.fn()}
            onDelete={vi.fn()}
            onFieldBlur={vi.fn()}
            inheritedProviderDescription="nincs"
            isSaveAttempted={false}
          />,
        );
      });
      const firstField = container.querySelector(':scope .node-inspector__body .field');
      expect(firstField?.querySelector('.field__label')?.textContent).toBe('Kezeletlen hiba szabálya');
      const trigger = firstField?.querySelector<HTMLButtonElement>('button.select');
      if (trigger === null || trigger === undefined) {
        throw new Error('a teszt nem találta a kezeletlen hiba szabály választóját');
      }
      expect(trigger.className).toContain('select--sm');
      expect(trigger.textContent).toBe('Válassz…');

      act(() => {
        trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
      });
      const panel = document.body.querySelector(`#${trigger.getAttribute('aria-controls') ?? ''}`);
      const options = [...(panel?.querySelectorAll('[role="option"]') ?? [])];
      expect(options.map((option) => option.querySelector('.menu__text')?.textContent)).toEqual([
        'fail_run',
        'fail_branch',
      ]);
      const failBranch = options.find((option) => option.querySelector('.menu__text')?.textContent === 'fail_branch');
      act(() => {
        failBranch?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
      });
      expect(onChange).toHaveBeenLastCalledWith({
        ...node,
        config: { ...node.config, onUnhandledError: 'fail_branch' },
      });
    },
  );

  it('sikertelen mentési kísérlet után a null onUnhandledError a választó alatt jelez, a mentési sémán (SPEC-008 5.4, O-29)', () => {
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
          onDelete={vi.fn()}
          onFieldBlur={vi.fn()}
          inheritedProviderDescription="nincs"
          isSaveAttempted
        />,
      );
    });
    const invalidFields = [...container.querySelectorAll('[aria-invalid="true"]')];
    expect(invalidFields.map((field) => field.closest('.field')?.querySelector('.field__label')?.textContent)).toEqual([
      'Kezeletlen hiba szabálya',
    ]);
    const errorElement = container.querySelector(`#${invalidFields[0]?.getAttribute('aria-describedby') ?? ''}`);
    expect(errorElement?.textContent).toBe('A mező nem lehet üres.');
  });

  it('sikertelen mentési kísérlet után a választatlan join mód a mód választó alatt jelez (SPEC-008 5.4, O-33)', () => {
    const joinNode: WorkflowNodeInput = {
      id: 'n-join-unselected',
      type: 'join',
      label: 'Összefésülés',
      positionX: 0,
      positionY: 0,
      config: { type: 'join', mode: null, onUnhandledError: 'fail_run' },
    };
    act(() => {
      root.render(
        <NodeInspector
          node={joinNode}
          onChange={vi.fn()}
          onClose={vi.fn()}
          onDelete={vi.fn()}
          onFieldBlur={vi.fn()}
          inheritedProviderDescription="nincs"
          isSaveAttempted
        />,
      );
    });
    const invalidFields = [...container.querySelectorAll('[aria-invalid="true"]')];
    expect(invalidFields.map((field) => field.closest('.field')?.querySelector('.field__label')?.textContent)).toEqual([
      'Összefésülés módja',
    ]);
    const errorElement = container.querySelector(`#${invalidFields[0]?.getAttribute('aria-describedby') ?? ''}`);
    expect(errorElement?.textContent).toBe('A mező nem lehet üres.');
  });

  it('EGYETLEN csomópont típuson sincs kártya alakú szakasz doboz a panelen', () => {
    for (const { node } of NODES_BY_TYPE) {
      act(() => {
        root.render(
          <NodeInspector
            node={node}
            onChange={vi.fn()}
            onClose={vi.fn()}
            onDelete={vi.fn()}
            onFieldBlur={vi.fn()}
            inheritedProviderDescription="nincs"
            isSaveAttempted={false}
          />,
        );
      });
      expect(container.querySelector('.inspector-section')).toBeNull();
      expect(container.querySelector('.card')).toBeNull();
      // A csoportosító `fieldset` és `legend` elem sincs (AC16b): a mezők
      // doboz és szegély nélkül, közvetlenül a törzsben állnak.
      expect(container.querySelectorAll('fieldset')).toHaveLength(0);
      expect(container.querySelectorAll('legend')).toHaveLength(0);
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
          onDelete={vi.fn()}
          onFieldBlur={vi.fn()}
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
          onDelete={vi.fn()}
          onFieldBlur={vi.fn()}
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

  it('a bezárás ikon gomb (secondary, sm), aria-label névvel (nincs látható szövege)', () => {
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
          onDelete={vi.fn()}
          onFieldBlur={vi.fn()}
          inheritedProviderDescription="nincs"
          isSaveAttempted={false}
        />,
      );
    });
    const closeButton = container.querySelector<HTMLButtonElement>('button[aria-label="Bezárás"]');
    expect(closeButton?.className).toBe('btn btn--secondary btn--sm btn--icon');
    expect(closeButton?.textContent).toBe('');
    expect(closeButton?.querySelector('svg')).not.toBeNull();
  });

  it('a bezárás gomb `secondary` variáns, nem `ghost`: a ghost szövegszíne az arany akcentus (SPEC-008 72. kritérium, user döntés 2026-10-21)', () => {
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
          onDelete={vi.fn()}
          onFieldBlur={vi.fn()}
          inheritedProviderDescription="nincs"
          isSaveAttempted={false}
        />,
      );
    });
    // A TÉNYLEGES, számított színt az `apps/web/e2e/form-control-typography.spec.ts`
    // méri valódi böngészőben, mert a jelölés önmagában nem bizonyít színt.
    const closeButton = container.querySelector<HTMLButtonElement>('button[aria-label="Bezárás"]');
    expect(closeButton?.classList.contains('btn--secondary')).toBe(true);
    expect(closeButton?.classList.contains('btn--ghost')).toBe(false);
  });

  const DELETABLE_NODES = NODES_BY_TYPE.filter(({ node }) => node.type !== 'start');

  it.each(DELETABLE_NODES)(
    'a(z) "$node.type" panelének fejlécében van danger, sm "Törlés" gomb, ami az onDelete-et hívja, megerősítés nélkül (SPEC-008 5.9)',
    ({ node }) => {
      const onDelete = vi.fn();
      const onClose = vi.fn();
      const onChange = vi.fn<OnChange>();
      act(() => {
        root.render(
          <NodeInspector
            node={node}
            onChange={onChange}
            onClose={onClose}
            onDelete={onDelete}
            onFieldBlur={vi.fn()}
            inheritedProviderDescription="nincs"
            isSaveAttempted={false}
          />,
        );
      });
      const dangerButton = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
        (button) => button.textContent === 'Törlés',
      );
      if (dangerButton === undefined) {
        throw new Error('a teszt nem találta a Törlés gombot');
      }
      expect(dangerButton.className).toContain('btn--danger');
      expect(dangerButton.className).toContain('btn--sm');
      expect(dangerButton.closest('.node-inspector__header')).not.toBeNull();
      expect(dangerButton.closest('.node-inspector__body')).toBeNull();
      expect(document.body.querySelector('[role="dialog"]')).toBeNull();

      act(() => {
        dangerButton.click();
      });
      expect(onDelete).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it('a Start panelén NINCS Törlés gomb (SPEC-008 5.9)', () => {
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
          onDelete={vi.fn()}
          onFieldBlur={vi.fn()}
          inheritedProviderDescription="nincs"
          isSaveAttempted={false}
        />,
      );
    });
    const labels = [...container.querySelectorAll('button')].map((button) => button.textContent);
    expect(labels).not.toContain('Törlés');
    expect(container.querySelector('button[aria-label="Bezárás"]')).not.toBeNull();
  });

  it.each(NODES_BY_TYPE)(
    'a(z) "$node.type" panel gyökér eleme a nokey osztályt viseli, tehát a panelen a Backspace és a Delete nem töröl csomópontot (SPEC-008 5.9)',
    ({ node }) => {
      act(() => {
        root.render(
          <NodeInspector
            node={node}
            onChange={vi.fn()}
            onClose={vi.fn()}
            onDelete={vi.fn()}
            onFieldBlur={vi.fn()}
            inheritedProviderDescription="nincs"
            isSaveAttempted={false}
          />,
        );
      });
      const panel = container.querySelector('aside');
      expect(panel?.classList.contains('node-inspector')).toBe(true);
      expect(panel?.classList.contains('nokey')).toBe(true);
    },
  );

  // A mező szerkesztési menete a `blur`-ig tart (SPEC-008 5.10): a React
  // `onBlur` buborékol, tehát a panel gyökerén a mező elhagyása is ideér.
  it('a panelbeli mező elhagyása az onFieldBlur-t hívja', () => {
    const onFieldBlur = vi.fn();
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
          onDelete={vi.fn()}
          onFieldBlur={onFieldBlur}
          inheritedProviderDescription="nincs"
          isSaveAttempted={false}
        />,
      );
    });
    const field = container.querySelector('textarea');
    if (field === null) {
      throw new Error('a teszt nem talált szöveg mezőt a panelen');
    }
    act(() => {
      field.focus();
    });
    expect(onFieldBlur).not.toHaveBeenCalled();
    act(() => {
      field.blur();
    });
    expect(onFieldBlur).toHaveBeenCalledTimes(1);
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
          onDelete={vi.fn()}
          onFieldBlur={vi.fn()}
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
      config: {
        type: 'loop',
        maxIterations: Number('nem szám'),
        continueExpression: 'iteration < 5',
        onUnhandledError: null,
      },
    };
    act(() => {
      root.render(
        <NodeInspector
          node={invalidNode}
          onChange={vi.fn()}
          onClose={vi.fn()}
          onDelete={vi.fn()}
          onFieldBlur={vi.fn()}
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
      config: {
        type: 'loop',
        maxIterations: Number('nem szám'),
        continueExpression: 'iteration < 5',
        onUnhandledError: null,
      },
    };
    act(() => {
      root.render(
        <NodeInspector
          node={invalidNode}
          onChange={vi.fn()}
          onClose={vi.fn()}
          onDelete={vi.fn()}
          onFieldBlur={vi.fn()}
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
      config: {
        type: 'loop',
        maxIterations: Number('nem szám'),
        continueExpression: 'iteration < 5',
        onUnhandledError: null,
      },
    };
    act(() => {
      root.render(
        <NodeInspector
          node={invalidNode}
          onChange={vi.fn()}
          onClose={vi.fn()}
          onDelete={vi.fn()}
          onFieldBlur={vi.fn()}
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
      config: {
        type: 'loop',
        maxIterations: Number('nem szám'),
        continueExpression: 'iteration < 5',
        onUnhandledError: null,
      },
    };
    act(() => {
      root.render(
        <NodeInspector
          node={invalidNode}
          onChange={vi.fn()}
          onClose={vi.fn()}
          onDelete={vi.fn()}
          onFieldBlur={vi.fn()}
          inheritedProviderDescription="nincs"
          isSaveAttempted
        />,
      );
    });
    expect(container.querySelector('.field__error')).not.toBeNull();
    expect(container.querySelector('[aria-invalid="true"]')).not.toBeNull();
  });

  it('sikertelen mentési kísérlet után az üres kötelező szöveg mező a mező alatt jelez, a mentési sémán (SPEC-008 5.4, O-21)', () => {
    const branchNode: WorkflowNodeInput = {
      id: 'n-branch-blank',
      type: 'branch',
      label: 'Elágazás',
      positionX: 0,
      positionY: 0,
      config: {
        type: 'branch',
        expression: ' '.repeat(3),
        branches: [{ key: '', label: 'Pozitív' }],
        defaultBranchKey: null,
        onUnhandledError: 'fail_run',
      },
    };
    act(() => {
      root.render(
        <NodeInspector
          node={branchNode}
          onChange={vi.fn()}
          onClose={vi.fn()}
          onDelete={vi.fn()}
          onFieldBlur={vi.fn()}
          inheritedProviderDescription="nincs"
          isSaveAttempted
        />,
      );
    });

    const invalidFields = [...container.querySelectorAll('[aria-invalid="true"]')];
    expect(invalidFields.map((field) => field.closest('.field')?.querySelector('.field__label')?.textContent)).toEqual([
      'Feltétel kifejezés',
      'Ág kulcsa',
    ]);
    for (const field of invalidFields) {
      const errorElement = container.querySelector(`#${field.getAttribute('aria-describedby') ?? ''}`);
      expect(errorElement?.textContent).toBe('A mező nem lehet üres.');
    }
  });

  for (const { description, config, expectedLabels } of [
    {
      description: 'a felvett ciklus',
      config: { type: 'loop', maxIterations: NaN, continueExpression: '', onUnhandledError: null },
      expectedLabels: ['Kezeletlen hiba szabálya', 'Max. iterációk száma', 'Folytatás feltétel (continueExpression)'],
    },
    {
      description: 'a felvett hibakezelő',
      config: {
        type: 'error_handler',
        maxAttempts: NaN,
        backoffMs: [],
        handledErrorKinds: [],
        onUnhandledError: null,
      },
      expectedLabels: ['Kezeletlen hiba szabálya', 'Max. próbálkozások száma'],
    },
  ] satisfies readonly {
    readonly description: string;
    readonly config: WorkflowNodeInput['config'];
    readonly expectedLabels: readonly string[];
  }[]) {
    it(`${description}: egy sikertelen mentési kísérlet után a szám mező típushibája mellett minden üres kötelező mező is jelez (SPEC-008 81. kritérium)`, () => {
      const addedNode: WorkflowNodeInput = {
        id: 'n-added',
        type: config.type,
        label: '',
        positionX: 0,
        positionY: 0,
        config,
      };
      act(() => {
        root.render(
          <NodeInspector
            node={addedNode}
            onChange={vi.fn()}
            onClose={vi.fn()}
            onDelete={vi.fn()}
            onFieldBlur={vi.fn()}
            inheritedProviderDescription="nincs"
            isSaveAttempted
          />,
        );
      });

      const invalidFields = [...container.querySelectorAll('[aria-invalid="true"]')];
      expect(
        invalidFields.map((field) => field.closest('.field')?.querySelector('.field__label')?.textContent),
      ).toEqual(expectedLabels);
    });
  }

  it('kitöltött kötelező szöveg mezőknél a mentési kísérlet után sincs hibaüzenet', () => {
    const branchNode: WorkflowNodeInput = {
      id: 'n-branch-filled',
      type: 'branch',
      label: 'Elágazás',
      positionX: 0,
      positionY: 0,
      config: {
        type: 'branch',
        expression: 'input.x > 0',
        branches: [{ key: 'pos', label: 'Pozitív' }],
        defaultBranchKey: null,
        onUnhandledError: 'fail_run',
      },
    };
    act(() => {
      root.render(
        <NodeInspector
          node={branchNode}
          onChange={vi.fn()}
          onClose={vi.fn()}
          onDelete={vi.fn()}
          onFieldBlur={vi.fn()}
          inheritedProviderDescription="nincs"
          isSaveAttempted
        />,
      );
    });

    expect(container.querySelector('[aria-invalid="true"]')).toBeNull();
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
          onDelete={vi.fn()}
          onFieldBlur={vi.fn()}
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

  for (const { description, config, expectedLabels } of [
    {
      description: 'a ciklus nulla iterációszáma',
      config: { type: 'loop', maxIterations: 0, continueExpression: 'iteration < 3', onUnhandledError: 'fail_run' },
      expectedLabels: ['Max. iterációk száma'],
    },
    {
      description: 'a hibakezelő negatív próbálkozásszáma és tört várakozása',
      config: {
        type: 'error_handler',
        maxAttempts: -3,
        backoffMs: [100, 1.5],
        handledErrorKinds: [],
        onUnhandledError: 'fail_run',
      },
      expectedLabels: ['Max. próbálkozások száma', 'Várakozás próbálkozásonként, ms (soronként egy szám)'],
    },
  ] satisfies readonly {
    readonly description: string;
    readonly config: WorkflowNodeInput['config'];
    readonly expectedLabels: readonly string[];
  }[]) {
    it(`${description}: sikertelen mentési kísérlet után a szám mező alatt jelez (SPEC-008 5.4, O-37)`, () => {
      act(() => {
        root.render(
          <NodeInspector
            node={{ id: 'n-number', type: config.type, label: '', positionX: 0, positionY: 0, config }}
            onChange={vi.fn()}
            onClose={vi.fn()}
            onDelete={vi.fn()}
            onFieldBlur={vi.fn()}
            inheritedProviderDescription="nincs"
            isSaveAttempted
          />,
        );
      });

      const invalidFields = [...container.querySelectorAll('[aria-invalid="true"]')];
      expect(
        invalidFields.map((field) => field.closest('.field')?.querySelector('.field__label')?.textContent),
      ).toEqual(expectedLabels);
      for (const field of invalidFields) {
        const errorElement = container.querySelector(`#${field.getAttribute('aria-describedby') ?? ''}`);
        expect(errorElement?.textContent).toBe('A mező értéke nem pozitív egész szám.');
      }
    });
  }

  for (const { description, config } of [
    {
      description: 'agent lépés',
      config: {
        ...AGENT_STEP_SETTINGS,
        agents: { kutato: { description: '', prompt: ' '.repeat(2) } },
        type: 'agent_step',
        onUnhandledError: 'fail_run',
      },
    },
    {
      description: 'ai_synthesis módú összefésülés',
      config: {
        type: 'join',
        mode: 'ai_synthesis',
        settings: { ...AGENT_STEP_SETTINGS, agents: { kutato: { description: '', prompt: ' '.repeat(2) } } },
        onUnhandledError: 'fail_run',
      },
    },
  ] satisfies readonly { readonly description: string; readonly config: WorkflowNodeInput['config'] }[]) {
    it(`${description}: sikertelen mentési kísérlet után az agent bejegyzés üres leírása és promptja a mező alatt jelez (SPEC-008 5.4, O-38)`, () => {
      act(() => {
        root.render(
          <NodeInspector
            node={{ id: 'n-agents', type: config.type, label: '', positionX: 0, positionY: 0, config }}
            onChange={vi.fn()}
            onClose={vi.fn()}
            onDelete={vi.fn()}
            onFieldBlur={vi.fn()}
            inheritedProviderDescription="nincs"
            isSaveAttempted
          />,
        );
      });
      const expandButton = [...container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Kibontás',
      );
      act(() => {
        expandButton?.click();
      });

      const invalidFields = [...container.querySelectorAll('[aria-invalid="true"]')];
      expect(
        invalidFields.map((field) => field.closest('.field')?.querySelector('.field__label')?.textContent),
      ).toEqual(['Leírás', 'Prompt']);
      for (const field of invalidFields) {
        const errorElement = container.querySelector(`#${field.getAttribute('aria-describedby') ?? ''}`);
        expect(errorElement?.textContent).toBe('A mező nem lehet üres.');
      }
    });
  }

  it('kitöltött agent bejegyzésnél a mentési kísérlet után sincs hibaüzenet (SPEC-008 5.4, O-38)', () => {
    const config: WorkflowNodeInput['config'] = {
      ...AGENT_STEP_SETTINGS,
      agents: { kutato: { description: 'Kutató', prompt: 'Keress forrást.' } },
      type: 'agent_step',
      onUnhandledError: 'fail_run',
    };
    act(() => {
      root.render(
        <NodeInspector
          node={{ id: 'n-agents', type: 'agent_step', label: '', positionX: 0, positionY: 0, config }}
          onChange={vi.fn()}
          onClose={vi.fn()}
          onDelete={vi.fn()}
          onFieldBlur={vi.fn()}
          inheritedProviderDescription="nincs"
          isSaveAttempted
        />,
      );
    });
    const expandButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Kibontás');
    act(() => {
      expandButton?.click();
    });

    expect(container.querySelector('[aria-invalid="true"]')).toBeNull();
  });
});

describe('NodeInspector: a sablon és kifejezés mezők fordítási hibája (SPEC-010 10., AC43, AC46)', () => {
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

  // A két nyelv egy-egy mezője: a `branch` kifejezése (CEL) és a
  // `human_approval` törzs sablonja (Mustache), a valódi csomag mondatával.
  const LANGUAGE_CASES = [
    {
      language: 'CEL kifejezés',
      label: 'Feltétel kifejezés',
      message: 'Nem deklarált változó a kifejezésben (pozíció: 0).',
      node: {
        id: 'n-branch-cel',
        type: 'branch',
        label: 'Elágazás',
        positionX: 0,
        positionY: 0,
        config: {
          type: 'branch',
          expression: 'titokNeve > 1',
          branches: [],
          defaultBranchKey: null,
          onUnhandledError: 'fail_run',
        },
      },
    },
    {
      language: 'Mustache sablon',
      label: 'Törzs sablon (bodyTemplate)',
      message: 'Le nem zárt szakasz a sablonban (pozíció: 10).',
      node: {
        id: 'n-approval-mustache',
        type: 'human_approval',
        label: 'Jóváhagyás',
        positionX: 0,
        positionY: 0,
        config: {
          type: 'human_approval',
          title: 'Cím',
          bodyTemplate: '{{#titok}}',
          timeoutMs: null,
          onUnhandledError: 'fail_run',
        },
      },
    },
  ] as const satisfies readonly {
    readonly language: string;
    readonly label: string;
    readonly message: string;
    readonly node: WorkflowNodeInput;
  }[];

  // A 9.2 lista többi öt mezője (AC43): a fenti kettővel együtt mind a hét sablon és
  // kifejezés mező alatt a csomag mondata jelenik meg.
  const UNCLOSED_SECTION = 'Le nem zárt szakasz a sablonban (pozíció: 10).';
  const UNDECLARED_VARIABLE = 'Nem deklarált változó a kifejezésben (pozíció: 0).';
  const REMAINING_LANGUAGE_CASES = [
    {
      field: 'agent_step promptTemplate',
      label: 'Prompt sablon',
      message: UNCLOSED_SECTION,
      node: {
        id: 'n-agent-mustache',
        type: 'agent_step',
        label: 'Agent',
        positionX: 0,
        positionY: 0,
        config: {
          ...DEFAULT_AGENT_STEP_SETTINGS,
          type: 'agent_step',
          promptTemplate: '{{#titok}}',
          onUnhandledError: 'fail_run',
        },
      },
    },
    {
      field: 'join settings.promptTemplate',
      label: 'Prompt sablon',
      message: UNCLOSED_SECTION,
      node: {
        id: 'n-join-mustache',
        type: 'join',
        label: 'Összefésülés',
        positionX: 0,
        positionY: 0,
        config: {
          type: 'join',
          mode: 'ai_synthesis',
          settings: { ...DEFAULT_AGENT_STEP_SETTINGS, promptTemplate: '{{#titok}}' },
          onUnhandledError: 'fail_run',
        },
      },
    },
    {
      field: 'fan_out itemsExpression',
      label: 'Elemek kifejezés (itemsExpression)',
      message: UNDECLARED_VARIABLE,
      node: {
        id: 'n-fan-out-cel',
        type: 'fan_out',
        label: 'Szétosztás',
        positionX: 0,
        positionY: 0,
        config: {
          type: 'fan_out',
          itemsExpression: 'titokNeve',
          branchLabelTemplate: '{{item}}',
          onUnhandledError: 'fail_run',
        },
      },
    },
    {
      field: 'fan_out branchLabelTemplate',
      label: 'Ág címke sablon (branchLabelTemplate)',
      message: UNCLOSED_SECTION,
      node: {
        id: 'n-fan-out-mustache',
        type: 'fan_out',
        label: 'Szétosztás',
        positionX: 0,
        positionY: 0,
        config: {
          type: 'fan_out',
          itemsExpression: 'input.items',
          branchLabelTemplate: '{{#titok}}',
          onUnhandledError: 'fail_run',
        },
      },
    },
    {
      field: 'loop continueExpression',
      label: 'Folytatás feltétel (continueExpression)',
      message: UNDECLARED_VARIABLE,
      node: {
        id: 'n-loop-cel',
        type: 'loop',
        label: 'Ciklus',
        positionX: 0,
        positionY: 0,
        config: { type: 'loop', maxIterations: 3, continueExpression: 'titokNeve > 1', onUnhandledError: 'fail_run' },
      },
    },
  ] satisfies readonly {
    readonly field: string;
    readonly label: string;
    readonly message: string;
    readonly node: WorkflowNodeInput;
  }[];

  function renderInspector(node: WorkflowNodeInput, isSaveAttempted: boolean): void {
    act(() => {
      root.render(
        <NodeInspector
          node={node}
          onChange={vi.fn()}
          onClose={vi.fn()}
          onDelete={vi.fn()}
          onFieldBlur={vi.fn()}
          inheritedProviderDescription="nincs"
          isSaveAttempted={isSaveAttempted}
        />,
      );
    });
  }

  function fieldControl(label: string): HTMLTextAreaElement {
    const field = [...container.querySelectorAll('.field')].find(
      (candidate) => candidate.querySelector('.field__label')?.textContent === label,
    );
    const control = field?.querySelector('textarea');
    if (control === null || control === undefined) {
      throw new Error(`a teszt nem találta a(z) "${label}" mezőt`);
    }
    return control;
  }

  function expectErrorUnder(control: HTMLTextAreaElement, message: string): void {
    expect(control.getAttribute('aria-invalid')).toBe('true');
    const errorElement = container.querySelector(`#${control.getAttribute('aria-describedby') ?? ''}`);
    expect(errorElement?.textContent).toBe(message);
    expect(errorElement?.getAttribute('role')).toBe('alert');
    // A hibaüzenet a mező UTÁN áll a DOM-ban, tehát alatta jelenik meg.
    expect(control.compareDocumentPosition(errorElement ?? control)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  }

  it.each(LANGUAGE_CASES)(
    '$language: érintetlen mezőn, mentési kísérlet nélkül nincs hibaüzenet',
    ({ node, label }) => {
      renderInspector(node, false);
      const control = fieldControl(label);
      expect(control.getAttribute('aria-invalid')).toBeNull();
      expect(container.querySelector('.field__error')).toBeNull();
    },
  );

  it.each(LANGUAGE_CASES)(
    '$language: az érintett, fordíthatatlan mező alatt a csomag mondata áll, aria kötéssel',
    ({ node, label, message }) => {
      renderInspector(node, false);
      const control = fieldControl(label);
      act(() => {
        control.focus();
        control.blur();
      });
      expectErrorUnder(control, message);
    },
  );

  it.each(LANGUAGE_CASES)(
    '$language: sikertelen mentési kísérlet után az érintetlen, fordíthatatlan mező is jelez',
    ({ node, label, message }) => {
      renderInspector(node, true);
      expectErrorUnder(fieldControl(label), message);
    },
  );

  it.each(REMAINING_LANGUAGE_CASES)(
    '$field: az érintett, fordíthatatlan mező alatt a csomag mondata áll, aria kötéssel (AC43)',
    ({ node, label, message }) => {
      renderInspector(node, false);
      const control = fieldControl(label);
      act(() => {
        control.focus();
        control.blur();
      });
      expectErrorUnder(control, message);
    },
  );

  it.each(REMAINING_LANGUAGE_CASES)(
    '$field: sikertelen mentési kísérlet után az érintetlen, fordíthatatlan mező is jelez (AC43)',
    ({ node, label, message }) => {
      renderInspector(node, true);
      expectErrorUnder(fieldControl(label), message);
    },
  );

  it.each([
    {
      language: 'CEL kifejezés',
      label: 'Feltétel kifejezés',
      node: {
        ...LANGUAGE_CASES[0].node,
        config: { ...LANGUAGE_CASES[0].node.config, expression: 'input.x > 0' },
      },
    },
    {
      language: 'Mustache sablon',
      label: 'Törzs sablon (bodyTemplate)',
      node: {
        ...LANGUAGE_CASES[1].node,
        config: { ...LANGUAGE_CASES[1].node.config, bodyTemplate: 'Szia {{input.nev}}' },
      },
    },
  ] satisfies readonly { readonly language: string; readonly label: string; readonly node: WorkflowNodeInput }[])(
    '$language: a lefordítható mező a mentési kísérlet után sem jelez',
    ({ node, label }) => {
      renderInspector(node, true);
      expect(fieldControl(label).getAttribute('aria-invalid')).toBeNull();
      expect(container.querySelector('.field__error')).toBeNull();
    },
  );

  it('a séma hibájú mező alatt a séma hibája áll, nem a fordítási hiba (AC46)', () => {
    // A csak szóközös kifejezés a mentési séma szerint üres, és a CEL
    // fordítás is elbuktatná: a mező alatt a séma mondata marad.
    renderInspector(
      {
        ...LANGUAGE_CASES[0].node,
        config: { ...LANGUAGE_CASES[0].node.config, expression: ' '.repeat(3) },
      },
      true,
    );
    expectErrorUnder(fieldControl('Feltétel kifejezés'), 'A mező nem lehet üres.');
  });
});
