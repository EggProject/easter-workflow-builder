/* eslint-disable unicorn/no-null -- a szintetikus WorkflowNodeInput fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak), nem helyőrző `undefined`-et */
import type { StepRunStatus, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { StepRunStatusSchema } from '@easter-workflow-builder/protocol';
import { ReactFlow } from '@xyflow/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GraphNodeCard } from './GraphNodeCard.tsx';
import type { GraphNodeCardFlowNode, RunNodeSummary } from './graph-node-card-data.ts';
import { SCRIPT_UNIMPLEMENTED_ERROR_CLASS } from './script-unimplemented-error-class.ts';

const NODE_TYPES = { workflowNode: GraphNodeCard };

/**
 * A T-009-3 mérés szerinti mezőpár (`initialWidth`/`initialHeight`), ami
 * happy-dom alatt ugyanúgy láthatóvá teszi a node-ot, mint a `width`/
 * `height` (`docs/research/2026-09-05-plan009-f0-blokkolo-meresek.md` 2.
 * szekció). A számérték itt kizárólag teszt fixture méret, nem a T-009-19
 * mért kártya konstans.
 */
const TEST_NODE_SIZE = { initialWidth: 220, initialHeight: 96 };

function buildFlowNode(workflowNode: WorkflowNodeInput, status?: StepRunStatus): GraphNodeCardFlowNode {
  return {
    id: workflowNode.id,
    type: 'workflowNode',
    position: { x: workflowNode.positionX, y: workflowNode.positionY },
    // `exactOptionalPropertyTypes: true` miatt a `status` kulcsot csak akkor
    // vesszük fel, ha valódi értéke van - `{ status: undefined }` nem
    // egyenértékű a kulcs hiányával ez alatt a beállítás alatt.
    data: status === undefined ? { workflowNode } : { workflowNode, status },
    ...TEST_NODE_SIZE,
  };
}

function buildDecoratedFlowNode(
  workflowNode: WorkflowNodeInput,
  summary: RunNodeSummary,
  onOpenSubWorkflowRun: (subWorkflowRunId: string) => void = () => {
    // a legtöbb összesítés nem navigál
  },
): GraphNodeCardFlowNode {
  const base = buildFlowNode(workflowNode);
  return { ...base, data: { ...base.data, runDecoration: { summary, onOpenSubWorkflowRun } } };
}

/**
 * A két futás nézeti jelvény adatával (SPEC-008 6.6): a megjelenített lépés
 * futás `attempt` és `status` értéke, illetve a legutóbbi döntésből számolt
 * `usedDefaultBranch` jelző. Az `exactOptionalPropertyTypes: true` miatt csak
 * a megadott kulcsok kerülnek fel.
 */
function buildBadgedFlowNode(
  workflowNode: WorkflowNodeInput,
  badges: Readonly<{ status?: StepRunStatus; attempt?: number; usedDefaultBranch?: true }>,
): GraphNodeCardFlowNode {
  const base = buildFlowNode(workflowNode);
  return { ...base, data: { ...base.data, ...badges } };
}

const AGENT_STEP_SETTINGS = {
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
  sessionMode: 'isolated' as const,
  structuredOutput: null,
};

const WORKFLOW_NODES: Readonly<Record<WorkflowNodeInput['type'], WorkflowNodeInput>> = {
  start: {
    id: 'n-start',
    type: 'start',
    label: 'Indítás',
    positionX: 0,
    positionY: 0,
    config: { type: 'start', inputFields: [], onUnhandledError: null },
  },
  agent_step: {
    id: 'n-agent',
    type: 'agent_step',
    label: 'Összefoglaló',
    positionX: 0,
    positionY: 0,
    config: { ...AGENT_STEP_SETTINGS, type: 'agent_step', onUnhandledError: null },
  },
  branch: {
    id: 'n-branch',
    type: 'branch',
    label: 'Elágazás',
    positionX: 0,
    positionY: 0,
    config: {
      type: 'branch',
      expression: 'x > 0',
      branches: [
        { key: 'pos', label: 'Pozitív' },
        { key: 'neg', label: 'Negatív' },
      ],
      defaultBranchKey: null,
      onUnhandledError: null,
    },
  },
  fan_out: {
    id: 'n-fan-out',
    type: 'fan_out',
    label: 'Szétosztás',
    positionX: 0,
    positionY: 0,
    config: { type: 'fan_out', itemsExpression: 'items', branchLabelTemplate: '{{item}}', onUnhandledError: null },
  },
  join: {
    id: 'n-join',
    type: 'join',
    label: 'Összefésülés',
    positionX: 0,
    positionY: 0,
    config: { type: 'join', mode: 'merge', settings: {}, onUnhandledError: null },
  },
  loop: {
    id: 'n-loop',
    type: 'loop',
    label: 'Ciklus',
    positionX: 0,
    positionY: 0,
    config: { type: 'loop', maxIterations: 5, continueExpression: 'i < 5', onUnhandledError: null },
  },
  human_approval: {
    id: 'n-approval',
    type: 'human_approval',
    label: 'Jóváhagyás',
    positionX: 0,
    positionY: 0,
    config: {
      type: 'human_approval',
      title: 'Engedélyezed?',
      bodyTemplate: 'Kérlek erősítsd meg',
      timeoutMs: null,
      onUnhandledError: null,
    },
  },
  error_handler: {
    id: 'n-error-handler',
    type: 'error_handler',
    label: 'Hibakezelő',
    positionX: 0,
    positionY: 0,
    config: {
      type: 'error_handler',
      maxAttempts: 3,
      backoffMs: [1000, 2000],
      handledErrorKinds: ['timeout'],
      onUnhandledError: null,
    },
  },
  sub_workflow: {
    id: 'n-sub-workflow',
    type: 'sub_workflow',
    label: 'Al-workflow',
    positionX: 0,
    positionY: 0,
    config: { type: 'sub_workflow', targetWorkflowId: 'wf-1', inputMapping: {}, onUnhandledError: null },
  },
  script: {
    id: 'n-script',
    type: 'script',
    label: 'Szkript',
    positionX: 0,
    positionY: 0,
    config: { type: 'script', source: 'x + 1', runtime: 'expression', onUnhandledError: null },
  },
};

describe('GraphNodeCard', () => {
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

  function renderNodes(flowNodes: GraphNodeCardFlowNode[]): void {
    act(() => {
      root.render(<ReactFlow nodes={flowNodes} edges={[]} nodeTypes={NODE_TYPES} />);
    });
  }

  function handleElements(kind: 'source' | 'target'): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>(`.react-flow__handle.${kind}`)];
  }

  function sourceHandleIds(): (string | undefined)[] {
    return handleElements('source').map((element) => element.dataset['handleid']);
  }

  it('a start bemenet nélküli, egy kimenő (névtelen) handle-t rajzol', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.start)]);
    expect(handleElements('target')).toHaveLength(0);
    expect(sourceHandleIds()).toEqual([undefined]);
  });

  it('az agent_step egy bemenő és egy névtelen kimenő handle-t rajzol', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.agent_step)]);
    expect(handleElements('target')).toHaveLength(1);
    expect(sourceHandleIds()).toEqual([undefined]);
  });

  it('a branch pontosan a config.branches listája szerint rajzol kimenő handle-t, kulcs nélküli kimenet nélkül (O-23)', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.branch)]);
    expect(handleElements('target')).toHaveLength(1);
    expect(sourceHandleIds()).toEqual(['pos', 'neg']);
    expect(handleElements('source').map((element) => element.getAttribute('aria-label'))).toEqual([
      'Pozitív',
      'Negatív',
    ]);
    expect(container.querySelector('[aria-label="Alapértelmezett"]')).toBeNull();
  });

  it('az üres ág listájú branch nulla kimenő handle-t rajzol', () => {
    const { branch } = WORKFLOW_NODES;
    if (branch.config.type !== 'branch') {
      throw new Error('a branch fixture config.type mezője nem branch');
    }
    renderNodes([buildFlowNode({ ...branch, config: { ...branch.config, branches: [] } })]);
    expect(handleElements('target')).toHaveLength(1);
    expect(sourceHandleIds()).toEqual([]);
  });

  it('a branch node nulla kimenő handle-t rajzol, ha a config.type nem branch (a séma nem kapcsolja össze a két mezőt)', () => {
    renderNodes([
      buildFlowNode({
        ...WORKFLOW_NODES.branch,
        config: WORKFLOW_NODES.fan_out.config,
      }),
    ]);
    expect(handleElements('target')).toHaveLength(1);
    expect(sourceHandleIds()).toEqual([]);
  });

  it('a fan_out egy bemenő és egy névtelen kimenő handle-t rajzol', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.fan_out)]);
    expect(handleElements('target')).toHaveLength(1);
    expect(sourceHandleIds()).toEqual([undefined]);
  });

  it('a join egy bemenő és egy névtelen kimenő handle-t rajzol', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.join)]);
    expect(handleElements('target')).toHaveLength(1);
    expect(sourceHandleIds()).toEqual([undefined]);
  });

  it('a loop két, fenntartott azonosítójú kimenő handle-t rajzol (continue, exit)', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.loop)]);
    expect(sourceHandleIds()).toEqual(['continue', 'exit']);
  });

  it('a human_approval két, fenntartott azonosítójú kimenő handle-t rajzol (approved, rejected)', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.human_approval)]);
    expect(sourceHandleIds()).toEqual(['approved', 'rejected']);
  });

  it('az error_handler egy névtelen és egy on_error kimenő handle-t rajzol', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.error_handler)]);
    expect(sourceHandleIds()).toEqual([undefined, 'on_error']);
  });

  it('a sub_workflow egy bemenő és egy névtelen kimenő handle-t rajzol', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.sub_workflow)]);
    expect(handleElements('target')).toHaveLength(1);
    expect(sourceHandleIds()).toEqual([undefined]);
  });

  it('a script egy bemenő és egy névtelen kimenő handle-t rajzol, plusz figyelmeztetést', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.script)]);
    expect(handleElements('target')).toHaveLength(1);
    expect(sourceHandleIds()).toEqual([undefined]);
    expect(container.textContent).toContain(`Nem futtatható: \`${SCRIPT_UNIMPLEMENTED_ERROR_CLASS}\``);
  });

  it('a nem script típusok egyike sem jeleníti meg a script figyelmeztetést', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.agent_step)]);
    expect(container.textContent).not.toContain('Nem futtatható');
  });

  // A nyolc magyar felirat literálként (SPEC-008 6.2 táblázat, AC21), nem a
  // `describeStepRunStatusBadge` hívásából számolva: a teszt így a leképezés
  // hibáját is észreveszi. A `satisfies` kimerítővé teszi: egy kilencedik
  // állapot fordítási hibát ad.
  const STEP_RUN_STATUS_LABELS = {
    pending: 'várakozik',
    running: 'fut',
    waiting_approval: 'jóváhagyásra vár',
    succeeded: 'sikeres',
    failed: 'sikertelen',
    rejected: 'elutasítva',
    cancelled: 'megszakítva',
    interrupted: 'félbeszakítva',
  } satisfies Readonly<Record<StepRunStatus, string>>;

  it.each(StepRunStatusSchema.options)('a "%s" StepRunStatus badge felirata megjelenik a kártyán', (status) => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.agent_step, status)]);
    expect(container.querySelector('.badge')).not.toBeNull();
    expect(container.querySelector('.badge')?.textContent).toBe(STEP_RUN_STATUS_LABELS[status]);
  });

  it('futás állapot nélkül nincs badge a kártyán', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.agent_step)]);
    expect(container.querySelector('.badge')).toBeNull();
  });

  // A kártya kerete az állapotot is jelöli (SPEC-008 6.2, 21. kritérium): a
  // gyökér elem az állapotot és a jelvény variánsát hordozza, amiből a stíluslap
  // a formát és a színt festi. A variáns literál tábla, nem a leképezés hívása.
  const STEP_RUN_STATUS_BADGE_VARIANTS = {
    pending: 'outline',
    running: 'info',
    waiting_approval: 'warning',
    succeeded: 'success',
    failed: 'danger',
    rejected: 'danger',
    cancelled: 'ink',
    interrupted: 'warning',
  } satisfies Readonly<Record<StepRunStatus, string>>;

  it.each(StepRunStatusSchema.options)(
    'a "%s" állapotú kártya gyökere az állapotot és a jelvény variánsát hordozza',
    (status) => {
      renderNodes([buildFlowNode(WORKFLOW_NODES.agent_step, status)]);
      const card = container.querySelector<HTMLElement>('.graph-node-card');
      expect(card?.dataset['status']).toBe(status);
      expect(card?.dataset['badgeVariant']).toBe(STEP_RUN_STATUS_BADGE_VARIANTS[status]);
      expect(
        container.querySelector('.badge')?.classList.contains(`badge--${STEP_RUN_STATUS_BADGE_VARIANTS[status]}`),
      ).toBe(true);
    },
  );

  it('futás állapot nélkül a kártya gyökerén nincs állapot attribútum (a szerkesztő keretének alapértéke marad)', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.agent_step)]);
    const card = container.querySelector('.graph-node-card');
    expect(card?.hasAttribute('data-status')).toBe(false);
    expect(card?.hasAttribute('data-badge-variant')).toBe(false);
  });

  it('az állapot betöltése alatt az állapot jelvény helyén Skeleton áll, a szöveg a felolvasónak marad (SPEC-008 9. szekció 8. pont)', () => {
    const base = buildFlowNode(WORKFLOW_NODES.agent_step);
    renderNodes([{ ...base, data: { ...base.data, isStatusLoading: true } }]);

    const badge = container.querySelector(':scope .graph-node-card__header .badge');
    expect(badge?.querySelector('.skel')).not.toBeNull();
    expect(badge?.querySelector('.graph-node-card__status-loading-text')?.textContent).toBe('állapot betöltése');
    // A kártya csomópont címkéje és kimenő handle-ja a betöltés alatt is a helyén van.
    expect(container.textContent).toContain(WORKFLOW_NODES.agent_step.label);
    expect(sourceHandleIds()).toEqual([undefined]);
  });

  it('betöltött állapotnál nincs betöltés jelzés a kártyán', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.agent_step, 'running')]);
    expect(container.querySelector('.skel')).toBeNull();
    expect(container.querySelector('.graph-node-card__status-loading-text')).toBeNull();
  });

  function headerBadgeLabels(): (string | null)[] {
    return [...container.querySelectorAll(':scope .graph-node-card__header .badge')].map((badge) => badge.textContent);
  }

  it('a második próbálkozás outline jelvényt kap az állapot jelvény mellett', () => {
    renderNodes([buildBadgedFlowNode(WORKFLOW_NODES.agent_step, { status: 'running', attempt: 2 })]);
    expect(headerBadgeLabels()).toEqual(['fut', '2. próbálkozás']);
    const attemptBadge = container.querySelector(':scope .graph-node-card__header .badge--outline');
    expect(attemptBadge?.textContent).toBe('2. próbálkozás');
    expect(attemptBadge?.querySelector('.badge__dot')).toBeNull();
  });

  it('a szám a próbálkozás jelvény szövegében az attempt értéke', () => {
    renderNodes([buildBadgedFlowNode(WORKFLOW_NODES.agent_step, { status: 'running', attempt: 13 })]);
    expect(headerBadgeLabels()).toEqual(['fut', '13. próbálkozás']);
  });

  it('az első próbálkozásnál nincs próbálkozás jelvény', () => {
    renderNodes([buildBadgedFlowNode(WORKFLOW_NODES.agent_step, { status: 'running', attempt: 1 })]);
    expect(headerBadgeLabels()).toEqual(['fut']);
  });

  it('próbálkozás adat nélkül (nincs megjelenített lépés futás) nincs próbálkozás jelvény', () => {
    renderNodes([buildBadgedFlowNode(WORKFLOW_NODES.agent_step, {})]);
    expect(container.querySelector('.badge')).toBeNull();
  });

  it('az alapértelmezett ágra lépett elágazás outline "alapértelmezett ág" jelvényt kap', () => {
    renderNodes([buildBadgedFlowNode(WORKFLOW_NODES.branch, { status: 'succeeded', usedDefaultBranch: true })]);
    expect(headerBadgeLabels()).toEqual(['sikeres', 'alapértelmezett ág']);
    expect(container.querySelector(':scope .graph-node-card__header .badge--outline')?.textContent).toBe(
      'alapértelmezett ág',
    );
  });

  it('az alapértelmezett ág jelvény nélkül a kártyán nincs ilyen jelvény', () => {
    renderNodes([buildBadgedFlowNode(WORKFLOW_NODES.branch, { status: 'succeeded' })]);
    expect(headerBadgeLabels()).toEqual(['sikeres']);
  });

  it('a három jelvény az állapot, a próbálkozás, az alapértelmezett ág sorrendjében áll a fejlécben', () => {
    renderNodes([
      buildBadgedFlowNode(WORKFLOW_NODES.branch, { status: 'succeeded', attempt: 3, usedDefaultBranch: true }),
    ]);
    expect(headerBadgeLabels()).toEqual(['sikeres', '3. próbálkozás', 'alapértelmezett ág']);
  });

  it('a node saját magyar címkéje megjelenik', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.human_approval)]);
    expect(container.textContent).toContain('Jóváhagyás');
  });

  it('futás összesítés nélkül nincs összesítő sor és nincs al-workflow gomb', () => {
    renderNodes([buildFlowNode(WORKFLOW_NODES.fan_out)]);
    expect(container.querySelector('.graph-node-card__summary')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });

  it('a fan_out összesítés az ág darabszámot, a sikeres és a bukott számot mutatja', () => {
    renderNodes([
      buildDecoratedFlowNode(WORKFLOW_NODES.fan_out, {
        kind: 'fan_out',
        branchCount: 4,
        succeededCount: 3,
        failedCount: 1,
      }),
    ]);
    expect(container.querySelector('.graph-node-card__summary')?.textContent).toBe('4 ág, 3 sikeres, 1 sikertelen');
  });

  it('a nulla ág eset külön, kimondott feliratot kap', () => {
    renderNodes([
      buildDecoratedFlowNode(WORKFLOW_NODES.fan_out, {
        kind: 'fan_out',
        branchCount: 0,
        succeededCount: 0,
        failedCount: 0,
      }),
    ]);
    expect(container.querySelector('.graph-node-card__summary')?.textContent).toBe(
      'nulla ág: a szétosztás egyetlen ágat sem indított',
    );
  });

  it('a loop összesítés az aktuális iterációt és a maxIterations korlátot mutatja', () => {
    renderNodes([buildDecoratedFlowNode(WORKFLOW_NODES.loop, { kind: 'loop', iteration: 2, maxIterations: 5 })]);
    expect(container.querySelector('.graph-node-card__summary')?.textContent).toBe('iteráció: 2 / 5');
  });

  it('a sub_workflow összesítés gombja a subWorkflowRunId értékkel navigál', () => {
    const openedRunIds: string[] = [];
    renderNodes([
      buildDecoratedFlowNode(
        WORKFLOW_NODES.sub_workflow,
        { kind: 'sub_workflow', subWorkflowRunId: 'r-42' },
        (subWorkflowRunId) => {
          openedRunIds.push(subWorkflowRunId);
        },
      ),
    ]);

    const button = container.querySelector('button');
    if (button === null) {
      throw new Error('a teszt nem talált al-workflow gombot');
    }
    expect(button.textContent).toBe('Al-workflow futás megnyitása');
    expect(button.className).toContain('btn--sm');

    act(() => {
      button.click();
    });
    expect(openedRunIds).toEqual(['r-42']);
  });

  it('a waiting_approval összesítés a kérés abszolút időpontját mutatja ("óta vár")', () => {
    const requestedAtMs = new Date(2026, 8, 24, 10, 32, 5).getTime();
    renderNodes([buildDecoratedFlowNode(WORKFLOW_NODES.human_approval, { kind: 'waiting_approval', requestedAtMs })]);
    expect(container.querySelector('.graph-node-card__summary')?.textContent).toBe('10:32:05 óta vár');
  });
});

describe('a kártya kerete és a graph-node-card.css', () => {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const stylesheet = readFileSync(path.join(directory, 'graph-node-card.css'), 'utf8');

  function declarationsOf(selector: string): string {
    const escaped = selector.replaceAll(/[.[\]'=]/g, String.raw`\$&`);
    const match = new RegExp(String.raw`^${escaped}\s*\{([^}]*)\}`, 'm').exec(stylesheet);
    expect(match, selector).not.toBeNull();
    return match?.[1] ?? '';
  }

  // A keret színe az állapot jelvényének variánsából jön (user döntés
  // 2026-10-21): a variáns névrokon témázó token, az outline a jelvény
  // gyűrűjének tokenje, az ink a jelvény háttere.
  it.each([
    ['info', '--ep-info'],
    ['success', '--ep-success'],
    ['warning', '--ep-warning'],
    ['danger', '--ep-danger'],
    ['ink', '--ep-ink-900'],
    ['outline', '--ep-border'],
  ])('a "%s" variáns keretszíne a %s token', (variant, token) => {
    expect(declarationsOf(`.graph-node-card[data-badge-variant='${variant}']`)).toMatch(
      new RegExp(String.raw`--graph-node-card-border-color:\s*var\(${token}\);`),
    );
  });

  it('a pending szaggatott, a running 2.4 pixeles, a failed és a rejected 3 pixeles dupla vonal', () => {
    expect(declarationsOf(".graph-node-card[data-status='pending']")).toMatch(
      /--graph-node-card-border-style:\s*dashed;/,
    );
    expect(declarationsOf(".graph-node-card[data-status='running']")).toMatch(
      /--graph-node-card-border-width:\s*2\.4px;/,
    );
    const doubleRule =
      /^\.graph-node-card\[data-status='failed'\],\n\.graph-node-card\[data-status='rejected'\]\s*\{([^}]*)\}/m.exec(
        stylesheet,
      );
    expect(doubleRule).not.toBeNull();
    expect(doubleRule?.[1]).toMatch(/--graph-node-card-border-width:\s*3px;/);
    expect(doubleRule?.[1]).toMatch(/--graph-node-card-border-style:\s*double;/);
  });
});
