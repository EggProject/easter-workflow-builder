// Regresszió két, felhasználó által képpel bizonyított vizuális hibára
// (2026-09-09). Mindkét állítás a TÉNYLEGES, számított stílust nézi valódi
// chromiumban, nem az osztálynév meglétét: a korábbi
// `NodeInspector.spec.tsx` teszt épp azért nem fogta meg a bezáró gomb
// arany színét, mert csak a `btn--ghost` osztálynevet ellenőrizte, azt
// pedig a hibás állapot is viselte.
//
// 1. BETŰTÍPUS. A natív űrlap vezérlő (`select`, `input`, `textarea`,
//    `button`) a szülőjétől NEM örökli a `font-family` értéket, azt a
//    böngésző saját stílusa adja. A design system ezt a `_shell.css`
//    `body { font-family: var(--ep-font-sans) }` szabályával oldja meg;
//    ebből korábban csak a `margin: 0` került át, ezért minden ilyen
//    vezérlő a chromium alapértelmezett TALPAS betűjén ("Times New Roman")
//    jelent meg. A javítás helye: `packages/ui/src/topnav-shell/
//    topnav-shell.css`.
//
// 2. A BEZÁRÓ GOMB SZÍNE. A design system `.btn--ghost` variánsának
//    szövegszíne `var(--ep-accent-fg)`, azaz az arany akcentus. A panel
//    bezárására a design system NEM a gomb komponenst használja, hanem a
//    Drawer és a Modal saját, `--ep-fg-muted` színű bezáró vezérlőjét. A
//    javítás helye: `apps/web/src/node-inspector/node-inspector.css`
//    `.node-inspector__close`.
//
// Minden REST hívás `page.route()` mockon megy (rest-mock.ts), az SSE
// csatorna egyetlen `stream_ready` kerettel (sse-mock.ts).
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

const AGENT_STEP_CONFIG: NodeConfig = {
  type: 'agent_step',
  promptTemplate: 'Összegezd a bemenetet.',
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
      id: 'n-agent',
      type: 'agent_step',
      label: 'Agent lépés',
      positionX: 0,
      positionY: 0,
      config: AGENT_STEP_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
  ],
  edges: [],
};

const WORKFLOW: WorkflowDetail = {
  id: 'w-alfa',
  name: 'Alfa workflow',
  description: null,
  providerId: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};

const SETTINGS: SettingsRecord = { defaultProviderId: 'minimax', persistStreamDeltas: false };

/* eslint-enable unicorn/no-null */

/**
 * Egy CSS változó tényleges, kirajzolt színe `rgb(...)` alakban. A mérés
 * egy eldobható próbaelemre teszi ki a változót, és a böngészőtől kéri
 * vissza a számított `color` értéket: így a teszt egyetlen színkonstanst
 * sem tartalmaz, a design system tokenje az egyetlen forrás.
 */
async function tokenColor(page: Page, customProperty: string): Promise<string> {
  return page.evaluate((property: string) => {
    const probe = globalThis.document.createElement('span');
    probe.style.color = `var(${property})`;
    globalThis.document.body.append(probe);
    const value = globalThis.getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, customProperty);
}

/**
 * Ugyanez a próbaelemes minta a betűcsaládra: a `--ep-font-sans` token
 * SZÁMÍTOTT alakja, tehát pontosan az a szöveg, amit a böngésző a
 * `font-family` tulajdonságon is visszaad. A token nyers értéke
 * idézőjeleket tartalmaz (`'Roboto', ...`), a számított érték nem, ezért
 * a nyers érték közvetlen összehasonlítása félrevezető lenne.
 */
async function tokenFontFamily(page: Page): Promise<string> {
  return page.evaluate(() => {
    const probe = globalThis.document.createElement('span');
    probe.style.fontFamily = 'var(--ep-font-sans)';
    globalThis.document.body.append(probe);
    const value = globalThis.getComputedStyle(probe).fontFamily;
    probe.remove();
    return value;
  });
}

/**
 * Egy kiválasztott elem egyetlen számított CSS tulajdonsága.
 */
async function computed(page: Page, selector: string, property: string): Promise<string> {
  return page.evaluate(
    ([elementSelector, cssProperty]: readonly [string, string]) => {
      const element = globalThis.document.querySelector(elementSelector);
      if (element === null) {
        throw new Error(`a teszt nem találta a(z) ${elementSelector} elemet`);
      }
      return globalThis.getComputedStyle(element).getPropertyValue(cssProperty);
    },
    [selector, property] as const,
  );
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
  ]);
  await page.goto('/editor?workflowId=w-alfa');
  // A React Flow saját, dokumentált tesztelési fogódzója az egyetlen
  // alkalmazható locator a csomópontra (lásd `graph-editor.spec.ts`).
  await page.getByTestId('rf__node-n-agent').click();
  await expect(page.locator('.node-inspector')).toBeVisible();
});

test.describe('a design system betűtípusa a natív űrlap vezérlőkön', () => {
  test('a body és mind a négy vezérlő típus a --ep-font-sans tokent viseli, nem a böngésző alapértelmezését', async ({
    page,
  }) => {
    const expected = await tokenFontFamily(page);
    // A mérés akkor mond bármit, ha a token tényleg feloldódott: üres vagy
    // talpas érték mellett a teszt önmagát hitelesítené.
    expect(expected).toContain('Roboto');

    // A `body` a lánc gyökere: enélkül a `font-family: inherit` szabályt
    // viselő komponensek (`.select`, `.input`, `.btn`, `.accordion__trigger`)
    // a böngésző alapértelmezésére esnek vissza.
    expect(await computed(page, 'body', 'font-family')).toBe(expected);
    expect(await computed(page, 'button.select', 'font-family')).toBe(expected);
    expect(await computed(page, 'input.input', 'font-family')).toBe(expected);
    expect(await computed(page, 'textarea.textarea', 'font-family')).toBe(expected);
    expect(await computed(page, 'button[aria-label="Bezárás"]', 'font-family')).toBe(expected);
  });
});

test.describe('a node inspector bezáró gombjának színe', () => {
  test('a bezáró gomb a semleges --ep-fg-muted színt viseli, nem az arany akcentust', async ({ page }) => {
    const accent = await tokenColor(page, '--ep-accent');
    const accentForeground = await tokenColor(page, '--ep-accent-fg');
    const mutedForeground = await tokenColor(page, '--ep-fg-muted');
    // A három token ténylegesen három különböző szín: enélkül az alábbi
    // "nem egyenlő" állítások üresen is teljesülhetnének.
    expect(new Set([accent, accentForeground, mutedForeground]).size).toBe(3);

    const closeColor = await computed(page, 'button[aria-label="Bezárás"]', 'color');
    expect(closeColor).not.toBe(accent);
    expect(closeColor).not.toBe(accentForeground);
    expect(closeColor).toBe(mutedForeground);
  });

  test('a bezáró gomb a design system Drawer bezáró vezérlőjének alakját viseli', async ({ page }) => {
    const selector = 'button[aria-label="Bezárás"]';
    expect(await computed(page, selector, 'width')).toBe('32px');
    expect(await computed(page, selector, 'height')).toBe('32px');
    expect(await computed(page, selector, 'background-color')).toBe('rgba(0, 0, 0, 0)');
    expect(await computed(page, selector, 'border-top-width')).toBe('0px');
    expect(await computed(page, `${selector} svg`, 'width')).toBe('16px');
    expect(await computed(page, `${selector} svg`, 'height')).toBe('16px');
  });
});
