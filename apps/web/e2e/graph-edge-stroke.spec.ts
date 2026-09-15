// Regressziós e2e: a gráf éleinek TÉNYLEGESEN KIFESTETT vonala (2026-09-09).
//
// MIÉRT KELL EZ A FÁJL, AZAZ MI VOLT GYENGE A MEGLÉVŐ TESZTBEN. A
// `graph-editor.spec.ts` egyetlen él állítása
// `expect(page.getByTestId('rf__edge-e1')).toBeVisible()`. Ez két okból nem
// fogja meg azt a hibát, amitől a felhasználó tart (eltűnő vonalak):
//
//   1. A `toBeVisible()` a Playwright dokumentált definíciója szerint nem üres
//      befoglaló dobozt és nem `visibility: hidden` állapotot néz
//      (https://playwright.dev/docs/actionability#visible) - a VONAL SZÍNÉRŐL
//      semmit nem állít. Ha az `--xy-edge-stroke` egy háttér tokenre kerülne,
//      az él doboza változatlanul ott van és látható, tehát az állítás
//      átmegy, miközben a képernyőn semmi nem látszik. Mérve 2026-09-09:
//      `--xy-edge-stroke: var(--ep-bg-sunken)` mellett a kifestett pixelek
//      maximális csatorna eltérése világos témában 0, sötétben 1 (a lenti
//      pixel mérés metrikájával), a `toBeVisible()` viszont zöld marad.
//   2. Az ott használt fixtúra SZÁNDÉKOSAN átlós (a második csomópont
//      `positionY: 240`), mert egy vízszintes él befoglaló doboza 0 magas, és
//      a `toBeVisible()` ott hamis bukást adna. A VALÓS alkalmazás viszont
//      épp vízszintes láncot rajzol, tehát a meglévő teszt pont azt az esetet
//      kerüli meg, amit a felhasználó lát.
//
// EZ A FÁJL EZÉRT: vízszintes láncot használ (a valós alkalmazás alakja), és
// nem a DOM meglétét, hanem a KIFESTETT PIXELEKET állítja. A módszer: két
// képernyőkép ugyanarról a kis területről (a két csomópont közötti szakasz),
// egyszer az éllel, egyszer az él útvonalát elrejtve, majd a két kép
// pixelenkénti összevetése. Ez immunis a React Flow háttér pontmintájára is,
// mert az mindkét képen ugyanott áll.
//
// A MÉRT SZÁMOK (chromium, 1440x900, 2026-09-09). Ép állapotban a maximális
// csatorna eltérés világos témában 236, sötétben 53. A fenti, szándékosan
// elrontott állapotban 0, illetve 1. A küszöb ezért 24: jóval a mért sötét
// témás 53 alatt (nem törékeny), és nagyságrenddel a hibás állapot 1 értéke
// felett (ténylegesen fog).
import type {
  NodeConfig,
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

const SCRIPT_CONFIG: NodeConfig = {
  type: 'script',
  source: 'return 1;',
  runtime: 'expression',
  onUnhandledError: null,
};

// A VALÓS alkalmazás gráfalakja: azonos magasságban álló csomópontok, tehát
// VÍZSZINTES él. Nem átlós fixtúra, mert a hiba pont ezen az alakon látszik.
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
    {
      id: 'n-script',
      type: 'script',
      label: 'Szkript',
      positionX: 500,
      positionY: 0,
      config: SCRIPT_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
  ],
  edges: [
    {
      id: 'e1',
      sourceNodeId: 'n-start',
      targetNodeId: 'n-script',
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

/**
 * A mért ép állapot (236 világos, 53 sötét) és a mért hibás állapot (0, illetve
 * 1) közötti küszöb.
 */
const MINIMUM_CHANNEL_DIFFERENCE = 24;

/**
 * A vizsgált képkivágat mérete a két csomópont közötti szakasz közepén, CSS
 * pixelben.
 */
const CLIP_SIZE = { width: 16, height: 17 };

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
  ]);
});

/**
 * A vonal számított stílusa és a témázás forrása. A `--xy-edge-stroke` a React
 * Flow dokumentált témázási felülete, a `--ep-border-strong` a design system
 * tokenje: a kettő egyezése azt állítja, hogy az él színe létező tokenre épül,
 * nem kitalált értékre.
 */
async function readEdgeStyle(page: Page): Promise<{
  readonly stroke: string;
  readonly strokeWidth: string;
  readonly opacity: string;
  readonly visibility: string;
  readonly xyEdgeStroke: string;
  readonly epBorderStrong: string;
  readonly boxWidth: number;
}> {
  return page.evaluate(() => {
    const path = globalThis.document.querySelector('.react-flow__edge-path');
    const canvas = globalThis.document.querySelector('.graph-editor-canvas');
    if (path === null || canvas === null) {
      throw new Error('a teszt nem talált .react-flow__edge-path és .graph-editor-canvas elemet');
    }
    const computed = globalThis.getComputedStyle(path);
    const rootStyle = globalThis.getComputedStyle(globalThis.document.documentElement);
    return {
      stroke: computed.stroke,
      strokeWidth: computed.strokeWidth,
      opacity: computed.opacity,
      visibility: computed.visibility,
      xyEdgeStroke: globalThis.getComputedStyle(canvas).getPropertyValue('--xy-edge-stroke').trim(),
      epBorderStrong: rootStyle.getPropertyValue('--ep-border-strong').trim(),
      boxWidth: path.getBoundingClientRect().width,
    };
  });
}

/**
 * A vonal közepének képernyő koordinátái alapján kivágott terület. Vízszintes
 * élnél a befoglaló doboz 0 magas, ezért a magasságot a kivágat adja, a doboz
 * `y` értéke köré rendezve.
 */
async function edgeClip(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.evaluate(() => {
    const path = globalThis.document.querySelector('.react-flow__edge-path');
    if (path === null) {
      throw new Error('a teszt nem talált .react-flow__edge-path elemet');
    }
    const rect = path.getBoundingClientRect();
    return { centerX: rect.x + rect.width / 2, y: rect.y };
  });
  return {
    x: Math.round(box.centerX) - CLIP_SIZE.width / 2,
    y: Math.round(box.y) - (CLIP_SIZE.height - 1) / 2,
    width: CLIP_SIZE.width,
    height: CLIP_SIZE.height,
  };
}

/**
 * A KIFESTETT vonal bizonyítéka: ugyanaz a kivágat éllel és él nélkül, majd a
 * két kép legnagyobb csatorna eltérése. Nulla közeli érték azt jelenti, hogy az
 * él útvonala semmit nem fest a vászonra, függetlenül attól, hogy a DOM-ban ott
 * van-e.
 */
async function measurePaintedDifference(page: Page): Promise<number> {
  const clip = await edgeClip(page);
  const paintedShot = await page.screenshot({ clip });

  await page.addStyleTag({ content: '.react-flow__edge-path { display: none !important; }' });
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const path = globalThis.document.querySelector('.react-flow__edge-path');
        return path === null ? 'missing' : globalThis.getComputedStyle(path).display;
      }),
    )
    .toBe('none');
  const blankShot = await page.screenshot({ clip });

  return page.evaluate(
    async (images: { readonly painted: string; readonly blank: string }) => {
      const paintedImage = new globalThis.Image();
      paintedImage.src = `data:image/png;base64,${images.painted}`;
      const blankImage = new globalThis.Image();
      blankImage.src = `data:image/png;base64,${images.blank}`;
      await paintedImage.decode();
      await blankImage.decode();

      const canvas = globalThis.document.createElement('canvas');
      canvas.width = paintedImage.naturalWidth;
      canvas.height = paintedImage.naturalHeight;
      const context = canvas.getContext('2d');
      if (context === null) {
        throw new Error('a 2d rajzoló kontextus nem érhető el');
      }
      context.drawImage(paintedImage, 0, 0);
      const paintedPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(blankImage, 0, 0);
      const blankPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

      let maximum = 0;
      for (const [index, value] of paintedPixels.entries()) {
        // A két kép mérete azonos, tehát az index mindig érvényes; a `?? value`
        // kizárólag a `noUncheckedIndexedAccess` miatt áll itt.
        maximum = Math.max(maximum, Math.abs(value - (blankPixels[index] ?? value)));
      }
      return maximum;
    },
    { painted: paintedShot.toString('base64'), blank: blankShot.toString('base64') },
  );
}

async function openEditor(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(EDITOR_URL);
  await expect(page.getByTestId('rf__node-n-start')).toBeVisible();
  // Az él a DOM-ban van. `toBeAttached` és nem `toBeVisible`: a VÍZSZINTES él
  // befoglaló doboza 0 magas, amit a Playwright láthatóság definíciója üres
  // doboznak tekint - a láthatóságot ezért a pixel mérés állítja, nem ez.
  await expect(page.getByTestId('rf__edge-e1')).toBeAttached();
  // A geometria készen áll, mielőtt képernyőképet készítünk: a vízszintes él
  // befoglaló doboza 0 magas, de a SZÉLESSÉGE nem nulla. Állapot alapú
  // várakozás, nem időzítő.
  await expect
    .poll(async () => {
      const style = await readEdgeStyle(page);
      return style.boxWidth;
    })
    .toBeGreaterThan(0);
}

test('világos témában az él vonala ténylegesen ki van festve, design system tokenre kötve', async ({ page }) => {
  await openEditor(page);

  const style = await readEdgeStyle(page);
  expect(style.epBorderStrong).not.toBe('');
  // A vonalszín forrása a design system tokenje, nem kitalált érték.
  expect(style.xyEdgeStroke).toBe(style.epBorderStrong);
  expect(style.stroke).not.toBe('none');
  expect(style.strokeWidth).not.toBe('0px');
  expect(style.opacity).not.toBe('0');
  expect(style.visibility).toBe('visible');

  expect(await measurePaintedDifference(page)).toBeGreaterThanOrEqual(MINIMUM_CHANNEL_DIFFERENCE);
});

test('sötét témában az él vonala ténylegesen ki van festve, design system tokenre kötve', async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.localStorage.setItem('eggTheme', 'dark');
  });
  await openEditor(page);

  const style = await readEdgeStyle(page);
  expect(style.epBorderStrong).not.toBe('');
  expect(style.xyEdgeStroke).toBe(style.epBorderStrong);
  expect(style.stroke).not.toBe('none');
  expect(style.strokeWidth).not.toBe('0px');
  expect(style.opacity).not.toBe('0');
  expect(style.visibility).toBe('visible');

  expect(await measurePaintedDifference(page)).toBeGreaterThanOrEqual(MINIMUM_CHANNEL_DIFFERENCE);
});
