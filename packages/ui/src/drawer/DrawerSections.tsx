import type { ReactElement, ReactNode } from 'react';
import './drawer.css';

export interface DrawerSectionsProperties {
  /**
   * A görgethető törzs tartalma (`.drawer__body`).
   */
  readonly children?: ReactNode;
  /**
   * A tapadó akciósáv tartalma (`.drawer__footer`); hiányában a sáv nem
   * rajzolódik ki.
   */
  readonly footer?: ReactNode;
}

/**
 * A design system `drawer` komponensének törzs és lábléc szakasza
 * (`eggproject-design-components/components/drawer/Drawer.jsx`), a forrás
 * JSX-ének szerkezetével és osztályaival: `<div className="drawer__body">` a
 * gyerekekkel, és ha van `footer`, `<div className="drawer__footer">` (a
 * forrás igazságérték vizsgálata helyett `undefined` vizsgálattal, hogy egy
 * `0` érték ne rajzolódjon ki szövegként). A két osztály a forrás CSS-e
 * szerint önálló szerkezet: a `.drawer__body` a görgető terület (`flex: 1`,
 * `overflow-y: auto`), a `.drawer__footer` a tapadó akciósáv (felső
 * elválasztó, jobbra igazított gombok).
 *
 * **Miért nem a `Drawer` egésze.** A forrás `Drawer` modális: `role="dialog"`
 * és `aria-modal="true"`, háttér réteg, fókusz csapda, a lap többi részét
 * `inert` és `aria-hidden` jelöléssel elszigeteli, a `body` görgetését
 * lezárja, és a CSS a panelt `position: fixed` alapon a képernyő széléhez
 * rögzíti. Egy a lap többi részével együtt használt, nem modális panelben ez
 * mind hibás lenne, ezért csak a törzs és a lábléc szerkezete kerül át; a
 * hívó adja a `display: flex; flex-direction: column` szülőt, amit a
 * forrásban a `.drawer` panel ad. A CSS a teljes forrással bájtra azonos.
 */
export function DrawerSections(properties: Readonly<DrawerSectionsProperties>): ReactElement {
  const { children, footer } = properties;

  return (
    <>
      <div className="drawer__body">{children}</div>
      {footer !== undefined && <div className="drawer__footer">{footer}</div>}
    </>
  );
}
