/**
 * A futás nézet három reszponzív sávja (SPEC-008 10., AC33, AC34).
 *
 * MIÉRT JS ÉS NEM CSAK CSS. A `--ep-screen-md` alatti sáv `Tabs` komponenst
 * kér, a fölötte lévő kettő `Resizable` komponenst: a kettő DOM szerkezete és
 * ARIA szemantikája teljesen más, tehát media queryvel nem cserélhető. A két
 * osztott sáv között pedig a `Resizable` `direction` propja dönt, ami az
 * elválasztó `aria-orientation` értékét is állítja - egy CSS
 * `flex-direction` váltás az elválasztóról HAMIS állítást hagyna a
 * hozzáférhetőségi fában.
 *
 * A TÖRÉSPONT LITERÁL NEM KITALÁLT SZÁM. A két érték a design system
 * `packages/ui/src/design-token/breakpoints.css` fájljának `--ep-screen-lg`
 * és `--ep-screen-md` tokenje; a `run-view-layout-band.spec.ts` regressziós
 * tesztje magából a token fájlból olvassa vissza és hasonlítja össze, tehát
 * egy elsodródott érték elbuktatja a `test` kaput. A CSS oldali ugyanilyen
 * kényszert a `packages/ui` `media-query-breakpoint-invariant` témája őrzi,
 * de az kizárólag CSS fájlokat vizsgál, ezért kell ez a párja a JS oldalra.
 */
export type RunViewLayoutBand = 'horizontal' | 'vertical' | 'tabs';

/**
 * A `--ep-screen-lg` (kis laptop) token és fölötte: a gráf és a transcript
 * EGYMÁS MELLETT, függőleges húzható elválasztóval.
 */
export const RUN_VIEW_HORIZONTAL_MEDIA_QUERY = '(min-width: 1024px)';

/**
 * A `--ep-screen-md` (tablet) token és fölötte: a gráf és a transcript
 * EGYMÁS ALATT, vízszintes húzható elválasztóval. A `--ep-screen-lg`
 * felett a fenti, szűkebb query nyer.
 */
export const RUN_VIEW_VERTICAL_MEDIA_QUERY = '(min-width: 768px)';

/**
 * A két media query illeszkedéséből a kiválasztott sáv. Tiszta függvény,
 * hogy a sáv választás a `matchMedia` bekötésétől függetlenül tesztelhető
 * legyen (`use-run-view-layout-band.ts` a bekötés).
 */
export function resolveRunViewLayoutBand(
  isAtLeastLargeScreen: boolean,
  isAtLeastMediumScreen: boolean,
): RunViewLayoutBand {
  if (isAtLeastLargeScreen) {
    return 'horizontal';
  }
  if (isAtLeastMediumScreen) {
    return 'vertical';
  }
  return 'tabs';
}
