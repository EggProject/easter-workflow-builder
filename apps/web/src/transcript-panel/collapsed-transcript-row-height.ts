/**
 * Az `.accordion__header` függőleges belső margója, egy oldalon, pixelben
 * (`packages/ui/src/accordion/accordion.css`: `padding: 16px 4px`).
 */
const HEADER_VERTICAL_PADDING_PX = 16;

/**
 * Az `.accordion__header` betűmérete és sormagasság szorzója
 * (`packages/ui/src/accordion/accordion.css`: `font: 600 16px/1.4 ...`).
 */
const HEADER_FONT_SIZE_PX = 16;
const HEADER_LINE_HEIGHT = 1.4;

/**
 * Egy összecsukott transcript sor magassága pixelben (T-009-25): a fejléc
 * két belső margója plusz EGY szövegsor. Egy sor, mert a cím és a meta
 * ellipszissel csonkolt (`run-event-row.css`), tehát a magasság a szöveg
 * hosszától és a panel szélességétől független. Az `.accordion__item`
 * alsó szegélye nem adódik hozzá: a sor egyetlen `.accordion__item` eleme a
 * saját burkolójának utolsó gyereke, amire a forrás `:last-child` szabálya
 * nulla szegélyt ad.
 *
 * Nem kitalált szám: mindhárom tényező a design system forrás CSS-éből jön,
 * és két regressziós teszt őrzi. A `collapsed-transcript-row-height.spec.ts`
 * a forrás CSS szabályát olvassa vissza, az e2e pedig a valódi böngészőben
 * kirajzolt sor magasságát méri.
 *
 * A `useDynamicRowHeight` `defaultRowHeight` értéke: ennyinek becsüli a
 * lista a még nem kirajzolt sorokat. Pontos becslés mellett az aljára
 * görgetés a becsült pozícióra is pontosan érkezik.
 */
export const COLLAPSED_TRANSCRIPT_ROW_HEIGHT =
  2 * HEADER_VERTICAL_PADDING_PX + HEADER_FONT_SIZE_PX * HEADER_LINE_HEIGHT;
