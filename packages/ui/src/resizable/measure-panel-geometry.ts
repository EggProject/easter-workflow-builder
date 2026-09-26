import { readPixels } from './read-pixels.ts';

/**
 * Egy `Resizable` csoport paneljeinek mért geometriája a csoport tengelyén.
 */
export interface PanelGeometry {
  /**
   * A panelek együttes mérete pixelben, az elválasztók nélkül. A panelek
   * százalékos mérete ennek a százaléka: a `ResizablePanel` `flex-shrink:
   * 1` értéke miatt az elválasztók helyét a panelek a méretük arányában
   * adják le (CSS Flexbox 9.7, "scaled flex shrink factor"), tehát a mért
   * arány pontosan a százalék, amíg egyik panel sem ütközik a minimumába.
   */
  readonly availableSizePixels: number;
  /**
   * Panelenként a CSS minimum (`min-width` vízszintes, `min-height`
   * függőleges csoportban; a forrás `.resizable-panel` szabálya 80 és 60
   * pixel) az `availableSizePixels` százalékában. Nem pixeles minimum
   * (`auto`, vagy a happy-dom üres kiszámított értéke) nullának számít.
   */
  readonly minSizePercents: readonly number[];
  /**
   * Panelenként a kirajzolt méret a csoport tengelyén, pixelben (a
   * felfedés számításához, `plan-reveal.ts`).
   */
  readonly panelSizePixels: readonly number[];
}

/**
 * A panelek geometriájának mérése, a panelek sorszáma szerinti sorrendben.
 * `undefined`, ha egy panel nincs kirajzolva (például a futás nézet
 * transcript oldalán látott jóváhagyás nélkül csak a transcript panel áll),
 * vagy ha a panelek együttes mérete nulla (rejtett fül panel, vagy a
 * happy-dom nulla téglalapja): ilyenkor nincs mihez mérni a minimumot, és a
 * `Resizable` a forrás százalékos `[5, 95]` határánál marad.
 *
 * Miért kell: a forrás CSS pixeles minimumot ad a paneleknek
 * (`.resizable-panel { min-width: 80px; min-height: 60px }`), a forrás
 * `resizeAt` viszont csak a százalékos `[5, 95]` tartományt ismeri, tehát
 * egy kis csoportban a `Home` és az `End` olyan értéket jelentett, amit a
 * CSS minimum felülírt (1440x600-on az 5, a 10 és a 15 ugyanazt a 60 pixeles
 * panelt adta, mérve: `docs/research/2026-09-24-jovahagyas-panel-helye.md`
 * 10. szekció).
 */
export function measurePanelGeometry(
  panels: readonly (Element | undefined)[],
  isVertical: boolean,
): PanelGeometry | undefined {
  const sizes: number[] = [];
  const minimums: number[] = [];
  for (const panel of panels) {
    if (panel === undefined) {
      return undefined;
    }
    const rect = panel.getBoundingClientRect();
    const style = globalThis.getComputedStyle(panel);
    sizes.push(isVertical ? rect.height : rect.width);
    minimums.push(readPixels(isVertical ? style.minHeight : style.minWidth));
  }
  const availableSizePixels = sizes.reduce((sum, size) => sum + size, 0);
  if (availableSizePixels <= 0) {
    return undefined;
  }
  return {
    availableSizePixels,
    minSizePercents: minimums.map((minimum) => (minimum / availableSizePixels) * 100),
    panelSizePixels: sizes,
  };
}
