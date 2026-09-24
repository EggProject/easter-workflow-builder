// Regressziós e2e: a React Flow vezérlő gombjai és attribúciója MINDKÉT
// vásznon (szerkesztő és futás nézet) a design system tokenjére festenek, és a
// téma váltót élőben, oldal újratöltés nélkül követik (2026-09-23).
//
// A HIBA, AMIT ŐRIZ. A `--xy-*` téma blokk addig csak a szerkesztő
// konténerén (`.graph-editor-canvas`) állt, a futás nézet vásznán nem, tehát
// ott a React Flow szállított, világos alapértelmezése festett. Mérve sötét
// témában, 1440x900: a vezérlő gomb 254,254,254 (a szállított `#fefefe`) a
// 11,13,18 vásznon, az attribúció doboza 133,134,137 (a szállított
// `rgba(255, 255, 255, 0.5)` a sötét vásznon). A mérés és a mechanizmus:
// `docs/research/2026-09-23-react-flow-sotet-tema.md`.
//
// A MÓDSZER KÜSZÖB NÉLKÜLI PIXEL EGYEZÉS. A teszt egy mérő szondát fest a
// vászon üres sarkára `var(--ep-bg-elevated)` háttérrel, és ugyanarról a
// képernyőképről a gomb belsejének és az attribúció dobozának kifestett
// pixelét a szonda pixelével PONTOSAN egyezőnek állítja. A számított stílus
// önmagában nem elég (szabálykönyv 11. szekció: vizuális állítást csak
// kifestett pixel bizonyít), a pixel egyezés viszont kitalált szám nélkül
// dönt: a hibás állapot világos témában is elbukik (254 kontra 255 a gombon,
// 251,249,245 kontra 255 az attribúción), sötétben pedig nagyságrenddel.
import type {
  NodeConfig,
  RunDetail,
  RunSnapshotResponse,
  SettingsRecord,
  WorkflowDetail,
  WorkflowGraphDocument,
} from '@easter-workflow-builder/protocol';
import type { Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */

const START_CONFIG: NodeConfig = { type: 'start', inputFields: [], onUnhandledError: null };

const GRAPH: WorkflowGraphDocument = {
  nodes: [
    {
      id: 'n-start',
      type: 'start',
      label: 'Indítás',
      positionX: 0,
      positionY: 0,
      config: START_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
  ],
  edges: [],
};

const WORKFLOW: WorkflowDetail = {
  id: 'w-tema',
  name: 'Téma workflow',
  description: null,
  providerId: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};

const SETTINGS: SettingsRecord = { defaultProviderId: null, persistStreamDeltas: false };

const SNAPSHOT: RunSnapshotResponse = {
  version: 1,
  sdkVersionPin: '0.1.13',
  workflow: { id: 'w-tema', name: 'Téma workflow', description: null },
  nodes: [
    {
      id: 'n-start',
      type: 'start',
      label: 'Indítás',
      position: { x: 0, y: 0 },
      config: START_CONFIG,
      effectiveProviderId: 'claude-subscription',
    },
  ],
  edges: [],
};

const RUN_DETAIL: RunDetail = {
  id: 'run-tema',
  workflowId: 'w-tema',
  status: 'succeeded',
  input: null,
  providerId: 'claude-subscription',
  rootRunId: 'run-tema',
  depth: 0,
  workflowAncestry: ['w-tema'],
  graphSnapshotHash: 'c'.repeat(64),
  persistedStreamDeltas: false,
  restartedFromRunId: null,
  createdAtMs: 1,
  startedAtMs: 2,
  finishedAtMs: 3,
  errorKind: null,
  errorMessage: null,
};

/* eslint-enable unicorn/no-null */

interface CanvasCase {
  readonly name: string;
  readonly url: string;
  readonly installMocks: (page: Page) => Promise<void>;
}

const CANVASES: readonly CanvasCase[] = [
  {
    name: 'gráf szerkesztő',
    url: '/editor?workflowId=w-tema',
    installMocks: async (page) => {
      await installApiMocks(page, [
        mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
        mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
        mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
      ]);
    },
  },
  {
    name: 'futás nézet',
    url: '/run?runId=run-tema',
    installMocks: async (page) => {
      await installApiMocks(page, [
        mockRoute('getRun', async (route) => route.fulfill(jsonBody(RUN_DETAIL))),
        mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(SNAPSHOT))),
        mockRoute('listStepRuns', async (route) => route.fulfill(jsonBody([]))),
        mockRoute('listPendingApprovals', async (route) => route.fulfill(jsonBody([]))),
        mockRoute('replaceStreamSubscriptions', async (route) =>
          route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
        ),
      ]);
    },
  },
];

const PROBE_ID = 'react-flow-theme-probe';

interface PaintedPixels {
  readonly probe: string;
  readonly controlButton: string;
  readonly attribution: string;
}

/**
 * A mérő szonda: egy kis doboz a vászon bal felső, üres sarkában, a vezérlő
 * gomb és az attribúció elvárt tokenjével. A háttere `var()` hivatkozás, tehát
 * a téma váltásakor ugyanúgy élőben vált, mint a mért elemek. A teszt
 * ellenőrzi, hogy a szonda pontján tényleg a szonda a legfelső elem, különben
 * a pixel nem a szondáé lenne.
 */
async function paintTokenProbe(page: Page): Promise<void> {
  const isProbeOnTop = await page.evaluate((probeId) => {
    const flow = globalThis.document.querySelector('.react-flow');
    if (flow === null) {
      throw new Error('a teszt nem talált .react-flow elemet');
    }
    const flowBox = flow.getBoundingClientRect();
    const probe = globalThis.document.createElement('div');
    probe.id = probeId;
    probe.style.position = 'fixed';
    probe.style.left = `${String(Math.ceil(flowBox.x) + 8)}px`;
    probe.style.top = `${String(Math.ceil(flowBox.y) + 8)}px`;
    probe.style.width = '8px';
    probe.style.height = '8px';
    probe.style.background = 'var(--ep-bg-elevated)';
    globalThis.document.body.append(probe);
    return globalThis.document.elementFromPoint(Math.ceil(flowBox.x) + 12, Math.ceil(flowBox.y) + 12) === probe;
  }, PROBE_ID);
  expect(isProbeOnTop).toBe(true);
}

/**
 * Egyetlen, memóriában tartott képernyőképről három pont kifestett színe: a
 * szonda közepe, a vezérlő gomb belseje (bal szél plusz 3px, az ikontól távol,
 * függőleges közép) és az attribúció dobozának belseje (a bal felső sarok
 * plusz 1px, a szöveg előtti paddingban). A pontok egész pixelre felfelé
 * kerekített dobozhatárból indulnak, hogy egyik se essen élsimított szélre.
 */
async function readPaintedPixels(page: Page): Promise<PaintedPixels> {
  const points = await page.evaluate((probeId) => {
    const probe = globalThis.document.querySelector(`#${probeId}`);
    const button = globalThis.document.querySelector('.react-flow__controls-zoomin');
    const attribution = globalThis.document.querySelector('.react-flow__attribution');
    if (probe === null || button === null || attribution === null) {
      throw new Error('a teszt nem talált szondát, vezérlő gombot vagy attribúciót');
    }
    const probeBox = probe.getBoundingClientRect();
    const buttonBox = button.getBoundingClientRect();
    const attributionBox = attribution.getBoundingClientRect();
    return {
      probe: { x: Math.ceil(probeBox.x) + 4, y: Math.ceil(probeBox.y) + 4 },
      controlButton: { x: Math.ceil(buttonBox.x) + 3, y: Math.ceil(buttonBox.y + buttonBox.height / 2) },
      attribution: { x: Math.ceil(attributionBox.x) + 1, y: Math.ceil(attributionBox.y) + 1 },
    };
  }, PROBE_ID);
  const shot = await page.screenshot({ animations: 'disabled' });

  return page.evaluate(
    async (input: {
      readonly image: string;
      readonly points: Readonly<Record<keyof PaintedPixels, { readonly x: number; readonly y: number }>>;
    }) => {
      const image = new globalThis.Image();
      image.src = `data:image/png;base64,${input.image}`;
      await image.decode();
      const canvas = globalThis.document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (context === null) {
        throw new Error('a 2d rajzoló kontextus nem érhető el');
      }
      context.drawImage(image, 0, 0);
      const colorAt = (point: { readonly x: number; readonly y: number }): string =>
        [...context.getImageData(point.x, point.y, 1, 1).data.slice(0, 3)].join(',');
      return {
        probe: colorAt(input.points.probe),
        controlButton: colorAt(input.points.controlButton),
        attribution: colorAt(input.points.attribution),
      };
    },
    { image: shot.toString('base64'), points },
  );
}

for (const canvas of CANVASES) {
  test(`${canvas.name}: a vezérlő gomb és az attribúció a design system tokenjére fest, és a téma váltást élőben követi`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      globalThis.localStorage.setItem('eggTheme', 'light');
    });
    await mockIdleStream(page);
    await canvas.installMocks(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(canvas.url);

    const zoomInButton = page.getByRole('button', { name: 'Zoom In' });
    await expect(zoomInButton).toBeVisible();
    await expect(page.getByRole('link', { name: 'React Flow attribution' })).toBeVisible();
    await paintTokenProbe(page);

    const light = await readPaintedPixels(page);
    expect(light.controlButton).toBe(light.probe);
    expect(light.attribution).toBe(light.probe);
    const lightBackground = await zoomInButton.evaluate(
      (element) => globalThis.getComputedStyle(element).backgroundColor,
    );

    // Élő váltás: világos -> sötét, oldal újratöltés nélkül. A számított
    // háttér változását állapot alapú várakozás figyeli, nem időzítő.
    await page.getByRole('button', { name: 'Téma: világos' }).click();
    await expect(page.getByRole('button', { name: 'Téma: sötét' })).toBeVisible();
    await expect
      .poll(async () => zoomInButton.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor))
      .not.toBe(lightBackground);

    const dark = await readPaintedPixels(page);
    expect(dark.probe).not.toBe(light.probe);
    expect(dark.controlButton).toBe(dark.probe);
    expect(dark.attribution).toBe(dark.probe);
  });
}
