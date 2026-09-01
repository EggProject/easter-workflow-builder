import type { ReactElement, ReactNode } from 'react';
import './topnav-shell.css';

/**
 * A topnav shell váza (SPEC-007 5.1): a bar (brand, navigáció, akciók) és a
 * content (oldal fejléc plusz a képernyő) szerkezete. A komponens domain
 * mentes: nem tudja, mi a brand, milyen navigáció vagy milyen tartalom kerül
 * bele, kizárólag a design system osztályneveit adja a megfelelő helyre.
 */
export interface AppShellFrameProperties {
  readonly brand: ReactNode;
  readonly navigation: ReactNode;
  readonly actions: ReactNode;
  readonly pageTitle: ReactNode;
  readonly pageActions?: ReactNode;
  readonly children: ReactNode;
}

export function AppShellFrame(properties: AppShellFrameProperties): ReactElement {
  const { brand, navigation, actions, pageTitle, pageActions, children } = properties;

  return (
    <div className="app-tn">
      <div className="app-tn__bar">
        <div className="app-tn__brand">{brand}</div>
        <nav className="app-tn__navigation">{navigation}</nav>
        <div className="app-tn__actions">{actions}</div>
      </div>
      <div className="app-tn__main">
        <div className="app-tn__inner">
          <div className="app-pagehead">
            <div className="app-pagehead__top">
              <h1 className="app-pagehead__title">{pageTitle}</h1>
              {pageActions === undefined ? undefined : <div className="app-pagehead__actions">{pageActions}</div>}
            </div>
          </div>
          <div className="app-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
