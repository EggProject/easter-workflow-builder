import { useId, type ReactElement, type ReactNode } from 'react';

export interface InspectorSectionProperties {
  /**
   * A szakasz címe; egyben a mezőcsoport hozzáférhető neve.
   */
  readonly title: string;
  readonly children: ReactNode;
}

/**
 * A beállítás panel egy mezőcsoportja, saját címmel.
 *
 * MIÉRT NEM `fieldset` és `legend`: a `legend` a szegélybe rajzolódó,
 * böngészőnként eltérően elhelyezett elem, aminek a doboz belső térközét és
 * a szélességét nem lehet megbízhatóan vezérelni - a panel korábbi alakjában
 * pontosan ez okozta az egymásra csúszó mezőket és a szakaszcím
 * olvashatatlanságát. A design system maga sem `fieldset`-tel tagolja a
 * több szakaszos űrlapjait, hanem kártya alakú szakasszal, saját fejléccel
 * (`eggproject-design-admin-app-examples/examples/settings.html`,
 * `.card`/`.card__header`).
 *
 * A HOZZÁFÉRHETŐSÉG NEM SÉRÜL, mert a csoport a `fieldset`/`legend` PÁRRAL
 * AZONOS szemantikát kap: `role="group"` plusz `aria-labelledby`, ami a
 * szakasz címére mutat. Ez a W3C WAI hivatalos, dokumentált alternatívája:
 *
 * - WAI Forms Tutorial, "Grouping Controls":
 *   <https://www.w3.org/WAI/tutorials/forms/grouping/> - "WAI-ARIA provides
 *   a grouping role that functions similarly to `fieldset` and `legend`.
 *   [...] the `div` element has `role=group` [...] and the `aria-labelledby`
 *   attribute references the `id` for text that will serve as the label for
 *   the group. This technique provides additional styling possibilities."
 * - WCAG 2.2 technika ARIA17, "Using grouping roles to identify related form
 *   controls": <https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA17> - "This
 *   is a viable alternative for grouping form controls programmatically when
 *   the user interface's design makes it difficult to employ the
 *   `fieldset`/`legend` technique (H71)."
 * - MDN, ARIA `group` role:
 *   <https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/group_role>
 *
 * Az ARIA17 egyetlen megkötése is teljesül: rádiógomb csoportra
 * `role="radiogroup"` kellene, a panelen viszont nincs rádiógomb, csak
 * jelölőnégyzet és szöveges mező. A `role` a hozzáférhetőségi fában
 * ugyanazt a `group` szerepet adja, mint a `fieldset`, tehát a
 * `getByRole('group', { name })` lekérdezések változatlanul találnak.
 *
 * A cím `<h3>`, nem `<div>`: a panelt egy `<h2>` fejléc nyitja, tehát a
 * szakaszcímek a következő szinten állnak, és a képernyőolvasó fejléc
 * navigációja is végigjárja őket.
 */
export function InspectorSection(properties: Readonly<InspectorSectionProperties>): ReactElement {
  const { title, children } = properties;
  const titleId = useId();

  return (
    <div className="inspector-section" role="group" aria-labelledby={titleId}>
      <h3 className="inspector-section__title" id={titleId}>
        {title}
      </h3>
      <div className="inspector-section__fields">{children}</div>
    </div>
  );
}
