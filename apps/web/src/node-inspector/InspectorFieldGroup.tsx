import { useId, type ReactElement, type ReactNode } from 'react';
import './node-inspector.css';

export interface InspectorFieldGroupProperties {
  /**
   * A csoport címe; egyben a mezőcsoport hozzáférhető neve.
   */
  readonly title: string;
  readonly children: ReactNode;
}

/**
 * A beállítás panel egy megnevezett mezőcsoportja, DOBOZ NÉLKÜL.
 *
 * MI VÁLTOZOTT, ÉS MIÉRT. A korábbi `InspectorSection` kártya alakú dobozt
 * rajzolt (szegély, lekerekítés, saját háttér), ráadásul nem a design
 * system `.card` osztályával, hanem egy attól eltérő tokenkombinációjú,
 * kitalált `.inspector-section` osztállyal
 * (`docs/research/2026-09-08-design-system-audit.md` 6. szekció). A panel
 * viszont már eleve egy kártya alakú `.resizable-group` belsejében ül,
 * tehát minden ilyen doboz card in card volt - amit a felhasználó
 * kifejezetten tiltott -, és a doboz saját belső térköze a mezők közötti
 * térközzel dupla eltartást adott. A csoport ezért ma **tisztán elrendezés**
 * (egy flex oszlop token térközzel) plusz a design system saját
 * `.field__label` címkéje, kártya chrome nélkül.
 *
 * A HOZZÁFÉRHETŐSÉG NEM VÁLTOZOTT: a csoport továbbra is a `fieldset`/
 * `legend` párral azonos szemantikát kap, `role="group"` plusz
 * `aria-labelledby` alakban, ami a W3C WAI hivatalos, dokumentált
 * alternatívája:
 *
 * - WAI Forms Tutorial, "Grouping Controls":
 *   <https://www.w3.org/WAI/tutorials/forms/grouping/> - "WAI-ARIA provides
 *   a grouping role that functions similarly to `fieldset` and `legend`.
 *   [...] the `div` element has `role=group` [...] and the `aria-labelledby`
 *   attribute references the `id` for text that will serve as the label for
 *   the group. This technique provides additional styling possibilities."
 * - WCAG 2.2 technika ARIA17, "Using grouping roles to identify related form
 *   controls": <https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA17>
 *
 * A cím `<h3>` helyett `<span class="field__label">`: a több mezőt kitevő,
 * ÖNÁLLÓ szakaszok ma `AccordionItem` panelek, és a fejlécük már natív
 * `<h3>` (lásd `packages/ui` `accordion` téma), tehát a dokumentum fejléc
 * vázát azok adják. Ez a csoport ennél kisebb egység (egy jelölőnégyzet
 * lista, egy `agents` bejegyzés), aminek a panel többi, csak olvasható
 * `.field` blokkjával azonos, halkabb címke illik.
 */
export function InspectorFieldGroup(properties: Readonly<InspectorFieldGroupProperties>): ReactElement {
  const { title, children } = properties;
  const titleId = useId();

  return (
    <div className="node-inspector__group" role="group" aria-labelledby={titleId}>
      <span className="field__label" id={titleId}>
        {title}
      </span>
      {children}
    </div>
  );
}
