import { useId, useState, type ReactElement, type ReactNode } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import './accordion.css';

export interface AccordionItemProperties {
  /**
   * A panel fejlécének tartalma; a szövege egyben a nyitott panel
   * hozzáférhető neve (`role="region"` plusz `aria-labelledby`). A forrás
   * `Accordion.jsx` a `title` értékét típus nélkül, csomópontként rajzolja,
   * ezért nem csak szöveg lehet: a transcript sor a meta darabjait külön
   * elemben adja át (`apps/web` `run-event-row`, user döntés 2026-09-24).
   */
  readonly title: ReactNode;
  /**
   * Opcionális jelölő a fejléc bal szélén, a forrás `.accordion__icon`
   * szlotjában: 18x18-as, `flex-shrink: 0` doboz, tehát minden sorban
   * ugyanolyan széles oszlopot ad. A jelölő hozzáférhetőségéről (pl.
   * `aria-hidden` az SVG-n) a hívó dönt, ahogy a forrásban is.
   */
  readonly icon?: ReactNode;
  /**
   * Opcionális, jobb oldali kiegészítő szöveg a cím után (darabszám,
   * állapot), a forrás `.accordion__meta` szlotjában.
   */
  readonly meta?: ReactNode;
  /**
   * Nyitva induljon-e a panel. Alapértéke `false`: a ritkán szerkesztett
   * mezők zárva indulnak, ez az egész téma bevezetésének oka.
   */
  readonly defaultOpen?: boolean;
  readonly children: ReactNode;
}

/**
 * Egy összecsukható panel a `.accordion` listában.
 *
 * SZEMANTIKA, a forrás `Accordion.jsx` szerint, változatlanul: a fejléc egy
 * natív `<h3>` fejlécbe ágyazott natív `<button>`, `aria-expanded` és
 * `aria-controls` attribútummal; a törzs `role="region"` szerepű, a
 * fejlécre mutató `aria-labelledby` névvel, és a natív `hidden`
 * attribútummal tűnik el. A natív gomb miatt a nyitás és a zárás
 * BILLENTYŰZETRŐL is működik (`Enter` és `Space`), külön kezelő nélkül.
 * A fejléc sorrendje is a forrásé: `icon`, cím, `meta`, chevron; az `icon`
 * és a `meta` szlot csak akkor kerül a DOM-ba, ha a hívó átadja.
 *
 * A nyitottságot a panel MAGA tartja, nem a szülő `Accordion`: így a
 * forrás `cloneElement` alapú, aláhúzással kezdődő privát propjai
 * elhagyhatók (azok típusbiztosan csak `as` kényszerítéssel írhatók le,
 * amit a projekt tilt), és minden panel egymástól függetlenül nyitható.
 */
export function AccordionItem(properties: Readonly<AccordionItemProperties>): ReactElement {
  const { title, icon, meta, defaultOpen = false, children } = properties;
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const automaticId = useId();
  const triggerId = `${automaticId}-trigger`;
  const panelId = `${automaticId}-panel`;

  return (
    <div className={joinClassNames('accordion__item', isOpen && 'is-open')}>
      <h3 className="accordion__heading">
        <button
          type="button"
          id={triggerId}
          className="accordion__header"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => {
            setIsOpen((currentIsOpen) => !currentIsOpen);
          }}
        >
          {icon === undefined ? undefined : <span className="accordion__icon">{icon}</span>}
          <span className="accordion__title">{title}</span>
          {meta === undefined ? undefined : <span className="accordion__meta">{meta}</span>}
          <svg
            className="accordion__chevron"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="m4 6 4 4 4-4" />
          </svg>
        </button>
      </h3>
      <div className="accordion__body" id={panelId} role="region" aria-labelledby={triggerId} hidden={!isOpen}>
        {children}
      </div>
    </div>
  );
}
