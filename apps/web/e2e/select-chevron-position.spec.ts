// Regressziós e2e a `SelectField` lenyíló chevronjának HELYÉRE (2026-09-09,
// felhasználói hibajelzés: "nem latod hogy a select lenyito chevron nem jo
// helyen van?").
//
// A MÉRT HIBA, ami ezt a fájlt indokolja. A mező korábban a design system
// `select.css` natív `<select>` retrofit ágát építette meg, ami a böngésző
// platform indikátorát rajzolja: a chevron középpontja a mező jobb szélétől
// 9 px-re állt, a design system saját `Select` triggerének 22 px-e helyett
// (`docs/research/2026-09-09-select-chevron-meres.md` 3. szekció). Minden
// addigi teszt zöld maradt, mert egyik sem a chevron HELYÉT állította, csak
// osztályneveket és számított `font-family` értékeket.
//
// Ezért a fájl KÉTFÉLE bizonyítékot kér, a `.claude/CLAUDE.md` 11. szekció
// "vizuális állítást csak kifestett pixel bizonyít" szabálya szerint:
//   1. geometriai mérés a chevron DOM dobozán, és
//   2. KIFESTETT PIXEL mérés a triggerről készült képernyőképen, ami akkor
//      is elbukik, ha a chevron a háttér színével festene (a DOM meglét és a
//      `toBeVisible()` ilyenkor is zöld maradna).
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

/**
 * A design system `Select` triggerének MÉRT chevron pozíciója: a chevron
 * középpontja ennyi CSS pixerre áll a mező jobb szélétől. A szám a forrás
 * `.select { padding: 10px 14px }` belső térközéből és a `.select__caret`
 * 14 px-es szélességéből következik, és a referencia oldal ellen ténylegesen
 * meg van mérve (research fájl 3. szekció, "referencia" sor).
 */
const REFERENCE_CARET_CENTRE_FROM_RIGHT_PX = 22;

/**
 * A pixel mérés nagyítása. A geometriai és a pixel mérés között
 * antialiasing miatt maradhat fél pixeles eltérés, ezért a képernyőkép
 * négyszeres nagyításban készül.
 */
const DEVICE_SCALE_FACTOR = 4;

test.use({ deviceScaleFactor: DEVICE_SCALE_FACTOR });

interface CaretPixelMeasurement {
  readonly pixelCount: number;
  readonly centreFromRightPx: number;
}

test('a lenyíló chevron a design system referenciájával azonos helyen, kifestett pixelekkel áll', async ({ page }) => {
  // A modális belépő animációja `scale(0.98)` -> `scale(1)` (`modal.css`
  // `modal-in`), és a méréseink a nagyítás miatt animáció közben akár 1.3
  // pixellel is elcsúsznának. A `modal.css` a csökkentett mozgás
  // beállításra `animation: none` értéket ad, tehát a panel azonnal a
  // végállapotában jelenik meg: ez teszi a mérést determinisztikussá, kézi
  // időzítés nélkül.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('listProviders', async (route) =>
      route.fulfill(
        jsonBody([{ id: 'claude-subscription', displayName: 'Claude Code', models: [], requiredEnvNames: [] }]),
      ),
    ),
  ]);

  await page.goto('/');
  await page.getByRole('button', { name: 'Új workflow' }).click();

  const dialog = page.getByRole('dialog', { name: 'Új workflow' });
  const combobox = dialog.getByRole('combobox', { name: 'Provider' });
  await expect(combobox).toBeVisible();

  // A chevron egy `<svg>`, aminek nincs sem szerepe, sem hozzáférhető neve,
  // tehát a `getByRole` család egyik locatora sem alkalmazható rá: ez az az
  // eset, amit a Playwright Quick Guide a CSS szelektorra hagy.
  const caret = combobox.locator('svg.select__caret');
  await expect(caret).toBeVisible();

  const triggerBox = await combobox.boundingBox();
  const caretBox = await caret.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(caretBox).not.toBeNull();
  if (triggerBox === null || caretBox === null) {
    return;
  }

  const geometricCentreFromRight = triggerBox.x + triggerBox.width - (caretBox.x + caretBox.width / 2);
  expect(geometricCentreFromRight).toBe(REFERENCE_CARET_CENTRE_FROM_RIGHT_PX);

  // KIFESTETT PIXEL. A trigger jobb harmadán megkeressük azokat a
  // képpontokat, amik eltérnek a mező hátterétől, és a súlypontjuk
  // vízszintes helyét mérjük. Ha a chevron eltűnne vagy a háttér színével
  // festene, a talált képpontok száma nullára esne.
  const screenshot = await combobox.screenshot();
  const measurement = await page.evaluate<CaretPixelMeasurement, { dataUrl: string; scale: number }>(
    async ({ dataUrl, scale }) => {
      // A böngészőben futó callback a globálisokat `globalThis`-en át éri el
      // (`unicorn/prefer-global-this`, `apps/web` CLAUDE.md).
      const image = new globalThis.Image();
      await new Promise((resolve) => {
        image.addEventListener('load', resolve);
        image.src = dataUrl;
      });
      const canvas = globalThis.document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (context === null) {
        throw new TypeError('nincs 2d rajzoló kontextus');
      }
      context.drawImage(image, 0, 0);
      const { data, width, height } = context.getImageData(0, 0, image.width, image.height);
      const channelAt = (x: number, y: number, channel: number): number => data[(y * width + x) * 4 + channel] ?? 0;
      const inset = 8 * scale;
      const rightInset = 4 * scale;
      const background = [
        channelAt(width - rightInset - 1, inset, 0),
        channelAt(width - rightInset - 1, inset, 1),
        channelAt(width - rightInset - 1, inset, 2),
      ];
      let weightedSum = 0;
      let pixelCount = 0;
      for (let y = inset; y < height - inset; y += 1) {
        for (let x = Math.floor(width * 0.7); x < width - rightInset; x += 1) {
          const distance =
            Math.abs(channelAt(x, y, 0) - (background[0] ?? 0)) +
            Math.abs(channelAt(x, y, 1) - (background[1] ?? 0)) +
            Math.abs(channelAt(x, y, 2) - (background[2] ?? 0));
          if (distance > 90) {
            weightedSum += x + 0.5;
            pixelCount += 1;
          }
        }
      }
      return {
        pixelCount,
        centreFromRightPx: pixelCount === 0 ? NaN : (width - weightedSum / pixelCount) / scale,
      };
    },
    { dataUrl: `data:image/png;base64,${screenshot.toString('base64')}`, scale: DEVICE_SCALE_FACTOR },
  );

  // Mérve: az ép chevron 282 képpontot fest ki négyszeres nagyításban,
  // ugyanannyit, amennyit a design system referencia triggere; a háttér
  // színével festő chevron 0-t. A küszöb ezért a mért nulla fölött áll, nem
  // becsült érték (research fájl 5. szekció).
  expect(measurement.pixelCount).toBeGreaterThan(0);
  expect(measurement.centreFromRightPx).toBe(REFERENCE_CARET_CENTRE_FROM_RIGHT_PX);
});
