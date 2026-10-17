/* eslint-disable unicorn/no-null -- a szintetikus WorkflowGraphDocument/WorkflowNodeInput fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak */
import type { FetchFunction } from '@easter-workflow-builder/core';
import { ReplaceGraphRequestSchema, type WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import type { useStoreApi } from '@xyflow/react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { GraphEditorCanvasProperties } from './GraphEditorCanvas.tsx';
import { GraphEditorScreen } from './GraphEditorScreen.tsx';
import { computeViewportCenterNodePosition } from './compute-viewport-center-node-position.ts';
import { FOOTER_COMPACT_MEDIA_QUERY } from './footer-compact-media-query.ts';
import { GRAPH_EDITOR_LAYOUT_STORAGE_KEY } from './graph-editor-layout.ts';
import type { GraphElementIdGenerator } from './graph-element-id-generator.ts';
import { UNDO_MODIFIER_STORAGE_KEY } from './undo-modifier-storage.ts';

/**
 * A `GraphEditorCanvas` mockolva: ez a spec a `GraphEditorScreen` SAJÁT
 * felelősségét teszteli (betöltés, mentés, piszkos állapot, mentés előtti
 * validáció, node-inspector wiring), a vászon belső React Flow vezérlését a
 * `GraphEditorCanvas.spec.tsx` már lefedi. A mock a képernyő
 * `ReactFlowProvider`-ének store-ját is rögzíti, hogy a teszt a "Hozzáadás"
 * gomb bemenetét (a store `width`, `height` és `transform` mezőjét) beállíthassa.
 */
const { capturedCanvasProperties, capturedStoreApis } = vi.hoisted(() => {
  const capturedCanvasProperties: GraphEditorCanvasProperties[] = [];
  const capturedStoreApis: ReturnType<typeof useStoreApi>[] = [];
  return { capturedCanvasProperties, capturedStoreApis };
});

vi.mock('./GraphEditorCanvas.tsx', async () => {
  const { useStoreApi: useActualStoreApi } = await import('@xyflow/react');
  return {
    GraphEditorCanvas: (properties: GraphEditorCanvasProperties) => {
      capturedCanvasProperties.push(properties);
      capturedStoreApis.push(useActualStoreApi());
      return null;
    },
  };
});

function lastCanvasProperties(): GraphEditorCanvasProperties {
  const properties = capturedCanvasProperties.at(-1);
  if (properties === undefined) {
    throw new Error('a teszt nem talált rögzített <GraphEditorCanvas> propot');
  }
  return properties;
}

const API_ORIGIN = 'https://api.example.test';

const GRAPH_ELEMENT_ID_GENERATOR: GraphElementIdGenerator = () => 'generated-element-id';

const START_NODE: WorkflowNodeInput = {
  id: 'n-1',
  type: 'start',
  label: 'Indítás',
  positionX: 0,
  positionY: 0,
  config: { type: 'start', inputFields: [], onUnhandledError: 'fail_run' },
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
    onUnhandledError: 'fail_run',
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

function findAddMenuTrigger(container: HTMLElement): HTMLButtonElement {
  const trigger = [
    ...container.querySelectorAll<HTMLButtonElement>(
      ':scope .page-footer__actions > .menu-anchor > button[aria-haspopup="menu"]',
    ),
  ].find((candidate) => candidate.textContent === 'Hozzáadás' || candidate.getAttribute('aria-label') === 'Hozzáadás');
  if (trigger === undefined) {
    throw new Error('a teszt nem találta a "Hozzáadás" gombot a lábléc akciósávjában');
  }
  return trigger;
}

function openedMenuItems(): readonly HTMLButtonElement[] {
  return [...document.body.querySelectorAll<HTMLButtonElement>(':scope [role="menu"]:not([hidden]) [role="menuitem"]')];
}

function countingFetchFunction(log: RouteCallLog, calls: { count: number }): FetchFunction {
  const fetchFunction = createFetchFunction(log);
  return (input, init) => {
    calls.count += 1;
    return fetchFunction(input, init);
  };
}

// ============================================================
// A VISSZAVONÁS ÉS AZ ÚJRA ELVÉGZÉS segédei (SPEC-008 5.10).
// ============================================================

function footerActionButtons(container: HTMLElement): readonly HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>(':scope .page-footer__actions button')];
}

function footerButtonNamed(container: HTMLElement, name: string): HTMLButtonElement {
  const button = footerActionButtons(container).find(
    (candidate) => candidate.getAttribute('aria-label') === name || candidate.textContent === name,
  );
  if (button === undefined) {
    throw new Error(`a teszt nem talált "${name}" nevű gombot a láblécben`);
  }
  return button;
}

function pressShortcut(init: KeyboardEventInit, target: EventTarget = document.body): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function canvasNodeIds(): readonly string[] {
  return lastCanvasProperties().nodes.map((node) => node.id);
}

function canvasPositionOf(nodeId: string): number | undefined {
  return lastCanvasProperties().nodes.find((node) => node.id === nodeId)?.positionX;
}

function moveStartNode(positionX: number, session?: { readonly key: string; readonly isFinal: boolean }): void {
  act(() => {
    lastCanvasProperties().onGraphChange(
      lastCanvasProperties().nodes.map((node) => (node.id === 'n-1' ? { ...node, positionX } : node)),
      lastCanvasProperties().edges,
      session,
    );
  });
}

function inspectorTextarea(container: HTMLElement): HTMLTextAreaElement {
  const textarea = container.querySelector<HTMLTextAreaElement>(':scope .node-inspector textarea');
  if (textarea === null) {
    throw new Error('a teszt nem találta a prompt sablon mezőt');
  }
  return textarea;
}

function typeInto(textarea: HTMLTextAreaElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  act(() => {
    descriptor?.set?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function agentPromptTemplate(): unknown {
  const config = lastCanvasProperties().nodes.find((node) => node.id === 'n-2')?.config;
  return config?.type === 'agent_step' ? config.promptTemplate : undefined;
}

const pendingPutFetchFunction: FetchFunction = (input, init) =>
  init.method === 'PUT'
    ? new Promise<Response>(() => {
        // A mentés szándékosan sosem fejeződik be: a teszt a futó mentés állapotát nézi.
      })
    : createFetchFunction({ putBodies: [], graphGetCount: 0 })(input, init);

/**
 * A két felhasználói ügynök szöveg: az `auto` beállítás ezek alapján dönt a
 * módosítóról (SPEC-008 5.10, O-31). A teszt minden futásban kifejezetten
 * rögzíti az értéket, mert a happy-dom saját ügynöke a futtató gép
 * platformjától függ.
 */
const NON_MACOS_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
const MACOS_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

describe('GraphEditorScreen', () => {
  let container: HTMLDivElement;
  let root: Root;
  let userAgentSpy: MockInstance<() => string>;
  const navigate = vi.fn();

  beforeEach(() => {
    capturedCanvasProperties.length = 0;
    capturedStoreApis.length = 0;
    navigate.mockClear();
    userAgentSpy = vi.spyOn(globalThis.navigator, 'userAgent', 'get').mockReturnValue(NON_MACOS_USER_AGENT);
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
    userAgentSpy.mockRestore();
  });

  async function renderScreen(search: string, fetchFunction: FetchFunction): Promise<void> {
    await act(async () => {
      root.render(
        <GraphEditorScreen
          apiOrigin={API_ORIGIN}
          fetchFunction={fetchFunction}
          search={search}
          navigate={navigate}
          graphElementIdGenerator={GRAPH_ELEMENT_ID_GENERATOR}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function buttonNamed(name: string): HTMLButtonElement {
    return footerButtonNamed(container, name);
  }

  async function renderWithTwoMoves(): Promise<void> {
    const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
    await renderScreen('?workflowId=wf-1', createFetchFunction(log));
    moveStartNode(99);
    moveStartNode(150);
  }

  function focusTooltipShortcut(name: string): string | undefined {
    const button = buttonNamed(name);
    act(() => {
      button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    });
    return container.querySelector(':scope .page-footer [role="tooltip"]:not([hidden]) kbd')?.textContent ?? undefined;
  }

  function clickButton(name: string): void {
    act(() => {
      buttonNamed(name).click();
    });
  }

  it('a betöltés sikertelenségére hibaüzenetet mutat', async () => {
    await renderScreen('?workflowId=wf-1', unreachableFetchFunction);
    expect(container.querySelector('.alert--danger[role="alert"]')?.textContent).toBe('A szerver nem érhető el.');
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
    const menuPanel = document.body.querySelector('[role="menu"]:not([hidden])');
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

  function findButtonByText(text: string): HTMLButtonElement {
    const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent === text,
    );
    if (button === undefined) {
      throw new Error(`a teszt nem talált "${text}" gombot`);
    }
    return button;
  }

  it('a panel Törlés gombja megerősítés és hálózati kérés nélkül törli a csomópontot és a rá kötött éleket, a panel bezárul (SPEC-008 5.9, AC84)', async () => {
    const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
    const requestedUrls: string[] = [];
    const delegate = createFetchFunction(log);
    const recordingFetchFunction: FetchFunction = (input, init) => {
      requestedUrls.push(`${init.method ?? 'GET'} ${input}`);
      return delegate(input, init);
    };
    await renderScreen('?workflowId=wf-1', recordingFetchFunction);
    // A betöltött gráfban csak egy, a Startra kötött hurokél van: az n-2 csomópontra
    // kötött élekhez egy bejövő és egy kimenő élt veszünk fel.
    const edgeToAgent = { ...EDGE_INPUT, id: 'e-in', sourceNodeId: 'n-1', targetNodeId: 'n-2' };
    const edgeFromAgent = { ...EDGE_INPUT, id: 'e-out', sourceNodeId: 'n-2', targetNodeId: 'n-1' };
    act(() => {
      lastCanvasProperties().onGraphChange(lastCanvasProperties().nodes, [
        ...lastCanvasProperties().edges,
        edgeToAgent,
        edgeFromAgent,
      ]);
    });
    act(() => {
      lastCanvasProperties().onSelectNode('n-2');
    });
    expect(container.querySelector('.node-inspector')).not.toBeNull();
    const requestsBeforeDelete = requestedUrls.length;

    act(() => {
      findButtonByText('Törlés').click();
    });

    expect(lastCanvasProperties().nodes.map((node) => node.id)).toEqual(['n-1']);
    expect(lastCanvasProperties().edges.map((edge) => edge.id)).toEqual(['e-1']);
    expect(container.querySelector('.node-inspector')).toBeNull();
    expect(lastCanvasProperties().selectedNodeId).toBeUndefined();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).toContain('Mentetlen változtatások');
    expect(requestedUrls).toHaveLength(requestsBeforeDelete);
    expect(log.putBodies).toEqual([]);
  });

  it('a Start panelén nincs Törlés gomb, és a gráf nem változik (SPEC-008 5.9, AC83)', async () => {
    const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
    await renderScreen('?workflowId=wf-1', createFetchFunction(log));
    act(() => {
      lastCanvasProperties().onSelectNode('n-1');
    });
    expect(container.querySelector('.node-inspector')).not.toBeNull();
    const labels = [...container.querySelectorAll(':scope .node-inspector button')].map((button) => button.textContent);
    expect(labels).not.toContain('Törlés');
    expect(container.textContent).not.toContain('Mentetlen változtatások');
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

  it('a befecskendezett azonosító generátort változatlanul továbbadja a vászonnak (SPEC-008 5.8)', async () => {
    const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
    await renderScreen('?workflowId=wf-1', createFetchFunction(log));
    expect(lastCanvasProperties().graphElementIdGenerator).toBe(GRAPH_ELEMENT_ID_GENERATOR);
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

  // ============================================================
  // A FUTÁS INDÍTÁSA (T-009-23, SPEC-008 6.5, AC28).
  // ============================================================

  interface StartRunLog {
    readonly postBodies: string[];
  }

  /**
   * A `GET /graph` a megadott `start` node config-gal tér vissza, a
   * `POST /runs` pedig az indított futás azonosítóját adja. A POST törzsek
   * naplózva, hogy a teszt a `StartRunRequest.input` alakját is mérhesse.
   */
  function createStartRunFetchFunction(
    log: StartRunLog,
    startInputFields: readonly { name: string; label: string; valueKind: string; required: boolean }[],
    startRunStatus = 200,
  ): FetchFunction {
    return (input, init) => {
      if (init.method === 'POST') {
        log.postBodies.push(typeof init.body === 'string' ? init.body : '{}');
        if (startRunStatus === 200) {
          return Promise.resolve(jsonResponse({ runId: 'r-7', status: 'pending' }));
        }
        return Promise.resolve(new Response('nem sikerult', { status: startRunStatus }));
      }
      const pathname = new URL(input).pathname;
      if (pathname.endsWith('/graph')) {
        return Promise.resolve(
          jsonResponse({
            nodes: [
              {
                ...START_NODE,
                config: { type: 'start', inputFields: startInputFields, onUnhandledError: null },
                createdAtMs: 0,
                updatedAtMs: 0,
              },
              { ...AGENT_NODE, createdAtMs: 0, updatedAtMs: 0 },
            ],
            edges: [{ ...EDGE_INPUT, createdAtMs: 0 }],
          }),
        );
      }
      if (pathname === '/api/settings') {
        return Promise.resolve(jsonResponse(SETTINGS_RECORD));
      }
      return Promise.resolve(jsonResponse(WORKFLOW_DETAIL));
    };
  }

  function startButton(): HTMLButtonElement {
    const button = [...container.querySelectorAll<HTMLButtonElement>(':scope .page-footer button')].find(
      (candidate) => candidate.textContent === 'Futás indítása',
    );
    if (button === undefined) {
      throw new Error('a teszt nem talált "Indítás" gombot a láblécben');
    }
    return button;
  }

  it('ÜRES inputFields lista esetén a modális NEM nyílik meg, a futás közvetlenül indul', async () => {
    const log: StartRunLog = { postBodies: [] };
    await renderScreen('?workflowId=wf-1', createStartRunFetchFunction(log, []));

    await act(async () => {
      startButton().click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(log.postBodies).toEqual([JSON.stringify({ input: {} })]);
    expect(navigate).toHaveBeenCalledWith('runView', 'runId=r-7');
  });

  it('NEM ÜRES inputFields lista esetén a modális nyílik meg, kérés nélkül', async () => {
    const log: StartRunLog = { postBodies: [] };
    const fields = [{ name: 'topic', label: 'Téma', valueKind: 'string', required: true }];
    await renderScreen('?workflowId=wf-1', createStartRunFetchFunction(log, fields));

    act(() => {
      startButton().click();
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.querySelector('.modal__title')?.textContent).toBe('Futás indítása');
    expect(dialog?.querySelector('.field__label')?.textContent).toBe('Téma');
    expect(log.postBodies).toEqual([]);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('a modális "Mégse" gombja bezárja a modálist, indítás nélkül', async () => {
    const log: StartRunLog = { postBodies: [] };
    const fields = [{ name: 'topic', label: 'Téma', valueKind: 'string', required: true }];
    await renderScreen('?workflowId=wf-1', createStartRunFetchFunction(log, fields));

    act(() => {
      startButton().click();
    });
    const cancelButton = [
      ...container.querySelectorAll<HTMLButtonElement>(':scope [role="dialog"] .modal__footer button'),
    ].find((candidate) => candidate.textContent === 'Mégse');
    if (cancelButton === undefined) {
      throw new Error('a teszt nem talált "Mégse" gombot a modálisban');
    }
    act(() => {
      cancelButton.click();
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(log.postBodies).toEqual([]);
  });

  it('a modális beküldése a start mezők értékeit küldi el, és a futás nézetre navigál', async () => {
    const log: StartRunLog = { postBodies: [] };
    const fields = [{ name: 'topic', label: 'Téma', valueKind: 'string', required: true }];
    await renderScreen('?workflowId=wf-1', createStartRunFetchFunction(log, fields));

    act(() => {
      startButton().click();
    });
    const field = container.querySelector<HTMLInputElement>(':scope [role="dialog"] input.input');
    if (field === null) {
      throw new Error('a teszt nem talált bemeneti mezőt a modálisban');
    }
    act(() => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      descriptor?.set?.call(field, 'AI hírek');
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const form = container.querySelector(':scope [role="dialog"] form');
    if (form === null) {
      throw new Error('a teszt nem talált űrlapot a modálisban');
    }
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(log.postBodies).toEqual([JSON.stringify({ input: { topic: 'AI hírek' } })]);
    expect(navigate).toHaveBeenCalledWith('runView', 'runId=r-7');
  });

  it('mentetlen változás mellett az indítás gomb letiltva', async () => {
    const log: StartRunLog = { postBodies: [] };
    await renderScreen('?workflowId=wf-1', createStartRunFetchFunction(log, []));
    expect(startButton().disabled).toBe(false);

    const initialNodes = lastCanvasProperties().nodes;
    act(() => {
      lastCanvasProperties().onGraphChange(
        initialNodes.map((node) => (node.id === 'n-1' ? { ...node, positionX: 99 } : node)),
        [],
      );
    });

    expect(startButton().disabled).toBe(true);
  });

  it('üres gráf mellett az indítás gomb letiltva', async () => {
    const log: StartRunLog = { postBodies: [] };
    await renderScreen('?workflowId=wf-1', createStartRunFetchFunction(log, []));

    act(() => {
      lastCanvasProperties().onGraphChange([], []);
    });

    expect(startButton().disabled).toBe(true);
  });

  it('modális nélküli indítás hibáját a lábléc státusza írja ki', async () => {
    const log: StartRunLog = { postBodies: [] };
    await renderScreen('?workflowId=wf-1', createStartRunFetchFunction(log, [], 500));

    await act(async () => {
      startButton().click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector(':scope .page-footer .alert--danger[role="alert"]')?.textContent).toBe(
      'A szerver hibás választ adott (HTTP 500).',
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it('modálissal indított futás hibája a modálisban látszik, a láblécben nem', async () => {
    const log: StartRunLog = { postBodies: [] };
    const fields = [{ name: 'topic', label: 'Téma', valueKind: 'string', required: false }];
    await renderScreen('?workflowId=wf-1', createStartRunFetchFunction(log, fields, 500));

    act(() => {
      startButton().click();
    });
    const form = container.querySelector(':scope [role="dialog"] form');
    if (form === null) {
      throw new Error('a teszt nem talált űrlapot a modálisban');
    }
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      container.querySelector(':scope [role="dialog"] .modal__body > .alert--danger[role="alert"]'),
    ).not.toBeNull();
    expect(container.querySelector(':scope .page-footer .alert--danger[role="alert"]')).toBeNull();
  });

  describe('csomópont felvétel (SPEC-008 5.8)', () => {
    it('a "Hozzáadás" sm méretű menü gomb a lábléc akciósávjában, közvetlenül a split button előtt, kilenc menüponttal (AC74)', async () => {
      const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
      await renderScreen('?workflowId=wf-1', createFetchFunction(log));

      const trigger = findAddMenuTrigger(container);
      expect(trigger.classList.contains('btn--sm')).toBe(true);
      expect(trigger.disabled).toBe(false);
      // A `Menu` a triggert egy `.menu-anchor` burkolóba teszi: ez a burkoló az
      // akciósáv közvetlen gyereke, és a split button gombcsoport közvetlenül
      // utána áll.
      const anchor = trigger.parentElement;
      expect(anchor?.nextElementSibling?.classList.contains('button-group')).toBe(true);
      expect(anchor?.nextElementSibling?.getAttribute('aria-label')).toBe('Gráf műveletek');

      act(() => {
        trigger.click();
      });
      expect(openedMenuItems().map((item) => item.textContent)).toEqual([
        'Agent lépés',
        'Elágazás',
        'Szétosztás',
        'Összefésülés',
        'Ciklus',
        'Emberi jóváhagyás',
        'Hibakezelő',
        'Al-workflow',
        'Szkript',
      ]);
    });

    it('a gomb menüpontja a látható vászon közepére vesz fel, kiválaszt, panelt nyit, mentetlen jelzőt ad, kérés nélkül (AC77, AC78)', async () => {
      const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
      const calls = { count: 0 };
      await renderScreen('?workflowId=wf-1', countingFetchFunction(log, calls));
      const callsAfterLoad = calls.count;
      const geometry = { width: 1000, height: 600, transform: [100, 50, 2] as const };
      act(() => {
        capturedStoreApis.at(-1)?.setState({
          width: geometry.width,
          height: geometry.height,
          transform: [...geometry.transform],
        });
      });

      act(() => {
        findAddMenuTrigger(container).click();
      });
      act(() => {
        openedMenuItems()[4]?.click();
      });

      const expectedPosition = computeViewportCenterNodePosition(geometry);
      const addedNode = lastCanvasProperties().nodes.find((node) => node.id === 'generated-element-id');
      expect(addedNode).toMatchObject({
        type: 'loop',
        label: '',
        positionX: expectedPosition.x,
        positionY: expectedPosition.y,
      });
      expect(lastCanvasProperties().nodes).toHaveLength(3);
      expect(lastCanvasProperties().selectedNodeId).toBe('generated-element-id');
      expect(container.querySelector('.node-inspector')?.textContent).toContain('Max. iterációk száma');
      expect(container.textContent).toContain('Mentetlen változtatások');
      expect(calls.count).toBe(callsAfterLoad);
    });

    it('a jobb klikk menü helyét a vászon adja, a felvétel ugyanígy kiválaszt, panelt nyit és mentetlen jelzőt ad, kérés nélkül (AC78)', async () => {
      const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
      const calls = { count: 0 };
      await renderScreen('?workflowId=wf-1', countingFetchFunction(log, calls));
      const callsAfterLoad = calls.count;

      act(() => {
        lastCanvasProperties().onAddNode('branch', { x: 40, y: 60 });
      });

      const addedNode = lastCanvasProperties().nodes.find((node) => node.id === 'generated-element-id');
      expect(addedNode).toMatchObject({ type: 'branch', label: '', positionX: 40, positionY: 60 });
      expect(lastCanvasProperties().selectedNodeId).toBe('generated-element-id');
      expect(container.querySelector('.node-inspector')?.textContent).toContain('Feltétel kifejezés');
      expect(container.textContent).toContain('Mentetlen változtatások');
      expect(calls.count).toBe(callsAfterLoad);
    });
  });

  describe('szűk nézet: a --ep-screen-sm token alatt a lábléc "Hozzáadás" és "Futás indítása" gombja csak ikon (SPEC-008 5.8, user döntések 2026-10-14 és 2026-10-16)', () => {
    let restoreMatchMedia: () => void;

    beforeEach(() => {
      const realMatchMedia = globalThis.matchMedia.bind(globalThis);
      const matchMediaSpy = vi.spyOn(globalThis, 'matchMedia').mockImplementation((query: string) => {
        const media = realMatchMedia(query);
        if (query === FOOTER_COMPACT_MEDIA_QUERY) {
          Object.defineProperty(media, 'matches', { value: true, configurable: true });
        }
        return media;
      });
      restoreMatchMedia = () => {
        matchMediaSpy.mockRestore();
      };
    });

    afterEach(() => {
      restoreMatchMedia();
    });

    it('a "Hozzáadás" sm méretű `.btn--icon` gomb, szöveg nélkül, a nevét az aria-label adja, és ugyanaz a kilenc menüpont nyílik', async () => {
      const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
      await renderScreen('?workflowId=wf-1', createFetchFunction(log));

      const trigger = findAddMenuTrigger(container);
      expect(trigger.classList.contains('btn--icon')).toBe(true);
      expect(trigger.classList.contains('btn--sm')).toBe(true);
      expect(trigger.getAttribute('aria-label')).toBe('Hozzáadás');
      expect(trigger.textContent).toBe('');
      expect(trigger.querySelector('svg[aria-hidden="true"]')).not.toBeNull();

      act(() => {
        trigger.click();
      });
      expect(openedMenuItems()).toHaveLength(9);
      act(() => {
        openedMenuItems()[1]?.click();
      });
      expect(lastCanvasProperties().nodes.find((node) => node.id === 'generated-element-id')).toMatchObject({
        type: 'branch',
      });
    });

    it('a "Futás indítása" sm méretű `.btn--icon` gomb, szöveg nélkül, a nevét az aria-label adja, és a kattintása változatlanul elindítja a futást', async () => {
      const log: StartRunLog = { postBodies: [] };
      await renderScreen('?workflowId=wf-1', createStartRunFetchFunction(log, []));

      const button = buttonNamed('Futás indítása');
      expect(button.classList.contains('btn--icon')).toBe(true);
      expect(button.classList.contains('btn--sm')).toBe(true);
      expect(button.getAttribute('aria-label')).toBe('Futás indítása');
      expect(button.textContent).toBe('');
      expect(button.querySelector(':scope svg[aria-hidden="true"] polygon')).not.toBeNull();

      await act(async () => {
        button.click();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(log.postBodies).toEqual([JSON.stringify({ input: {} })]);
      expect(navigate).toHaveBeenCalledWith('runView', 'runId=r-7');
    });
  });

  describe('visszavonás és újra elvégzés (SPEC-008 5.10)', () => {
    it('a lábléc sorrendje Futás indítása, Visszavonás, Újra, Hozzáadás, Mentés; a két új gomb sm ikon gomb aria-label névvel, betöltés után tiltott (AC103)', async () => {
      const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
      await renderScreen('?workflowId=wf-1', createFetchFunction(log));

      expect(
        footerActionButtons(container).map((button) => button.getAttribute('aria-label') ?? button.textContent),
      ).toEqual(['Futás indítása', 'Visszavonás', 'Újra', 'Hozzáadás', 'Mentés', 'További műveletek']);
      for (const name of ['Visszavonás', 'Újra']) {
        const button = buttonNamed(name);
        expect(button.classList.contains('btn--icon')).toBe(true);
        expect(button.classList.contains('btn--sm')).toBe(true);
        expect(button.textContent).toBe('');
        expect(button.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
        expect(button.disabled).toBe(true);
      }
    });

    it.each([
      { name: 'Visszavonás', shortcut: 'Ctrl+Z' },
      { name: 'Újra', shortcut: 'Ctrl+Shift+Z / Ctrl+Y' },
    ])(
      'a(z) $name gomb fókuszára a Tooltip a feliratot és a $shortcut jelölést mutatja (AC103)',
      async ({ name, shortcut }) => {
        const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
        await renderScreen('?workflowId=wf-1', createFetchFunction(log));
        // Két változás és egy visszavonás után mindkét gomb engedélyezett, tehát
        // fókuszálható.
        moveStartNode(99);
        moveStartNode(150);
        clickButton('Visszavonás');

        const button = buttonNamed(name);
        act(() => {
          button.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        });
        const tooltip = container.querySelector(':scope .page-footer [role="tooltip"]:not([hidden])');
        expect(tooltip).not.toBeNull();
        expect(button.getAttribute('aria-describedby')).toBe(tooltip?.id);
        expect(tooltip?.getAttribute('role')).toBe('tooltip');
        expect(tooltip?.querySelector('.tooltip__text')?.textContent).toBe(name);
        expect(tooltip?.querySelector('kbd')?.textContent).toBe(shortcut);
        expect(button.getAttribute('aria-label')).toBe(name);
      },
    );

    it('a gombok pontosan a művelet előtti és utáni dokumentumot állítják vissza, a betöltött állapotig visszavonva a mentetlen jelző eltűnik (AC101)', async () => {
      const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
      const calls = { count: 0 };
      await renderScreen('?workflowId=wf-1', countingFetchFunction(log, calls));
      const callsAfterLoad = calls.count;
      const loadedNodes = lastCanvasProperties().nodes;

      moveStartNode(99);
      expect(buttonNamed('Visszavonás').disabled).toBe(false);
      expect(buttonNamed('Újra').disabled).toBe(true);

      clickButton('Visszavonás');
      expect(lastCanvasProperties().nodes).toEqual(loadedNodes);
      expect(container.textContent).not.toContain('Mentetlen változtatások');
      expect(buttonNamed('Visszavonás').disabled).toBe(true);
      expect(buttonNamed('Újra').disabled).toBe(false);

      clickButton('Újra');
      expect(canvasPositionOf('n-1')).toBe(99);
      expect(container.textContent).toContain('Mentetlen változtatások');
      expect(buttonNamed('Újra').disabled).toBe(true);
      expect(calls.count).toBe(callsAfterLoad);
    });

    it('Ctrl+Z visszavon, Ctrl+Y és Ctrl+Shift+Z újra elvégez, a kezelt billentyűn preventDefault fut (AC101, AC102)', async () => {
      const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
      await renderScreen('?workflowId=wf-1', createFetchFunction(log));

      moveStartNode(99);
      moveStartNode(150);

      const undoEvent = pressShortcut({ key: 'z', ctrlKey: true });
      expect(undoEvent.defaultPrevented).toBe(true);
      expect(canvasPositionOf('n-1')).toBe(99);
      pressShortcut({ key: 'z', ctrlKey: true });
      expect(canvasPositionOf('n-1')).toBe(0);
      // Üres visszavonás listánál a billentyű nem változtat.
      pressShortcut({ key: 'z', ctrlKey: true });
      expect(canvasPositionOf('n-1')).toBe(0);

      pressShortcut({ key: 'y', ctrlKey: true });
      expect(canvasPositionOf('n-1')).toBe(99);
      pressShortcut({ key: 'Z', ctrlKey: true, shiftKey: true });
      expect(canvasPositionOf('n-1')).toBe(150);
    });

    it('egy új változás az újra listát kiüríti', async () => {
      const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
      await renderScreen('?workflowId=wf-1', createFetchFunction(log));
      moveStartNode(99);
      clickButton('Visszavonás');
      expect(buttonNamed('Újra').disabled).toBe(false);

      moveStartNode(42);
      expect(buttonNamed('Újra').disabled).toBe(true);
    });

    it('a beviteli mezőben lenyomott Ctrl+Z a gráfot nem vonja vissza (AC102)', async () => {
      const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
      await renderScreen('?workflowId=wf-1', createFetchFunction(log));
      moveStartNode(99);
      act(() => {
        lastCanvasProperties().onSelectNode('n-2');
      });

      const event = pressShortcut({ key: 'z', ctrlKey: true }, inspectorTextarea(container));
      expect(event.defaultPrevented).toBe(false);
      expect(canvasPositionOf('n-1')).toBe(99);
    });

    it('egy húzás a végéig egy lépés (AC101)', async () => {
      const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
      await renderScreen('?workflowId=wf-1', createFetchFunction(log));
      moveStartNode(10, { key: 'node-drag', isFinal: false });
      moveStartNode(20, { key: 'node-drag', isFinal: false });
      moveStartNode(30, { key: 'node-drag', isFinal: true });

      clickButton('Visszavonás');
      expect(canvasPositionOf('n-1')).toBe(0);
      expect(buttonNamed('Visszavonás').disabled).toBe(true);
    });

    it('a mező egy szerkesztési menete a blur-ig egy lépés, a következő menet új lépés (AC102)', async () => {
      const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
      await renderScreen('?workflowId=wf-1', createFetchFunction(log));
      act(() => {
        lastCanvasProperties().onSelectNode('n-2');
      });

      act(() => {
        inspectorTextarea(container).focus();
      });
      typeInto(inspectorTextarea(container), 'sablon 1');
      typeInto(inspectorTextarea(container), 'sablon 12');
      act(() => {
        inspectorTextarea(container).blur();
      });
      act(() => {
        inspectorTextarea(container).focus();
      });
      typeInto(inspectorTextarea(container), 'sablon 123');
      act(() => {
        inspectorTextarea(container).blur();
      });
      expect(agentPromptTemplate()).toBe('sablon 123');

      clickButton('Visszavonás');
      expect(agentPromptTemplate()).toBe('sablon 12');
      clickButton('Visszavonás');
      expect(agentPromptTemplate()).toBe('sablon');
      expect(buttonNamed('Visszavonás').disabled).toBe(true);
    });

    it('a felvétel visszavonása a kiválasztást megszünteti, és az újra elvégzés sem nyitja meg újra a panelt (AC101, 5.10)', async () => {
      const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
      await renderScreen('?workflowId=wf-1', createFetchFunction(log));
      act(() => {
        lastCanvasProperties().onAddNode('script', { x: 5, y: 5 });
      });
      expect(lastCanvasProperties().selectedNodeId).toBe('generated-element-id');

      clickButton('Visszavonás');
      expect(canvasNodeIds()).toEqual(['n-1', 'n-2']);
      expect(lastCanvasProperties().selectedNodeId).toBeUndefined();
      expect(container.querySelector('.node-inspector')).toBeNull();

      clickButton('Újra');
      expect(canvasNodeIds()).toEqual(['n-1', 'n-2', 'generated-element-id']);
      expect(lastCanvasProperties().selectedNodeId).toBeUndefined();
      expect(container.querySelector('.node-inspector')).toBeNull();
    });

    it('a panel Törlés gombja a vele törlődő élekkel együtt egy lépés (AC101)', async () => {
      const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
      await renderScreen('?workflowId=wf-1', createFetchFunction(log));
      const edgeToAgent = { ...EDGE_INPUT, id: 'e-in', sourceNodeId: 'n-1', targetNodeId: 'n-2' };
      act(() => {
        lastCanvasProperties().onGraphChange(lastCanvasProperties().nodes, [
          ...lastCanvasProperties().edges,
          edgeToAgent,
        ]);
      });
      act(() => {
        lastCanvasProperties().onSelectNode('n-2');
      });
      act(() => {
        [...container.querySelectorAll<HTMLButtonElement>('button')]
          .find((button) => button.textContent === 'Törlés')
          ?.click();
      });
      expect(canvasNodeIds()).toEqual(['n-1']);

      clickButton('Visszavonás');
      expect(canvasNodeIds()).toEqual(['n-1', 'n-2']);
      expect(lastCanvasProperties().edges.map((edge) => edge.id)).toEqual(['e-1', 'e-in']);
    });

    it('az automatikus elrendezés egy lépés (AC101)', async () => {
      const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
      await renderScreen('?workflowId=wf-1', createFetchFunction(log));
      const loadedNodes = lastCanvasProperties().nodes;
      act(() => {
        buttonNamed('További műveletek').click();
      });
      act(() => {
        [...document.body.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
          .find((item) => item.textContent === 'Elrendezés')
          ?.click();
      });
      expect(lastCanvasProperties().nodes).not.toEqual(loadedNodes);

      clickButton('Visszavonás');
      expect(lastCanvasProperties().nodes).toEqual(loadedNodes);
    });

    it('sikeres mentés után mindkét lista üres, mindkét gomb tiltott (AC103, 5.10)', async () => {
      const log: RouteCallLog = { putBodies: [], graphGetCount: 0 };
      await renderScreen('?workflowId=wf-1', createFetchFunction(log));
      moveStartNode(99);
      moveStartNode(150);
      clickButton('Visszavonás');
      expect(buttonNamed('Visszavonás').disabled).toBe(false);
      expect(buttonNamed('Újra').disabled).toBe(false);

      await act(async () => {
        buttonNamed('Mentés').click();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(log.putBodies).toHaveLength(1);
      expect(buttonNamed('Visszavonás').disabled).toBe(true);
      expect(buttonNamed('Újra').disabled).toBe(true);
      pressShortcut({ key: 'z', ctrlKey: true });
      expect(canvasPositionOf('n-1')).toBe(99);
    });

    it('sikertelen mentés a listákat nem érinti', async () => {
      await renderScreen('?workflowId=wf-1', failingPutFetchFunction);
      moveStartNode(99);

      await act(async () => {
        buttonNamed('Mentés').click();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(container.querySelector('.toast__title')?.textContent).toBe('A mentés sikertelen');
      expect(buttonNamed('Visszavonás').disabled).toBe(false);
      clickButton('Visszavonás');
      expect(canvasPositionOf('n-1')).toBe(0);
    });

    it('sikertelen mentés után a billentyű ismét visszavon (user döntés 2026-10-16)', async () => {
      await renderScreen('?workflowId=wf-1', failingPutFetchFunction);
      moveStartNode(99);

      await act(async () => {
        buttonNamed('Mentés').click();
        await Promise.resolve();
        await Promise.resolve();
      });

      const event = pressShortcut({ key: 'z', ctrlKey: true });
      expect(event.defaultPrevented).toBe(true);
      expect(canvasPositionOf('n-1')).toBe(0);
    });

    it('a mentés alatt a Ctrl+Z, a Ctrl+Shift+Z és a Ctrl+Y sem von vissza és nem végez újra, a gombokhoz hasonlóan (user döntés 2026-10-16)', async () => {
      await renderScreen('?workflowId=wf-1', pendingPutFetchFunction);
      moveStartNode(99);
      moveStartNode(150);
      clickButton('Visszavonás');
      expect(canvasPositionOf('n-1')).toBe(99);
      expect(buttonNamed('Visszavonás').disabled).toBe(false);
      expect(buttonNamed('Újra').disabled).toBe(false);

      act(() => {
        buttonNamed('Mentés').click();
      });
      expect(buttonNamed('Mentés...').disabled).toBe(true);

      const undoEvent = pressShortcut({ key: 'z', ctrlKey: true });
      const redoEvent = pressShortcut({ key: 'Z', ctrlKey: true, shiftKey: true });
      const redoYEvent = pressShortcut({ key: 'y', ctrlKey: true });

      expect(canvasPositionOf('n-1')).toBe(99);
      for (const event of [undoEvent, redoEvent, redoYEvent]) {
        expect(event.defaultPrevented).toBe(false);
      }
    });

    it('a mentés alatt mindkét gomb tiltott (AC103)', async () => {
      await renderScreen('?workflowId=wf-1', pendingPutFetchFunction);
      moveStartNode(99);
      moveStartNode(150);
      clickButton('Visszavonás');
      expect(buttonNamed('Visszavonás').disabled).toBe(false);
      expect(buttonNamed('Újra').disabled).toBe(false);

      act(() => {
        buttonNamed('Mentés').click();
      });

      expect(buttonNamed('Mentés...').disabled).toBe(true);
      expect(buttonNamed('Visszavonás').disabled).toBe(true);
      expect(buttonNamed('Újra').disabled).toBe(true);
    });
  });

  describe('a visszavonás módosító billentyűje (SPEC-008 5.10, O-31, AC113)', () => {
    it('macOS felhasználói ügynökkel és üres tárolóval a Cmd+Z visszavon, a Ctrl+Z nem, a tipp a Cmd alakot mutatja', async () => {
      userAgentSpy.mockReturnValue(MACOS_USER_AGENT);
      await renderWithTwoMoves();

      const ctrlEvent = pressShortcut({ key: 'z', ctrlKey: true });
      expect(ctrlEvent.defaultPrevented).toBe(false);
      expect(canvasPositionOf('n-1')).toBe(150);

      const metaEvent = pressShortcut({ key: 'z', metaKey: true });
      expect(metaEvent.defaultPrevented).toBe(true);
      expect(canvasPositionOf('n-1')).toBe(99);
      pressShortcut({ key: 'y', metaKey: true });
      expect(canvasPositionOf('n-1')).toBe(150);
      pressShortcut({ key: 'z', metaKey: true });
      pressShortcut({ key: 'Z', metaKey: true, shiftKey: true });
      expect(canvasPositionOf('n-1')).toBe(150);

      expect(focusTooltipShortcut('Visszavonás')).toBe('Cmd+Z');
    });

    it('macOS felhasználói ügynökkel a Újra gomb tippje a Cmd alakot mutatja', async () => {
      userAgentSpy.mockReturnValue(MACOS_USER_AGENT);
      await renderWithTwoMoves();
      clickButton('Visszavonás');

      expect(focusTooltipShortcut('Újra')).toBe('Cmd+Shift+Z / Cmd+Y');
    });

    it('macOS felhasználói ügynökkel és tárolt ctrl értékkel a Ctrl+Z visszavon, a Cmd+Z nem, a tipp a Ctrl alakot mutatja', async () => {
      userAgentSpy.mockReturnValue(MACOS_USER_AGENT);
      globalThis.localStorage.setItem(UNDO_MODIFIER_STORAGE_KEY, 'ctrl');
      await renderWithTwoMoves();

      const metaEvent = pressShortcut({ key: 'z', metaKey: true });
      expect(metaEvent.defaultPrevented).toBe(false);
      expect(canvasPositionOf('n-1')).toBe(150);

      pressShortcut({ key: 'z', ctrlKey: true });
      expect(canvasPositionOf('n-1')).toBe(99);
      expect(focusTooltipShortcut('Visszavonás')).toBe('Ctrl+Z');
    });

    it('nem macOS felhasználói ügynökkel és üres tárolóval a Ctrl+Z visszavon, a Cmd+Z nem', async () => {
      await renderWithTwoMoves();

      pressShortcut({ key: 'z', metaKey: true });
      expect(canvasPositionOf('n-1')).toBe(150);
      pressShortcut({ key: 'z', ctrlKey: true });
      expect(canvasPositionOf('n-1')).toBe(99);
    });

    it('nem macOS felhasználói ügynökkel és tárolt meta értékkel a Cmd+Z visszavon, a Ctrl+Z nem, a tipp a Cmd alakot mutatja', async () => {
      globalThis.localStorage.setItem(UNDO_MODIFIER_STORAGE_KEY, 'meta');
      await renderWithTwoMoves();

      pressShortcut({ key: 'z', ctrlKey: true });
      expect(canvasPositionOf('n-1')).toBe(150);
      pressShortcut({ key: 'z', metaKey: true });
      expect(canvasPositionOf('n-1')).toBe(99);
      expect(focusTooltipShortcut('Visszavonás')).toBe('Cmd+Z');
    });

    it('hibás tárolt érték az Automatikus szerint dönt: nem macOS felhasználói ügynökkel a Ctrl+Z visszavon', async () => {
      globalThis.localStorage.setItem(UNDO_MODIFIER_STORAGE_KEY, 'cmd');
      await renderWithTwoMoves();

      pressShortcut({ key: 'z', ctrlKey: true });
      expect(canvasPositionOf('n-1')).toBe(99);
    });
  });
});
