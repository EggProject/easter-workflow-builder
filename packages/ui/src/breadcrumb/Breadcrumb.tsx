import type { MouseEvent, ReactElement } from 'react';
import './breadcrumb.css';

/**
 * Egy ős elem a morzsamenüben: mindig valódi, kattintható link (WAI-ARIA
 * APG Breadcrumb Pattern, https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/
 * - "Breadcrumb trail is contained within a navigation landmark region").
 */
export interface BreadcrumbAncestor {
  readonly label: string;
  readonly href: string;
  readonly onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

export interface BreadcrumbProperties {
  /**
   * A jelenlegi elem ELŐDEI, gyökértől a legközelebbiig. Üres lista esetén
   * (alapértelmezés) a `current` az egyetlen, ős nélküli elem - ugyanaz a
   * viselkedés, mint a forrás komponens "Single item" példája (a design
   * system `eggproject-design-components` skill `components/breadcrumb`
   * témája).
   */
  readonly ancestors?: readonly BreadcrumbAncestor[];
  /**
   * A jelenlegi oldal neve. Sosem link: a WAI-ARIA APG minta és a MDN
   * `aria-current` dokumentációja szerint az aktuális elem `aria-current="page"`
   * jelölésű, nem interaktív elem.
   */
  readonly current: string;
}

/**
 * A design system kész `breadcrumb` komponensének átemelt, TypeScript+TSX
 * alakja (`eggproject-design-components` skill, `components/breadcrumb/
 * Breadcrumb.jsx`). A hivatalos WAI-ARIA APG minta szerint VALÓDI rendezett
 * listával (`<ol>`/`<li>`) egészítve ki: a forrás JSX ezt kifejezetten NEM
 * adja (a komponens demó oldalának "Limits" szekciója szó szerint: "no
 * <ol>/<li> list semantics"), a hivatalos példa viszont igen - "The set of
 * links is structured using an ordered list"
 * (https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/examples/breadcrumb/,
 * megerősítve az MDN `aria-current` dokumentációjának `nav > ol > li > a`
 * mintájával is). Ez dokumentált, szándékos eltérés a forrástól - ugyanaz a
 * minta, mint a `resizable` téma Enter billentyű kiegészítése
 * (`packages/ui` CLAUDE.md).
 *
 * A forrás `separator`/`maxItems`/`icon`/`className` prop-jai és az
 * összecsukás (`…` ellipszis) nincs átemelve: az `apps/web` legfeljebb
 * kételemű morzsamenüi (elő plusz aktuális) miatt sem összecsukásra, sem
 * ikonra, sem elválasztó választásra nincs szükség - ugyanaz az elv, mint a
 * `select-field` vagy a `menu` téma szűkítésénél. A sík `items` tömb helyett
 * `ancestors`/`current` prop pár: az utolsó elem a forrásban href nélkül,
 * nem linkként rajzolódik ki, egy kötelező, de a rendereléskor figyelmen
 * kívül hagyott `href` mező helyett ez a forma típusszinten zárja ki a
 * soha nem futó ágat (`.claude/CLAUDE.md` 5. szekció, 100 százalékos,
 * kizárás nélküli ág lefedettség).
 */
export function Breadcrumb(properties: Readonly<BreadcrumbProperties>): ReactElement {
  const { ancestors = [], current } = properties;

  return (
    <nav className="breadcrumb" aria-label="Morzsamenü">
      <ol className="breadcrumb__list">
        {ancestors.map((ancestor) => (
          <li className="breadcrumb__listItem" key={ancestor.href}>
            <a className="breadcrumb__item" href={ancestor.href} onClick={ancestor.onClick}>
              {ancestor.label}
            </a>
            <span className="breadcrumb__separator" aria-hidden="true">
              /
            </span>
          </li>
        ))}
        <li className="breadcrumb__listItem">
          <span className="breadcrumb__item breadcrumb__item--current" aria-current="page">
            {current}
          </span>
        </li>
      </ol>
    </nav>
  );
}
