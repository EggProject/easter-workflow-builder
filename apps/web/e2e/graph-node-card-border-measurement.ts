// A csomópont kártya KERETÉNEK ténylegesen kifestett pixeleit mérő közös
// segédfüggvények (SPEC-008 21. kritérium, user döntés 2026-10-21).
//
// A MÓDSZER, ÉS MIÉRT EZ. A számított stílus (`border-style: double`) és a
// `toBeVisible()` nem bizonyít kifestett kettős vonalat: a Chromium a 3 pixelnél
// vékonyabb `double` keretet egyetlen vonallá (`solid`) alakítja
// (`BorderEdge::EffectiveStyle`, `border_edge.cc`), miközben a számított érték
// `double` marad. A bizonyíték ezért a kártya felső keretén átmenő pixel oszlop
// és sor képe, memóriában: a képernyőkép nem íródik lemezre.
//
// A MÉRÉSI SZONDA. A kivágat alatt és körül egyenletes szín kell: a szonda
// eltünteti a React Flow pontmintáját és a kártya árnyékát (az árnyék a kártya
// körül sötétítené a külső pixeleket), a vezérlő paneleket pedig `visibility`
// alá teszi, hogy a méret figyelő ne induljon el (`edge-paint-measurement.ts`).
//
// A BESOROLÁS. Minden pixel a három ismert szín legközelebbi tagjába kerül:
// a külső háttér (az oszlop első pixele), a kártya háttere (az oszlop utolsó
// pixele) és a keret VÁRT színe (a design system tokenje, feloldva, NEM a
// kártya saját számított keretszíne, hogy a mérés ne legyen körkörös). A
// dupla vonal a `vonal, kártya háttér, vonal` sorrend: a két vonal közti rés a
// kártya háttere alatt marad látható, mert a háttér a keret alá is kifest.
import { expect, type Page } from '@playwright/test';

export type PixelClass = 'outside' | 'line' | 'card';

export interface PixelRun {
  readonly kind: PixelClass;
  readonly length: number;
}

export interface BorderProfile {
  /** A kártya felső keretén átmenő pixel oszlop futamai, fentről lefelé. */
  readonly column: readonly PixelRun[];
  /** A legtöbb vonal színű pixelt tartalmazó sor futamai, balról jobbra. */
  readonly row: readonly PixelRun[];
  /** A vonal szín és a kártya háttér legnagyobb csatorna távolsága. */
  readonly lineToCardDistance: number;
  /**
   * A vonalnak besorolt oszlop pixelek közül a várt vonal színhez legközelebbi
   * legnagyobb csatorna távolsága: a besorolás a három szín közül a
   * legközelebbit választja, ezért egy MÁS szín is vonalnak számítana, ez a
   * szám viszont a várt színtől való eltérést közvetlenül méri.
   */
  readonly lineColorDistance: number;
  /** A rés (a két vonal közti kártya háttér) és a vonal színének legnagyobb csatorna távolsága, ha van rés. */
  readonly gapToLineDistance: number | undefined;
}

type Rgb = readonly [number, number, number];

const PROBE_STYLE_ID = 'graph-node-card-border-probe';
const CARD_SELECTOR = '.graph-node-card';

/** A kivágatok: a kártya felső keretéhez képest, képpontban. */
const COLUMN_ABOVE = 8;
const COLUMN_HEIGHT = 30;
const ROW_ABOVE = 2;
const ROW_HEIGHT = 14;
/** A sor kivágat a kártya szélétől befelé indul, hogy a lekerekítés kívül maradjon. */
const ROW_INSET = 48;
const ROW_MAXIMUM_WIDTH = 300;

const PROBE_RULES = `.react-flow__background { display: none !important; } .react-flow__panel { visibility: hidden !important; } ${CARD_SELECTOR} { box-shadow: none !important; }`;

function cardSelector(nodeId: string): string {
  return `[data-testid="rf__node-${nodeId}"] ${CARD_SELECTOR}`;
}

async function readBackgroundDisplay(page: Page): Promise<string> {
  return page.evaluate((selector: string) => {
    const element = globalThis.document.querySelector(selector);
    return element === null ? 'missing' : globalThis.getComputedStyle(element).display;
  }, '.react-flow__background');
}

/**
 * A szonda be- és kikapcsolása. A várakozás állapot alapú: a pontminta
 * számított `display` értékét figyeli, nem időzítőt.
 */
async function writeProbe(page: Page, isOn: boolean): Promise<void> {
  await page.evaluate(
    (input: { readonly styleId: string; readonly rules: string; readonly isOn: boolean }) => {
      const document_ = globalThis.document;
      document_.querySelector(`#${input.styleId}`)?.remove();
      if (input.isOn) {
        const created = document_.createElement('style');
        created.id = input.styleId;
        created.textContent = input.rules;
        document_.head.append(created);
      }
    },
    { styleId: PROBE_STYLE_ID, rules: PROBE_RULES, isOn },
  );
  if (isOn) {
    await expect.poll(async () => readBackgroundDisplay(page)).toBe('none');
  } else {
    await expect.poll(async () => readBackgroundDisplay(page)).not.toBe('none');
  }
}

interface CardGeometry {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

async function readCardGeometry(page: Page, nodeId: string): Promise<CardGeometry> {
  return page.evaluate((selector: string) => {
    const card = globalThis.document.querySelector(selector);
    if (card === null) {
      throw new Error(`a mérés nem találta a kártyát: ${selector}`);
    }
    const rect = card.getBoundingClientRect();
    return { x: rect.left, y: rect.top, width: rect.width };
  }, cardSelector(nodeId));
}

/**
 * A `--ep-*` token feloldott `rgb(...)` értéke a kártya környezetében, a
 * számított `color` alakjában.
 */
async function resolveToken(page: Page, nodeId: string, token: string): Promise<Rgb> {
  const resolved = await page.evaluate(
    (input: { readonly selector: string; readonly token: string }) => {
      const card = globalThis.document.querySelector(input.selector);
      if (card === null) {
        throw new Error(`a mérés nem találta a kártyát: ${input.selector}`);
      }
      const probe = globalThis.document.createElement('span');
      probe.style.color = `var(${input.token})`;
      card.append(probe);
      const color = globalThis.getComputedStyle(probe).color;
      probe.remove();
      return color;
    },
    { selector: cardSelector(nodeId), token },
  );
  const channels = /^rgb\((\d+), (\d+), (\d+)\)$/u.exec(resolved);
  if (channels === null) {
    throw new Error(`a ${token} token nem rgb(...) alakra oldódott fel: ${resolved}`);
  }
  return [Number(channels[1]), Number(channels[2]), Number(channels[3])];
}

interface DecodedPixels {
  readonly width: number;
  readonly height: number;
  /** Sorfolytonosan, [r, g, b, a] négyesekben. */
  readonly data: readonly number[];
}

/**
 * A böngésző saját vászon API-ján dekódol, hogy ne kelljen képfeldolgozó
 * függőséget behozni a repóba.
 */
async function decodePixels(page: Page, png: string): Promise<DecodedPixels> {
  return page.evaluate(async (base64: string) => {
    const image = new globalThis.Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = globalThis.document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (context === null) {
      throw new Error('a 2d rajzoló kontextus nem érhető el');
    }
    context.drawImage(image, 0, 0);
    return {
      width: canvas.width,
      height: canvas.height,
      data: [...context.getImageData(0, 0, canvas.width, canvas.height).data],
    };
  }, png);
}

function channelDistance(left: Rgb, right: Rgb): number {
  return Math.max(Math.abs(left[0] - right[0]), Math.abs(left[1] - right[1]), Math.abs(left[2] - right[2]));
}

function sumDistance(left: Rgb, right: Rgb): number {
  return Math.abs(left[0] - right[0]) + Math.abs(left[1] - right[1]) + Math.abs(left[2] - right[2]);
}

function pixelAt(pixels: DecodedPixels, index: number): Rgb {
  return [pixels.data[index * 4] ?? 0, pixels.data[index * 4 + 1] ?? 0, pixels.data[index * 4 + 2] ?? 0];
}

function classify(pixel: Rgb, palette: Readonly<Record<PixelClass, Rgb>>): PixelClass {
  const kinds: readonly PixelClass[] = ['outside', 'line', 'card'];
  let best: PixelClass = 'outside';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const kind of kinds) {
    const distance = sumDistance(pixel, palette[kind]);
    if (distance < bestDistance) {
      best = kind;
      bestDistance = distance;
    }
  }
  return best;
}

function toRuns(classes: readonly PixelClass[]): readonly PixelRun[] {
  const runs: PixelRun[] = [];
  for (const kind of classes) {
    const last = runs.at(-1);
    if (last?.kind === kind) {
      runs[runs.length - 1] = { kind, length: last.length + 1 };
    } else {
      runs.push({ kind, length: 1 });
    }
  }
  return runs;
}

/** A vonal futamok száma: egy vonalnál 1, kettős vonalnál 2. */
export function countLineRuns(runs: readonly PixelRun[]): number {
  return runs.filter((run) => run.kind === 'line').length;
}

/** Az első vonal futam hossza képpontban, vagy 0, ha nincs vonal. */
export function firstLineRunLength(runs: readonly PixelRun[]): number {
  return runs.find((run) => run.kind === 'line')?.length ?? 0;
}

/** A futamváltások száma egy soron: szaggatott keretnél sok, folytonosnál nulla. */
export function countRunTransitions(runs: readonly PixelRun[]): number {
  return runs.length - 1;
}

/**
 * A kártya felső keretének mérése. `lineToken` a keret VÁRT színének tokenje.
 * A szonda a mérés idejére él, és a végén visszavonódik.
 */
export async function measureCardTopBorder(page: Page, nodeId: string, lineToken: string): Promise<BorderProfile> {
  const line = await resolveToken(page, nodeId, lineToken);
  await writeProbe(page, true);
  const card = await readCardGeometry(page, nodeId);
  const columnClip = {
    x: Math.round(card.x + card.width / 2),
    y: Math.floor(card.y) - COLUMN_ABOVE,
    width: 1,
    height: COLUMN_HEIGHT,
  };
  const rowClip = {
    x: Math.round(card.x + ROW_INSET),
    y: Math.floor(card.y) - ROW_ABOVE,
    width: Math.round(Math.min(card.width - 2 * ROW_INSET, ROW_MAXIMUM_WIDTH)),
    height: ROW_HEIGHT,
  };
  const columnShot = await page.screenshot({ clip: columnClip });
  const rowShot = await page.screenshot({ clip: rowClip });
  await writeProbe(page, false);

  const columnPixels = await decodePixels(page, columnShot.toString('base64'));
  const rowPixels = await decodePixels(page, rowShot.toString('base64'));

  const cardBackground = pixelAt(columnPixels, columnPixels.height - 1);
  const palette = { outside: pixelAt(columnPixels, 0), line, card: cardBackground } satisfies Record<PixelClass, Rgb>;

  const columnClasses = Array.from({ length: columnPixels.height }, (_unused, index) =>
    classify(pixelAt(columnPixels, index), palette),
  );
  const column = toRuns(columnClasses);
  const lineColorDistance = Math.min(
    ...columnClasses.flatMap((kind, index) =>
      kind === 'line' ? [channelDistance(pixelAt(columnPixels, index), line)] : [],
    ),
  );

  // A sor: a legtöbb vonal színű képpontot adó képpont sor (a keret közepe).
  const rows = Array.from({ length: rowPixels.height }, (_unused, rowIndex) =>
    Array.from({ length: rowPixels.width }, (_ignored, columnIndex) =>
      classify(pixelAt(rowPixels, rowIndex * rowPixels.width + columnIndex), palette),
    ),
  );
  const lineCounts = rows.map((classes) => classes.filter((kind) => kind === 'line').length);
  const row = toRuns(rows[lineCounts.indexOf(Math.max(...lineCounts))] ?? []);

  // A rés pixele: az első vonal utáni kártya háttér futam, ha utána újabb vonal jön.
  const firstLineIndex = column.findIndex((run) => run.kind === 'line');
  const gapRun = column[firstLineIndex + 1];
  const hasGap = gapRun?.kind === 'card' && column.slice(firstLineIndex + 2).some((run) => run.kind === 'line');
  let gapToLineDistance: number | undefined;
  if (hasGap) {
    const gapStart = column.slice(0, firstLineIndex + 1).reduce((sum, run) => sum + run.length, 0);
    gapToLineDistance = channelDistance(pixelAt(columnPixels, gapStart + Math.floor(gapRun.length / 2)), line);
  }

  return {
    column,
    row,
    lineToCardDistance: channelDistance(line, cardBackground),
    lineColorDistance,
    gapToLineDistance,
  };
}
