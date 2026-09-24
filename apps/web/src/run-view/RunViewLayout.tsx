import { Resizable, ResizableHandle, ResizablePanel, Tabs } from '@easter-workflow-builder/ui';
import type { ReactElement, ReactNode } from 'react';
import type { RunViewLayoutBand } from './run-view-layout-band.ts';

export interface RunViewLayoutProperties {
  readonly band: RunViewLayoutBand;
  readonly graph: ReactNode;
  readonly transcript: ReactNode;
  /**
   * A két panel kezdő aránya százalékban. A `Resizable` ezt kizárólag a saját
   * kezdő állapotához használja, a perzisztálás a hívó dolga
   * (`run-view-layout.ts`).
   */
  readonly defaultSizes: readonly number[];
  readonly onSizesChange: (sizes: readonly number[]) => void;
}

const GRAPH_TAB_LABEL = 'Gráf';
const TRANSCRIPT_TAB_LABEL = 'Transcript';

/**
 * A futás nézet elrendezése a három reszponzív sáv szerint (SPEC-008 10.,
 * AC33, AC34). A sáv kiválasztása NEM itt történik: a `band` propként jön a
 * `useRunViewLayoutBand` hookból, hogy mindhárom sáv elrendezése a
 * `matchMedia` bekötésétől függetlenül tesztelhető legyen.
 *
 * - `horizontal` (`--ep-screen-lg` és fölötte): a gráf és a transcript egymás
 *   mellett, FÜGGŐLEGES húzható elválasztóval.
 * - `vertical` (`--ep-screen-md` és a `--ep-screen-lg` között): egymás alatt,
 *   VÍZSZINTES húzható elválasztóval. A `Resizable` `direction` propja az
 *   elválasztó `aria-orientation` értékét is átállítja.
 * - `tabs` (`--ep-screen-md` alatt): `Tabs` komponens két füllel, egyszerre
 *   egy nézet, elválasztó nélkül. A `Tabs` mindkét panelt felcsatolva tartja
 *   (a natív `hidden` rejti az inaktívat), tehát a fülváltás nem szereli le a
 *   vásznat.
 */
export function RunViewLayout(properties: Readonly<RunViewLayoutProperties>): ReactElement {
  const { band, graph, transcript, defaultSizes, onSizesChange } = properties;

  const graphSide = <div className="run-view-screen__graph">{graph}</div>;
  const transcriptSide = <div className="run-view-screen__transcript">{transcript}</div>;

  if (band === 'tabs') {
    return (
      <Tabs
        aria-label="Futás nézet"
        items={[
          { id: 'graph', label: GRAPH_TAB_LABEL, content: graphSide },
          { id: 'transcript', label: TRANSCRIPT_TAB_LABEL, content: transcriptSide },
        ]}
      />
    );
  }

  return (
    <Resizable direction={band} defaultSizes={defaultSizes} onSizesChange={onSizesChange}>
      <ResizablePanel index={0}>{graphSide}</ResizablePanel>
      <ResizableHandle beforeIndex={0} aria-label={`A ${GRAPH_TAB_LABEL} és a ${TRANSCRIPT_TAB_LABEL} aránya`} />
      <ResizablePanel index={1}>{transcriptSide}</ResizablePanel>
    </Resizable>
  );
}
