import type { HTMLAttributes, ReactElement } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import './button-group.css';

export interface ButtonGroupProperties extends HTMLAttributes<HTMLDivElement> {
  /**
   * A gombcsoport hozzáférhető neve. Kötelező, mert a `role="group"`
   * önmagában nem hordoz nevet, és a WAI-ARIA szerint a csoportnak
   * megnevezhetőnek kell lennie ahhoz, hogy a benne álló gombok
   * összetartozása felolvasható legyen.
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
 */
export function ButtonGroup(properties: Readonly<ButtonGroupProperties>): ReactElement {
  const { className, children, ...rest } = properties;

  return (
    <div role="group" className={joinClassNames('button-group', className)} {...rest}>
      {children}
    </div>
  );
}
