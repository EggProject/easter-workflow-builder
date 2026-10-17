import type { HTMLAttributes, ReactElement } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import './button-group.css';

export interface ButtonGroupProperties extends HTMLAttributes<HTMLDivElement> {
  /**
   * A gombcsoport hozzáférhető neve. A név kötelező prop (projekt döntés): a
   * `group` megnevezhető, de a WAI-ARIA nem teszi kötelezővé (APG:
   * Discretionary,
   * <https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/>).
   */
  readonly 'aria-label': string;
}

/**
 * A design system `.button-group` összeragasztott gombcsoportja (split
 * button). A forrás `button-group.html` "Mixed (split button)" mintája
 * szerint a csoport gyerekei sima `.btn` elemek **bármelyik variánsban**
 * (a forrás CSS fejléc komment szó szerinti szabálya: "> .btn (any
 * variant)"), a CSS pedig a szomszédos szegélyeket olvasztja össze és
 * csak a külső sarkokat kerekíti.
 *
 * A forrás függőleges variánsa (`.button-group--vertical`) és a
 * szegmentált vezérlőként használt `is-active` állapota **nincs**
 * propként kivezetve, mert a felület egyiket sem használja (ugyanaz a
 * szűkítési minta, mint a `Badge` `Chip` vagy a `Tabs` `Segmented`
 * esetében). A CSS bájtra azonosan átemelt, tehát ha egy jövőbeli
 * képernyőnek kell, csak a prop hiányzik hozzá, a stílus nem.
 *
 * A valódi split button (forrás "Mixed" mintája) egy `Menu` triggert is
 * hordozhat gyerekként - a `Menu` a saját trigger gombját `.menu-anchor`
 * spannel csomagolja, amihez a `button-group.css` végén álló, dokumentált
 * kiegészítés adja ugyanazt a fúziós/lekerekítési receptet, mint a sima
 * `.btn` testvérnek.
 */
export function ButtonGroup(properties: Readonly<ButtonGroupProperties>): ReactElement {
  const { className, children, ...rest } = properties;

  return (
    <div role="group" className={joinClassNames('button-group', className)} {...rest}>
      {children}
    </div>
  );
}
