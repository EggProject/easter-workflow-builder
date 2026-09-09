/* eslint-disable unicorn/no-null -- a szintetikus WorkflowGraphDocument/WorkflowNodeInput fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak */
import type { FetchFunction } from '@easter-workflow-builder/core';
import { ReplaceGraphRequestSchema, type WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GraphEditorCanvasProperties } from './GraphEditorCanvas.tsx';
import { GraphEditorScreen } from './GraphEditorScreen.tsx';
import { GRAPH_EDITOR_LAYOUT_STORAGE_KEY } from './graph-editor-layout.ts';

/**
 * A `GraphEditorCanvas` mockolva: ez a spec a `GraphEditorScreen` SAJÁT
 * felelősségét teszteli (betöltés, mentés, piszkos állapot, mentés előtti
 * validáció, node-inspector wiring), a vászon belső React Flow vezérlését a
 * `GraphEditorCanvas.spec.tsx` már lefedi.
 */
const { capturedCanvasProperties } = vi.hoisted(() => {
  const capturedCanvasProperties: GraphEditorCanvasProperties[] = [];
  return { capturedCanvasProperties };
});

vi.mock('./GraphEditorCanvas.tsx', () => ({
  GraphEditorCanvas: (properties: GraphEditorCanvasProperties) => {
    capturedCanvasProperties.push(properties);
    return null;
  },
}));

function lastCanvasProperties(): GraphEditorCanvasProperties {
  const properties = capturedCanvasProperties.at(-1);
  if (properties === undefined) {
    throw new Error('a teszt nem talált rögzített <GraphEditorCanvas> propot');
  }
  return properties;
}

const API_ORIGIN = 'https://api.example.test';

const START_NODE: WorkflowNodeInput = {
  id: 'n-1',
  type: 'start',
  label: 'Indítás',
  positionX: 0,
  positionY: 0,
  config: { type: 'start', inputFields: [], onUnhandledError: null },
};

const AGENT_NODE: WorkflowNodeInput = {
  id: 'n-2',
  type: 'agent_step',
  label: 'Agent',
  positionX: 10,
  positionY: 10,
  config: {
    type: 'agent_step',
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
    sessionMode: 'isolated',
    structuredOutput: null,
    onUnhandledError: null,
  },
};

// A `WorkflowEdgeInput` alakú él - ez az, amit a valódi `GraphEditorCanvas.
// onGraphChange` is termelne (nincs `createdAtMs` mezője).
const EDGE_INPUT = {
  id: 'e-1',
  sourceNodeId: 'n-1',
  targetNodeId: 'n-1',
  sourceHandle: null,
  targetHandle: null,
  branchKey: null,
};

const GRAPH_DOCUMENT = {
  nodes: [
    { ...START_NODE, createdAtMs: 0, updatedAtMs: 0 },
    { ...AGENT_NODE, createdAtMs: 0, updatedAtMs: 0 },
  ],
  // Legalább egy él kell a betöltött dokumentumban is (nem csak a mentés
  // válaszában), különben a hidratáló hatás `edges.map(...)` hívása (a
  // `workflowEdgeToEdgeInput` vetítéssel) sosem futna le.
  edges: [{ ...EDGE_INPUT, createdAtMs: 0 }],
};

const WORKFLOW_DETAIL = {
  id: 'wf-1',
  name: 'Teszt',
  description: null,
  providerId: null,
  createdAtMs: 0,
  updatedAtMs: 0,
};
const SETTINGS_RECORD = { defaultProviderId: 'claude-subscription', persistStreamDeltas: false };

function jsonResponse(body: unknown): Response {
  return Response.json(body);
}

interface RouteCallLog {
  putBodies: string[];
  graphGetCount: number;
}

/**
 * A `PUT` mock "szerver" a ténylegesen elküldött törzset adja vissza, timestamp
 * mezőkkel kiegészítve - enélkül a mentés utáni `baseline` a régi, be NEM
 * küldött adatra állna, és a mentetlen jelző a mentés UTÁN is fennmaradna.
 */
function echoAsGraphDocument(rawBody: string): unknown {
  const parsed = ReplaceGraphRequestSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    throw new Error('a teszt PUT törzse nem érvényes ReplaceGraphRequest alakú');
  }
  return {
    nodes: parsed.data.nodes.map((node) => ({ ...node, createdAtMs: 0, updatedAtMs: 0 })),
    edges: parsed.data.edges.map((edge) => ({ ...edge, createdAtMs: 0 })),
  };
}

function createFetchFunction(log: RouteCallLog): FetchFunction {
  return (input, init) => {
    if (init.method === 'PUT') {
      const rawBody = typeof init.body === 'string' ? init.body : '{}';
      log.putBodies.push(rawBody);
      return Promise.resolve(jsonResponse(echoAsGraphDocument(rawBody)));
    }
    const pathname = new URL(input).pathname;
    if (pathname.endsWith('/graph')) {
      log.graphGetCount += 1;
      return Promise.resolve(jsonResponse(GRAPH_DOCUMENT));
    }
    if (pathname === '/api/settings') {
      return Promise.resolve(jsonResponse(SETTINGS_RECORD));
    }
    return Promise.resolve(jsonResponse(WORKFLOW_DETAIL));
  };
}

const unreachableFetchFunction: FetchFunction = () => Promise.reject(new Error('kapcsolat megszakadt'));

const failingPutFetchFunction: FetchFunction = (input, init) => {
  if (init.method === 'PUT') {
    return Promise.resolve(new Response('nem sikerult', { status: 500 }));
  }
  const pathname = new URL(input).pathname;
  if (pathname.endsWith('/graph')) {
    return Promise.resolve(jsonResponse(GRAPH_DOCUMENT));
  }
  if (pathname === '/api/settings') {
    return Promise.resolve(jsonResponse(SETTINGS_RECORD));
  }
  return Promise.resolve(jsonResponse(WORKFLOW_DETAIL));
};

describe('GraphEditorScreen', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    capturedCanvasProperties.length = 0;
    // A perzisztált elrendezés arány tesztek közötti átszivárgásának
    // megelőzése: a `Resizable` a csatoláskor is jelent, tehát minden
    // renderelés ír a kulcsra.
    globalThis.localStorage.clear();
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

  async function renderScreen(search: string, fetchFunction: FetchFunction): Promise<void> {
    await act(async () => {
      root.render(<GraphEditorScreen apiOrigin={API_ORIGIN} fetchFunction={fetchFunction} search={search} />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('a betöltés sikertelenségére hibaüzenetet mutat', async () => {
    await renderScreen('?workflowId=wf-1', unreachableFetchFunction);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('A szerver nem érhető el.');
  });

  it('kiválasztás nélkül NINCS jobb oldali panel és nincs elválasztó (2026-09-09)', async () => {
    const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
    await renderScreen('?workflowId=wf-1', createFetchFunction(log));

    expect(container.querySelector('.node-inspector')).toBeNull();
    expect(container.querySelector('[role="separator"]')).toBeNull();
    // A vászon panelje viszont fel van mountolva: a kiválasztás nem
    // szerelheti újra a React Flow-t, mert azzal a pásztázás és a
    // nagyítás elveszne.
    expect(container.querySelectorAll('.resizable-panel')).toHaveLength(1);
    expect(container.querySelector('.graph-editor-screen__body--solo')).not.toBeNull();
  });

  it('a lábléc balra a státuszt, jobbra a sm méretű split button gombcsoportot hordozza (2026-09-09)', async () => {
    const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
    await renderScreen('?workflowId=wf-1', createFetchFunction(log));

    const footer = container.querySelector('.page-footer');
    if (footer === null) {
      throw new Error('a teszt nem talált .page-footer elemet');
    }
    // A sáv a képernyő gyökerének KÖZVETLEN gyereke, tehát nem a
    // görgethető törzsön belül ül.
    expect(footer.parentElement?.className).toBe('graph-editor-screen');

    const group = footer.querySelector(':scope .page-footer__actions .button-group');
    if (group === null) {
      throw new Error('a teszt nem talált gombcsoportot a láblécben');
    }
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Gráf műveletek');
    // Valódi split button (design system "Mixed" mintája): elsődleges
    // "Mentés" gomb, mellette egy szöveg nélküli nyíl trigger, ami a
    // lenyíló menüt nyitja - nem két egyenrangú, szöveges gomb.
    const buttons = [...group.querySelectorAll('button')];
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.textContent).toBe('Mentés');
    expect(buttons[1]?.textContent).toBe('');
    expect(buttons[1]?.getAttribute('aria-label')).toBe('További műveletek');
    expect(buttons[1]?.getAttribute('aria-haspopup')).toBe('menu');
    expect(buttons[1]?.classList.contains('btn--icon')).toBe(true);
    // Minden szerkesztő gomb `sm` méretű (a modális és a popup a kivétel).
    expect(buttons.every((button) => button.classList.contains('btn--sm'))).toBe(true);

    // A nyíl trigger megnyitja a menüt, ami a "Elrendezés" menüpontot adja,
    // és billentyűzettel is elérhető (a `Menu` már meglévő, tesztelt
    // billentyűzet-kezelésén át, lásd `packages/ui/src/menu/Menu.tsx`).
    act(() => {
      buttons[1]?.click();
    });
    const menuPanel = document.body.querySelector('[role="menu"]');
    if (menuPanel === null) {
      throw new Error('a teszt nem talált nyitott menü panelt');
    }
    const menuItem = menuPanel.querySelector('[role="menuitem"]');
    expect(menuItem?.textContent).toBe('Elrendezés');
    expect(document.activeElement).toBe(menuItem);

    // A státusz a MÁSIK sávban áll, nem a gombok mellett.
    act(() => {
      lastCanvasProperties().onGraphChange([{ ...START_NODE, positionX: 99 }, AGENT_NODE], []);
    });
    expect(footer.querySelector(':scope .page-footer__status [role="status"]')?.textContent).toBe(
      'Mentetlen változtatások',
    );
  });

  it('a felső eszköztár megszűnt: a képernyőn nincs .graph-editor-screen__toolbar (2026-09-09)', async () => {
    const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
    await renderScreen('?workflowId=wf-1', createFetchFunction(log));
    expect(container.querySelector('.graph-editor-screen__toolbar')).toBeNull();
  });

  it('az osztott elrendezés aránya a localStorage-ből töltődik vissza, és a változás oda mentődik (2026-09-09)', async () => {
    globalThis.localStorage.setItem(GRAPH_EDITOR_LAYOUT_STORAGE_KEY, JSON.stringify([55, 45]));
    const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
    await renderScreen('?workflowId=wf-1', createFetchFunction(log));

    act(() => {
      lastCanvasProperties().onSelectNode('n-1');
    });
    const panels = [...container.querySelectorAll<HTMLDivElement>('.resizable-panel')];
    expect(panels.map((panel) => panel.style.flexBasis)).toEqual(['55%', '45%']);

    // A billentyűzetes átméretezés az új arányt azonnal a kulcsra írja.
    const separator = container.querySelector('[role="separator"]');
    if (separator === null) {
      throw new Error('a teszt nem talált elválasztót');
    }
    act(() => {
      separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    });
    expect(globalThis.localStorage.getItem(GRAPH_EDITOR_LAYOUT_STORAGE_KEY)).toBe('[60,40]');
  });

  it('node kiválasztására megjelenik a node-inspector, bezárásra eltűnik', async () => {
    const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
    await renderScreen('?workflowId=wf-1', createFetchFunction(log));
    act(() => {
      lastCanvasProperties().onSelectNode('n-1');
    });
    expect(container.querySelector('.node-inspector')).not.toBeNull();
    expect(container.textContent).toContain('n-1');

    // A gomb hozzáférhető NEVE szerint keresünk, nem a szöveges tartalma
    // szerint: a panel bezárás gombja ikon gomb (`.btn--icon`), tehát
    // látható szövege nincs, a neve az `aria-label`-ből jön.
    const closeButton = container.querySelector<HTMLButtonElement>('button[aria-label="Bezárás"]');
    if (closeButton === null) {
      throw new Error('a teszt nem talált Bezárás gombot');
    }
    act(() => {
      closeButton.click();
    });
    expect(container.querySelector('.node-inspector')).toBeNull();
  });

  it('a node-inspector szerkesztése frissíti a vászon nodes propját (M-55 kör)', async () => {
    const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
    await renderScreen('?workflowId=wf-1', createFetchFunction(log));
    act(() => {
      lastCanvasProperties().onSelectNode('n-2');
    });
    const promptTextarea = [...container.querySelectorAll('textarea')].find((textarea) => textarea.value === 'sablon');
    if (promptTextarea === undefined) {
      throw new Error('a teszt nem találta a prompt sablon textarea-t');
    }
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    act(() => {
      descriptor?.set?.call(promptTextarea, 'módosított sablon');
      promptTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      promptTextarea.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const updatedAgentNode = lastCanvasProperties().nodes.find((node) => node.id === 'n-2');
    expect(updatedAgentNode?.config).toMatchObject({ promptTemplate: 'módosított sablon' });
  });

  it('providerId null értékére az örökölt globális alapértelmezést nevezi meg a panelen', async () => {
    const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
    await renderScreen('?workflowId=wf-1', createFetchFunction(log));
    act(() => {
      lastCanvasProperties().onSelectNode('n-2');
    });
    expect(container.textContent).toContain('a globális alapértelmezést örökli: claude-subscription');
  });

  it('workflowId hiányában hibaüzenetet mutat, és nem kér vászont', async () => {
    const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
    await renderScreen('', createFetchFunction(log));
    expect(container.textContent).toContain('Nincs megadva');
    expect(capturedCanvasProperties).toHaveLength(0);
    expect(log.graphGetCount).toBe(0);
  });

  it('betöltés után a vászont rendereli, mentetlen jelző nélkül', async () => {
    const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
    await renderScreen('?workflowId=wf-1', createFetchFunction(log));
    expect(log.graphGetCount).toBe(1);
    expect(capturedCanvasProperties.length).toBeGreaterThan(0);
    expect(lastCanvasProperties().nodes).toHaveLength(2);
    expect(container.textContent).not.toContain('Mentetlen változtatások');
  });

  it('egy módosítás után mentetlen jelzőt mutat, majd visszavonás után eltűnik (AC13)', async () => {
    const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
    await renderScreen('?workflowId=wf-1', createFetchFunction(log));
    // A `baseline` a betöltéskor a szerver válaszán (Zod `safeParse`) megy
    // át, ami a mezők sorrendjét a séma szerint kanonizálja. A `currentNodes`/
    // `currentEdges` "visszavonáshoz" ezért ugyanezt a MÁR KANONIZÁLT
    // tömböt kell visszaadni, nem egy kézzel írt szó szerinti fixture-t -
    // a `JSON.stringify` alapú `isGraphDirty` mezősorrend érzékeny, és egy
    // kézzel írt literál sorrendje nem feltétlenül egyezik a sémáéval, holott
    // a valódi vászon (`flowNodeToWorkflowNode`) mindig a meglévő objektumot
    // terjeszti ki, nem épít újat (`graph-editor-node-mapping.ts`).
    const initialNodes = lastCanvasProperties().nodes;
    const initialEdges = lastCanvasProperties().edges;
    act(() => {
      lastCanvasProperties().onGraphChange(
        initialNodes.map((node) => (node.id === 'n-1' ? { ...node, positionX: 99 } : node)),
        initialEdges,
      );
    });
    expect(container.textContent).toContain('Mentetlen változtatások');

    act(() => {
      lastCanvasProperties().onGraphChange(initialNodes, initialEdges);
    });
    expect(container.textContent).not.toContain('Mentetlen változtatások');
  });

  it('az Elrendezés gomb átírja a node pozíciókat, mentetlen jelzőt ad, és nem ment (T-009-19)', async () => {
    const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
    await renderScreen('?workflowId=wf-1', createFetchFunction(log));
    const initialPositions = lastCanvasProperties().nodes.map((node) => ({
      id: node.id,
      positionX: node.positionX,
      positionY: node.positionY,
    }));

    // Az "Elrendezés" a split button lenyíló menüjében van (2026-09-09):
    // előbb a nyíl trigger nyitja meg a menüt, utána a menüpont kattintható.
    const menuTrigger = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.getAttribute('aria-label') === 'További műveletek',
    );
    if (menuTrigger === undefined) {
      throw new Error('a teszt nem talált "További műveletek" trigger gombot');
    }
    act(() => {
      menuTrigger.click();
    });
    // A menü panel `createPortal`-lal a `document.body`-ba kerül
    // (packages/ui/src/menu/Menu.tsx), tehát nem a `container` leszármazottja.
    const layoutButton = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent === 'Elrendezés',
    );
    if (layoutButton === undefined) {
      throw new Error('a teszt nem talált "Elrendezés" gombot');
    }
    const revisionBeforeLayout = lastCanvasProperties().autoLayoutRevision;
    act(() => {
      layoutButton.click();
    });

    // Az elrendezés számlálója eggyel nőtt: ebből tudja a vászon, hogy a
    // nézetet újra a teljes gráfra kell illesztenie (`FitViewOnAutoLayout`).
    expect(lastCanvasProperties().autoLayoutRevision).toBe(revisionBeforeLayout + 1);

    const layoutedPositions = lastCanvasProperties().nodes.map((node) => ({
      id: node.id,
      positionX: node.positionX,
      positionY: node.positionY,
    }));
    expect(layoutedPositions).not.toEqual(initialPositions);
    expect(container.textContent).toContain('Mentetlen változtatások');
    expect(log.putBodies).toHaveLength(0);
  });

  it('hibás gráfra (NaN a maxIterations mezőn) a Mentés nem indít kérést, és megnevezi a hibás mezőt (AC12)', async () => {
    const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
    await renderScreen('?workflowId=wf-1', createFetchFunction(log));

    const invalidLoopNode: WorkflowNodeInput = {
      id: 'n-3',
      type: 'loop',
      label: 'Ciklus',
      positionX: 0,
      positionY: 0,
      config: { type: 'loop', maxIterations: Number('nem szám'), continueExpression: 'i < 5', onUnhandledError: null },
    };
    act(() => {
      lastCanvasProperties().onGraphChange([START_NODE, invalidLoopNode], []);
    });

    const saveButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Mentés');
    if (saveButton === undefined) {
      throw new Error('a teszt nem talált "Mentés" gombot');
    }
    await act(async () => {
      saveButton.click();
      await Promise.resolve();
    });

    expect(log.putBodies).toHaveLength(0);
    expect(container.textContent).toContain('maxIterations');
  });

  it(
    'sikertelen mentési kísérlet után az ÉRINTETLEN, érvénytelen mező is kiírja a hibáját a ' +
      'node-inspectorban (isSaveAttempted wiring)',
    async () => {
      const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
      await renderScreen('?workflowId=wf-1', createFetchFunction(log));

      const invalidLoopNode: WorkflowNodeInput = {
        id: 'n-3',
        type: 'loop',
        label: 'Ciklus',
        positionX: 0,
        positionY: 0,
        config: {
          type: 'loop',
          maxIterations: Number('nem szám'),
          continueExpression: 'i < 5',
          onUnhandledError: null,
        },
      };
      act(() => {
        lastCanvasProperties().onGraphChange([START_NODE, invalidLoopNode], []);
      });

      const saveButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Mentés');
      if (saveButton === undefined) {
        throw new Error('a teszt nem talált "Mentés" gombot');
      }
      await act(async () => {
        saveButton.click();
        await Promise.resolve();
      });
      expect(log.putBodies).toHaveLength(0);

      // A sikertelen mentési kísérlet UTÁN nyitjuk meg a hibás node panelét:
      // a mezőhöz nem nyúltunk (nincs focus/blur), a hibaüzenetnek mégis meg
      // kell jelennie, mert az `isSaveAttempted` a `GraphEditorScreen`-ből a
      // `NodeInspector`-ra megy - enélkül ez a teszt nulla találatot adna.
      act(() => {
        lastCanvasProperties().onSelectNode('n-3');
      });
      expect(container.querySelector('.field__error')).not.toBeNull();
      expect(container.querySelector('[aria-invalid="true"]')).not.toBeNull();
    },
  );

  it('érvényes mentés után a piszkos jelző eltűnik, és sikeres Toast jelenik meg (AC15)', async () => {
    const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
    await renderScreen('?workflowId=wf-1', createFetchFunction(log));

    // Lásd az AC13 teszt megjegyzését: a módosítás a MÁR betöltött, Zod
    // séma szerint kanonizált node tömböt terjeszti ki, nem egy kézzel írt
    // literált, hogy a mentés utáni új `baseline` (szintén Zod `safeParse`-on
    // átment) mezősorrendje egyezzen.
    const initialNodes = lastCanvasProperties().nodes;
    act(() => {
      lastCanvasProperties().onGraphChange(
        initialNodes.map((node) => (node.id === 'n-1' ? { ...node, positionX: 99 } : node)),
        [],
      );
    });
    expect(container.textContent).toContain('Mentetlen változtatások');

    const saveButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Mentés');
    if (saveButton === undefined) {
      throw new Error('a teszt nem talált "Mentés" gombot');
    }
    await act(async () => {
      saveButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(log.putBodies).toHaveLength(1);
    expect(container.textContent).not.toContain('Mentetlen változtatások');
    expect(container.querySelector('.toast__title')?.textContent).toBe('Gráf mentve');
  });

  it('sikertelen mentésre hiba Toast jelenik meg, a piszkos jelző megmarad', async () => {
    await renderScreen('?workflowId=wf-1', failingPutFetchFunction);

    act(() => {
      lastCanvasProperties().onGraphChange([{ ...START_NODE, positionX: 99 }, AGENT_NODE], []);
    });

    const saveButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Mentés');
    if (saveButton === undefined) {
      throw new Error('a teszt nem talált "Mentés" gombot');
    }
    await act(async () => {
      saveButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('.toast__title')?.textContent).toBe('A mentés sikertelen');
    expect(container.textContent).toContain('Mentetlen változtatások');
  });
});
