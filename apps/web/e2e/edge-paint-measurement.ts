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

function edgePathSelector(edgeId: string): string {
  return `[data-testid="rf__edge-${edgeId}"] .react-flow__edge-path`;
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
    { styleId: PROBE_STYLE_ID, rule: `${PROBE_BASE_RULES} ${edgeRule}` },
  );

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
