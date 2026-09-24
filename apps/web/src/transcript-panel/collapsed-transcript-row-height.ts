/**
 * Az `.accordion__header` függőleges belső margója, egy oldalon, pixelben
 * (`packages/ui/src/accordion/accordion.css`: `padding: 16px 4px`).
 */
const HEADER_VERTICAL_PADDING_PX = 16;

/**
 * A sor fejlécének betűmérete és sormagasság szorzója: a `run-event-row.css`
 * a fejlécre a design system `--ep-text-small` tokenjét teszi
 * (`packages/ui/src/design-token/typography.css`: `400 14px/1.5`, user döntés
 * 2026-09-24). A cím meta darabjai a `--ep-text-code` tokennel állnak, ami
 * ugyanezt a méretet és sormagasságot adja.
 */
const HEADER_FONT_SIZE_PX = 14;
const HEADER_LINE_HEIGHT = 1.5;

/**
 * Egy összecsukott transcript sor magassága pixelben (T-009-25): a fejléc
 * két belső margója plusz EGY szövegsor. Egy sor, mert a cím és a meta
 * ellipszissel csonkolt (`run-event-row.css`), tehát a magasság a szöveg
 * hosszától és a panel szélességétől független. Az `.accordion__item`
 * alsó szegélye nem adódik hozzá: a sor egyetlen `.accordion__item` eleme a
 * saját burkolójának utolsó gyereke, amire a forrás `:last-child` szabálya
 * nulla szegélyt ad.
 *
 * Nem kitalált szám: a tényezők a design system forrás CSS-éből jönnek, és a
 * kétféle betűcsaládú cím sordoboza valódi Chromiumban mérve pontosan a
 * token sormagassága, 21 pixel; a sor 53 pixel
 * (`docs/research/2026-09-23-transcript-panel-meresek.md` 11. szekció). Két
 * regressziós teszt őrzi: a `collapsed-transcript-row-height.spec.ts` a
 * forrás CSS szabályaiból számolja újra, az e2e a valódi böngészőben
 * kirajzolt sor magasságát méri. Kivétel az átmeneti sor: a "Nem tárolt"
 * `Badge` 22 pixel magas, tehát az a sor 54 pixel (ugyanott mérve).
 *
 * A `useDynamicRowHeight` `defaultRowHeight` értéke: ennyinek becsüli a
 * lista a még nem kirajzolt sorokat. Pontos becslés mellett az aljára
 * görgetés a becsült pozícióra is pontosan érkezik.
 */
export const COLLAPSED_TRANSCRIPT_ROW_HEIGHT =
  2 * HEADER_VERTICAL_PADDING_PX + HEADER_FONT_SIZE_PX * HEADER_LINE_HEIGHT;
