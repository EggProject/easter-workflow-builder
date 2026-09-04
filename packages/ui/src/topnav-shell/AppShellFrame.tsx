import type { ReactElement, ReactNode } from 'react';
// A `--ep-*` design-token változókat DEFINIÁLÓ barrel: minden komponens CSS
// csak HASZNÁLJA ezeket (pl. topnav-shell.css: `background:var(--ep-bg-sunken)`),
// de a definíciót (`:root`, `[data-theme="dark"]`) semmi más nem importálja
// (packages/ui CLAUDE.md "Nyitott pont" - most lezárva). Az `AppShellFrame` a
// legkülső, minden alkalmazás-összeszerelésben garantáltan jelen lévő
// komponens, ezért itt, a `src/index.ts` barrel helyett (SPEC-007 16.
// szekció 5. kritérium: a barrel kizárólag nevesített újraexportot tartalmazhat).
import '../design-token/colors-and-type.css';
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
  /**
   * A --ep-screen-md alatt lenyíló menüvé váló navigáció nyitottsága
   * (SPEC-007 5.3). A komponens az állapotot nem tárolja, csak a
   * topnav-shell.css data-navigation-open szelektorába vezeti át; a
   * tényleges nyitás/zárás a hívó (app szintű) felelőssége.
   */
  readonly isNavigationMenuOpen?: boolean;
}

export function AppShellFrame(properties: AppShellFrameProperties): ReactElement {
  const { brand, navigation, actions, pageTitle, pageActions, children, isNavigationMenuOpen } = properties;

  return (
    <div className="app-tn" data-navigation-open={isNavigationMenuOpen ?? false}>
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
