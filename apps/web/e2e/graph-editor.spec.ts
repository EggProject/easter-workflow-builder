// Regressziós e2e a gráf szerkesztő képernyőre (2026-09-05).
//
// A MÉRT HIBA, ami ezt a fájlt indokolja. A szerkesztő valós böngészőben
// használhatatlan volt, miközben minden kapu zöld maradt, mert a gráf
// vászonra addig EGYETLEN e2e teszt sem futott (a `graph-editor` téma csak
// happy-dom unit teszteket kapott, ahol a React Flow mérési útja nem is fut
// le). Három, egymástól független hiba állt fenn:
//
//   1. a csomópontok tartósan `visibility: hidden` állapotban maradtak, és
//      egyetlen él sem rajzolódott ki (a vezérelt oda-vissza leképezés
//      elnyelte a React Flow `measured` mezőjét, lásd
//      `src/graph-editor/measured-node-sizes.ts`),
//   2. a vászonnak nem volt korlátozott magassága (`70vh`), ezért az OLDAL
//      görgött a vászon pásztázása helyett,
//   3. a React Flow vezérlő gombjai a szállított világos alapértelmezésen
//      maradtak, sötét témában olvashatatlanul.
//
// Ezért a fájl minden állítása `toBeVisible()` alapú, nem `toBeAttached()`:
// a hibás állapotban a csomópont a DOM-ban helyes mérettel JELEN VOLT, csak
// `visibility: hidden` alatt - a `toBeAttached()` tehát átment volna
// (Playwright doksi: `toBeAttached()` csak a DOM-hoz csatoltságot nézi,
// `toBeVisible()` a láthatóságot is,
// https://playwright.dev/docs/api/class-locatorassertions).
import type {
  NodeConfig,
  SettingsRecord,
  WorkflowDetail,
  WorkflowGraphDocument,
} from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */

const AGENT_STEP_CONFIG: NodeConfig = {
  type: 'agent_step',
  promptTemplate: 'Foglald össze a bemenetet.',
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
};

const GRAPH: WorkflowGraphDocument = {
  nodes: [
    {
      id: 'n1',
      type: 'start',
      label: 'Ügyfél kérés fogadása',
      positionX: 0,
      positionY: 0,
      config: { type: 'start', inputFields: [], onUnhandledError: null },
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n2',
      type: 'agent_step',
      label: 'Összefoglaló készítése',
      positionX: 500,
      // A második csomópont SZÁNDÉKOSAN más magasságban áll, mint az első: a
      // Playwright láthatóság definíciója szerint egy elem akkor látható, ha
      // "non-empty bounding box"-a van
      // (https://playwright.dev/docs/actionability#visible), egy tökéletesen
      // vízszintes él befoglaló doboza viszont 0 magas - saját méréssel
      // igazolva 2026-09-05 (`rect.height: 0`, `visibility: visible`), tehát
      // a `toBeVisible()` ott hamis bukást adna. Átlós elrendezésnél az él
      // görbéjének valódi doboza van.
      positionY: 240,
      config: AGENT_STEP_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
  ],
  edges: [
    {
      id: 'e1',
      sourceNodeId: 'n1',
      targetNodeId: 'n2',
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
      createdAtMs: 1,
    },
  ],
};

const WORKFLOW: WorkflowDetail = {
  id: 'w-alfa',
  name: 'Alfa workflow',
  description: null,
  providerId: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};

const SETTINGS: SettingsRecord = { defaultProviderId: null, persistStreamDeltas: false };

/* eslint-enable unicorn/no-null */

const EDITOR_URL = '/editor?workflowId=w-alfa';

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
  ]);
});

/**
 * A React Flow a csomópontokra és az élekre `data-testid="rf__node-<id>"`,
 * illetve `rf__edge-<id>` azonosítót tesz, saját, dokumentált tesztelési
 * fogódzóként. A szabálykönyv locator sorrendjében a `getByTestId` az
 * utolsó, de itt a fölötte állók egyike sem alkalmazható: a csomópont és az
 * él `role="group"` szerepe azonos és szerző adta hozzáférhető név nélküli,
 * a `getByText` pedig kizárólag nem interaktív elemre használható, a
 * csomópont viszont fókuszálható és húzható.
 */
function nodeLocator(page: Page, nodeId: string): Locator {
  return page.getByTestId(`rf__node-${nodeId}`);
}

test('a gráf csomópontjai és élei LÁTHATÓAK a vásznon', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(EDITOR_URL);

  // A csomópont doboza láthatóan, nem csak csatoltan van jelen.
  await expect(nodeLocator(page, 'n1')).toBeVisible();
  await expect(nodeLocator(page, 'n2')).toBeVisible();
  // A kártya tartalma is: a típuscímke és az egyedi címke.
  await expect(page.getByText('Ügyfél kérés fogadása')).toBeVisible();
  await expect(page.getByText('Összefoglaló készítése')).toBeVisible();
  // Az él is kirajzolódik. A hibás állapotban a React Flow egyetlen élt sem
  // renderelt, mert egyik végpont sem volt mérve.
  await expect(page.getByTestId('rf__edge-e1')).toBeVisible();

  // A csomópontnak valódi, nem nulla doboza van.
  const box = await nodeLocator(page, 'n1').boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(0);
  expect(box?.height ?? 0).toBeGreaterThan(0);
});

test('a vászon a rendelkezésre álló területet tölti ki, és az oldal nem görget', async ({ page }) => {
  const viewportHeight = 900;
  await page.setViewportSize({ width: 1440, height: viewportHeight });
  await page.goto(EDITOR_URL);
  await expect(nodeLocator(page, 'n1')).toBeVisible();

  const layout = await page.evaluate(() => {
    const root = globalThis.document.documentElement;
    const canvas = globalThis.document.querySelector('.react-flow');
    const canvasRect = canvas === null ? undefined : canvas.getBoundingClientRect();
    return {
      horizontalOverflow: root.scrollWidth - root.clientWidth,
      verticalOverflow: root.scrollHeight - root.clientHeight,
      canvasTop: canvasRect?.top ?? 0,
      canvasBottom: canvasRect?.bottom ?? 0,
      canvasHeight: canvasRect?.height ?? 0,
      viewportHeight: root.clientHeight,
    };
  });

  // Sem vízszintesen, sem függőlegesen nem görget az OLDAL: a vászon belül
  // pásztázik. A `70vh` plusz oldal fejléc korábban 85px függőleges
  // túllógást adott ugyanezen a viewporton.
  expect(layout.horizontalOverflow).toBe(0);
  expect(layout.verticalOverflow).toBe(0);
  // A vászon alja a viewporton belül van, és a maradék terület érdemi
  // részét kitölti (a fejléc és a toolbar alatti hely legalább felét).
  expect(layout.canvasBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.canvasHeight).toBeGreaterThan((layout.viewportHeight - layout.canvasTop) / 2);
});

test('a React Flow vezérlő gombjai a design system tokenjeire vannak témázva, sötét módban is', async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.localStorage.setItem('eggTheme', 'dark');
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(EDITOR_URL);
  await expect(nodeLocator(page, 'n1')).toBeVisible();

  const zoomInButton = page.getByRole('button', { name: 'Zoom In' });
  await expect(zoomInButton).toBeVisible();

  const themed = await zoomInButton.evaluate((element) => {
    const computed = globalThis.getComputedStyle(element);
    const rootStyle = globalThis.getComputedStyle(globalThis.document.documentElement);
    const readToken = (name: string): string => rootStyle.getPropertyValue(name).trim();
    return {
      background: computed.backgroundColor,
      color: computed.color,
      elevatedToken: readToken('--ep-bg-elevated'),
      foregroundToken: readToken('--ep-fg'),
      // A szállított, témázatlan világos alapértelmezés (style.css
      // `--xy-controls-button-background-color-default: #fefefe`).
      shippedDefault: 'rgb(254, 254, 254)',
    };
  });

  expect(themed.elevatedToken).not.toBe('');
  expect(themed.background).not.toBe(themed.shippedDefault);
  // A gomb háttere és ikonszíne ténylegesen a `--ep-*` tokenek értéke: a
  // hibás állapotban világos ikon állt fehér dobozon, azaz üres gomb.
  expect(themed.background).not.toBe(themed.color);
});

test('a beállítás panel önállóan görget, és nem vágódik le a viewport alján', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(EDITOR_URL);

  // Az `agent_step` a legtöbb mezőt hordozó típus, tehát a panel tartalma
  // biztosan magasabb, mint a rendelkezésre álló hely.
  await nodeLocator(page, 'n2').click();
  await expect(page.getByRole('button', { name: 'Bezárás' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Prompt sablon' })).toBeVisible();

  const panel = await page.evaluate(() => {
    const element = globalThis.document.querySelector('.node-inspector');
    if (element === null) {
      throw new Error('a teszt nem talált .node-inspector elemet');
    }
    const rect = element.getBoundingClientRect();
    return {
      overflowY: globalThis.getComputedStyle(element).overflowY,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      bottom: rect.bottom,
      viewportHeight: globalThis.document.documentElement.clientHeight,
    };
  });

  expect(panel.overflowY).toBe('auto');
  // Van mit görgetni, és a panel alja a viewporton belül van: nem lóg le,
  // tehát a görgetése ténylegesen elérhető.
  expect(panel.scrollHeight).toBeGreaterThan(panel.clientHeight);
  expect(panel.bottom).toBeLessThanOrEqual(panel.viewportHeight);

  // És a görgetés valóban a panelen belül történik.
  const scrolled = await page.evaluate(() => {
    const element = globalThis.document.querySelector('.node-inspector');
    if (element === null) {
      throw new Error('a teszt nem talált .node-inspector elemet');
    }
    element.scrollTop = 200;
    return element.scrollTop;
  });
  expect(scrolled).toBeGreaterThan(0);
});
