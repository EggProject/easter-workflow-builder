// A gráf éleinek TÉNYLEGESEN KIFESTETT vonalát mérő közös segédfüggvények
// (2026-09-09).
//
// A MÓDSZER, ÉS MIÉRT EZ. A DOM megléte és a `toBeVisible()` nem bizonyít
// kifestett vonalat: mindkettő zöld marad, ha az él pontosan a háttér
// színével fest (mérve, `docs/research/2026-09-09-graf-el-vonal-meres.md`
// 4. szekció). A bizonyíték ezért két képernyőkép UGYANARRÓL a kivágatról,
// egyszer az éllel, egyszer az ADOTT él útvonalát elrejtve, majd a két kép
// legnagyobb csatorna eltérése.
//
// A MÉRÉSI SZONDA, ÉS MIÉRT KELL. A puszta "él be, él ki" összevetés a valós
// vászonon NEM dönt, mert az él alatt nem egyenletes a háttér: a React Flow
// pontmintája és a csomópont kártyák árnyéka is odaesik, és ezeket a
// háttérszínnel festő (tehát HIBÁS) él is eltakarja. Mérve 2026-09-09-én, a
// `graph-editor.css`-be ideiglenesen beszúrt
// `.react-flow__edge-path { stroke: var(--ep-bg-sunken); }` szabály mellett,
// sötét témában: szonda nélkül a HIBÁS állapot legnagyobb csatorna eltérése
// felment 25-ig, miközben az ÉP állapot legkisebb értéke 16 volt, tehát a
// két állapot ÁTFEDETT és a mérés nem döntött semmit.
//
// A szonda ezért mindkét képernyőképen ELTÜNTETI a nem egyenletes hátteret:
// a pontmintát `display: none`, a csomópont kártyákat és a vezérlő paneleket
// `visibility: hidden` alá teszi (nem `display: none`, hogy a React Flow
// méret figyelője ne induljon el és az élek ne mozduljanak el). Így az él
// alatt egyetlen, egyenletes szín marad, a vászon `--ep-bg-sunken` háttere.
// Ugyanaz a mérés a szondával, a bemutató fixtúra kilenc élén, mindkét
// témában és mindkét nézetben (36 mérés): a HIBÁS állapot legnagyobb értéke
// 3, az ÉP állapoté 15 és 136 között van. A két tartomány így nem érintkezik.
import { expect, type Page } from '@playwright/test';

/**
 * A küszöb, ami felett a vonal ténylegesen ki van festve. A szám MÉRÉSBŐL
 * jön, nem becslésből: a fenti szondás mérés szerint a hibás állapot
 * legnagyobb értéke 3, az ép állapot legkisebb értéke 15 (sötét téma,
 * nyitott beállítás panel melletti 0.58-as illesztési nagyítás, a
 * legkedvezőtlenebb, vízszintes él). A 8 a két mért tartomány közé esik:
 * több mint két és félszerese a hibás állapot maximumának, és nagyjából
 * fele az ép állapot minimumának, tehát mindkét irányban van tartaléka.
 * A teljes táblázat: `docs/research/2026-09-09-graf-el-vonal-meres.md`
 * 7. szekció.
 */
export const EDGE_PAINT_MINIMUM_CHANNEL_DIFFERENCE = 8;

/**
 * A mérés idejére beszúrt stíluslap azonosítója. Egyetlen elem, aminek a
 * tartalmát a mérés írja át, hogy az elrejtés visszavonható legyen.
 */
const PROBE_STYLE_ID = 'edge-paint-probe';

/**
 * A kivágat köré hagyott ráhagyás pixelben. A befoglaló doboz a görbe
 * matematikai burkolója, a kifestett vonalnak viszont van vonalvastagsága és
 * élsimítása, ami azon egy-két pixellel túlnyúlhat.
 */
const CLIP_MARGIN = 8;

const BACKGROUND_SELECTOR = '.react-flow__background';

/**
 * A szonda alapszabályai: a nem egyenletes hátteret adó rétegek eltűnnek
 * MINDKÉT képernyőképről. A csomópont és a panel `visibility: hidden` alá
 * kerül, nem `display: none` alá, mert az utóbbi a React Flow méret
 * figyelőjén át új `dimensions` változást váltana ki, ami az élek
 * geometriáját is elmozdíthatná a két felvétel között.
 */
const PROBE_BASE_RULES = `${BACKGROUND_SELECTOR} { display: none !important; } .react-flow__node, .react-flow__panel { visibility: hidden !important; }`;

function edgeSelector(edgeId: string): string {
  return `[data-testid="rf__edge-${edgeId}"]`;
}

function edgePathSelector(edgeId: string): string {
  return `${edgeSelector(edgeId)} .react-flow__edge-path`;
}

/**
 * A szonda stíluslapjának írása: egyetlen, a mérés idejére beszúrt elem,
 * aminek a tartalmát minden lépés felülírja, hogy a szonda visszavonható
 * legyen.
 */
async function writeProbeStyle(page: Page, rule: string): Promise<void> {
  await page.evaluate(
    (input: { readonly styleId: string; readonly rule: string }) => {
      const document_ = globalThis.document;
      const existing = document_.querySelector(`#${input.styleId}`);
      if (existing === null) {
        const created = document_.createElement('style');
        created.id = input.styleId;
        created.textContent = input.rule;
        document_.head.append(created);
        return;
      }
      existing.textContent = input.rule;
    },
    { styleId: PROBE_STYLE_ID, rule },
  );
}

async function readDisplay(page: Page, selector: string): Promise<string> {
  return page.evaluate((input: string) => {
    const element = globalThis.document.querySelector(input);
    return element === null ? 'missing' : globalThis.getComputedStyle(element).display;
  }, selector);
}

/**
 * A mérési szonda beállítása: az alapszabályok mindig érvényesek, az
 * `hiddenEdgeId` élé pedig akkor rejtőzik el, ha meg van adva. A várakozás
 * állapot alapú: a számított `display` értéket figyeli, nem időzítőt
 * (`.claude/CLAUDE.md` 11. szekció).
 */
async function applyProbe(page: Page, hiddenEdgeId: string | undefined): Promise<void> {
  const edgeRule = hiddenEdgeId === undefined ? '' : `${edgePathSelector(hiddenEdgeId)} { display: none !important; }`;

  await writeProbeStyle(page, `${PROBE_BASE_RULES} ${edgeRule}`);

  await expect.poll(async () => readDisplay(page, BACKGROUND_SELECTOR)).toBe('none');
  if (hiddenEdgeId === undefined) {
    return;
  }
  await expect.poll(async () => readDisplay(page, edgePathSelector(hiddenEdgeId))).toBe('none');
}

/**
 * A mérési szonda törlése: a pontminta, a kártyák, a panelek és minden él
 * visszakerül a képre.
 */
async function clearProbe(page: Page): Promise<void> {
  await page.evaluate((styleId: string) => {
    globalThis.document.querySelector(`#${styleId}`)?.remove();
  }, PROBE_STYLE_ID);
  await expect.poll(async () => readDisplay(page, BACKGROUND_SELECTOR)).not.toBe('none');
}

/**
 * Az él befoglaló doboza, ráhagyással, a látható területre vágva. Vízszintes
 * élnél a doboz 0 magas, ezért a ráhagyás nélkül nem lenne mit lefényképezni.
 */
async function edgeClip(page: Page, edgeId: string): Promise<{ x: number; y: number; width: number; height: number }> {
  return page.evaluate(
    (input: { readonly selector: string; readonly margin: number }) => {
      const path = globalThis.document.querySelector(input.selector);
      if (path === null) {
        throw new Error(`a mérés nem találta az él útvonalát: ${input.selector}`);
      }
      const rect = path.getBoundingClientRect();
      const left = Math.max(0, Math.floor(rect.left) - input.margin);
      const top = Math.max(0, Math.floor(rect.top) - input.margin);
      const right = Math.min(globalThis.innerWidth, Math.ceil(rect.right) + input.margin);
      const bottom = Math.min(globalThis.innerHeight, Math.ceil(rect.bottom) + input.margin);
      return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
    },
    { selector: edgePathSelector(edgeId), margin: CLIP_MARGIN },
  );
}

/**
 * Két azonos méretű PNG legnagyobb csatorna eltérése. A böngésző saját
 * vászon (`canvas`) API-ján fut, hogy ne kelljen képfeldolgozó függőséget
 * behozni a repóba.
 */
export async function maximumChannelDifference(page: Page, painted: string, blank: string): Promise<number> {
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
        // A két kép mérete azonos, tehát az index mindig érvényes; a
        // `?? value` kizárólag a `noUncheckedIndexedAccess` miatt áll itt.
        maximum = Math.max(maximum, Math.abs(value - (blankPixels[index] ?? value)));
      }
      return maximum;
    },
    { painted, blank },
  );
}

/**
 * EGYETLEN él kifestett vonalának mérése: a kivágat az adott él befoglaló
 * doboza, és kizárólag AZ AZ EGY él tűnik el a második képről. Így a
 * visszaadott szám élenként külön mondja meg, hogy az a vonal látszik-e -
 * ebből számolható, hogy hány vonal van ténylegesen kifestve a képen.
 */
export async function measureEdgePaintDifference(page: Page, edgeId: string): Promise<number> {
  const clip = await edgeClip(page, edgeId);
  await applyProbe(page, undefined);
  const paintedShot = await page.screenshot({ clip });
  await applyProbe(page, edgeId);
  const blankShot = await page.screenshot({ clip });
  await clearProbe(page);
  return maximumChannelDifference(page, paintedShot.toString('base64'), blankShot.toString('base64'));
}

/**
 * Az él VÁRT festése, amihez a tényleges festést hasonlítjuk: a vonal színe és
 * vastagsága, CSS értékként.
 */
export interface EdgeReferencePaint {
  readonly stroke: string;
  readonly strokeWidth: string;
}

/**
 * A referencia szabály beállítását jelző egyedi CSS változó. A várakozás ezt
 * figyeli, mert az ép állapotban a referencia minden festési értéke
 * egyezik a ténylegessel, tehát azokból nem derülne ki, hogy a szabály
 * illeszkedett-e.
 */
const REFERENCE_MARKER_PROPERTY = '--edge-paint-reference';

/**
 * A referencia festés szabályai EGYETLEN élre (2026-09-23). Az útvonal
 * `all: initial` alá kerül, tehát SEMMILYEN szerzői szabály (osztály, `--xy-*`
 * változó, átlátszóság, szűrő, szaggatás) nem hat rá; a geometriát a
 * saját `d` attribútumából kapja vissza (`d` a Chromiumban CSS tulajdonság,
 * amit az `all` szintén alaphelyzetbe tenne), a festést pedig kizárólag a
 * `reference` adja. Az ősök (a közös `.react-flow__edges` réteg, az él saját
 * `<svg>` burkolója és `<g>` csoportja) nem kaphatnak `all: initial`-t, mert
 * az a pozíciójukat is elvenné; rajtuk az átlátszóság lánca áll alaphelyzetben.
 */
function edgeReferenceRules(edgeId: string, pathData: string, reference: EdgeReferencePaint): string {
  const edge = edgeSelector(edgeId);
  return [
    `.react-flow__edges, .react-flow__edges > svg:has(> ${edge}), ${edge} { opacity: 1 !important; filter: none !important; mix-blend-mode: normal !important; }`,
    `${edgePathSelector(edgeId)} { all: initial !important; d: path("${pathData}") !important; fill: none !important; stroke: ${reference.stroke} !important; stroke-width: ${reference.strokeWidth} !important; ${REFERENCE_MARKER_PROPERTY}: on; }`,
  ].join(' ');
}

async function readEdgePathData(page: Page, edgeId: string): Promise<string> {
  return page.evaluate((selector: string) => {
    const path = globalThis.document.querySelector(selector);
    const pathData = path?.getAttribute('d');
    if (pathData === null || pathData === undefined) {
      throw new Error(`a mérés nem találta az él útvonalának d attribútumát: ${selector}`);
    }
    return pathData;
  }, edgePathSelector(edgeId));
}

async function readReferenceMarker(page: Page, edgeId: string): Promise<string> {
  return page.evaluate(
    (input: { readonly selector: string; readonly property: string }) => {
      const element = globalThis.document.querySelector(input.selector);
      return element === null
        ? 'missing'
        : globalThis.getComputedStyle(element).getPropertyValue(input.property).trim();
    },
    { selector: edgePathSelector(edgeId), property: REFERENCE_MARKER_PROPERTY },
  );
}

/**
 * EGYETLEN él TÉNYLEGES festésének összevetése a VÁRT festéssel (2026-09-23):
 * a kivágat az él befoglaló doboza, az első kép a valós él, a második
 * UGYANAZ a geometria a `reference` festéssel. A visszaadott szám a két kép
 * legnagyobb csatorna eltérése. Az alsó korlátos `measureEdgePaintDifference`
 * csak azt mondja meg, hogy a vonal LÁTSZIK-e; ez azt, hogy a várt festéstől
 * mennyire tér el, tehát az erősebb és a gyengébb festést is elkapja. Ép
 * állapotban sem mindig 0: a Chromium raszterezése ugyanazt a vonalat a
 * végpontok körül 1..2 szinttel eltérően adhatja vissza, attól függően, hogy
 * a kivágat melyik része raszterizálódott újra a szonda váltásakor (mérve,
 * `docs/research/2026-09-23-react-flow-sotet-tema.md` 7. szekció).
 */
export async function measureEdgeReferenceDifference(
  page: Page,
  edgeId: string,
  reference: EdgeReferencePaint,
): Promise<number> {
  const clip = await edgeClip(page, edgeId);
  await applyProbe(page, undefined);
  const paintedShot = await page.screenshot({ clip });
  const pathData = await readEdgePathData(page, edgeId);
  await writeProbeStyle(page, `${PROBE_BASE_RULES} ${edgeReferenceRules(edgeId, pathData, reference)}`);
  await expect.poll(async () => readReferenceMarker(page, edgeId)).toBe('on');
  const referenceShot = await page.screenshot({ clip });
  await clearProbe(page);
  return maximumChannelDifference(page, paintedShot.toString('base64'), referenceShot.toString('base64'));
}
