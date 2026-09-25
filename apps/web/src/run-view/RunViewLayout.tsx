import { Resizable, ResizableHandle, ResizablePanel, Tabs } from '@easter-workflow-builder/ui';
import { useState, type ReactElement, type ReactNode } from 'react';
import type { RunViewLayoutBand } from './run-view-layout-band.ts';
import { RunViewTranscriptVisibility } from './run-view-transcript-visibility.ts';

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
  /**
   * Mozdulhat-e a gráf és a transcript közti elválasztó egy függő jóváhagyás
   * kedvéért (nincs saját arány, `is-own-layout-sizes.ts`). A függőleges
   * sávban a transcript oldal belső csoportja innen kér helyet, a rajz
   * rovására (`Resizable` `adjustsForReveal`, SPEC-008 8. szekció 1. pont); a
   * vízszintes sávban a kérés más tengelyű, ezért ez az elválasztó nem mozdul.
   */
  readonly adjustsForReveal: boolean;
}

const GRAPH_TAB_LABEL = 'Gráf';
const TRANSCRIPT_TAB_LABEL = 'Transcript';
const GRAPH_TAB_ID = 'graph';
const TRANSCRIPT_TAB_ID = 'transcript';

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
  const { band, graph, transcript, defaultSizes, onSizesChange, adjustsForReveal } = properties;

  // A fül sáv aktív füle: a transcript oldal csak a "Transcript" fülön
  // látszik, és ezt a `RunViewTranscriptVisibility` viszi le a jóváhagyás
  // felfedéséhez. A `Tabs` nem kontrollált marad (a sávváltáskor újra
  // csatolódó fülsor a "Gráf" fülön indul, mint eddig); az `onChange` csak
  // jelez, és a sáv elhagyásakor az érték a "Gráf" fülre áll vissza, hogy a
  // visszaváltás után a kettő egyezzen.
  const [activeTabId, setActiveTabId] = useState(GRAPH_TAB_ID);
  const [renderedBand, setRenderedBand] = useState(band);
  if (band !== renderedBand) {
    setRenderedBand(band);
    setActiveTabId(GRAPH_TAB_ID);
  }

  const graphSide = <div className="run-view-screen__graph">{graph}</div>;
  const transcriptSide = <div className="run-view-screen__transcript">{transcript}</div>;

  if (band === 'tabs') {
    return (
      <Tabs
        aria-label="Futás nézet"
        onChange={setActiveTabId}
        items={[
          { id: GRAPH_TAB_ID, label: GRAPH_TAB_LABEL, content: graphSide },
          {
            id: TRANSCRIPT_TAB_ID,
            label: TRANSCRIPT_TAB_LABEL,
            content: (
              <RunViewTranscriptVisibility value={activeTabId === TRANSCRIPT_TAB_ID}>
                {transcriptSide}
              </RunViewTranscriptVisibility>
            ),
          },
        ]}
      />
    );
  }

  return (
    <Resizable
      direction={band}
      defaultSizes={defaultSizes}
      onSizesChange={onSizesChange}
      adjustsForReveal={adjustsForReveal}
    >
      <ResizablePanel index={0}>{graphSide}</ResizablePanel>
      <ResizableHandle beforeIndex={0} aria-label={`A ${GRAPH_TAB_LABEL} és a ${TRANSCRIPT_TAB_LABEL} aránya`} />
      <ResizablePanel index={1}>{transcriptSide}</ResizablePanel>
    </Resizable>
  );
}
