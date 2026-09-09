import { useContext, type ReactElement, type ReactNode } from 'react';
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
 */
export function ResizablePanel(properties: Readonly<ResizablePanelProperties>): ReactElement {
  const { index, children } = properties;
  const { sizes, panelDomId } = useContext(ResizableContext);
  const size = sizes[index] ?? 0;

  return (
    <div
      className="resizable-panel"
      id={panelDomId(index)}
      style={{ flexBasis: `${String(size)}%`, flexGrow: 0, flexShrink: 0 }}
    >
      {children}
    </div>
  );
}
