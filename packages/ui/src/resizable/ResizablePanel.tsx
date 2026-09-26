import { useCallback, useContext, type ReactElement, type ReactNode } from 'react';
import { ResizableContext } from './resizable-context.ts';

export interface ResizablePanelProperties {
  /**
   * A panel sorszáma a befoglaló `Resizable` `defaultSizes` tömbjében.
   */
  readonly index: number;
  readonly children?: ReactNode;
}

/**
 * Egy `Resizable` egyetlen paneljét rajzolja ki, a mérete a befoglaló
 * kontextus `sizes[index]` értékéből jön `flex-basis`-ként. `Resizable`-n
 * kívül (pl. önálló tesztben) a no-op alapérték kontextus 0 százalékra esik
 * vissza, hibadobás nélkül.
 *
 * **Eltérés a forrástól: `flex-shrink: 1` a forrás `0` értéke helyett**
 * (2026-09-25, SPEC-008 14.2 O-10). A forrás panelei a 100 százalékon felül
 * az 5 pixeles elválasztót is elfoglalták, a csoport 5 pixellel túllógott, és
 * a csoport `overflow: hidden` szabálya levágta (a forrás saját
 * `resizable.html` demójában is, mérve 4,98 pixel): a futás nézetben a
 * transcript oldal jobb szélét, a jóváhagyás felület jobb belső térköze ezért
 * volt 19 pixel a bal 24 helyett. Zsugorodó panelekkel a túllógást a
 * panelek a `flex-basis` méretük arányában adják le (CSS Flexbox 9.7:
 * "scaled flex shrink factor" = a zsugorodási tényező szorozva a belső
 * `flex-basis` mérettel), tehát a két panel aránya pontosan a százalék
 * marad; egy panel a pixeles minimuma alá nem zsugorodik, ilyenkor a másik
 * adja le a helyet (a "min violation" befagyasztás), ahelyett, hogy a csoport
 * túllógna.
 */
export function ResizablePanel(properties: Readonly<ResizablePanelProperties>): ReactElement {
  const { index, children } = properties;
  const { sizes, panelDomId, registerPanel } = useContext(ResizableContext);
  const size = sizes[index] ?? 0;
  // Stabil ref visszahívás: egy minden renderen új függvényt a React minden
  // renderen `null`, majd újra az elem értékkel hívna.
  const panelReference = useCallback(
    (element: HTMLDivElement | null): void => {
      registerPanel(index, element);
    },
    [registerPanel, index],
  );

  return (
    <div
      ref={panelReference}
      className="resizable-panel"
      id={panelDomId(index)}
      style={{ flexBasis: `${String(size)}%`, flexGrow: 0, flexShrink: 1 }}
    >
      {children}
    </div>
  );
}
