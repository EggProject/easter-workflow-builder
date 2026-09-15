import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import './page-footer.css';

export interface PageFooterProperties extends HTMLAttributes<HTMLDivElement> {
  /**
   * A bal oldali sáv tartalma: állapot, mentetlen jelző, hibaüzenet. A
   * komponens nem tudja, mi kerül ide, a szerepköröket (`role="status"`,
   * `role="alert"`) a hívó adja a saját elemein.
   */
  readonly status: ReactNode;
  /**
   * A jobb oldali sáv tartalma: a művelet gombok (jellemzően egy
   * `ButtonGroup`).
   */
  readonly children: ReactNode;
}

/**
 * A képernyő aljához tapadó akciósáv: balra a státusz, jobbra a gombok
 * (felhasználói kérés, 2026-09-09).
 *
 * **Ez nem a design system átemelt eleme.** Ilyen minta a négy
 * `eggproject-design*` skill egyikében sincs; a `page-footer.css` fejléce
 * részletezi, melyik két létező receptből (`.app-tn__bar` ragadós sáv,
 * `.modal__footer--split` szerkezet) áll össze, és hogy minden érték a
 * design system tokenje. A hiányt a 2026-09-08-i audit tételesen
 * kimondja (`docs/research/2026-09-08-design-system-audit.md` 5.4, 8.1).
 *
 * A gyökér szándékosan `<div>`, nem `<footer>`: sectioning root ősként
 * csak a `<body>` áll fölötte (`AppShellFrame` nem ad `<main>` elemet),
 * ott pedig a `<footer>` a `contentinfo` landmarkra képződne, ami az
 * oldal egészének lábjegyzetét jelenti, nem egy képernyő művelet sávját.
 */
export function PageFooter(properties: Readonly<PageFooterProperties>): ReactElement {
  const { status, className, children, ...rest } = properties;

  return (
    <div className={joinClassNames('page-footer', className)} {...rest}>
      <div className="page-footer__status">{status}</div>
      <div className="page-footer__actions">{children}</div>
    </div>
  );
}
