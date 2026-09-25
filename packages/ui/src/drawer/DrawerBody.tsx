import type { ReactElement, ReactNode } from 'react';
import './drawer.css';

export interface DrawerBodyProperties {
  /**
   * A görgethető törzs tartalma.
   */
  readonly children?: ReactNode;
}

/**
 * A design system `drawer` komponensének görgethető törzse
 * (`eggproject-design-components/components/drawer/Drawer.jsx`: `<div
 * className="drawer__body">{children}</div>`). A forrás CSS szerint önálló
 * szerkezet: `flex: 1`, `overflow-y: auto`, a flex oszlop szülőt a hívó adja,
 * amit a forrásban a `.drawer` panel ad.
 *
 * **Miért nem a `Drawer` egésze.** A forrás `Drawer` modális: `role="dialog"`
 * és `aria-modal="true"`, háttér réteg, fókusz csapda, a lap többi részét
 * `inert` és `aria-hidden` jelöléssel elszigeteli, a `body` görgetését
 * lezárja, és a CSS a panelt `position: fixed` alapon a képernyő széléhez
 * rögzíti. Egy a lap többi részével együtt használt, nem modális panelben ez
 * mind hibás lenne, ezért csak a törzs és a lábléc (`DrawerFooter.tsx`)
 * szerkezete kerül át. A kettő külön komponens (2026-09-25 óta, korábban
 * egy közös `DrawerSections`), mert a futás nézetben a törzs a húzható
 * elválasztó fölötti panelben, a lábléc azon kívül, a transcript alatt áll
 * (SPEC-008 8. szekció 1. pont). A CSS a teljes forrással bájtra azonos.
 */
export function DrawerBody(properties: Readonly<DrawerBodyProperties>): ReactElement {
  return <div className="drawer__body">{properties.children}</div>;
}
