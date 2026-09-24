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
 * két belső margója plusz EGY szövegsor. A `run-event-row.css` a fejléc
 * magasságát pontosan erre állítja (`height: calc(1lh + 2 * 16px)`), tehát a
 * magasság a szöveg hosszától, a panel szélességétől és a meta szlot
 * tartalmától is független: a "Nem tárolt" `Badge` (22 pixel) a 21 pixeles
 * szövegsor fölé és alá fél-fél pixelt nyúlik a belső margóba, a sort nem
 * növeli. Az `.accordion__item` alsó szegélye nem adódik hozzá: a sor
 * egyetlen `.accordion__item` eleme a saját burkolójának utolsó gyereke,
 * amire a forrás `:last-child` szabálya nulla szegélyt ad.
 *
 * Nem kitalált szám: a tényezők a design system forrás CSS-éből jönnek, és
 * valódi Chromiumban mérve a tárolt és az átmeneti sor is 53 pixel
 * (`docs/research/2026-09-23-transcript-panel-meresek.md` 16. szekció). Két
 * regressziós teszt őrzi: a `collapsed-transcript-row-height.spec.ts` a
 * forrás CSS szabályaiból számolja újra, az e2e a valódi böngészőben
 * kirajzolt tárolt és átmeneti sor magasságát méri.
 *
 * A `useDynamicRowHeight` `defaultRowHeight` értéke: ennyinek becsüli a
 * lista a még nem kirajzolt sorokat. Mivel minden összecsukott sor
 * pontosan ennyi, a `scrollToRow` a becsült pozícióra is pontosan érkezik; a
 * `react-window@2.3.1` a görgetés után nem igazít a mért magassághoz, tehát
 * egy eltérő sormagasság az utolsó sor alját a lista alja alá tolná
 * (research 13. szekció).
 */
export const COLLAPSED_TRANSCRIPT_ROW_HEIGHT =
  2 * HEADER_VERTICAL_PADDING_PX + HEADER_FONT_SIZE_PX * HEADER_LINE_HEIGHT;
